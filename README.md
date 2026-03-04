# MegaLinter MCP Server

<!-- mcp-name: io.github.downatthebottomofthemolehole/megalinter-mcp-server -->

> **Note:** This is a community-maintained MCP server. It is not an official Model Context Protocol server, but it is **sanctioned by Ox Security** as a complement to their official MegaLinter tools.

[![CI Status](https://github.com/DownAtTheBottomOfTheMoleHole/megaliter-mcp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DownAtTheBottomOfTheMoleHole/megaliter-mcp/actions/workflows/ci.yml)
[![Publish Status](https://github.com/DownAtTheBottomOfTheMoleHole/megaliter-mcp/actions/workflows/publish.yml/badge.svg)](https://github.com/DownAtTheBottomOfTheMoleHole/megaliter-mcp/actions/workflows/publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen)](https://nodejs.org/)

A Model Context Protocol (MCP) server for running [Ox Security MegaLinter](https://megalinter.io/) through `mega-linter-runner`, using Azure DevOps-style argument mapping.

## Overview

This server provides three MCP tools:

- `megalinter_run` to execute MegaLinter with configurable runtime and runner options.
- `megalinter_write_config` to generate a minimal `.mega-linter.yml` file.
- `megalinter_list_flavors` to return common MegaLinter flavors.

## Tools

### `megalinter_run`

Runs `mega-linter-runner` via `npx`.

Inputs:

- `workingDirectory` (string, optional): Command working directory. Defaults to current process directory.
- `path` (string, optional): Directory path to lint.
- `flavor` (string, optional): MegaLinter flavor. Default: `all`.
- `release` (string, optional): MegaLinter image tag. Default: `v9`.
- `image` (string, optional): Full Docker image override.
- `env` (string, optional): Environment variable string passed to `--env`.
- `fix` (boolean, optional): Apply auto-fixes.
- `help` (boolean, optional): Show `mega-linter-runner` help.
- `install` (boolean, optional): Generate MegaLinter starter config.
- `containerName` (string, optional): Docker container name override.
- `removeContainer` (boolean, optional): Remove container after run.
- `configFile` (string, optional): Path to `.mega-linter.yml`.
- `reportsPath` (string, optional): Reports directory. Default: `megalinter-reports`.
- `disableLinters` (string, optional): Comma-separated list of linters to disable.
- `lintChangedFilesOnly` (boolean, optional): Sets `VALIDATE_ALL_CODEBASE=false` when true.
- `runnerVersion` (string, optional): npm version for `mega-linter-runner` (for example `latest`).
- `timeoutSeconds` (number, optional): Timeout in seconds. Default: `3600`.
- `extraArgs` (string[], optional): Additional CLI arguments.

### `megalinter_write_config`

Writes a minimal MegaLinter configuration.

Inputs:

- `targetPath` (string, optional): Output file path. Default: `.mega-linter.yml`.
- `applyFixes` (string, optional): Value for `APPLY_FIXES`. Default: `none`.
- `showElapsedTime` (boolean, optional): Value for `SHOW_ELAPSED_TIME`. Default: `true`.
- `flavorSuggestions` (boolean, optional): Value for `FLAVOR_SUGGESTIONS`. Default: `false`.
- `disableLinters` (string[], optional): Values for `DISABLE_LINTERS`.

### `megalinter_list_flavors`

Returns the built-in list of common flavors (`all`, `javascript`, `python`, `terraform`, and others).

## Dependencies

### System Dependencies

- Node.js `>=24.0.0`
- npm (bundled with Node.js)
- Docker Engine or Docker Desktop (must be running for `megalinter_run`)
- Optional local container runtime wrapper such as Colima

### npm Dependencies

Runtime:

- `@modelcontextprotocol/sdk` (MCP server SDK)

Development:

- `typescript` (build/compile)
- `tsx` (development runner)
- `@types/node` (Node.js typings)

Runtime note:

- `mega-linter-runner` is executed via `npx` at runtime and can be pinned with the `runnerVersion` tool input.

## Installation

```bash
npm install
npm run build
```

## Configuration

### Usage with VS Code

This workspace is preconfigured in `.vscode/mcp.json`:

```json
{
  "servers": {
    "megalinter-ox-security": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/index.js"]
    }
  }
}
```

Reload VS Code (`Cmd+Shift+P` → `Developer: Reload Window`) after changing MCP configuration.

## Running

```bash
npm start
```

Development mode:

```bash
npm run dev
```

## Debugging

Use `.vscode/launch.json`:

- `Debug MCP Server` (runs `npm run dev`)
- `Debug MCP Server (Built)` (runs `dist/index.js` after build)

Set breakpoints in `src/index.ts`, then press `F5`.

## Testing

See [TESTING.md](./TESTING.md) for Copilot Chat scenarios, manual JSON-RPC checks, and troubleshooting guidance.

Quick validation prompt in Copilot Chat:

```text
@megalinter-ox-security list available flavors
```

## Related Projects

### Official MegaLinter Resources

- [MegaLinter website](https://megalinter.io/) — Comprehensive documentation and configuration guide
- [MegaLinter repository](https://github.com/oxsecurity/megalinter) — Source code and issue tracking
- [mega-linter-runner](https://www.npmjs.com/package/mega-linter-runner) — npm package used by this server

### Azure DevOps Integration

- [MegaLinter Azure DevOps Extension](https://github.com/downatthebottomofthemolehole/megalinter-ado) — Official ADO task by the same author (also sanctioned by Ox Security)

### Model Context Protocol

- [MCP official documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP servers registry](https://github.com/mcp)

## Community & Contributing

- 🤝 **[Contributing Guide](./CONTRIBUTING.md)** — Start here to contribute code, report bugs, or request features
- 🔒 **[Security Policy](./SECURITY.md)** — Report vulnerabilities responsibly
- 📝 **[Compliance & Updates](./COMPLIANCE_AND_UPDATES.md)** — MegaLinter and Renovate configuration details
- 🧪 **[Testing Guide](./TESTING.md)** — Manual testing and validation procedures
- ⚙️ **[GitHub Automation](./GITHUB_AUTOMATION.md)** — How CI/CD workflows operate

## Attribution & License

Maintained by Carl Dawson under the [Down At The Bottom Of The Mole Hole](https://github.com/downatthebottomofthemolehole) organization.

Licensed under the MIT License. MegaLinter is managed by [Ox Security](https://www.ox.security/).
