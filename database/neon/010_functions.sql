-- Generated from the live Supabase function definitions on 2026-08-21.
-- Neon Data API exposes auth.uid() for UUID subject claims.

CREATE OR REPLACE FUNCTION public.tb_is_member(target_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select exists (select 1 from public.tb_org_members m where m.org_id = target_org and m.user_id = (select auth.uid())); $function$;

CREATE OR REPLACE FUNCTION public.tb_voucher_affects_books(voucher tb_vouchers)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select not coalesce(voucher.is_cancelled, false)
     and not coalesce(voucher.is_deleted, false)
     and not coalesce(voucher.is_optional, false)
     and lower(trim(coalesce(voucher.voucher_type, ''))) not like '% order'
$function$;


