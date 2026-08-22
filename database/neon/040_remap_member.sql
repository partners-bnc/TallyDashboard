-- Run only after the requested user has been created through Neon Managed Auth
-- and password sign-in has returned its UUID.
-- psql variables required: old_user_id, neon_user_id, and member_email.
BEGIN;

CREATE TEMP TABLE member_remap_candidate (
  old_user_id uuid NOT NULL,
  new_user_id uuid NOT NULL,
  member_email text NOT NULL
) ON COMMIT DROP;

INSERT INTO member_remap_candidate (old_user_id, new_user_id, member_email)
SELECT :'old_user_id'::uuid, id, :'member_email'::text
FROM neon_auth."user"
WHERE id = :'neon_user_id'::uuid
  AND lower(email) = lower(:'member_email');

DO $$
DECLARE
  replacement_count integer;
BEGIN
  SELECT count(*) INTO replacement_count FROM member_remap_candidate;

  IF replacement_count <> 1 THEN
    RAISE EXCEPTION 'Expected the explicit Neon user UUID and email to match exactly once, found %', replacement_count;
  END IF;
END
$$;

DO $$
DECLARE
  source_count integer;
BEGIN
  SELECT count(*) INTO source_count
  FROM public.tb_org_members member
  JOIN public.tb_organizations organization ON organization.id = member.org_id
  JOIN member_remap_candidate candidate ON candidate.old_user_id = member.user_id
  WHERE member.user_id = candidate.old_user_id
    AND organization.name = 'TallyBridge Demo Org'
    AND member.role = 'owner';
  IF source_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one source owner membership for TallyBridge Demo Org, found %', source_count;
  END IF;
END
$$;

UPDATE public.tb_org_members m
SET user_id = candidate.new_user_id
FROM member_remap_candidate candidate
WHERE m.user_id = candidate.old_user_id;

DO $$
DECLARE
  mapped_count integer;
BEGIN
  SELECT count(*) INTO mapped_count
  FROM public.tb_org_members member
  JOIN public.tb_organizations organization ON organization.id = member.org_id
  JOIN neon_auth."user" auth_user ON auth_user.id = member.user_id
  JOIN member_remap_candidate candidate ON candidate.new_user_id = member.user_id
  WHERE member.user_id = candidate.new_user_id
    AND lower(auth_user.email) = lower(candidate.member_email)
    AND organization.name = 'TallyBridge Demo Org'
    AND member.role = 'owner';
  IF mapped_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one remapped owner membership, found %', mapped_count;
  END IF;
END
$$;

ALTER TABLE public.tb_org_members VALIDATE CONSTRAINT tb_org_members_user_id_fkey;
COMMIT;
