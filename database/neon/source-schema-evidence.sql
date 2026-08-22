--
-- PostgreSQL database dump
--

\restrict Fxz9Gj8XIavOQk0Hq9BDXC3olAWeTmH9W9i31zjc1f9OjVlQBkurYJptoq5yiHO

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: tb_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    company_id uuid NOT NULL,
    tally_guid text NOT NULL,
    alter_id bigint,
    master_id bigint,
    voucher_date date NOT NULL,
    effective_date date,
    voucher_type text NOT NULL,
    voucher_number text,
    party_ledger_guid text,
    party_ledger_name text,
    reference text,
    narration text,
    is_cancelled boolean DEFAULT false NOT NULL,
    is_optional boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    source_hash text,
    source_payload jsonb,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_mapping_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_mapping_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    company_id uuid NOT NULL,
    compliance_type text NOT NULL,
    status text DEFAULT 'complete'::text NOT NULL,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT compliance_mapping_profiles_check CHECK ((((status = 'complete'::text) AND (confirmed_by IS NOT NULL) AND (confirmed_at IS NOT NULL)) OR (status = 'draft'::text))),
    CONSTRAINT compliance_mapping_profiles_compliance_type_check CHECK ((compliance_type ~ '^[A-Z][A-Z0-9_]*$'::text)),
    CONSTRAINT compliance_mapping_profiles_status_check CHECK ((status = 'complete'::text))
);


--
-- Name: tb_companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    tally_company_guid text NOT NULL,
    name text NOT NULL,
    alter_id bigint,
    master_id bigint,
    company_number text,
    starting_from date,
    books_from date,
    country text,
    state text,
    phone text,
    email text,
    last_seen_at timestamp with time zone,
    last_successful_sync_at timestamp with time zone,
    last_sync_status text,
    last_sync_error text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tb_company_sync_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_company_sync_state (
    company_id uuid NOT NULL,
    ledger_cursor text,
    voucher_cursor text,
    last_catalog_seen_at timestamp with time zone,
    last_ledger_sync_at timestamp with time zone,
    last_voucher_sync_at timestamp with time zone,
    last_error text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    history_baseline_date date,
    history_earliest_voucher_date date,
    history_latest_voucher_date date,
    history_reconciliation_status text,
    history_reconciled_at timestamp with time zone,
    verification_as_of_date date,
    verification_status text,
    verification_completed_at timestamp with time zone
);


--
-- Name: tb_ledger_balance_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_ledger_balance_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    company_id uuid NOT NULL,
    ledger_id uuid NOT NULL,
    as_of_date date NOT NULL,
    opening_balance numeric(20,4) NOT NULL,
    debit_total numeric(20,4) DEFAULT 0 NOT NULL,
    credit_total numeric(20,4) DEFAULT 0 NOT NULL,
    closing_balance numeric(20,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tb_ledger_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_ledger_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    company_id uuid NOT NULL,
    tally_guid text,
    alter_id bigint,
    master_id bigint,
    name text NOT NULL,
    parent_name text,
    parent_group_id uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tb_ledgers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_ledgers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    company_id uuid NOT NULL,
    tally_guid text NOT NULL,
    alter_id bigint,
    master_id bigint,
    name text NOT NULL,
    parent_name text,
    parent_group_id uuid,
    opening_balance numeric(20,4),
    closing_balance numeric(20,4),
    is_deleted boolean DEFAULT false NOT NULL,
    source_hash text,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tb_voucher_ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_voucher_ledger_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_id uuid NOT NULL,
    org_id uuid NOT NULL,
    company_id uuid NOT NULL,
    line_number integer NOT NULL,
    ledger_id uuid,
    tally_ledger_guid text,
    ledger_name text NOT NULL,
    amount numeric(20,4) NOT NULL,
    is_deemed_positive boolean,
    is_party_ledger boolean,
    is_billwise boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tb_org_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_org_members (
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tb_org_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
);


--
-- Name: tb_organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tb_sync_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_sync_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    company_id uuid,
    entity_type text NOT NULL,
    status text NOT NULL,
    discovered integer DEFAULT 0 NOT NULL,
    created_count integer DEFAULT 0 NOT NULL,
    updated_count integer DEFAULT 0 NOT NULL,
    deleted_count integer DEFAULT 0 NOT NULL,
    skipped_count integer DEFAULT 0 NOT NULL,
    error text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT tb_sync_runs_entity_type_check CHECK ((entity_type = ANY (ARRAY['catalog'::text, 'groups'::text, 'ledgers'::text, 'vouchers'::text]))),
    CONSTRAINT tb_sync_runs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'partial'::text, 'error'::text, 'skipped'::text])))
);


--
-- Name: tb_tally_trial_balance_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_tally_trial_balance_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    company_id uuid NOT NULL,
    as_of_date date NOT NULL,
    debit_total numeric NOT NULL,
    credit_total numeric NOT NULL,
    rows jsonb NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tb_tally_verification_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_tally_verification_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    company_id uuid NOT NULL,
    ledger_id uuid NOT NULL,
    as_of_date date NOT NULL,
    closing_balance numeric NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tb_voucher_bill_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_voucher_bill_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_ledger_entry_id uuid NOT NULL,
    bill_name text,
    bill_type text,
    reference text,
    amount numeric(20,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tb_voucher_cost_centre_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tb_voucher_cost_centre_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_ledger_entry_id uuid NOT NULL,
    cost_centre_name text NOT NULL,
    amount numeric(20,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tds_ledger_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tds_ledger_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    company_id uuid NOT NULL,
    ledger_id uuid NOT NULL,
    tds_type text NOT NULL,
    section_code text,
    is_payable_ledger boolean DEFAULT true NOT NULL,
    rounding_tolerance numeric(18,2) DEFAULT 1 NOT NULL,
    active_from date DEFAULT '1900-01-01'::date NOT NULL,
    active_to date,
    liability_voucher_types text[] DEFAULT ARRAY['Purchase'::text, 'Journal'::text] NOT NULL,
    deposit_voucher_types text[] DEFAULT ARRAY['Payment'::text] NOT NULL,
    journal_treatment text DEFAULT 'MAPPED_BY_SIGN'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT tds_ledger_mappings_check CHECK (((active_to IS NULL) OR (active_to >= active_from))),
    CONSTRAINT tds_ledger_mappings_journal_treatment_check CHECK ((journal_treatment = ANY (ARRAY['MAPPED_BY_SIGN'::text, 'REVIEW_REQUIRED'::text]))),
    CONSTRAINT tds_ledger_mappings_rounding_tolerance_check CHECK ((rounding_tolerance >= (0)::numeric))
);


--
-- Name: compliance_mapping_profiles compliance_mapping_profiles_company_id_compliance_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_mapping_profiles
    ADD CONSTRAINT compliance_mapping_profiles_company_id_compliance_type_key UNIQUE (company_id, compliance_type);


--
-- Name: compliance_mapping_profiles compliance_mapping_profiles_id_org_id_company_id_compliance_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_mapping_profiles
    ADD CONSTRAINT compliance_mapping_profiles_id_org_id_company_id_compliance_key UNIQUE (id, org_id, company_id, compliance_type);


--
-- Name: compliance_mapping_profiles compliance_mapping_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_mapping_profiles
    ADD CONSTRAINT compliance_mapping_profiles_pkey PRIMARY KEY (id);


--
-- Name: tb_companies tb_companies_org_id_tally_company_guid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_companies
    ADD CONSTRAINT tb_companies_org_id_tally_company_guid_key UNIQUE (org_id, tally_company_guid);


--
-- Name: tb_companies tb_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_companies
    ADD CONSTRAINT tb_companies_pkey PRIMARY KEY (id);


--
-- Name: tb_company_sync_state tb_company_sync_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_company_sync_state
    ADD CONSTRAINT tb_company_sync_state_pkey PRIMARY KEY (company_id);


--
-- Name: tb_ledger_balance_snapshots tb_ledger_balance_snapshots_ledger_id_as_of_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledger_balance_snapshots
    ADD CONSTRAINT tb_ledger_balance_snapshots_ledger_id_as_of_date_key UNIQUE (ledger_id, as_of_date);


--
-- Name: tb_ledger_balance_snapshots tb_ledger_balance_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledger_balance_snapshots
    ADD CONSTRAINT tb_ledger_balance_snapshots_pkey PRIMARY KEY (id);


--
-- Name: tb_ledger_groups tb_ledger_groups_company_id_tally_guid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledger_groups
    ADD CONSTRAINT tb_ledger_groups_company_id_tally_guid_key UNIQUE (company_id, tally_guid);


--
-- Name: tb_ledger_groups tb_ledger_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledger_groups
    ADD CONSTRAINT tb_ledger_groups_pkey PRIMARY KEY (id);


--
-- Name: tb_ledgers tb_ledgers_company_id_tally_guid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledgers
    ADD CONSTRAINT tb_ledgers_company_id_tally_guid_key UNIQUE (company_id, tally_guid);


--
-- Name: tb_ledgers tb_ledgers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledgers
    ADD CONSTRAINT tb_ledgers_pkey PRIMARY KEY (id);


--
-- Name: tb_org_members tb_org_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_org_members
    ADD CONSTRAINT tb_org_members_pkey PRIMARY KEY (user_id, org_id);


--
-- Name: tb_organizations tb_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_organizations
    ADD CONSTRAINT tb_organizations_pkey PRIMARY KEY (id);


--
-- Name: tb_sync_runs tb_sync_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_sync_runs
    ADD CONSTRAINT tb_sync_runs_pkey PRIMARY KEY (id);


--
-- Name: tb_tally_trial_balance_snapshots tb_tally_trial_balance_snapshots_company_id_as_of_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_tally_trial_balance_snapshots
    ADD CONSTRAINT tb_tally_trial_balance_snapshots_company_id_as_of_date_key UNIQUE (company_id, as_of_date);


--
-- Name: tb_tally_trial_balance_snapshots tb_tally_trial_balance_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_tally_trial_balance_snapshots
    ADD CONSTRAINT tb_tally_trial_balance_snapshots_pkey PRIMARY KEY (id);


--
-- Name: tb_tally_verification_snapshots tb_tally_verification_snapshots_ledger_id_as_of_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_tally_verification_snapshots
    ADD CONSTRAINT tb_tally_verification_snapshots_ledger_id_as_of_date_key UNIQUE (ledger_id, as_of_date);


--
-- Name: tb_tally_verification_snapshots tb_tally_verification_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_tally_verification_snapshots
    ADD CONSTRAINT tb_tally_verification_snapshots_pkey PRIMARY KEY (id);


--
-- Name: tb_voucher_bill_allocations tb_voucher_bill_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_voucher_bill_allocations
    ADD CONSTRAINT tb_voucher_bill_allocations_pkey PRIMARY KEY (id);


--
-- Name: tb_voucher_cost_centre_allocations tb_voucher_cost_centre_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_voucher_cost_centre_allocations
    ADD CONSTRAINT tb_voucher_cost_centre_allocations_pkey PRIMARY KEY (id);


--
-- Name: tb_voucher_ledger_entries tb_voucher_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_voucher_ledger_entries
    ADD CONSTRAINT tb_voucher_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: tb_voucher_ledger_entries tb_voucher_ledger_entries_voucher_id_line_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_voucher_ledger_entries
    ADD CONSTRAINT tb_voucher_ledger_entries_voucher_id_line_number_key UNIQUE (voucher_id, line_number);


--
-- Name: tb_vouchers tb_vouchers_company_id_tally_guid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_vouchers
    ADD CONSTRAINT tb_vouchers_company_id_tally_guid_key UNIQUE (company_id, tally_guid);


--
-- Name: tb_vouchers tb_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_vouchers
    ADD CONSTRAINT tb_vouchers_pkey PRIMARY KEY (id);


--
-- Name: tds_ledger_mappings tds_ledger_mappings_company_id_ledger_id_active_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_ledger_mappings
    ADD CONSTRAINT tds_ledger_mappings_company_id_ledger_id_active_from_key UNIQUE (company_id, ledger_id, active_from);


--
-- Name: tds_ledger_mappings tds_ledger_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_ledger_mappings
    ADD CONSTRAINT tds_ledger_mappings_pkey PRIMARY KEY (id);


--
-- Name: compliance_mapping_profiles_org_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_mapping_profiles_org_type_idx ON public.compliance_mapping_profiles USING btree (org_id, compliance_type, status);


--
-- Name: tb_companies_org_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_companies_org_active_idx ON public.tb_companies USING btree (org_id, is_active);


--
-- Name: tb_ledger_balance_snapshots_company_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_ledger_balance_snapshots_company_date_idx ON public.tb_ledger_balance_snapshots USING btree (company_id, as_of_date DESC);


--
-- Name: tb_ledger_groups_company_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_ledger_groups_company_name_idx ON public.tb_ledger_groups USING btree (company_id, name);


--
-- Name: tb_ledger_groups_company_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_ledger_groups_company_parent_idx ON public.tb_ledger_groups USING btree (company_id, parent_name);


--
-- Name: tb_ledgers_company_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_ledgers_company_name_idx ON public.tb_ledgers USING btree (company_id, name);


--
-- Name: tb_ledgers_company_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_ledgers_company_parent_idx ON public.tb_ledgers USING btree (company_id, parent_name);


--
-- Name: tb_ledgers_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_ledgers_org_idx ON public.tb_ledgers USING btree (org_id);


--
-- Name: tb_org_members_org_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_org_members_org_user_idx ON public.tb_org_members USING btree (org_id, user_id);


--
-- Name: tb_sync_runs_company_entity_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_sync_runs_company_entity_started_idx ON public.tb_sync_runs USING btree (company_id, entity_type, started_at DESC);


--
-- Name: tb_sync_runs_org_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_sync_runs_org_started_idx ON public.tb_sync_runs USING btree (org_id, started_at DESC);


--
-- Name: tb_tally_verification_company_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_tally_verification_company_date_idx ON public.tb_tally_verification_snapshots USING btree (company_id, as_of_date DESC);


--
-- Name: tb_voucher_bill_allocations_entry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_voucher_bill_allocations_entry_idx ON public.tb_voucher_bill_allocations USING btree (voucher_ledger_entry_id);


--
-- Name: tb_voucher_cost_centre_allocations_entry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_voucher_cost_centre_allocations_entry_idx ON public.tb_voucher_cost_centre_allocations USING btree (voucher_ledger_entry_id);


--
-- Name: tb_voucher_entries_company_ledger_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_voucher_entries_company_ledger_idx ON public.tb_voucher_ledger_entries USING btree (company_id, ledger_id);


--
-- Name: tb_voucher_entries_company_tally_ledger_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_voucher_entries_company_tally_ledger_idx ON public.tb_voucher_ledger_entries USING btree (company_id, tally_ledger_guid);


--
-- Name: tb_vouchers_company_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_vouchers_company_date_idx ON public.tb_vouchers USING btree (company_id, voucher_date DESC);


--
-- Name: tb_vouchers_company_type_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tb_vouchers_company_type_date_idx ON public.tb_vouchers USING btree (company_id, voucher_type, voucher_date DESC);


--
-- Name: tds_ledger_mappings_company_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tds_ledger_mappings_company_active_idx ON public.tds_ledger_mappings USING btree (company_id, active_from, active_to) WHERE is_payable_ledger;


--
-- Name: tds_ledger_mappings_ledger_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tds_ledger_mappings_ledger_idx ON public.tds_ledger_mappings USING btree (ledger_id);


--
-- Name: tds_ledger_mappings_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tds_ledger_mappings_org_idx ON public.tds_ledger_mappings USING btree (org_id);


--
-- Name: compliance_mapping_profiles compliance_mapping_profiles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_mapping_profiles
    ADD CONSTRAINT compliance_mapping_profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE CASCADE;


--
-- Name: compliance_mapping_profiles compliance_mapping_profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_mapping_profiles
    ADD CONSTRAINT compliance_mapping_profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tb_companies tb_companies_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_companies
    ADD CONSTRAINT tb_companies_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tb_company_sync_state tb_company_sync_state_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_company_sync_state
    ADD CONSTRAINT tb_company_sync_state_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE CASCADE;


--
-- Name: tb_ledger_balance_snapshots tb_ledger_balance_snapshots_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledger_balance_snapshots
    ADD CONSTRAINT tb_ledger_balance_snapshots_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE CASCADE;


--
-- Name: tb_ledger_balance_snapshots tb_ledger_balance_snapshots_ledger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledger_balance_snapshots
    ADD CONSTRAINT tb_ledger_balance_snapshots_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.tb_ledgers(id) ON DELETE CASCADE;


--
-- Name: tb_ledger_balance_snapshots tb_ledger_balance_snapshots_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledger_balance_snapshots
    ADD CONSTRAINT tb_ledger_balance_snapshots_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tb_ledger_groups tb_ledger_groups_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledger_groups
    ADD CONSTRAINT tb_ledger_groups_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE CASCADE;


--
-- Name: tb_ledger_groups tb_ledger_groups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledger_groups
    ADD CONSTRAINT tb_ledger_groups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tb_ledger_groups tb_ledger_groups_parent_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledger_groups
    ADD CONSTRAINT tb_ledger_groups_parent_group_id_fkey FOREIGN KEY (parent_group_id) REFERENCES public.tb_ledger_groups(id) ON DELETE SET NULL;


--
-- Name: tb_ledgers tb_ledgers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledgers
    ADD CONSTRAINT tb_ledgers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE CASCADE;


--
-- Name: tb_ledgers tb_ledgers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledgers
    ADD CONSTRAINT tb_ledgers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tb_ledgers tb_ledgers_parent_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_ledgers
    ADD CONSTRAINT tb_ledgers_parent_group_id_fkey FOREIGN KEY (parent_group_id) REFERENCES public.tb_ledger_groups(id) ON DELETE SET NULL;


--
-- Name: tb_org_members tb_org_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_org_members
    ADD CONSTRAINT tb_org_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tb_org_members tb_org_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_org_members
    ADD CONSTRAINT tb_org_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tb_sync_runs tb_sync_runs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_sync_runs
    ADD CONSTRAINT tb_sync_runs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE SET NULL;


--
-- Name: tb_sync_runs tb_sync_runs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_sync_runs
    ADD CONSTRAINT tb_sync_runs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tb_tally_trial_balance_snapshots tb_tally_trial_balance_snapshots_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_tally_trial_balance_snapshots
    ADD CONSTRAINT tb_tally_trial_balance_snapshots_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE CASCADE;


--
-- Name: tb_tally_trial_balance_snapshots tb_tally_trial_balance_snapshots_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_tally_trial_balance_snapshots
    ADD CONSTRAINT tb_tally_trial_balance_snapshots_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tb_tally_verification_snapshots tb_tally_verification_snapshots_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_tally_verification_snapshots
    ADD CONSTRAINT tb_tally_verification_snapshots_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE CASCADE;


--
-- Name: tb_tally_verification_snapshots tb_tally_verification_snapshots_ledger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_tally_verification_snapshots
    ADD CONSTRAINT tb_tally_verification_snapshots_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.tb_ledgers(id) ON DELETE CASCADE;


--
-- Name: tb_tally_verification_snapshots tb_tally_verification_snapshots_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_tally_verification_snapshots
    ADD CONSTRAINT tb_tally_verification_snapshots_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tb_voucher_bill_allocations tb_voucher_bill_allocations_voucher_ledger_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_voucher_bill_allocations
    ADD CONSTRAINT tb_voucher_bill_allocations_voucher_ledger_entry_id_fkey FOREIGN KEY (voucher_ledger_entry_id) REFERENCES public.tb_voucher_ledger_entries(id) ON DELETE CASCADE;


--
-- Name: tb_voucher_cost_centre_allocations tb_voucher_cost_centre_allocations_voucher_ledger_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_voucher_cost_centre_allocations
    ADD CONSTRAINT tb_voucher_cost_centre_allocations_voucher_ledger_entry_id_fkey FOREIGN KEY (voucher_ledger_entry_id) REFERENCES public.tb_voucher_ledger_entries(id) ON DELETE CASCADE;


--
-- Name: tb_voucher_ledger_entries tb_voucher_ledger_entries_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_voucher_ledger_entries
    ADD CONSTRAINT tb_voucher_ledger_entries_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE CASCADE;


--
-- Name: tb_voucher_ledger_entries tb_voucher_ledger_entries_ledger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_voucher_ledger_entries
    ADD CONSTRAINT tb_voucher_ledger_entries_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.tb_ledgers(id) ON DELETE SET NULL;


--
-- Name: tb_voucher_ledger_entries tb_voucher_ledger_entries_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_voucher_ledger_entries
    ADD CONSTRAINT tb_voucher_ledger_entries_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tb_voucher_ledger_entries tb_voucher_ledger_entries_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_voucher_ledger_entries
    ADD CONSTRAINT tb_voucher_ledger_entries_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.tb_vouchers(id) ON DELETE CASCADE;


--
-- Name: tb_vouchers tb_vouchers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_vouchers
    ADD CONSTRAINT tb_vouchers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE CASCADE;


--
-- Name: tb_vouchers tb_vouchers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tb_vouchers
    ADD CONSTRAINT tb_vouchers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: tds_ledger_mappings tds_ledger_mappings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_ledger_mappings
    ADD CONSTRAINT tds_ledger_mappings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.tb_companies(id) ON DELETE CASCADE;


--
-- Name: tds_ledger_mappings tds_ledger_mappings_ledger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_ledger_mappings
    ADD CONSTRAINT tds_ledger_mappings_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.tb_ledgers(id) ON DELETE CASCADE;


--
-- Name: tds_ledger_mappings tds_ledger_mappings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_ledger_mappings
    ADD CONSTRAINT tds_ledger_mappings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.tb_organizations(id) ON DELETE CASCADE;


--
-- Name: compliance_mapping_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_mapping_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_mapping_profiles compliance_profiles_delete_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_profiles_delete_member ON public.compliance_mapping_profiles FOR DELETE TO authenticated USING (( SELECT public.tb_is_member(compliance_mapping_profiles.org_id) AS tb_is_member));


--
-- Name: compliance_mapping_profiles compliance_profiles_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_profiles_insert_member ON public.compliance_mapping_profiles FOR INSERT TO authenticated WITH CHECK ((( SELECT public.tb_is_member(compliance_mapping_profiles.org_id) AS tb_is_member) AND (EXISTS ( SELECT 1
   FROM public.tb_companies c
  WHERE ((c.id = compliance_mapping_profiles.company_id) AND (c.org_id = c.org_id))))));


--
-- Name: compliance_mapping_profiles compliance_profiles_read_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_profiles_read_member ON public.compliance_mapping_profiles FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(compliance_mapping_profiles.org_id) AS tb_is_member));


--
-- Name: compliance_mapping_profiles compliance_profiles_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_profiles_update_member ON public.compliance_mapping_profiles FOR UPDATE TO authenticated USING (( SELECT public.tb_is_member(compliance_mapping_profiles.org_id) AS tb_is_member)) WITH CHECK ((( SELECT public.tb_is_member(compliance_mapping_profiles.org_id) AS tb_is_member) AND (EXISTS ( SELECT 1
   FROM public.tb_companies c
  WHERE ((c.id = compliance_mapping_profiles.company_id) AND (c.org_id = c.org_id))))));


--
-- Name: tb_companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_companies ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_companies tb_companies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_companies_select ON public.tb_companies FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(tb_companies.org_id) AS tb_is_member));


--
-- Name: tb_company_sync_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_company_sync_state ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_company_sync_state tb_company_sync_state_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_company_sync_state_select ON public.tb_company_sync_state FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tb_companies c
  WHERE ((c.id = tb_company_sync_state.company_id) AND ( SELECT public.tb_is_member(c.org_id) AS tb_is_member)))));


--
-- Name: tb_ledger_balance_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_ledger_balance_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_ledger_balance_snapshots tb_ledger_balance_snapshots_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_ledger_balance_snapshots_select ON public.tb_ledger_balance_snapshots FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(tb_ledger_balance_snapshots.org_id) AS tb_is_member));


--
-- Name: tb_ledger_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_ledger_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_ledger_groups tb_ledger_groups_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_ledger_groups_select ON public.tb_ledger_groups FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(tb_ledger_groups.org_id) AS tb_is_member));


--
-- Name: tb_ledgers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_ledgers ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_ledgers tb_ledgers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_ledgers_select ON public.tb_ledgers FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(tb_ledgers.org_id) AS tb_is_member));


--
-- Name: tb_org_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_org_members ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_org_members tb_org_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_org_members_select ON public.tb_org_members FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(tb_org_members.org_id) AS tb_is_member));


--
-- Name: tb_organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_organizations tb_organizations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_organizations_select ON public.tb_organizations FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(tb_organizations.id) AS tb_is_member));


--
-- Name: tb_sync_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_sync_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_sync_runs tb_sync_runs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_sync_runs_select ON public.tb_sync_runs FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(tb_sync_runs.org_id) AS tb_is_member));


--
-- Name: tb_tally_trial_balance_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_tally_trial_balance_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_tally_trial_balance_snapshots tb_tally_trial_balance_snapshots_read_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_tally_trial_balance_snapshots_read_member ON public.tb_tally_trial_balance_snapshots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tb_org_members m
  WHERE ((m.org_id = tb_tally_trial_balance_snapshots.org_id) AND (m.user_id = auth.uid())))));


--
-- Name: tb_tally_verification_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_tally_verification_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_tally_verification_snapshots tb_tally_verification_snapshots_read_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_tally_verification_snapshots_read_member ON public.tb_tally_verification_snapshots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tb_org_members m
  WHERE ((m.org_id = tb_tally_verification_snapshots.org_id) AND (m.user_id = auth.uid())))));


--
-- Name: tb_voucher_bill_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_voucher_bill_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_voucher_bill_allocations tb_voucher_bill_allocations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_voucher_bill_allocations_select ON public.tb_voucher_bill_allocations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tb_voucher_ledger_entries e
  WHERE ((e.id = tb_voucher_bill_allocations.voucher_ledger_entry_id) AND ( SELECT public.tb_is_member(e.org_id) AS tb_is_member)))));


--
-- Name: tb_voucher_cost_centre_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_voucher_cost_centre_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_voucher_cost_centre_allocations tb_voucher_cost_centre_allocations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_voucher_cost_centre_allocations_select ON public.tb_voucher_cost_centre_allocations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tb_voucher_ledger_entries e
  WHERE ((e.id = tb_voucher_cost_centre_allocations.voucher_ledger_entry_id) AND ( SELECT public.tb_is_member(e.org_id) AS tb_is_member)))));


--
-- Name: tb_voucher_ledger_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_voucher_ledger_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_voucher_ledger_entries tb_voucher_ledger_entries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_voucher_ledger_entries_select ON public.tb_voucher_ledger_entries FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(tb_voucher_ledger_entries.org_id) AS tb_is_member));


--
-- Name: tb_vouchers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tb_vouchers ENABLE ROW LEVEL SECURITY;

--
-- Name: tb_vouchers tb_vouchers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tb_vouchers_select ON public.tb_vouchers FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(tb_vouchers.org_id) AS tb_is_member));


--
-- Name: tds_ledger_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tds_ledger_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: tds_ledger_mappings tds_ledger_mappings_delete_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tds_ledger_mappings_delete_member ON public.tds_ledger_mappings FOR DELETE TO authenticated USING (( SELECT public.tb_is_member(tds_ledger_mappings.org_id) AS tb_is_member));


--
-- Name: tds_ledger_mappings tds_ledger_mappings_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tds_ledger_mappings_insert_member ON public.tds_ledger_mappings FOR INSERT TO authenticated WITH CHECK ((( SELECT public.tb_is_member(tds_ledger_mappings.org_id) AS tb_is_member) AND (EXISTS ( SELECT 1
   FROM public.tb_ledgers l
  WHERE ((l.id = tds_ledger_mappings.ledger_id) AND (l.company_id = l.company_id) AND (l.org_id = l.org_id))))));


--
-- Name: tds_ledger_mappings tds_ledger_mappings_read_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tds_ledger_mappings_read_member ON public.tds_ledger_mappings FOR SELECT TO authenticated USING (( SELECT public.tb_is_member(tds_ledger_mappings.org_id) AS tb_is_member));


--
-- Name: tds_ledger_mappings tds_ledger_mappings_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tds_ledger_mappings_update_member ON public.tds_ledger_mappings FOR UPDATE TO authenticated USING (( SELECT public.tb_is_member(tds_ledger_mappings.org_id) AS tb_is_member)) WITH CHECK ((( SELECT public.tb_is_member(tds_ledger_mappings.org_id) AS tb_is_member) AND (EXISTS ( SELECT 1
   FROM public.tb_ledgers l
  WHERE ((l.id = tds_ledger_mappings.ledger_id) AND (l.company_id = l.company_id) AND (l.org_id = l.org_id))))));


--
-- PostgreSQL database dump complete
--

\unrestrict Fxz9Gj8XIavOQk0Hq9BDXC3olAWeTmH9W9i31zjc1f9OjVlQBkurYJptoq5yiHO

