import type { ToolContext, ToolRegistrar } from "./shared.js"
import { registerSiteTools } from "./sites.js"
import { registerAnalyticsTools } from "./analytics.js"
import { registerSitemapTools } from "./sitemaps.js"
import { registerInspectTools } from "./inspect.js"
import { registerVerificationTools } from "./verification.js"
import { slipwayTools } from "./kit.js"

/* Grouped by what they reach, not by which endpoint they call. The reader's
   question is always "what can this see", never "which URL is behind it". */
export function registerAllTools(server: ToolRegistrar, ctx: ToolContext): void {
  registerSiteTools(server, ctx)
  registerAnalyticsTools(server, ctx)
  registerSitemapTools(server, ctx)
  registerInspectTools(server, ctx)
  registerVerificationTools(server, ctx)
}

/** Every tool, as Slipway serves it over MCP and the CLI. */
export const TOOLS = slipwayTools(registerAllTools)
