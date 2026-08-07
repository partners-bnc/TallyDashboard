begin;

-- Tally has additional operational order families such as Job Work Out Order.
-- An order is a commitment, not an accounting posting, regardless of its
-- prefix. Keep it available in raw voucher data but outside the books.
create or replace function public.tb_voucher_affects_books(voucher public.tb_vouchers)
returns boolean
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select not coalesce(voucher.is_cancelled, false)
     and not coalesce(voucher.is_deleted, false)
     and not coalesce(voucher.is_optional, false)
     and lower(trim(coalesce(voucher.voucher_type, ''))) not like '% order'
$$;

commit;