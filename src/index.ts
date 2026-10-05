#!/usr/bin/env node
/**
 * Both binaries. `google-search-console-mcp` with no arguments serves MCP over
 * stdio, `--http` serves it over HTTP, and any command runs one tool from the
 * shell.
 *
 * Node's compile cache goes on before the app loads, so every launch after the
 * first skips compiling it again. NODE_DISABLE_COMPILE_CACHE=1 turns it off.
 */

import * as nodeModule from "node:module"

nodeModule.enableCompileCache?.()

// 0.2 took --host and read PORT for --http; Slipway reads GSC_HTTP_HOST and
// GSC_HTTP_PORT, so the old spellings, which the Dockerfile and existing
// deployments use, become those.
const argv = process.argv.slice(2)
if (argv.includes("--http")) {
  const at = argv.indexOf("--host")
  if (at !== -1 && argv[at + 1]) {
    process.env.GSC_HTTP_HOST = argv[at + 1]
    argv.splice(at, 2)
  }
  if (process.env.PORT && !process.env.GSC_HTTP_PORT) process.env.GSC_HTTP_PORT = process.env.PORT
}

const { app } = await import("./app.js")
await app.main(argv)
