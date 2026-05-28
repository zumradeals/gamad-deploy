-- C-14 / ADR-0013 — GitHub OAuth tokens (chiffrés AES-256-GCM au repos)
CREATE TABLE IF NOT EXISTS "github_oauth_tokens" (
  "id"                 uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id"             uuid        NOT NULL,
  "user_id"            uuid        NOT NULL,
  "github_user_login"  text        NOT NULL,
  "github_user_id"     bigint      NOT NULL,
  "encrypted_token"    text        NOT NULL,
  "scopes"             text[]      NOT NULL DEFAULT '{}',
  "connected_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "github_oauth_tokens_org_id_fk"
    FOREIGN KEY ("org_id")  REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "github_oauth_tokens_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")         ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "github_oauth_tokens_org_user_uniq"
  ON "github_oauth_tokens"("org_id", "user_id");
