import { z } from "zod"
import { resolveToken } from "../auth.js"
import type { Config } from "../config.js"
import type { Sensitivity } from "../safety.js"

export const ACCOUNT = z
  .string()
  .optional()
  .describe(
    "Which signed-in Google account to act as, by email. Omit to use the default. Call list_accounts to see what is signed in.",
  )

export const SITE = z
  .string()
  .describe(
    'The Search Console property. Either a URL-prefix property ("https://navid.me/", trailing slash included) or a domain property ("sc-domain:navid.me"). A bare hostname is read as a domain property. Call list_sites for the exact strings this account owns, because the two shapes are different properties and mixing them up returns a 403.',
  )

export interface ToolContext {
  cfg: Config
  token(account?: string | null): Promise<string>
}

export function makeContext(cfg: Config): ToolContext {
  return {
    cfg,
    async token(account) {
      const resolved = await resolveToken(cfg, account)
      return resolved.token
    },
  }
}

/** One tool: what it is called, what it can change, what it takes and what it does with a live token. */
export interface ToolSpec<S extends z.ZodRawShape> {
  name: string
  kind: Sensitivity
  description: string
  schema: S
  run: (args: z.infer<z.ZodObject<S>>, token: string) => Promise<unknown>
}

/** What each tool module hands its tools to. tools/kit.ts records them and Slipway serves them. */
export interface ToolRegistrar {
  add(spec: ToolSpec<z.ZodRawShape>): void
}

/**
 * Register a tool.
 *
 * Write safety is Slipway's now: it hides writes under GSC_READ_ONLY, asks for
 * confirmation before an irreversible call and writes the audit log, from the
 * `kind` each tool declares. A tool only says what it does.
 */
export function tool<S extends z.ZodRawShape>(server: ToolRegistrar, _ctx: ToolContext, spec: ToolSpec<S>): void {
  server.add(spec as unknown as ToolSpec<z.ZodRawShape>)
}
