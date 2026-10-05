/**
 * The Search Console app: everything Slipway needs to ship the MCP server and the CLI.
 *
 * This file only describes. It never starts anything, so `slipway check` and
 * tests can import it; `index.ts` is what runs.
 */

import { createRequire } from "node:module"
import { SlipwayError, slipway, type CliIO, type DoctorCheck } from "@thenavidm/slipway"
import { request, VERIFY_BASE, WMX_BASE } from "./api/client.js"
import { forgetAccount, listStoredAccounts, login, resolveToken } from "./auth.js"
import { loadConfig, scopes, tokenStorePath } from "./config.js"
import { INSTRUCTIONS } from "./instructions.js"
import { TOOLS } from "./tools/index.js"
import { toSlipway, type AppContext } from "./tools/kit.js"
import { makeContext } from "./tools/shared.js"

const require = createRequire(import.meta.url)
export const VERSION: string = (require("../package.json") as { version: string }).version

const message = (error: unknown): string => (error as Error)?.message ?? String(error)

/** Whether any credential is set: a stored sign-in, a service account or a token. */
async function signedIn({ cfg }: AppContext): Promise<boolean> {
  if (cfg.staticAccessToken || cfg.serviceAccountKeyPath || cfg.serviceAccountKeyJson) return true
  return (await listStoredAccounts()).accounts.length > 0
}

/**
 * The checks 0.2's doctor ran, which always call Google: which credential is
 * in use, whether it yields a live token, what Search Console it reaches, and
 * whether the optional verification scope works.
 */
async function doctor({ cfg }: AppContext): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = []
  const { accounts } = await listStoredAccounts()
  const haveServiceAccount = Boolean(cfg.serviceAccountKeyPath || cfg.serviceAccountKeyJson)
  if (accounts.length) {
    checks.push({ name: "Signed in", ok: true, detail: `${accounts.map((a) => a.email).join(", ")}, stored at ${tokenStorePath()}` })
    checks.push(
      cfg.clientId && cfg.clientSecret
        ? { name: "OAuth client", ok: true, detail: "GSC_CLIENT_ID and GSC_CLIENT_SECRET are set, so tokens refresh automatically" }
        : {
            name: "OAuth client",
            ok: false,
            detail: "a sign-in is stored but GSC_CLIENT_ID and GSC_CLIENT_SECRET are not set, so the token cannot be refreshed: calls work until the current hour is up, then fail",
            fix: "Set GSC_CLIENT_ID and GSC_CLIENT_SECRET to the Desktop OAuth client used at login.",
          },
    )
  } else if (haveServiceAccount) {
    checks.push({ name: "Credential", ok: true, detail: "a service account key, so no browser sign-in is needed" })
  } else if (cfg.staticAccessToken) {
    checks.push({ name: "Credential", ok: true, warn: true, detail: "GSC_ACCESS_TOKEN, which is never refreshed and stops working about an hour after it was minted" })
  } else {
    return checks
  }

  let token: string
  try {
    const resolved = await resolveToken(cfg)
    token = resolved.token
    checks.push({ name: "Token", ok: true, detail: `live for ${resolved.account}, by ${resolved.source}` })
  } catch (error) {
    checks.push({ name: "Token", ok: false, detail: message(error) })
    return checks
  }

  try {
    const res = await request<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(token, `${WMX_BASE}/sites`)
    const sites = res.siteEntry || []
    const writable = sites.filter((s) => s.permissionLevel === "siteOwner" || s.permissionLevel === "siteFullUser")
    checks.push(
      sites.length
        ? { name: "Search Console", ok: true, detail: `${sites.length} propert${sites.length === 1 ? "y" : "ies"}, ${writable.length} writable. First: ${sites[0]!.siteUrl}` }
        : {
            name: "Search Console",
            ok: true,
            warn: true,
            detail: haveServiceAccount
              ? "the API answered but this account owns no properties. A service account is a separate identity: add its client_email as a user on each property under Settings, Users and permissions"
              : "the API answered but this account owns no properties. Sign in with the Google account that owns them",
          },
    )
  } catch (error) {
    checks.push({ name: "Search Console", ok: false, detail: message(error) })
  }

  // The verification scope is optional, and its absence should not read as breakage.
  if (scopes().some((scope) => scope.includes("siteverification"))) {
    try {
      await request(token, `${VERIFY_BASE}/webResource`)
      checks.push({ name: "Site verification", ok: true, detail: "the siteverification scope works, so add_site and verify_site can stand up a new property" })
    } catch (error) {
      checks.push({ name: "Site verification", ok: true, warn: true, detail: `unavailable: ${message(error)} Only get_verification_token and verify_site need it.` })
    }
  } else {
    checks.push({ name: "Site verification", ok: true, warn: true, detail: "GSC_SCOPES leaves out siteverification, so the verification tools will fail. Everything else works." })
  }
  return checks
}

/** The exit code a failure carries, as Slipway gives it everywhere else. */
function fail(io: CliIO, error: unknown): number {
  const mapped = toSlipway(error)
  io.stderr(`${message(mapped)}\n`)
  return mapped instanceof SlipwayError ? mapped.exitCode : 1
}

export type AppOptions = {
  /** Replace how handlers get their context, for tests that stub the network. */
  context?: (env: NodeJS.ProcessEnv) => AppContext
}

export function createApp(options: AppOptions = {}) {
  return slipway<AppContext>({
    name: "google-search-console",
    title: "Google Search Console",
    version: VERSION,
    package: "@thenavidm/google-search-console-mcp-cli",
    envPrefix: "GSC",
    description: "What Google Search recorded about a site: clicks, impressions, CTR and position by query, page, country and device, URL inspection, sitemaps and verification.",
    instructions: INSTRUCTIONS,
    context:
      options.context ??
      ((env) => {
        const cfg = loadConfig(env)
        return { cfg, tools: makeContext(cfg) }
      }),
    configured: signedIn,
    secrets: (ctx) => [ctx.cfg.staticAccessToken, ctx.cfg.clientSecret, ctx.cfg.serviceAccountKeyJson],
    tools: TOOLS,
    doctor,
    doctorNetwork: true,
    // 0.2 served HTTP on 8000, and its Dockerfile and docs still say so.
    httpPort: 8000,
    // 0.2 took the two deletes off the list under GSC_ALLOW_DESTRUCTIVE=0, as read-only mode does every write.
    defaults: { destructiveOff: "hide" },
    login: {
      usage: "login [--port N]",
      help: "sign in to a Google account",
      run: async (io, args) => {
        const at = args.indexOf("--port")
        const port = at === -1 ? undefined : Number(args[at + 1])
        try {
          const account = await login(loadConfig(io.env), { port })
          io.stdout(`Signed in as ${account.email}.\nRun \`doctor\` to check what it can reach.\n`)
          return 0
        } catch (error) {
          return fail(io, error)
        }
      },
    },
    commands: [
      {
        name: "logout",
        usage: "logout <email>",
        help: "forget a signed-in account",
        run: async (io, args) => {
          const email = args[0]
          if (!email) {
            io.stderr("Which account? Pass the email, e.g. `logout you@example.com`. `accounts` lists them.\n")
            return 2
          }
          const removed = await forgetAccount(email)
          io.stdout(removed ? `Forgot ${email}.\n` : `No stored account matched ${email}.\n`)
          io.stdout("This only removes the local copy. To revoke Google's grant as well, visit https://myaccount.google.com/permissions\n")
          return removed ? 0 : 3
        },
      },
      {
        name: "accounts",
        help: "list signed-in accounts",
        run: async (io) => {
          const { accounts, default: def } = await listStoredAccounts()
          if (!accounts.length) {
            io.stdout("No accounts signed in. Run `login`.\n")
            return 0
          }
          for (const a of accounts) io.stdout(`${a.email}${a.email === def ? "  (default)" : ""}\n`)
          return 0
        },
      },
    ],
    settings: [
      { env: "GSC_ACCESS_TOKEN", description: "A token minted elsewhere, such as by gcloud; never refreshed.", secret: true },
      { env: "GSC_SERVICE_ACCOUNT_KEY", description: "Path to a service account JSON key, for machines with no browser." },
      { env: "GSC_SERVICE_ACCOUNT_KEY_JSON", description: "The same key inline, raw or base64.", secret: true },
      { env: "GSC_CLIENT_ID", description: "A Desktop OAuth client's ID, for login and for refreshing a stored sign-in." },
      { env: "GSC_CLIENT_SECRET", description: "That client's secret.", secret: true },
      { env: "GSC_TOKEN_STORE", description: "Where sign-ins are kept; ~/.google-search-console-mcp/tokens.json when unset.", tuning: true },
      { env: "GSC_SCOPES", description: "The scopes login asks for; webmasters and siteverification when unset.", tuning: true },
    ],
    links: { repository: "https://github.com/thenavidm/google-search-console-mcp-cli" },
  })
}

export const app = createApp()
