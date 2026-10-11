-- London Life — platform quality (spec ch. 35–36): account recovery and attempt throttling.

-- A reset token is stored only as a SHA-256 hash; the raw token exists in the link alone.
-- Tokens are single-use (used_at) and expire after 30 minutes (expires_at).
CREATE TABLE password_reset_tokens (
  token_hash  text PRIMARY KEY,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
CREATE INDEX password_reset_by_account ON password_reset_tokens (account_id, created_at DESC);

-- Throttle buckets for sign-in failures, reset requests, reset attempts and password changes.
-- Buckets hold hashes of emails and addresses, never the raw values.
CREATE TABLE auth_attempts (
  id          bigserial PRIMARY KEY,
  bucket      text NOT NULL,
  created_at  timestamptz NOT NULL
);
CREATE INDEX auth_attempts_by_bucket ON auth_attempts (bucket, created_at);

ALTER TABLE accounts ADD COLUMN password_changed_at timestamptz;
