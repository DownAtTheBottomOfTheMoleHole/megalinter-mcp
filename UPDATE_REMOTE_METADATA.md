# Updating Remote Repository Metadata

This guide walks through updating the GitHub repository metadata for the public release.

**Repository URL:** https://github.com/DownAtTheBottomOfTheMoleHole/megalinter-mcp

## Option 1: Using GitHub CLI (Recommended)

Install [GitHub CLI](https://cli.github.com/) if not already installed:

```bash
brew install gh  # macOS
# or visit https://cli.github.com for other platforms
```

Authenticate:

```bash
gh auth login
```

### Update Repository Description

```bash
gh repo edit DownAtTheBottomOfTheMoleHole/megalinter-mcp \
  --description "MCP server for Ox Security MegaLinter via mega-linter-runner. Sanctioned by Ox Security."
```

### Update Homepage URL

```bash
gh repo edit DownAtTheBottomOfTheMoleHole/megalinter-mcp \
  --homepage "https://megalinter.io/"
```

### Add Repository Topics

```bash
gh repo edit DownAtTheBottomOfTheMoleHole/megalinter-mcp \
  --add-topic "mcp" \
  --add-topic "megalinter" \
  --add-topic "linting" \
  --add-topic "code-quality" \
  --add-topic "ox-security"
```

### View Current Settings

```bash
gh repo view DownAtTheBottomOfTheMoleHole/megalinter-mcp
```

## Option 2: Using Web UI

1. Go to [Repository Settings](https://github.com/DownAtTheBottomOfTheMoleHole/megalinter-mcp/settings)

2. **General Settings:**
   - **Repository name:** `megalinter-mcp`
   - **Description:** 
     ```
     MCP server for Ox Security MegaLinter via mega-linter-runner. Sanctioned by Ox Security.
     ```
   - **Website:** `https://megalinter.io/`

3. **Topics** (scroll down to "About" section on repo main page):
   - Click the gear icon
   - Add: `mcp`, `megalinter`, `linting`, `code-quality`, `ox-security`

4. **Visibility:**
   - Ensure set to **Public**

5. **Additional Settings** (in Settings > Code and automation):
   - Enable **Discussions** (optional, for community engagement)
   - Enable **Wikis** (for extended documentation)

## Option 3: Using curl/API (Advanced)

Requires a GitHub Personal Access Token with `repo` scope.

```bash
export GITHUB_TOKEN=your_token_here

curl -X PATCH \
  https://api.github.com/repos/DownAtTheBottomOfTheMoleHole/megalinter-mcp \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{
    "description": "MCP server for Ox Security MegaLinter via mega-linter-runner. Sanctioned by Ox Security.",
    "homepage": "https://megalinter.io/",
    "topics": ["mcp", "megalinter", "linting", "code-quality", "ox-security"],
    "private": false
  }'
```

## Next Steps After Metadata Update

1. **Verify settings:**
   ```bash
   gh repo view DownAtTheBottomOfTheMoleHole/megalinter-mcp
   ```

2. **Push local commits:**
   ```bash
   git push origin main
   ```

3. **Create initial release:**
   - Go to [Releases](https://github.com/DownAtTheBottomOfTheMoleHole/megalinter-mcp/releases)
   - Click "Draft a new release"
   - Tag: `v0.1.0`
   - Title: "Initial Release"
   - Description: Auto-generated from PRs
   - Publish Release

4. **Verify automated publishing:**
   - Check [GitHub Actions](https://github.com/DownAtTheBottomOfTheMoleHole/megalinter-mcp/actions)
   - Confirm `publish.yml` workflow completed
   - Verify package in [GitHub Packages](https://github.com/orgs/DownAtTheBottomOfTheMoleHole/packages)

## Repository Metadata Summary

| Setting | Value |
|---------|-------|
| **Name** | megalinter-mcp |
| **Description** | MCP server for Ox Security MegaLinter via mega-linter-runner. Sanctioned by Ox Security. |
| **Homepage** | https://megalinter.io/ |
| **License** | MIT (set in LICENSE file) |
| **Topics** | mcp, megalinter, linting, code-quality, ox-security |
| **Visibility** | Public |
| **Has releases** | Yes (auto-published to GitHub Packages) |

## Before Pushing

Ensure local `.gitignore` is configured:

```bash
# View what would be ignored
git status --ignored

# Verify .github/copilot-instructions.md won't be committed
git check-ignore .github/copilot-instructions.md
```

If it shows a path, it's correctly ignored. If not, check `.gitignore`.

## References

- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [GitHub API - Update a repository](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#update-a-repository)
- [Managing topics for your repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)
