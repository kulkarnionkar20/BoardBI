import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(
      `Missing required env var: ${name}. Copy server/.env.example to server/.env and set it.`,
    );
  }
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number(optional("PORT", "3001")),
  encryptionKeyB64: required("APP_ENCRYPTION_KEY"),
  jiraUserAgent: optional("JIRA_USER_AGENT", "BoardBI/0.0.0"),
  databaseUrl: optional("DATABASE_URL", "file:./dev.db"),
};
