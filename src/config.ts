/**
 * Settings and accounts, read from the environment once at startup.
 *
 * Environment variables rather than CLI flags throughout. Someone configuring
 * an MCP client is already editing a JSON `env` block; flags mean editing
 * `args` as a separate array, and the two drift.
 */

import { homedir } from "node:os"
import { join } from "node:path"

export const ENV_PREFIX = "GSC"

/** Where the OAuth refresh token is cached between runs. */
export function tokenStorePath(): string {
  const override = process.env.GSC_TOKEN_STORE?.trim()
  if (override) return expandHome(override)
  return join(homedir(), ".google-search-console-mcp", "tokens.json")
}

export function expandHome(p: string): string {
  return p.startsWith("~") ? join(homedir(), p.slice(1)) : p
}

export interface Config {
  /** OAuth client, needed for `login` and for refreshing a cached token. */
  clientId: string | null
  clientSecret: string | null
  /** Service account key, for servers and CI where no browser exists. */
  serviceAccountKeyPath: string | null
  serviceAccountKeyJson: string | null
  /** A token somebody already minted elsewhere, e.g. `gcloud auth print-access-token`. */
  staticAccessToken: string | null
}

function envStr(env: NodeJS.ProcessEnv, name: string): string | null {
  const v = env[name]?.trim()
  return v ? v : null
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    clientId: envStr(env, "GSC_CLIENT_ID"),
    clientSecret: envStr(env, "GSC_CLIENT_SECRET"),
    serviceAccountKeyPath: envStr(env, "GSC_SERVICE_ACCOUNT_KEY") ? expandHome(envStr(env, "GSC_SERVICE_ACCOUNT_KEY")!) : null,
    serviceAccountKeyJson: envStr(env, "GSC_SERVICE_ACCOUNT_KEY_JSON"),
    staticAccessToken: envStr(env, "GSC_ACCESS_TOKEN"),
  }
}

/**
 * Scopes.
 *
 * `webmasters` covers reading search analytics and writing properties and
 * sitemaps. `siteverification` is what lets the server claim a new domain
 * without a trip to the Search Console UI. Both are requested at login; a
 * read-only deployment can narrow to `webmasters.readonly` by setting
 * GSC_SCOPES, and the verification tools then fail with Google's own message.
 */
export const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/siteverification",
]

export function scopes(): string[] {
  const override = process.env.GSC_SCOPES?.trim()
  return override ? override.split(/[\s,]+/).filter(Boolean) : DEFAULT_SCOPES
}
