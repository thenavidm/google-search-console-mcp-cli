/**
 * The Search Console tools as Slipway tools.
 *
 * Each tool module describes its tools with `tool(server, ctx, spec)`: a name,
 * what it can change, a schema, and what it does with a live token. Here those
 * specs are recorded and handed to Slipway, which builds the MCP server and the
 * CLI from them. The token for the account a call names is resolved per call,
 * as it was in 1.x.
 */

import { ApiError, AuthError, NotConfiguredError, SlipwayError, UsageError, httpError, toolkit, z, type Tool } from "@thenavidm/slipway"
import { ApiError as SearchConsoleError } from "../api/client.js"
import { AuthError as SignInError } from "../auth.js"
import type { Config } from "../config.js"
import { normalizeSite } from "../api/client.js"
import { makeContext, type ToolContext, type ToolRegistrar, type ToolSpec } from "./shared.js"

/** What Slipway builds once per environment, and every handler receives. */
export type AppContext = { cfg: Config; tools: ToolContext }

type Args = Record<string, unknown>
type Spec = ToolSpec<z.ZodRawShape>
type Register = (server: ToolRegistrar, ctx: ToolContext) => void

function record(register: Register, ctx: ToolContext): Spec[] {
  const specs: Spec[] = []
  register({ add: (spec) => specs.push(spec) }, ctx)
  return specs
}

/**
 * A failure as the Slipway error that carries its exit code. Google's status
 * picks it; nothing signed in, an account that is not, or a key that cannot be
 * read is 10; a sign-in Google rejects is 4; an argument this server checks
 * itself is 2; Google out of reach is 5.
 */
export function toSlipway(error: unknown): unknown {
  if (error instanceof SlipwayError) return error
  if (error instanceof SearchConsoleError) {
    return httpError(error.status, error.message, { status: error.status, ...(error.reason ? { details: { reason: error.reason } } : {}) })
  }
  if (error instanceof SignInError) {
    return /^Not signed in|^No signed-in Google account matches|service account key/i.test(error.message)
      ? new NotConfiguredError(error.message)
      : new AuthError(error.message)
  }
  if (error instanceof TypeError && /fetch failed/i.test(error.message)) return new ApiError(`Could not reach Google: ${error.message}`)
  if (error instanceof Error && error.constructor === Error) return new UsageError(error.message)
  return error
}

/**
 * A few words for pickers, the command list and `which`. 0.2 had no titles, so
 * clients showed the name, and "Striking distance" says less than what it finds.
 */
const TITLES: Record<string, string> = {
  list_accounts: "Signed-in Google accounts",
  list_sites: "Properties this account can reach",
  get_site: "One property and its permission level",
  add_site: "Register a property",
  delete_site: "Remove a property",
  query_search_analytics: "Search analytics by any dimension",
  top_queries: "Top search queries by clicks",
  top_pages: "Top pages by clicks",
  compare_periods: "Compare two periods",
  striking_distance: "Queries just off page one",
  list_sitemaps: "Submitted sitemaps",
  get_sitemap: "One submitted sitemap",
  submit_sitemap: "Submit or resubmit a sitemap",
  delete_sitemap: "Stop tracking a sitemap",
  inspect_url: "What Google knows about a URL",
  inspect_urls: "Inspect several URLs",
  get_verification_token: "Token that proves ownership",
  verify_site: "Verify ownership",
  list_verified_sites: "Sites and domains verified",
}

function title(name: string): string {
  if (TITLES[name]) return TITLES[name]
  const words = name.split("_").join(" ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** What a confirmed call does that cannot be taken back, as its refusal and the approval form say it. */
const CONSEQUENCES: Record<string, string> = {
  delete_site: "removes the property from this Google account, and Google offers no undo",
  delete_sitemap: "drops the sitemap's submission history and coverage, which cannot be recovered",
}

/** What each write is about to do, for the audit log and a refusal. */
const SUMMARIES: Record<string, (args: Args) => string> = {
  add_site: (a) => `add property ${normalizeSite(String(a.site))}`,
  delete_site: (a) => `remove property ${normalizeSite(String(a.site))}`,
  submit_sitemap: (a) => `submit ${String(a.sitemap_url)} on ${normalizeSite(String(a.site))}`,
  delete_sitemap: (a) => `stop tracking ${String(a.sitemap_url)} on ${normalizeSite(String(a.site))}`,
}

const kit = toolkit<AppContext>()

/**
 * The tools, as Slipway serves them. A spec is recorded again for each config
 * the first time a call needs it, because a few read the config when they run.
 */
export function slipwayTools(register: Register): Tool<AppContext>[] {
  const bound = new WeakMap<Config, Map<string, Spec>>()
  const specFor = (ctx: AppContext, name: string): Spec => {
    let specs = bound.get(ctx.cfg)
    if (!specs) {
      specs = new Map(record(register, ctx.tools).map((spec) => [spec.name, spec]))
      bound.set(ctx.cfg, specs)
    }
    return specs.get(name)!
  }

  // The names, kinds and schemas do not depend on the config, so one pass with an empty one lists them.
  const listed = record(register, makeContext({} as Config))
  return listed.map((spec) => {
    const summary = SUMMARIES[spec.name]
    return kit.defineTool({
      name: spec.name,
      title: title(spec.name),
      description: spec.description,
      input: z.object(spec.schema),
      risk: spec.kind,
      // 0.2 marked its three writes idempotent, and each is: adding a property, submitting a sitemap or verifying again changes nothing.
      ...(spec.kind === "write" ? { idempotent: true } : {}),
      ...(spec.kind === "destructive" ? { consequence: CONSEQUENCES[spec.name] ?? "cannot be undone" } : {}),
      ...(summary ? { summary: (args: Args) => summary(args) } : {}),
      handler: async (args, ctx) => {
        try {
          const token = await ctx.tools.token(((args as Args).account as string | undefined) ?? null)
          return await specFor(ctx, spec.name).run(args as never, token)
        } catch (error) {
          throw toSlipway(error)
        }
      },
    })
  })
}
