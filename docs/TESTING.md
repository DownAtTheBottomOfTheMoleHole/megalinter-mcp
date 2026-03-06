# Testing MegaLinter MCP Server

This document describes repeatable tests for the MegaLinter MCP server.

## Dependencies for Testing

- Node.js `>=24.0.0`
- npm
- Docker Engine or Docker Desktop (running)
- Optional: Colima as the local Docker runtime

## Prerequisites

1. Build the server:

   ```bash
   npm run build
   ```

2. Confirm Docker is available:

   ```bash
   docker ps
   ```

3. Reload VS Code so MCP config is reloaded:

   - `Cmd+Shift+P` → `Developer: Reload Window`

## Copilot Chat Validation

Use `@megalinter-ox-security` in Copilot Chat.

### Test 1: List flavors

```text
@megalinter-ox-security list all available MegaLinter flavors
```

Expected: A comma-separated list including `all`, `javascript`, `python`, `terraform`, and others.

### Test 2: Write a config file

```text
@megalinter-ox-security create a MegaLinter config at .mega-linter.yml with:
- applyFixes: all
- showElapsedTime: true
- flavorSuggestions: false
- disableLinters: [COPYPASTE]
```

Expected: `.mega-linter.yml` is written successfully.

### Test 3: Run a targeted scan

```text
@megalinter-ox-security run MegaLinter with:
- workingDirectory: ${workspaceFolder}
- path: .
- flavor: javascript
- release: v9
- disableLinters: COPYPASTE
- timeoutSeconds: 600
```

Expected: Tool returns command output with exit code and stdout/stderr sections.

### Test 4: Run full scan with reports

```text
@megalinter-ox-security run MegaLinter with:
- workingDirectory: ${workspaceFolder}
- path: .
- flavor: all
- fix: true
- reportsPath: megalinter-reports
- timeoutSeconds: 1800
```

Expected: Full run executes and writes reports to `megalinter-reports`.

### Test 5: Discover language and security linters

```text
@megalinter-ox-security list security linters with autofix support
```

Expected: JSON output containing a filtered linter list where `isSecurity=true` and `isAutoFix=true`.

### Test 6: Inspect security coverage categories

```text
@megalinter-ox-security show megalinter security linter categories
```

Expected: Grouped sections for categories such as SAST, secrets, supply chain, container, and infrastructure.

### Test 7: List available reporters

```text
@megalinter-ox-security list available megalinter reporters
```

Expected: Reporter list including IDs, descriptions, enablement state, and CI requirements where applicable.

### Test 8: Parse generated report files

```text
@megalinter-ox-security parse the json report from megalinter-reports
```

Expected: Parsed JSON report content from `megalinter-reports/megalinter-report.json`.

Note: Run Test 4 first so reports exist.

### Test 9: Summarise and filter issues

```text
@megalinter-ox-security summarise issues from megalinter-reports with severity error
```

Expected: A summary section with total issues and linter breakdown, with the requested filter listed.

### Test 10: Generate security recommendations

```text
@megalinter-ox-security generate security recommendations using megalinter-reports
```

Expected: Security-focused recommendations and next-step guidance based on detected security linters.

## Debugging

### VS Code debugger

1. Open `src/index.ts`
2. Set breakpoints
3. Press `F5`
4. Choose:

   - `Debug MCP Server`
   - or `Debug MCP Server (Built)`

### Logs

- VS Code: `View` → `Output` → `MCP Servers`
- Terminal:

  ```bash
  npm run dev
  ```

## Manual JSON-RPC Smoke Test

```bash
npm start
```

In a second terminal, test `tools/list`:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

## Troubleshooting

### Docker errors

- Ensure Docker is running: `docker ps`
- Verify Docker daemon access: `docker info`
- Start Docker Desktop or run `colima start`

### Server not visible in Copilot Chat

- Verify `.vscode/mcp.json` exists
- Reload VS Code window
- Check `Output` → `MCP Servers` for startup errors

### Build failures

- Reinstall dependencies: `npm install`
- Rebuild: `npm run build`
- Re-check project: `npm run check`
