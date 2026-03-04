# Publishing to GitHub Packages Registry

**For maintainers:** Publishing is now fully automated through GitHub Actions. See [GITHUB_AUTOMATION.md](./GITHUB_AUTOMATION.md) for the release workflow.

**For developers/contributors:** No action needed when merging PRs. Releases are published automatically when a GitHub Release is created.

---

## Automated Publishing

When a release is published on GitHub:

1. `.github/workflows/publish.yml` triggers automatically
2. Builds the project
3. Publishes to GitHub Packages as `@downatthebottomofthemolehole/megalinter-mcp-server`
4. Process completes in 1-2 minutes

See [GITHUB_AUTOMATION.md](./GITHUB_AUTOMATION.md#release-workflow-for-maintainers) for detailed release instructions.

---

## Manual Publishing (Advanced)

If you need to publish outside the automated workflow (rare), follow the steps below.

## Prerequisites

- GitHub account with access to the `downatthebottomofthemolehole` organization
- GitHub Personal Access Token (PAT) with `write:packages` and `read:packages` scopes
- Node.js 24+
- npm 8+

## Setup

### 1. Create a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Name: `npm-packages` (or similar)
4. Check scopes:
   - `write:packages` (publish packages)
   - `read:packages` (read packages)
   - `repo` (optional, for private repos)
5. Set expiration
6. Click "Generate token"
7. Copy the token immediately (you won't see it again)

### 2. Configure npm Authentication

Create or update `~/.npmrc` with your GitHub token:

```bash
//npm.pkg.github.com/:_authToken=YOUR_TOKEN_HERE
@downatthebottomofthemolehole:registry=https://npm.pkg.github.com
```

Replace `YOUR_TOKEN_HERE` with your actual PAT.

Alternatively, use `npm login`:

```bash
npm login --registry=https://npm.pkg.github.com --scope=@downatthebottomofthemolehole
```

Then enter:
- Username: your GitHub username
- Password: your GitHub PAT (not your GitHub password)
- Email: your GitHub email

### 3. Rename the Package Scope (if needed)

The package must be scoped to the organization for GitHub Packages publishing. Update `package.json`:

```json
{
  "name": "@downatthebottomofthemolehole/megalinter-mcp-server",
  ...
}
```

The current `package.json` already includes:

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

## Publishing Steps

### 1. Increment Version

Update `package.json` version following semantic versioning:

```bash
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.0 → 0.2.0
npm version major  # 0.1.0 → 1.0.0
```

This also creates a git tag automatically.

### 2. Build the Project

```bash
npm run build
```

Verify `dist/` contains the compiled JavaScript.

### 3. Publish to GitHub Packages

```bash
npm publish
```

This will:
- Read the package name from `package.json`
- Use the registry from `publishConfig.registry`
- Authenticate using your configured `~/.npmrc` credentials
- Upload the package to GitHub Packages

### 4. Verify Publication

Check the package on GitHub:

- URL: `https://github.com/orgs/downatthebottomofthemolehole/packages/npm/megalinter-mcp-server`
- Or via npm: `npm view @downatthebottomofthemolehole/megalinter-mcp-server`

### 5. Push Git Tag

After publishing, push the version tag to the repository:

```bash
git push origin v0.1.0  # or whatever version was created
```

Or push all tags:

```bash
git push origin --tags
```

## Installing from GitHub Packages

Users can install the published package by configuring npm to use GitHub Packages registry.

### Option 1: User-level `.npmrc` (Recommended)

Add to `~/.npmrc`:

```
@downatthebottomofthemolehole:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_PAT_HERE
```

Then install normally:

```bash
npm install @downatthebottomofthemolehole/megalinter-mcp-server
```

### Option 2: Project-level `.npmrc`

Create `.npmrc` in the project root:

```
@downatthebottomofthemolehole:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Set the environment variable:

```bash
export GITHUB_TOKEN=your_pat_here
npm install
```

### Option 3: Via npx

For one-time use in VS Code MCP config:

```json
{
  "servers": {
    "megalinter": {
      "command": "npx",
      "args": [
        "--registry=https://npm.pkg.github.com",
        "@downatthebottomofthemolehole/megalinter-mcp-server"
      ]
    }
  }
}
```

## Troubleshooting

### "You do not have the permission to publish this package"

- Verify your PAT has `write:packages` scope
- Check organization membership for `downatthebottomofthemolehole`
- Ensure `.npmrc` is configured correctly

### "Invalid authentication token"

- Regenerate your PAT
- Copy the full token (including any prefix like `ghp_`)
- Update `~/.npmrc` with the new token

### "Package name must be scoped"

- Update `package.json` name to include the scope: `@downatthebottomofthemolehole/megalinter-mcp-server`

### 401 Unauthorized

- Clear npm cache: `npm cache clean --force`
- Re-authenticate: `npm login --registry=https://npm.pkg.github.com --scope=@downatthebottomofthemolehole`

## GitHub Actions Automation (Optional)

For automated publishing on release, create `.github/workflows/publish.yml`:

```yaml
name: Publish to GitHub Packages

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@downatthebottomofthemolehole'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Then releases on GitHub will automatically trigger npm package publication.

## References

- [GitHub Packages npm registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [npm publish documentation](https://docs.npmjs.com/cli/v8/commands/npm-publish)
