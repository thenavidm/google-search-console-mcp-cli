# Versions

| Component | Version | Checked |
|---|---|---|
| `@modelcontextprotocol/sdk` | 1.30.0 | 2026-09-01 |
| `zod` | 4.5.4 | 2026-09-01 |
| `express` | 5.1.0 | 2026-09-01 |
| Google Search Console API | v1, discovery revision 20260830 | 2026-09-01 |
| Google Site Verification API | v1 | 2026-09-01 |
| Node | >= 20 | |

## 0.2.1

**A refusal says `--confirm` in a terminal.** The server words it for an AI, as `confirm: true`, and the CLI now rewrites that one phrase, so the command it asks for is the one you type. The command list only mentions `--confirm` where a tool takes it.

**The README shows the context cost measured in Claude Code**: every tool loaded, Claude Code's default tool search, and the CLI's `SKILL.md`, each from 2 real runs.

## 0.2.0

**A CLI.** `google-search-console-cli` runs every tool as a shell command. It builds the same server the MCP binary runs and calls it through the SDK's in-memory transport, so the flags, the validation and the write guard are the ones an MCP app gets, and the two surfaces cannot drift. Agents that run commands, like Claude Code and Codex, use it without paying for the tool list on every turn. Exit codes follow the house contract: 2 usage or a refused write, 3 not found, 4 auth, 5 API, 7 rate limited, 10 nothing configured.

**Renamed to google-search-console-mcp-cli**, the name every server with a CLI carries. The old package is deprecated with a pointer here, and GitHub redirects the old repo address.

**A Claude Desktop extension.** `desktop-extension/build.sh` produces a `.mcpb` that installs on a double click. Each release carries the file.

Checked against a live account before release: the MCP tool list is byte-identical to 0.1.0's, and the CLI and the MCP server both read real Search Console data.

## 0.1.0

First release. 19 tools over the Search Console API and the Site Verification
API.

Search performance: `top_queries`, `top_pages`, `compare_periods`,
`striking_distance`, `query_search_analytics`. The middle two answer questions
the API cannot express in a single call and the Search Console UI cannot express
at all without an export.

Indexing: `inspect_url`, `inspect_urls`.

Sitemaps: `list_sitemaps`, `get_sitemap`, `submit_sitemap`, `delete_sitemap`.

Properties: `list_sites`, `get_site`, `add_site`, `delete_site`,
`list_accounts`.

Verification: `get_verification_token`, `verify_site`, `list_verified_sites`.

Three credential routes: browser sign-in with automatic refresh, service account
for headless environments, and a static token for anyone who already has one.
Multiple Google accounts on the same install, selected per call.

stdio and streamable HTTP transports. The HTTP transport refuses to bind
anything but loopback without `GSC_HTTP_TOKEN`.
