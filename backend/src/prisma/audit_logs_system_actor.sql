BEGIN;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS system_actor_key text;

ALTER TABLE public.audit_logs
  ALTER COLUMN actor_user_id DROP NOT NULL;

DROP INDEX IF EXISTS public.audit_logs_system_actor_key_created_at_idx;
CREATE INDEX IF NOT EXISTS audit_logs_system_actor_key_created_at_idx
  ON public.audit_logs (system_actor_key, created_at);

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_identity_check;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_identity_check
  CHECK (num_nonnulls(actor_user_id, system_actor_key) = 1);

UPDATE public.audit_logs
SET
  system_actor_key = 'payment_provider_callback',
  actor_user_id = NULL
WHERE actor_user_id = '00000000-0000-0000-0000-000000000002'
  AND COALESCE(metadata_json ->> 'actorType', '') = 'payment_provider_callback'
  AND system_actor_key IS NULL;

COMMIT;