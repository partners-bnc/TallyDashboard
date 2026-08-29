-- Persist non-TDS report mappings without restoring the two decision tables
-- intentionally removed by the final source migration.
ALTER TABLE public.compliance_mapping_profiles
  ADD COLUMN IF NOT EXISTS selected_groups text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS ledger_decisions jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.compliance_mapping_profiles'::regclass
      AND conname = 'compliance_mapping_profiles_ledger_decisions_array_check'
  ) THEN
    ALTER TABLE public.compliance_mapping_profiles
      ADD CONSTRAINT compliance_mapping_profiles_ledger_decisions_array_check
      CHECK (jsonb_typeof(ledger_decisions) = 'array');
  END IF;
END
$$;

COMMENT ON COLUMN public.compliance_mapping_profiles.selected_groups IS
  'Selected Tally group names for non-TDS report mappings.';
COMMENT ON COLUMN public.compliance_mapping_profiles.ledger_decisions IS
  'Per-ledger overrides for non-TDS report mappings.';
