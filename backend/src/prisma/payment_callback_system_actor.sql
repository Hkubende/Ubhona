-- Ubhona payment callback system audit actor
--
-- Why this exists:
-- - Provider callbacks do not originate from an authenticated tenant user.
-- - Callback audit rows still need a stable, foreign-key-valid actor identity.
-- - This seed formalizes the callback actor as a real reserved user row instead
--   of relying on an unbacked synthetic UUID.

BEGIN;

INSERT INTO public.users (id, name, email, role, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Payment Callback System',
  'system+payment-callback@internal.ubhona.invalid',
  'platform_admin',
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8i0s5momkMumZ5qX6Ch12yvDqOiiM2'
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role;

COMMIT;