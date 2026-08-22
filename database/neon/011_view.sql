CREATE OR REPLACE VIEW public.tb_ledger_voucher_lines WITH (security_invoker = true) AS  SELECT e.company_id,
    l.id AS ledger_id,
    l.name AS ledger_name,
    e.id AS voucher_ledger_entry_id,
    e.line_number,
    v.id AS voucher_id,
    v.voucher_date,
    v.voucher_type,
    v.voucher_number,
    COALESCE(other_entries.particulars, v.party_ledger_name, v.narration, ''::text) AS particulars,
        CASE
            WHEN e.amount < 0::numeric THEN abs(e.amount)
            ELSE 0::numeric
        END AS debit_amount,
        CASE
            WHEN e.amount >= 0::numeric THEN abs(e.amount)
            ELSE 0::numeric
        END AS credit_amount,
    COALESCE(snapshot.opening_balance, 0::numeric) + COALESCE(( SELECT sum(previous_entry.amount) AS sum
           FROM tb_voucher_ledger_entries previous_entry
             JOIN tb_vouchers previous_voucher ON previous_voucher.id = previous_entry.voucher_id
          WHERE previous_entry.ledger_id = e.ledger_id AND previous_entry.company_id = e.company_id AND tb_voucher_affects_books(previous_voucher.*) AND previous_voucher.voucher_date >= snapshot.as_of_date AND ((ROW(previous_voucher.voucher_date, COALESCE(previous_voucher.voucher_number, ''::text), previous_entry.line_number, previous_voucher.id) <= ROW(v.voucher_date, COALESCE(v.voucher_number, ''::text), e.line_number, v.id)))), 0::numeric) AS running_balance
   FROM tb_voucher_ledger_entries e
     JOIN tb_vouchers v ON v.id = e.voucher_id
     JOIN tb_ledgers l ON l.id = e.ledger_id
     LEFT JOIN LATERAL ( SELECT s.as_of_date,
            s.opening_balance
           FROM tb_ledger_balance_snapshots s
          WHERE s.ledger_id = l.id AND s.company_id = e.company_id AND s.as_of_date <= v.voucher_date
          ORDER BY s.as_of_date DESC
         LIMIT 1) snapshot ON true
     LEFT JOIN LATERAL ( SELECT string_agg(other_entry.ledger_name, ', '::text ORDER BY other_entry.line_number) AS particulars
           FROM tb_voucher_ledger_entries other_entry
          WHERE other_entry.voucher_id = e.voucher_id AND other_entry.id <> e.id) other_entries ON true
  WHERE tb_voucher_affects_books(v.*) AND NOT l.is_deleted;;
