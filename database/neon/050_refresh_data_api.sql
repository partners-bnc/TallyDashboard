-- Run after the final schema/policy deployment. Neon Data API is PostgREST-compatible.
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
