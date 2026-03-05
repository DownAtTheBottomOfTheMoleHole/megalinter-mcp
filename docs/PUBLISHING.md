# Publishing to MCP Registry Setup Guide

This document describes how to configure automated publishing to npm and the MCP Registry.

## Prerequisites

1. **npm account**: You need an npm account to publish packages to the public npm registry
2. **GitHub account**: Required for MCP Registry authentication (already configured via GitHub OIDC)

## Setup Instructions

### Step 1: Create npm Access Token

1. Log in to [npmjs.com](https://www.npmjs.com/)
2. Click on your profile icon → **Access Tokens**
3. Click **Generate New Token** → **Classic Token**
4. Select token type: **Automation** (recommended for CI/CD)
5. Copy the generated token (it will only be shown once)

### Step 2: Add NPM_TOKEN to GitHub Repository

1. Go to your [GitHub repository](https://github.com/DownAtTheBottomOfTheMoleHole/megalinter-mcp)
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secret:
   - **Name**: `NPM_TOKEN`
   - **Value**: Paste the npm access token from Step 1
5. Click **Add secret**

### Step 3: Verify Configuration

The publish workflow will automatically run when you push a version tag:

```bash
# Example: Publishing version 0.1.0
git tag v0.1.0
git push origin v0.1.0
```

The workflow will:

1. ✅ Run tests and build verification
2. ✅ Run MegaLinter compliance scan
3. ✅ Publish package to [npm](https://www.npmjs.com/package/@downatthebottomofthemolehole/megalinter-mcp-server)
4. ✅ Publish server to MCP Registry: `io.github.downatthebottomofthemolehole/megalinter`

## Authentication Methods

### npm Publishing

- Uses `NPM_TOKEN` secret (you must configure this manually)
- Token type: Automation token for CI/CD

### MCP Registry Publishing

- Uses GitHub OIDC (automatic, no secret required)
- Requires `id-token: write` permission (already configured in workflow)
- Server name must start with `io.github.downatthebottomofthemolehole/`

## Troubleshooting

### "Authentication failed" on npm publish

- Verify `NPM_TOKEN` secret is correctly set in repository settings
- Ensure the token has not expired
- Check that the token has "Automation" or "Publish" permissions

### "Package validation failed" on MCP Registry

- Ensure `mcpName` in [package.json](package.json) matches `name` in [server.json](server.json)
- Verify the npm package was successfully published before MCP Registry publish step
- Check that `server.json` is valid according to the schema

### "You do not have permission to publish this server"

- Server name must start with `io.github.downatthebottomofthemolehole/` when using GitHub OIDC
- Verify you have write access to the repository

## Version Management

To publish a new version:

1. Update version in both [package.json](package.json) and [server.json](server.json):

   ```json
   // package.json
   "version": "0.2.0"
   
   // server.json
   "version": "0.2.0"
   ```

2. Commit the version bump:

   ```bash
   git add package.json server.json
   git commit -m "chore: bump version to 0.2.0"
   ```

3. Create and push a git tag:

   ```bash
   git tag v0.2.0
   git push origin main
   git push origin v0.2.0
   ```

4. Monitor the [workflow](https://github.com/DownAtTheBottomOfTheMoleHole/megalinter-mcp/actions)

## References

- [npm Access Tokens Documentation](https://docs.npmjs.com/creating-and-viewing-access-tokens)
- [MCP Registry Publishing Guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx)
- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
