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
