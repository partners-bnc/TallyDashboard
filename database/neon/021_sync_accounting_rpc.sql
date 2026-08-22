-- Atomic accounting ingestion for authenticated Neon Data API clients.
-- The public function is the only exposed write surface. Tenant identifiers
-- are derived from auth.uid(); no org_id or company_id is accepted from clients.

CREATE SCHEMA IF NOT EXISTS tallybridge_private;
REVOKE ALL ON SCHEMA tallybridge_private FROM PUBLIC, anonymous, authenticated;

CREATE OR REPLACE FUNCTION tallybridge_private.tb_sync_accounting_data(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, public, tallybridge_private, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_company_id uuid;
  v_company_guid text;
  v_memberships integer;
  v_company_existed boolean;
  v_started_at timestamptz := clock_timestamp();
  v_key text;
  v_limit integer;
  v_count integer;
  v_prior integer;
  v_expected integer;
  v_baseline date;
  v_preserve_snapshots boolean := false;
  v_earliest date;
  v_latest date;
  v_groups jsonb := '[]'::jsonb;
  v_ledgers jsonb := '[]'::jsonb;
  v_vouchers jsonb := '[]'::jsonb;
  v_entries jsonb := '[]'::jsonb;
  v_bill_allocations jsonb := '[]'::jsonb;
  v_cost_allocations jsonb := '[]'::jsonb;
  v_deletes jsonb := '{}'::jsonb;
  v_result jsonb := jsonb_build_object(
    'companies', jsonb_build_object('created', 0, 'updated', 0),
    'groups', jsonb_build_object('created', 0, 'updated', 0, 'deleted', 0),
    'ledgers', jsonb_build_object('created', 0, 'updated', 0, 'deleted', 0),
    'vouchers', jsonb_build_object('created', 0, 'updated', 0, 'deleted', 0),
    'entries', jsonb_build_object('created', 0, 'updated', 0)
  );
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication is required';
  END IF;
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Payload must be a JSON object';
  END IF;
  IF octet_length(payload::text) > 8 * 1024 * 1024 THEN
    RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'Payload exceeds the 8 MB limit';
  END IF;

  SELECT count(*), min(org_id::text)::uuid
  INTO v_memberships, v_org_id
  FROM public.tb_org_members
  WHERE user_id = v_user_id;
  IF v_memberships <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = CASE WHEN v_memberships = 0 THEN 'User is not a TallyBridge member'
                     ELSE 'User belongs to multiple organizations' END;
  END IF;

  IF jsonb_typeof(payload->'company') <> 'object'
     OR jsonb_typeof(payload->'company'->'tallyGuid') <> 'string'
     OR length(btrim(payload->'company'->>'tallyGuid')) NOT BETWEEN 1 AND 255
     OR jsonb_typeof(payload->'company'->'name') <> 'string'
     OR length(btrim(payload->'company'->>'name')) NOT BETWEEN 1 AND 512 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Company tallyGuid and name are required';
  END IF;
  v_company_guid := btrim(payload->'company'->>'tallyGuid');

  FOR v_key, v_limit IN
    SELECT * FROM (VALUES
      ('groups', 5000), ('ledgers', 5000), ('voucherHeaders', 5000),
      ('voucherLedgerEntries', 20000), ('billAllocations', 50000),
      ('costCentreAllocations', 50000)
    ) AS limits(key, max_items)
  LOOP
    IF payload ? v_key AND jsonb_typeof(payload->v_key) <> 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('%s must be an array', v_key);
    END IF;
    IF jsonb_array_length(coalesce(payload->v_key, '[]'::jsonb)) > v_limit THEN
      RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = format('%s exceeds its item limit', v_key);
    END IF;
  END LOOP;

  v_groups := coalesce(payload->'groups', '[]'::jsonb);
  v_ledgers := coalesce(payload->'ledgers', '[]'::jsonb);
  v_vouchers := coalesce(payload->'voucherHeaders', '[]'::jsonb);
  v_entries := coalesce(payload->'voucherLedgerEntries', '[]'::jsonb);
  v_bill_allocations := coalesce(payload->'billAllocations', '[]'::jsonb);
  v_cost_allocations := coalesce(payload->'costCentreAllocations', '[]'::jsonb);
  v_deletes := coalesce(payload->'deletes', '{}'::jsonb);

  IF jsonb_typeof(v_deletes) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'deletes must be an object';
  END IF;
  FOR v_key, v_limit IN SELECT * FROM (VALUES ('groups', 5000), ('ledgers', 5000), ('vouchers', 5000)) AS limits(key, max_items)
  LOOP
    IF v_deletes ? v_key AND jsonb_typeof(v_deletes->v_key) <> 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('deletes.%s must be an array', v_key);
    END IF;
    IF jsonb_array_length(coalesce(v_deletes->v_key, '[]'::jsonb)) > v_limit
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(v_deletes->v_key, '[]'::jsonb)) item
                  WHERE jsonb_typeof(item) <> 'string' OR length(btrim(item #>> '{}')) = 0) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('deletes.%s is invalid', v_key);
    END IF;
  END LOOP;

  -- Validate required child fields and reject tenant confusion before writes.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_groups || v_ledgers) item
    WHERE jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item->'tallyCompanyGuid') <> 'string'
       OR item->>'tallyCompanyGuid' <> v_company_guid
       OR jsonb_typeof(item->'tallyGuid') <> 'string' OR length(btrim(item->>'tallyGuid')) = 0
       OR jsonb_typeof(item->'name') <> 'string' OR length(btrim(item->>'name')) = 0
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Group or ledger identity is invalid or belongs to another company';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_vouchers) item
    WHERE jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item->'tallyCompanyGuid') <> 'string' OR item->>'tallyCompanyGuid' <> v_company_guid
       OR jsonb_typeof(item->'tallyGuid') <> 'string' OR length(btrim(item->>'tallyGuid')) = 0
       OR jsonb_typeof(item->'voucherDate') <> 'string' OR (item->>'voucherDate') !~ '^\d{4}-\d{2}-\d{2}$'
       OR jsonb_typeof(item->'voucherType') <> 'string' OR length(btrim(item->>'voucherType')) = 0
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Voucher identity, date, or type is invalid or belongs to another company';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_entries) item
    WHERE jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item->'tallyCompanyGuid') <> 'string' OR item->>'tallyCompanyGuid' <> v_company_guid
       OR jsonb_typeof(item->'voucherGuid') <> 'string' OR length(btrim(item->>'voucherGuid')) = 0
       OR jsonb_typeof(item->'lineNumber') <> 'number' OR (item->>'lineNumber')::numeric < 0
       OR trunc((item->>'lineNumber')::numeric) <> (item->>'lineNumber')::numeric
       OR jsonb_typeof(item->'ledgerName') <> 'string' OR length(btrim(item->>'ledgerName')) = 0
       OR jsonb_typeof(item->'amount') <> 'number'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Voucher entry is invalid or belongs to another company';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_bill_allocations || v_cost_allocations) item
    WHERE jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item->'tallyCompanyGuid') <> 'string' OR item->>'tallyCompanyGuid' <> v_company_guid
       OR jsonb_typeof(item->'voucherGuid') <> 'string' OR length(btrim(item->>'voucherGuid')) = 0
       OR jsonb_typeof(item->'lineNumber') <> 'number' OR (item->>'lineNumber')::numeric < 0
       OR trunc((item->>'lineNumber')::numeric) <> (item->>'lineNumber')::numeric
       OR jsonb_typeof(item->'amount') <> 'number'
       OR NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(v_entries) entry
         WHERE entry->>'voucherGuid' = item->>'voucherGuid'
           AND entry->>'lineNumber' = item->>'lineNumber'
       )
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_cost_allocations) item
    WHERE jsonb_typeof(item->'costCentreName') <> 'string' OR length(btrim(item->>'costCentreName')) = 0
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Allocation is invalid or does not reference an entry in this payload';
  END IF;

  IF payload ? 'reconciliation' AND (
    jsonb_typeof(payload->'reconciliation') <> 'object'
    OR jsonb_typeof(payload->'reconciliation'->'baselineDate') <> 'string'
    OR (payload->'reconciliation'->>'baselineDate') !~ '^\d{4}-\d{2}-\d{2}$'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'reconciliation.baselineDate is invalid';
  END IF;
  IF payload ? 'verification' AND (
    jsonb_typeof(payload->'verification') <> 'object'
    OR jsonb_typeof(payload->'verification'->'asOfDate') <> 'string'
    OR (payload->'verification'->>'asOfDate') !~ '^\d{4}-\d{2}-\d{2}$'
    OR jsonb_typeof(payload->'verification'->'rows') <> 'array'
    OR jsonb_array_length(payload->'verification'->'rows') NOT BETWEEN 1 AND 100
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(payload->'verification'->'rows') row
      WHERE jsonb_typeof(row) <> 'object'
         OR jsonb_typeof(row->'name') <> 'string' OR length(btrim(row->>'name')) = 0
         OR jsonb_typeof(row->'debitBalance') <> 'number'
         OR jsonb_typeof(row->'creditBalance') <> 'number'
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'verification is invalid';
  END IF;

  -- Match the desktop contract's last-write-wins identity semantics. This also
  -- prevents one INSERT ... ON CONFLICT statement from touching a row twice.
  SELECT coalesce(jsonb_agg(item ORDER BY ord), '[]'::jsonb) INTO v_groups
  FROM (
    SELECT DISTINCT ON (item->>'tallyGuid') item, ord
    FROM jsonb_array_elements(v_groups) WITH ORDINALITY source(item,ord)
    ORDER BY item->>'tallyGuid',ord DESC
  ) unique_items;
  SELECT coalesce(jsonb_agg(item ORDER BY ord), '[]'::jsonb) INTO v_ledgers
  FROM (
    SELECT DISTINCT ON (item->>'tallyGuid') item, ord
    FROM jsonb_array_elements(v_ledgers) WITH ORDINALITY source(item,ord)
    ORDER BY item->>'tallyGuid',ord DESC
  ) unique_items;
  SELECT coalesce(jsonb_agg(item ORDER BY ord), '[]'::jsonb) INTO v_vouchers
  FROM (
    SELECT DISTINCT ON (item->>'tallyGuid') item, ord
    FROM jsonb_array_elements(v_vouchers) WITH ORDINALITY source(item,ord)
    ORDER BY item->>'tallyGuid',ord DESC
  ) unique_items;
  SELECT coalesce(jsonb_agg(item ORDER BY ord), '[]'::jsonb) INTO v_entries
  FROM (
    SELECT DISTINCT ON (item->>'voucherGuid',(item->>'lineNumber')::integer) item, ord
    FROM jsonb_array_elements(v_entries) WITH ORDINALITY source(item,ord)
    ORDER BY item->>'voucherGuid',(item->>'lineNumber')::integer,ord DESC
  ) unique_items;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':' || v_company_guid, 0));

  SELECT EXISTS (
    SELECT 1 FROM public.tb_companies WHERE org_id = v_org_id AND tally_company_guid = v_company_guid
  ) INTO v_company_existed;
  INSERT INTO public.tb_companies (
    org_id, tally_company_guid, name, alter_id, master_id, starting_from, books_from, country, state,
    phone, email, company_number, last_seen_at, last_successful_sync_at, last_sync_status, last_sync_error, updated_at
  ) VALUES (
    v_org_id, v_company_guid, btrim(payload->'company'->>'name'),
    (payload->'company'->>'alterId')::bigint, (payload->'company'->>'masterId')::bigint,
    (payload->'company'->>'startingFrom')::date, (payload->'company'->>'booksFrom')::date,
    payload->'company'->>'country', payload->'company'->>'state', payload->'company'->>'phone',
    payload->'company'->>'email', payload->'company'->>'companyNumber', now(), now(), 'success', null, now()
  )
  ON CONFLICT (org_id, tally_company_guid) DO UPDATE SET
    name=excluded.name, alter_id=excluded.alter_id, master_id=excluded.master_id,
    starting_from=excluded.starting_from, books_from=excluded.books_from, country=excluded.country,
    state=excluded.state, phone=excluded.phone, email=excluded.email, company_number=excluded.company_number,
    last_seen_at=now(), last_successful_sync_at=now(), last_sync_status='success', last_sync_error=null, updated_at=now()
  RETURNING id INTO v_company_id;
  v_result := jsonb_set(v_result, '{companies}', jsonb_build_object(
    'created', CASE WHEN v_company_existed THEN 0 ELSE 1 END,
    'updated', CASE WHEN v_company_existed THEN 1 ELSE 0 END
  ));

  WITH items AS (
    SELECT DISTINCT ON (item->>'tallyGuid') item
    FROM jsonb_array_elements(v_groups) WITH ORDINALITY source(item, ord)
    ORDER BY item->>'tallyGuid', ord DESC
  )
  SELECT count(*) INTO v_prior FROM public.tb_ledger_groups existing
  JOIN items ON items.item->>'tallyGuid' = existing.tally_guid
  WHERE existing.company_id = v_company_id;
  WITH items AS (
    SELECT DISTINCT ON (item->>'tallyGuid') item
    FROM jsonb_array_elements(v_groups) WITH ORDINALITY source(item, ord)
    ORDER BY item->>'tallyGuid', ord DESC
  )
  INSERT INTO public.tb_ledger_groups (org_id,company_id,tally_guid,alter_id,master_id,name,parent_name,is_deleted,synced_at,updated_at)
  SELECT v_org_id,v_company_id,item->>'tallyGuid',(item->>'alterId')::bigint,(item->>'masterId')::bigint,
    item->>'name',item->>'parentName',coalesce((item->>'isDeleted')::boolean,false),now(),now()
  FROM items
  ON CONFLICT (company_id,tally_guid) DO UPDATE SET alter_id=excluded.alter_id,master_id=excluded.master_id,
    name=excluded.name,parent_name=excluded.parent_name,is_deleted=excluded.is_deleted,synced_at=now(),updated_at=now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{groups,created}', to_jsonb(v_count-v_prior));
  v_result := jsonb_set(v_result, '{groups,updated}', to_jsonb(v_prior));
  UPDATE public.tb_ledger_groups child SET parent_group_id=parent.id
  FROM jsonb_array_elements(v_groups) item
  JOIN public.tb_ledger_groups parent ON parent.company_id=v_company_id AND
    (parent.tally_guid=item->>'parentGroupGuid' OR
     (nullif(item->>'parentGroupGuid','') IS NULL AND parent.name=item->>'parentName'))
  WHERE child.company_id=v_company_id AND child.tally_guid=item->>'tallyGuid';
  UPDATE public.tb_ledger_groups SET is_deleted=true,synced_at=now(),updated_at=now()
  WHERE company_id=v_company_id AND tally_guid IN (
    SELECT DISTINCT value #>> '{}' FROM jsonb_array_elements(coalesce(v_deletes->'groups','[]'::jsonb)) value
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{groups,deleted}', to_jsonb(v_count));

  WITH items AS (
    SELECT DISTINCT ON (item->>'tallyGuid') item FROM jsonb_array_elements(v_ledgers) WITH ORDINALITY source(item,ord)
    ORDER BY item->>'tallyGuid',ord DESC
  )
  SELECT count(*) INTO v_prior FROM public.tb_ledgers existing JOIN items ON items.item->>'tallyGuid'=existing.tally_guid
  WHERE existing.company_id=v_company_id;
  WITH items AS (
    SELECT DISTINCT ON (item->>'tallyGuid') item FROM jsonb_array_elements(v_ledgers) WITH ORDINALITY source(item,ord)
    ORDER BY item->>'tallyGuid',ord DESC
  )
  INSERT INTO public.tb_ledgers (org_id,company_id,tally_guid,alter_id,master_id,name,parent_name,opening_balance,closing_balance,is_deleted,source_hash,synced_at,updated_at)
  SELECT v_org_id,v_company_id,item->>'tallyGuid',(item->>'alterId')::bigint,(item->>'masterId')::bigint,
    item->>'name',item->>'parentName',(item->>'openingBalance')::numeric,(item->>'closingBalance')::numeric,
    coalesce((item->>'isDeleted')::boolean,false),item->>'sourceHash',now(),now()
  FROM items
  ON CONFLICT (company_id,tally_guid) DO UPDATE SET alter_id=excluded.alter_id,master_id=excluded.master_id,
    name=excluded.name,parent_name=excluded.parent_name,opening_balance=excluded.opening_balance,
    closing_balance=excluded.closing_balance,is_deleted=excluded.is_deleted,source_hash=excluded.source_hash,synced_at=now(),updated_at=now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{ledgers,created}', to_jsonb(v_count-v_prior));
  v_result := jsonb_set(v_result, '{ledgers,updated}', to_jsonb(v_prior));
  UPDATE public.tb_ledgers child SET parent_group_id=parent.id
  FROM jsonb_array_elements(v_ledgers) item
  JOIN public.tb_ledger_groups parent ON parent.company_id=v_company_id AND
    (parent.tally_guid=item->>'parentGroupGuid' OR
     (nullif(item->>'parentGroupGuid','') IS NULL AND parent.name=item->>'parentName'))
  WHERE child.company_id=v_company_id AND child.tally_guid=item->>'tallyGuid';
  UPDATE public.tb_ledgers SET is_deleted=true,synced_at=now(),updated_at=now()
  WHERE company_id=v_company_id AND tally_guid IN (
    SELECT DISTINCT value #>> '{}' FROM jsonb_array_elements(coalesce(v_deletes->'ledgers','[]'::jsonb)) value
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{ledgers,deleted}', to_jsonb(v_count));

  WITH items AS (
    SELECT DISTINCT ON (item->>'tallyGuid') item FROM jsonb_array_elements(v_vouchers) WITH ORDINALITY source(item,ord)
    ORDER BY item->>'tallyGuid',ord DESC
  )
  SELECT count(*) INTO v_prior FROM public.tb_vouchers existing JOIN items ON items.item->>'tallyGuid'=existing.tally_guid
  WHERE existing.company_id=v_company_id;
  WITH items AS (
    SELECT DISTINCT ON (item->>'tallyGuid') item FROM jsonb_array_elements(v_vouchers) WITH ORDINALITY source(item,ord)
    ORDER BY item->>'tallyGuid',ord DESC
  )
  INSERT INTO public.tb_vouchers (org_id,company_id,tally_guid,alter_id,master_id,voucher_date,effective_date,voucher_type,voucher_number,party_ledger_guid,party_ledger_name,reference,narration,is_cancelled,is_optional,is_deleted,source_hash,source_payload,synced_at,updated_at)
  SELECT v_org_id,v_company_id,item->>'tallyGuid',(item->>'alterId')::bigint,(item->>'masterId')::bigint,
    (item->>'voucherDate')::date,(item->>'effectiveDate')::date,item->>'voucherType',item->>'voucherNumber',
    item->>'partyLedgerGuid',item->>'partyLedgerName',item->>'reference',item->>'narration',
    coalesce((item->>'isCancelled')::boolean,false),coalesce((item->>'isOptional')::boolean,false),
    coalesce((item->>'isDeleted')::boolean,false),item->>'sourceHash',item->'sourcePayload',now(),now()
  FROM items
  ON CONFLICT (company_id,tally_guid) DO UPDATE SET alter_id=excluded.alter_id,master_id=excluded.master_id,
    voucher_date=excluded.voucher_date,effective_date=excluded.effective_date,voucher_type=excluded.voucher_type,
    voucher_number=excluded.voucher_number,party_ledger_guid=excluded.party_ledger_guid,
    party_ledger_name=excluded.party_ledger_name,reference=excluded.reference,narration=excluded.narration,
    is_cancelled=excluded.is_cancelled,is_optional=excluded.is_optional,is_deleted=excluded.is_deleted,
    source_hash=excluded.source_hash,source_payload=excluded.source_payload,synced_at=now(),updated_at=now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{vouchers,created}', to_jsonb(v_count-v_prior));
  v_result := jsonb_set(v_result, '{vouchers,updated}', to_jsonb(v_prior));
  UPDATE public.tb_vouchers SET is_deleted=true,synced_at=now(),updated_at=now()
  WHERE company_id=v_company_id AND tally_guid IN (
    SELECT DISTINCT value #>> '{}' FROM jsonb_array_elements(coalesce(v_deletes->'vouchers','[]'::jsonb)) value
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{vouchers,deleted}', to_jsonb(v_count));

  WITH items AS (
    SELECT DISTINCT ON (item->>'voucherGuid', (item->>'lineNumber')::integer) item
    FROM jsonb_array_elements(v_entries) WITH ORDINALITY source(item,ord)
    ORDER BY item->>'voucherGuid',(item->>'lineNumber')::integer,ord DESC
  )
  SELECT count(*) INTO v_prior
  FROM public.tb_voucher_ledger_entries existing
  JOIN public.tb_vouchers voucher ON voucher.id=existing.voucher_id
  JOIN items ON items.item->>'voucherGuid'=voucher.tally_guid AND (items.item->>'lineNumber')::integer=existing.line_number
  WHERE existing.company_id=v_company_id;
  WITH items AS (
    SELECT DISTINCT ON (item->>'voucherGuid', (item->>'lineNumber')::integer) item
    FROM jsonb_array_elements(v_entries) WITH ORDINALITY source(item,ord)
    ORDER BY item->>'voucherGuid',(item->>'lineNumber')::integer,ord DESC
  )
  INSERT INTO public.tb_voucher_ledger_entries (voucher_id,org_id,company_id,line_number,ledger_id,tally_ledger_guid,ledger_name,amount,is_deemed_positive,is_party_ledger,is_billwise,updated_at)
  SELECT voucher.id,v_org_id,v_company_id,(item->>'lineNumber')::integer,coalesce(guid_ledger.id,name_ledger.id),
    item->>'tallyLedgerGuid',item->>'ledgerName',(item->>'amount')::numeric,
    (item->>'isDeemedPositive')::boolean,(item->>'isPartyLedger')::boolean,(item->>'isBillwise')::boolean,now()
  FROM items
  JOIN public.tb_vouchers voucher ON voucher.company_id=v_company_id AND voucher.tally_guid=item->>'voucherGuid'
  LEFT JOIN public.tb_ledgers guid_ledger ON guid_ledger.company_id=v_company_id AND guid_ledger.tally_guid=item->>'tallyLedgerGuid'
  LEFT JOIN LATERAL (
    SELECT (array_agg(id))[1] id FROM public.tb_ledgers
    WHERE company_id=v_company_id AND NOT is_deleted AND name=item->>'ledgerName'
    HAVING count(*)=1
  ) name_ledger ON nullif(item->>'tallyLedgerGuid','') IS NULL
  ON CONFLICT (voucher_id,line_number) DO UPDATE SET ledger_id=excluded.ledger_id,
    tally_ledger_guid=excluded.tally_ledger_guid,ledger_name=excluded.ledger_name,amount=excluded.amount,
    is_deemed_positive=excluded.is_deemed_positive,is_party_ledger=excluded.is_party_ledger,
    is_billwise=excluded.is_billwise,updated_at=now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  SELECT count(*) INTO v_expected FROM (
    SELECT DISTINCT item->>'voucherGuid',(item->>'lineNumber')::integer
    FROM jsonb_array_elements(v_entries) item
  ) unique_entries;
  IF v_count <> v_expected THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'One or more voucher entries reference an unknown company voucher';
  END IF;
  v_result := jsonb_set(v_result, '{entries,created}', to_jsonb(v_count-v_prior));
  v_result := jsonb_set(v_result, '{entries,updated}', to_jsonb(v_prior));

  DELETE FROM public.tb_voucher_bill_allocations allocation
  USING public.tb_voucher_ledger_entries entry, public.tb_vouchers voucher, jsonb_array_elements(v_entries) item
  WHERE allocation.voucher_ledger_entry_id=entry.id AND entry.voucher_id=voucher.id
    AND entry.company_id=v_company_id AND voucher.tally_guid=item->>'voucherGuid'
    AND entry.line_number=(item->>'lineNumber')::integer;
  DELETE FROM public.tb_voucher_cost_centre_allocations allocation
  USING public.tb_voucher_ledger_entries entry, public.tb_vouchers voucher, jsonb_array_elements(v_entries) item
  WHERE allocation.voucher_ledger_entry_id=entry.id AND entry.voucher_id=voucher.id
    AND entry.company_id=v_company_id AND voucher.tally_guid=item->>'voucherGuid'
    AND entry.line_number=(item->>'lineNumber')::integer;

  INSERT INTO public.tb_voucher_bill_allocations (voucher_ledger_entry_id,bill_name,bill_type,reference,amount)
  SELECT entry.id,item->>'billName',item->>'billType',item->>'reference',(item->>'amount')::numeric
  FROM jsonb_array_elements(v_bill_allocations) item
  JOIN public.tb_vouchers voucher ON voucher.company_id=v_company_id AND voucher.tally_guid=item->>'voucherGuid'
  JOIN public.tb_voucher_ledger_entries entry ON entry.voucher_id=voucher.id AND entry.line_number=(item->>'lineNumber')::integer;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> jsonb_array_length(v_bill_allocations) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'One or more bill allocations reference an unknown entry';
  END IF;
  INSERT INTO public.tb_voucher_cost_centre_allocations (voucher_ledger_entry_id,cost_centre_name,amount)
  SELECT entry.id,item->>'costCentreName',(item->>'amount')::numeric
  FROM jsonb_array_elements(v_cost_allocations) item
  JOIN public.tb_vouchers voucher ON voucher.company_id=v_company_id AND voucher.tally_guid=item->>'voucherGuid'
  JOIN public.tb_voucher_ledger_entries entry ON entry.voucher_id=voucher.id AND entry.line_number=(item->>'lineNumber')::integer;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> jsonb_array_length(v_cost_allocations) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'One or more cost-centre allocations reference an unknown entry';
  END IF;

  v_baseline := (payload->'reconciliation'->>'baselineDate')::date;
  IF v_baseline IS NULL AND jsonb_array_length(v_ledgers) > 0 THEN
    SELECT history_baseline_date INTO v_baseline FROM public.tb_company_sync_state
    WHERE company_id=v_company_id AND history_reconciliation_status='complete';
    v_preserve_snapshots := true;
  END IF;
  IF v_baseline IS NOT NULL AND jsonb_array_length(v_ledgers) > 0 THEN
    INSERT INTO public.tb_ledger_balance_snapshots (ledger_id,company_id,org_id,as_of_date,opening_balance,debit_total,credit_total,closing_balance)
    SELECT ledger.id,v_company_id,v_org_id,v_baseline,coalesce((item->>'openingBalance')::numeric,0),0,0,
      coalesce((item->>'openingBalance')::numeric,0)
    FROM jsonb_array_elements(v_ledgers) item
    JOIN public.tb_ledgers ledger ON ledger.company_id=v_company_id AND ledger.tally_guid=item->>'tallyGuid'
    ON CONFLICT (ledger_id,as_of_date) DO UPDATE SET
      opening_balance=CASE WHEN v_preserve_snapshots THEN tb_ledger_balance_snapshots.opening_balance ELSE excluded.opening_balance END,
      closing_balance=CASE WHEN v_preserve_snapshots THEN tb_ledger_balance_snapshots.closing_balance ELSE excluded.closing_balance END;
  END IF;

  IF payload ? 'verification' THEN
    INSERT INTO public.tb_tally_trial_balance_snapshots (org_id,company_id,as_of_date,debit_total,credit_total,rows,synced_at)
    SELECT v_org_id,v_company_id,(payload->'verification'->>'asOfDate')::date,
      coalesce(sum((row->>'debitBalance')::numeric),0),coalesce(sum((row->>'creditBalance')::numeric),0),
      payload->'verification'->'rows',now()
    FROM jsonb_array_elements(payload->'verification'->'rows') row
    ON CONFLICT (company_id,as_of_date) DO UPDATE SET debit_total=excluded.debit_total,
      credit_total=excluded.credit_total,rows=excluded.rows,synced_at=now();
  END IF;

  IF coalesce((payload->'reconciliation'->>'complete')::boolean,false) THEN
    SELECT min(voucher_date),max(voucher_date) INTO v_earliest,v_latest
    FROM public.tb_vouchers WHERE company_id=v_company_id AND NOT is_deleted;
  END IF;
  INSERT INTO public.tb_company_sync_state (
    company_id,last_catalog_seen_at,last_ledger_sync_at,last_voucher_sync_at,last_error,
    history_baseline_date,history_earliest_voucher_date,history_latest_voucher_date,
    history_reconciliation_status,history_reconciled_at,verification_as_of_date,
    verification_status,verification_completed_at,updated_at
  ) VALUES (
    v_company_id,now(),
    CASE WHEN jsonb_array_length(v_groups)+jsonb_array_length(v_ledgers)>0 THEN now() END,
    CASE WHEN jsonb_array_length(v_vouchers)+jsonb_array_length(v_entries)>0 THEN now() END,
    null,(payload->'reconciliation'->>'baselineDate')::date,v_earliest,v_latest,
    CASE WHEN payload ? 'reconciliation' THEN CASE WHEN coalesce((payload->'reconciliation'->>'complete')::boolean,false) THEN 'complete' ELSE 'in_progress' END END,
    CASE WHEN coalesce((payload->'reconciliation'->>'complete')::boolean,false) THEN now() END,
    (payload->'verification'->>'asOfDate')::date,CASE WHEN payload ? 'verification' THEN 'complete' END,
    CASE WHEN payload ? 'verification' THEN now() END,now()
  )
  ON CONFLICT (company_id) DO UPDATE SET last_catalog_seen_at=now(),
    last_ledger_sync_at=coalesce(excluded.last_ledger_sync_at,tb_company_sync_state.last_ledger_sync_at),
    last_voucher_sync_at=coalesce(excluded.last_voucher_sync_at,tb_company_sync_state.last_voucher_sync_at),
    last_error=null,history_baseline_date=coalesce(excluded.history_baseline_date,tb_company_sync_state.history_baseline_date),
    history_earliest_voucher_date=coalesce(excluded.history_earliest_voucher_date,tb_company_sync_state.history_earliest_voucher_date),
    history_latest_voucher_date=coalesce(excluded.history_latest_voucher_date,tb_company_sync_state.history_latest_voucher_date),
    history_reconciliation_status=coalesce(excluded.history_reconciliation_status,tb_company_sync_state.history_reconciliation_status),
    history_reconciled_at=coalesce(excluded.history_reconciled_at,tb_company_sync_state.history_reconciled_at),
    verification_as_of_date=coalesce(excluded.verification_as_of_date,tb_company_sync_state.verification_as_of_date),
    verification_status=coalesce(excluded.verification_status,tb_company_sync_state.verification_status),
    verification_completed_at=coalesce(excluded.verification_completed_at,tb_company_sync_state.verification_completed_at),updated_at=now();

  INSERT INTO public.tb_sync_runs (org_id,company_id,entity_type,status,created_count,updated_count,deleted_count,started_at,finished_at)
  SELECT v_org_id,v_company_id,entity,'success',created,updated,deleted,v_started_at,now()
  FROM (VALUES
    ('catalog', (v_result#>>'{companies,created}')::integer, (v_result#>>'{companies,updated}')::integer, 0),
    ('groups', (v_result#>>'{groups,created}')::integer, (v_result#>>'{groups,updated}')::integer, (v_result#>>'{groups,deleted}')::integer),
    ('ledgers', (v_result#>>'{ledgers,created}')::integer, (v_result#>>'{ledgers,updated}')::integer, (v_result#>>'{ledgers,deleted}')::integer),
    ('vouchers', (v_result#>>'{vouchers,created}')::integer+(v_result#>>'{entries,created}')::integer,
      (v_result#>>'{vouchers,updated}')::integer+(v_result#>>'{entries,updated}')::integer,
      (v_result#>>'{vouchers,deleted}')::integer)
  ) runs(entity,created,updated,deleted);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION tallybridge_private.tb_sync_accounting_data(jsonb) FROM PUBLIC, anonymous, authenticated;

CREATE OR REPLACE FUNCTION public.tb_sync_accounting_data(payload jsonb)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, tallybridge_private, auth, pg_temp
AS $$
  SELECT tallybridge_private.tb_sync_accounting_data(payload)
$$;

REVOKE ALL ON FUNCTION public.tb_sync_accounting_data(jsonb) FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION public.tb_sync_accounting_data(jsonb) TO authenticated;
