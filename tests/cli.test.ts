/**
 * The CLI, now built by Slipway from the same tools as the MCP server.
 *
 * Parsing, help and output shapes are Slipway's and tested there. These cover
 * what this repo promises: every tool is a command, a task is found by what it
 * does, Google's failures keep the exit codes scripts branch on, the sign-in
 * commands still answer, and the docs stay in step with the code.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkApp, cli } from "@thenavidm/slipway/testing"
import { app } from "../src/app.js"
import { TOOLS } from "../src/tools/index.js"
import { errorResponse, fakeFetch } from "./helpers.js"

const env = { GSC_ACCESS_TOKEN: "fake" }
let store = ""

beforeEach(() => {
  store = join(mkdtempSync(join(tmpdir(), "gsc-")), "tokens.json")
  vi.stubEnv("GSC_TOKEN_STORE", store)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("Search Console CLI on Slipway", () => {
  it("makes all 19 tools commands, the two deletes needing confirmation", async () => {
    const context = JSON.parse((await cli(app, ["agent-context", "--brief"], { env: {} })).stdout)
    const commands = context.commands as Array<{ command: string; requires_confirm?: boolean }>
    expect(commands.map((c) => c.command)).toEqual(TOOLS.map((tool) => tool.name.replace(/_/g, "-")))
    expect(commands.filter((c) => c.requires_confirm).map((c) => c.command).sort()).toEqual(["delete-site", "delete-sitemap"])
  })

  it("finds the command for a task described in words", async () => {
    const first = async (...words: string[]) => (await cli(app, ["which", ...words], { env: {} })).stdout.split("\n")[0]
    expect(await first("submit", "a", "sitemap")).toContain("submit-sitemap")
    expect(await first("queries", "between", "positions", "5", "and", "20")).toContain("striking-distance")
  })

  it("reports a missing argument by its flag", async () => {
    const run = await cli(app, ["get-site", "--agent"], { env })
    expect(run.code).toBe(2)
    expect(JSON.parse(run.stderr).error).toContain("--site")
  })

  it("keeps the exit codes scripts branch on", async () => {
    // 0.2 gave 5 for 400 and 422; Google's status now says the request was the caller's to fix.
    for (const [status, code] of [[400, 2], [401, 4], [403, 4], [404, 3], [429, 7], [500, 5]] as const) {
      vi.stubGlobal("fetch", fakeFetch({ "/sites/": errorResponse(status, `Google answered ${status}.`) }).impl)
      const run = await cli(app, ["get-site", "--site", "sc-domain:example.com", "--agent"], { env })
      expect(run.code, `HTTP ${status}`).toBe(code)
      expect(JSON.parse(run.stderr).status, `HTTP ${status}`).toBe(status)
    }
  })

  it("exits 10 when nothing is signed in, saying how to sign in", async () => {
    const run = await cli(app, ["list-sites", "--agent"], { env: {} })
    expect(run.code).toBe(10)
    expect(JSON.parse(run.stderr).error).toMatch(/Not signed in/)
  })

  it("lists and forgets stored sign-ins with accounts and logout", async () => {
    writeFileSync(store, JSON.stringify({ default: "a@example.com", accounts: [{ email: "a@example.com", scopes: [] }, { email: "b@example.com", scopes: [] }] }))
    expect((await cli(app, ["accounts"], { env: {} })).stdout).toBe("a@example.com  (default)\nb@example.com\n")
    const out = await cli(app, ["logout", "b@example.com"], { env: {} })
    expect(out.code).toBe(0)
    expect(out.stdout).toContain("Forgot b@example.com.")
    expect((await cli(app, ["accounts"], { env: {} })).stdout).toBe("a@example.com  (default)\n")
    expect((await cli(app, ["logout"], { env: {} })).code).toBe(2)
  })

  it("passes slipway check", async () => {
    const report = await checkApp(app, { env: {} })
    expect(report.findings.filter((finding) => finding.level === "error")).toEqual([])
  })
})

describe("documentation stays in step with the code", () => {
  const read = (p: string): string => readFileSync(new URL(p, import.meta.url), "utf-8")
  const names = (text: string): Set<string> => new Set((text.match(/GSC_[A-Z_]+/g) ?? []).filter((name) => !name.endsWith("_")))
  const source = (dir: string): string =>
    readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })
      .map((entry) => (entry.isDirectory() ? source(`${dir}${entry.name}/`) : entry.name.endsWith(".ts") ? read(`${dir}${entry.name}`) : ""))
      .join("\n")

  /** Every variable the server reads: this repo's code, and Slipway's as agent-context lists them. */
  const used = async (): Promise<Set<string>> => {
    const context = JSON.parse((await cli(app, ["agent-context"], { env: {} })).stdout)
    return new Set([...names(source("../src/")), ...context.settings.map((setting: { env: string }) => setting.env)])
  }

  it("documents every environment variable the code reads", async () => {
    const documented = names(read("../README.md"))
    expect([...(await used())].filter((v) => !documented.has(v))).toEqual([])
  })

  it("names every environment variable in --help or agent-context", async () => {
    const help = (await cli(app, ["--help"], { env: {} })).stdout
    const context = JSON.parse((await cli(app, ["agent-context"], { env: {} })).stdout)
    const described = new Set(context.settings.map((setting: { env: string }) => setting.env))
    expect([...(await used())].filter((v) => !help.includes(v) && !described.has(v))).toEqual([])
  })

  it.each(["../README.md", "../INSTALL.md"])("has no dead in-page anchors in %s", (file) => {
    if (!existsSync(new URL(file, import.meta.url))) return
    const md = read(file).replace(/```[\s\S]*?```/g, "")
    // GitHub's slug keeps letters, marks, numbers and connector punctuation, so an
    // emoji's variation selector (U+FE0F) stays in the anchor and a link has to carry it.
    const slugs = new Set(
      [...md.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) =>
        (heading as string).trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, "").replace(/ /g, "-"),
      ),
    )
    const dead = [...md.matchAll(/\[[^\]]+\]\(#([^)]+)\)/g)].map((m) => decodeURIComponent(m[1] as string)).filter((a) => !slugs.has(a))
    expect(dead).toEqual([])
  })
})
