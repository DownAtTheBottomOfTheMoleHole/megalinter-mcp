# MegaLinter MCP Server

<!-- mcp-name: io.github.downatthebottomofthemolehole/megalinter-mcp-server -->

> **Note:** This is a community-maintained MCP server. It is not an official Model Context Protocol server, but it is **sanctioned by Ox Security** as a complement to their official MegaLinter tools.

[![CI/Publish](https://github.com/DownAtTheBottomOfTheMoleHole/megalinter-mcp/actions/workflows/publish-mcp.yml/badge.svg)](https://github.com/DownAtTheBottomOfTheMoleHole/megalinter-mcp/actions/workflows/publish-mcp.yml)
[![Coverage](https://codecov.io/github/DownAtTheBottomOfTheMoleHole/megalinter-mcp/graph/badge.svg?branch=main)](https://codecov.io/github/DownAtTheBottomOfTheMoleHole/megalinter-mcp)
[![npm](https://img.shields.io/npm/v/@downatthebottomofthemolehole/megalinter-mcp-server.svg)](https://www.npmjs.com/package/@downatthebottomofthemolehole/megalinter-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen)](https://nodejs.org/)

A Model Context Protocol (MCP) server for running [Ox Security MegaLinter](https://megalinter.io/) through `mega-linter-runner`. Works with any CI/CD platform (GitHub Actions, GitLab CI, Azure DevOps, CircleCI, Jenkins) or locally.

## Overview

This server provides 15 MCP tools in total: 10 core tools and 5 convenience aliases across execution, discovery, and analysis workflows.

- `megalinter_quick_action` for short, natural requests with sensible defaults.
- `megalinter_run` to execute MegaLinter with configurable runtime and runner options.
- `megalinter_write_config` to generate a minimal `.mega-linter.yml` file.
- `megalinter_list_flavors` to return common MegaLinter flavors.
- `megalinter_get_linters` to discover available linters by language, security focus, and auto-fix capability.
- `megalinter_get_security_info` to group security linters by threat category.
- `megalinter_get_reporters` to list supported report output formats and CI-targeted reporters.
- `megalinter_parse_reports` to parse JSON or SARIF report artefacts.
- `megalinter_get_issue_summary` to aggregate report issues by linter and severity.
- `megalinter_get_security_recommendations` to generate security-focused remediation guidance.

### Quick Start (Short Prompts)

If you prefer short prompts, use `megalinter_quick_action` first:

- `@megalinter quick scan this repository`
- `@megalinter security scan`
- `@megalinter summarise errors`
- `@megalinter list python security linters`
- `@megalinter write config`

Or use **ultra-short aliases** for minimal typing:

- `@megalinter scan` — Quick scan with defaults
- `@megalinter summary` — Summarise last run's errors
- `@megalinter parse` — Parse JSON report
- `@megalinter help_quick` — Context-aware help for your project

### Platform Compatibility

This MCP server is **platform-agnostic** and works universally:

- ✅ **Locally** — Run MegaLinter from your IDE or command line
- ✅ **GitHub Actions** — Integrate with workflows
- ✅ **GitLab CI/CD** — Use in GitLab pipelines
- ✅ **Azure DevOps** — Run in Azure Pipelines
- ✅ **CircleCI, Jenkins, Bitbucket Pipelines** — Any CI/CD platform with Docker support
- ✅ **AI Agents & Copilot** — Automated code quality checks via MCP

The only requirement is Docker (or a compatible container runtime like Colima).

### Tool Matrix

| Tool | Category | Typical outcome |
| --- | --- | --- |
| `megalinter_quick_action` | Interactive | Handle short natural requests with defaults |
| `scan` | Alias | Ultra-short alias for quick scan |
| `summary` | Alias | Ultra-short alias for error summary |
| `parse` | Alias | Ultra-short alias for report parsing |
| `help_quick` | Alias | Ultra-short alias for context-aware help |
| `megalinter_help_quick` | Help | Context-aware suggestions for your project |
| `megalinter_run` | Execution | Run linting and produce report artefacts |
| `megalinter_write_config` | Configuration | Generate baseline `.mega-linter.yml` |
| `megalinter_list_flavors` | Discovery | Identify an appropriate flavour for your stack |
| `megalinter_get_linters` | Discovery | Filter linters by language, security, and auto-fix support |
| `megalinter_get_security_info` | Discovery | View security linters grouped by SAST, secrets, container, and IaC |
| `megalinter_get_reporters` | Discovery | Select output/reporting formats for local and CI workflows |
| `megalinter_parse_reports` | Analysis | Read JSON or SARIF reports in structured form |
| `megalinter_get_issue_summary` | Analysis | Summarise issue totals and top failing linters |
| `megalinter_get_security_recommendations` | Analysis | Produce practical shift-left security actions |

## Tools

### `megalinter_quick_action`

Interactive shortcut that accepts a short request and routes it to the right workflow.

Inputs:

- `request` (string, optional): Short instruction. Default: `quick scan`.
- `action` (string, optional): Explicit quick action (`scan`, `config`, `flavors`, `linters`, `security`, `reporters`, `parse`, `summary`, `recommendations`).
- `scanMode` (string, optional): Scan preset (`quick`, `full`, `security`, `fix`).
- `target` (string, optional): Directory to scan. Default: `.`.
- `workingDirectory` (string, optional): Command working directory.
- `reportsPath` (string, optional): Reports directory. Default: `megalinter-reports`.
- `reportType` (string, optional): Parse format (`json` or `sarif`).
- `severity` (string, optional): Summary filter (`error`, `warning`, `info`).
- `language` (string, optional): Language filter for linter queries. For scans, maps to a flavor hint (`python`, `javascript`, `terraform`, and similar).
- `securityOnly` (boolean, optional): Return only security linters in linter queries. For scans, forces `security` flavor.
- `autoFixOnly` (boolean, optional): Return only auto-fix linters in linter queries.
- `timeoutMinutes` (number, optional): Timeout for scan actions. Default: `20`.
- `summaryOnly` (boolean, optional): Return concise output for scans. Default: `true`.
- `flavor` (string, optional): Optional flavor override for scan actions.
- `fix` (boolean, optional): Force auto-fixes for scan actions.
- `targetPath` (string, optional): Config output path for write-config requests.

Examples:

- `request: "quick scan"` -> Runs `ci_light` against changed files.
- `request: "full scan"` -> Runs `all` flavor.
- `request: "security scan"` -> Runs `security` flavor.
- `request: "summarise errors"` -> Returns issue summary filtered to errors.
- `request: "parse sarif report"` -> Parses SARIF output.
- `action: "summary", severity: "error"` -> Deterministic summary with no phrase parsing.
- `action: "scan", scanMode: "security"` -> Deterministic security scan.

### `scan` (Ultra-short alias)

Run a quick scan with minimal typing. Accepts optional parameters for customization.

Inputs:

- `language` (string, optional): Target language mapped to flavor (e.g., `python`, `javascript`, `terraform`).
- `scanMode` (string, optional): Scan preset (`quick`, `full`, `security`, `fix`). Default: `quick`.
- `summaryOnly` (boolean, optional): Return concise output. Default: `true`.

Example: `@megalinter scan` runs a quick scan with concise output.

### `summary` (Ultra-short alias)

Summarise errors from the last MegaLinter run with minimal typing.

Inputs:

- `severity` (string, optional): Filter by severity (`error`, `warning`, `info`).
- `linterFilter` (string, optional): Filter by linter name.

Example: `@megalinter summary` shows all error/warning totals.

### `parse` (Ultra-short alias)

Parse MegaLinter report files with minimal typing.

Inputs:

- `reportType` (string, optional): Report format (`json` or `sarif`). Default: `json`.
- `reportsPath` (string, optional): Reports directory path.

Example: `@megalinter parse` parses the JSON report.

### `megalinter_help_quick`

Get context-aware help based on your current repository. Detects languages, frameworks, Docker, Terraform, and security files to suggest relevant commands.

No inputs required.

Example: `@megalinter help_quick` returns tailored suggestions for your project.

### `megalinter_run`

Use this tool when you need full argument-level control. For short prompts, prefer `megalinter_quick_action`.

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
- `summaryOnly` (boolean, optional): Return concise logs. Default: `false`.
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

### `megalinter_get_linters`

Returns linter metadata from the built-in catalogue and supports targeted filtering.

Inputs:

- `language` (string, optional): Filter by language (for example `python`, `javascript`, `terraform`).
- `securityOnly` (boolean, optional): Return only security-focused linters.
- `autoFixOnly` (boolean, optional): Return only linters with automatic fix capability.

### `megalinter_get_security_info`

Returns security linters grouped into categories such as SAST, secrets, supply chain, container, and infrastructure.

Inputs:

- None.

### `megalinter_get_reporters`

Returns available MegaLinter reporters, including CI-targeted formats.

Inputs:

- None.

### `megalinter_parse_reports`

Parses MegaLinter report files from the reports directory.

Inputs:

- `reportsPath` (string, optional): Report directory path. Default: `megalinter-reports`.
- `reportType` (string, optional): Report type (`json` or `sarif`). Default: `json`.

### `megalinter_get_issue_summary`

Summarises issues from `megalinter-report.json` and can apply severity/linter filters.

Inputs:

- `reportsPath` (string, optional): Report directory path. Default: `megalinter-reports`.
- `severityFilter` (string, optional): Filter results by severity (`error`, `warning`, `info`).
- `linterFilter` (string, optional): Filter results by linter name.

### `megalinter_get_security_recommendations`

Generates security recommendations based on active linters in the parsed report data.

Inputs:

- `reportsPath` (string, optional): Report directory path. Default: `megalinter-reports`.

## Prompt Cookbook

Use these copy/paste prompts in Copilot Chat with `@megalinter`.
CLI tools default to the current workspace root when no path is given.
If you add a file or folder as Copilot context (`#file` or `#folder`), reference it in your prompt and the tool will target that path.

### Quick Actions (`megalinter_quick_action`)

```text
@megalinter quick scan
@megalinter full scan
@megalinter security scan
@megalinter summarise errors
@megalinter parse sarif report
@megalinter write config
```

**Expected output**: Routes each short request to the correct tool with sensible defaults.

Deterministic alternatives using explicit action fields:

```text
@megalinter run quick action with action summary and severity error
@megalinter run quick action with action parse and reportType sarif
@megalinter run quick action with action scan and scanMode security
```

### Run MegaLinter (`megalinter_run`)

```text
@megalinter run megalinter with flavor all on . with reports in megalinter-reports
```

**Expected output**: Executes linters and reports issues found across all languages. Creates `megalinter-reports/` with JSON, SARIF, and text reports.

### Create Config (`megalinter_write_config`)

```text
@megalinter create a MegaLinter config at .mega-linter.yml
```

**Expected output**: Creates `.mega-linter.yml` with specified settings ready for customization.

### List Flavors (`megalinter_list_flavors`)

```text
@megalinter list all available MegaLinter flavors
```

**Expected output**: Table of flavors (all, python, javascript, go, etc.) with descriptions and use cases.

### Query Linters (`megalinter_get_linters`)

```text
@megalinter list python security linters with autofix support
```

**Expected output**: Filtered list of Python-related and multi-language security linters from the current catalog that support autofix (if any match the query).

### Security Categories (`megalinter_get_security_info`)

```text
@megalinter show MegaLinter security linter categories
```

**Expected output**: Security categories (for example, `sast`, `secrets`, `supply-chain`, `container`, `infrastructure`) with associated linters (gitleaks, trivy, etc.).

### List Reporters (`megalinter_get_reporters`)

```text
@megalinter list available MegaLinter reporters
```

**Expected output**: List of reporters (console, json, sarif, github-comment, etc.) with activation methods.

### Parse Reports (`megalinter_parse_reports`)

```text
@megalinter parse the json report from megalinter-reports
```

**Expected output**: Parsed MegaLinter JSON or SARIF report content as structured data (raw report payload).

### Issue Summary (`megalinter_get_issue_summary`)

```text
@megalinter summarise issues from megalinter-reports with severity error
```

**Expected output**: Summary of issues filtered by severity and linter inputs, aggregated by linter with totals and run counts.

### Security Recommendations (`megalinter_get_security_recommendations`)

```text
@megalinter generate security recommendations using megalinter-reports
```

**Expected output**: Actionable security recommendations prioritized by severity with linter names, rule IDs, and suggested next steps.

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

### Usage with VS Code Copilot Chat

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

Then query the server from Copilot Chat with `@megalinter`, for example:

```text
@megalinter list available flavors
@megalinter list security linters for javascript
```

### Usage with Other MCP Clients

Use a stdio server configuration that runs the compiled entrypoint:

```json
{
  "name": "megalinter-mcp-server",
  "type": "stdio",
  "command": "node",
  "args": ["/absolute/path/to/megalinter-mcp/dist/index.js"]
}
```

Build first with `npm run build`, then start your MCP client.

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

See [docs/TESTING.md](./docs/TESTING.md) for Copilot Chat scenarios, manual JSON-RPC checks, and troubleshooting guidance.

Quick validation prompt in Copilot Chat:

```text
@megalinter list available flavors
```

## Interactive VS Code Workflows

### 1. Shift-Left Security Triage

1. Ask Copilot to run a scan:

```text
@megalinter run megalinter on this repository with reports enabled
```

1. Parse the generated report:

```text
@megalinter parse the json report in megalinter-reports
```

1. Summarise and prioritise:

```text
@megalinter summarise error-level issues and top failing linters
```

1. Request security guidance:

```text
@megalinter generate security recommendations from the current report
```

### 2. Language-Specific Linter Onboarding

1. Discover linters for your stack:

```text
@megalinter list python security linters with autofix support
```

1. Generate starter config:

```text
@megalinter create a megalinter config file with apply fixes set to none
```

1. Disable unsuitable linters and iterate.

### 3. CI/CD Reporter Selection

1. List reporters:

```text
@megalinter list available reporters
```

1. Select formats for your pipeline (for example SARIF for security tooling, Markdown for human-readable summaries).

### Best Practices

- Start with `megalinter_write_config`, then tighten rules in small steps.
- Use `lintChangedFilesOnly` during fast feedback loops, and full scans in CI.
- Keep `reportsPath` stable so downstream analysis tools always read from a known location.
- Prefer `megalinter_get_issue_summary` for triage before requesting full report dumps.
- Run `megalinter_get_security_recommendations` regularly to maintain shift-left coverage.

## Additional Use Cases

- **Pre-merge quality gates**: Run `megalinter_run` in PR checks and publish SARIF output.
- **Repo onboarding packs**: Use `megalinter_get_linters` and `megalinter_list_flavors` to choose a baseline quickly.
- **Security baseline reporting**: Combine `megalinter_parse_reports` and `megalinter_get_issue_summary` for recurring snapshots.
- **Compliance evidence**: Store generated reports and summaries as CI artefacts for audit trails.
- **Developer self-service**: Let contributors query available linters/reporters directly through Copilot Chat.

## Related Projects

### Official MegaLinter Resources

- [MegaLinter website](https://megalinter.io/) — Comprehensive documentation and configuration guide
- [MegaLinter repository](https://github.com/oxsecurity/megalinter) — Source code and issue tracking
- [mega-linter-runner](https://www.npmjs.com/package/mega-linter-runner) — npm package used by this server

### CI/CD Integrations

- [MegaLinter Azure DevOps Extension](https://github.com/downatthebottomofthemolehole/megalinter-ado) — ADO task by the same author (also sanctioned by Ox Security)
- GitHub Actions: Use MegaLinter's official [GitHub Action](https://github.com/marketplace/actions/megalinter)
- GitLab CI/CD: See [MegaLinter GitLab integration docs](https://github.com/oxsecurity/megalinter/blob/main/docs/install-gitlab.md)
- Jenkins, CircleCI, and others: Run MegaLinter via Docker in any CI/CD pipeline

### Model Context Protocol

- [MCP official documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP servers registry](https://github.com/mcp)

## Community and Contributing

- [Contributing Guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [Testing Guide](./docs/TESTING.md)
- [Maintainer Guide](./docs/MAINTAINERS.md)

## Attribution and License

Maintained by Carl Dawson under the [Down At The Bottom Of The Mole Hole](https://github.com/downatthebottomofthemolehole) organization.

Licensed under the MIT License. MegaLinter is managed by [Ox Security](https://www.ox.security/).
