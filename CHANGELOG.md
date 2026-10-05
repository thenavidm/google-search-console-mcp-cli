# Versions

| Component | Version | Checked |
|---|---|---|
| `@thenavidm/slipway` | 0.1.21 | 2026-10-05 |
| MCP TypeScript SDK, through Slipway | 2.3.0 | 2026-10-05 |
| `zod` | 4.5.4 | 2026-10-05 |
| Google Search Console API | v1, discovery revision 20260830 | 2026-09-01 |
| Google Site Verification API | v1 | 2026-09-01 |
| Node | >= 22 | 2026-10-05 |

## 0.3.0, 2026-10-05

Built on [Slipway](https://github.com/thenavidm/slipway) 0.1.21. The 19 tools keep their names and arguments, and every difference below was measured against 0.2.2, the last version on npm, before release.

- **`which <words>` finds a command**, and `agent-context` describes every command, flag and setting as JSON. In Codex 0.159.3, finding the command for the queries a site ranks just off page one, and its flags, took a median of 62,056 input tokens over the CLI instead of 83,685 (five runs each). Every 0.2.2 run read the general help, the command list and then the command's help; every 0.3.0 run read the general help and asked `which`, which answered with the command's help: two commands instead of three, and each one carries the conversation so far.
- **Each tool has a title that says what it finds.** 0.2.2 gave clients the name, so `striking_distance` was "striking_distance"; it is now "Queries just off page one", and `which` reads titles too.
- **A person approves each delete over MCP.** `delete_site` and `delete_sitemap` still need confirmation. Claude Code (2.1.246 and later) shows its own prompt, and a client that can show forms asks with an approval form whose one box starts unticked. Approvals are signed, bound to the exact call and work once. Where a client can do neither, the model's `confirm: true` still counts, and `GSC_CONFIRM=model` makes it enough everywhere. The refusal names the property or the sitemap and says what is lost: "removes the property from this Google account, and Google offers no undo". `GSC_ALLOW_DESTRUCTIVE=0` still takes both deletes off the list, and `GSC_READ_ONLY=1` all five writes.
- **Google's status picks the exit code.** A request Google rejects (400 or 422) exits 2 where 0.2.2 usually exited 5. 401 and 403 still exit 4, 404 3 and 429 7, and anything else from Google 5. Nothing signed in, no signed-in account matching the one named, or a service account key that cannot be read exits 10, a sign-in Google rejects 4, and Google out of reach 5. 1 now means an unexpected error.
- **Smaller answers over MCP.** A result is compact JSON, where 0.2.2 indented it, so the same answer costs fewer tokens. A failure is JSON too, with Slipway's `code`, Google's `status` and its `reason` under `details`, where 0.2.2 sent "Error:" and the message.
- **A smaller tool list.** Each tool no longer repeats `$schema` or an `execution` block saying it runs no background tasks, so the list is 6,528 o200k tokens instead of 6,880, and Claude Code 2.1.286 spends 8,686 tokens a message on it with every tool loaded instead of 9,208.
- **Less to install and start.** npx installs 4 packages instead of 94: Slipway brings the MCP SDK's 2.x server package, which carries no web framework, where 0.2.2 brought Express. The entry turns on Node's compile cache, and the server spends 200 ms of CPU before its first answer where 0.2.2 spent 229, and answers in 170 ms of wall time instead of 176 (median of 21 runs, taking turns on one Mac).
- **`install <client>`** adds the server to Claude Code, Codex, Claude Desktop, Cursor, VS Code or Gemini CLI in each one's own format. `login`, `logout`, `accounts` and `doctor` work as they did, and `doctor` runs 0.2.2's checks: the credential in use, a live token, the properties it reaches and the verification scope.
- **`--http` keeps 0.2.2's port, 8000, and its `--host` flag and `PORT` variable,** and still refuses to listen beyond this machine without `GSC_HTTP_TOKEN`. It now also refuses a page from another site unless `GSC_HTTP_ALLOWED_ORIGINS` lists it.
- **Docs.** The README's costs are measured against 0.2.2, where they were 2026-09-27's; section 9 gains a settings table listing every variable; the contents links to sections 6 and 7 work on GitHub, which keeps an emoji's variation selector in the anchor; and `SKILL.md` lists exit codes 1 and 10, says how a delete is confirmed now, and costs 3,140 tokens in Claude Code instead of 3,142.

### Upgrading

Node 22 or later is required; 0.2.2 ran on 20. Over MCP, expect an approval prompt or form before a delete; a headless agent that should run them with `confirm: true` alone needs `GSC_CONFIRM=model`. A script that read exit 5 as a request Google rejected should read 2. An error in the terminal is one JSON object with `error`, Slipway's `code` (`usage`, `refused`, `auth`, `not_found`, `rate_limited`, `timeout`, `api`, `not_configured`) and often a `hint`, plus Google's `status` when it answered; 0.2.2 printed `error` alone. Over MCP, an error is that JSON, where 0.2.2 sent "Error:" and its message as plain text, and a result is compact JSON rather than indented. With `GSC_READ_ONLY=1` or `GSC_ALLOW_DESTRUCTIVE=0`, a client that calls a hidden tool gets "tool not found", and that call is not in the audit log; the CLI still names the setting. The audit log's lines carry a summary of the call, such as the property and the sitemap, where 0.2.2 wrote the redacted arguments, and gain `surface`, `risk` and `confirmed_by`; each allowed call is followed by a `done` or `failed` line. Each delete's `confirm` argument now reads "Set true only when the user asked for exactly this action." The server now tells clients its name is `google-search-console`, where 0.2.2 said `google-search-console-mcp`. A missing argument's error is 15 tokens longer, for its code and a hint.

## 0.2.2, 2026-10-04

- **`npx -y @thenavidm/google-search-console-mcp-cli` always starts the MCP server.** npx starts whichever binary the npm registry lists first when they share one file, and the registry does not keep the published order, so an MCP client set up with this README's install line could get `google-search-console-cli` and its command list instead of a server. A third binary named after the package now always starts the server, and npx picks it by name.

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
