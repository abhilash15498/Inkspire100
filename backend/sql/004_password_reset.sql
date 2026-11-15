-- Password reset tokens for automated reset email flow
CREATE TABLE IF NOT EXISTS password_resets (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id);
CREATE INDEX IF NOT EXISTS password_resets_token_hash_idx ON password_resets (token_hash);
