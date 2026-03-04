# GitHub Automation & Public Workflows

This document describes the automated GitHub workflows and templates that facilitate public-facing development and releases.

## Continuous Integration (CI)

**File:** `.github/workflows/ci.yml`

Runs on:
- Every pull request to `main` or `develop` branches
- Every push to `main` or `develop` branches

**Jobs:**

### Test Job
- Installs dependencies
- Runs TypeScript build (`npm run build`)
- Runs security audit (`npm audit`)
- Verifies dist artifacts exist

Supports multiple Node.js versions (currently 24.x).

### MegaLinter Compliance Scan Job
Uses [oxsecurity/megalinter-action](https://github.com/oxsecurity/megalinter) to enforce code quality standards:
- **Markdown** — Formatting and structure validation
- **JSON** — Configuration file validation
- **YAML** — Workflow and config file validation
- **TypeScript** — Code style and syntax checking
- **Bash** — Shell script quality
- **Spell checking** — Documentation and code spelling

**Fails the build** if any compliance errors are found (`FAIL_IF_ERRORS: true`).

Uploads MegaLinter reports as CI artifacts and SARIF report to GitHub Security tab for code scanning.

For detailed configuration and local testing, see [COMPLIANCE_AND_UPDATES.md](./COMPLIANCE_AND_UPDATES.md).

## Automated Publishing

**File:** `.github/workflows/publish.yml`

Triggers automatically when a release is published on GitHub.

**Process:**

### Compliance Job (Required Gate)
1. Clones repository with full history (`fetch-depth: 0`)
2. Runs **MegaLinter compliance scan** (same checks as CI)
3. Uploads compliance reports as artifacts
4. **Fails if non-compliant** — prevents publishing broken code

### Publish Job (Depends on Compliance ✅)
1. Only runs if Compliance job succeeds
2. Sets up Node.js and npm authentication with GitHub Packages registry
3. Installs dependencies
4. Builds project
5. Publishes to GitHub Packages as `@downatthebottomofthemolehole/megalinter-mcp-server`

Uses `${{ secrets.GITHUB_TOKEN }}` for authentication (no extra configuration needed).

This two-stage approach ensures **zero non-compliant packages reach GitHub Packages**.

## Release Notes

**File:** `.github/release.yml`

Automatically generates changelog from pull request labels when creating a release on GitHub.

**Categories:**
- 🎉 Features (labels: `feature`, `enhancement`)
- 🐛 Bug Fixes (labels: `bug`, `bugfix`, `fix`)
- 📚 Documentation (labels: `documentation`, `docs`)
- 🔧 Maintenance (labels: `maintenance`, `dependencies`, `chore`)
- 🏗️ Infrastructure (labels: `ci`, `github-actions`, `workflow`)

Excluded labels: `duplicate`, `invalid`, `wontfix`, `skip-changelog`

## Pull Request Template

**File:** `.github/pull_request_template.md`

Auto-populated for new PRs on the repository. Includes sections for:
- Description of changes
- Type of change (bug fix, feature, docs, etc.)
- Testing instructions
- Completion checklist
- Related links

## Issue Templates

### Bug Report
**File:** `.github/ISSUE_TEMPLATE/bug_report.md`

Template for reporting bugs with sections for:
- Description of the bug
- Reproduction steps
- Expected vs. actual behavior
- Environment details (OS, Node.js version, Docker status)
- Tool and arguments used
- Error output
- Additional context

### Feature Request
**File:** `.github/ISSUE_TEMPLATE/feature_request.md`

Template for suggesting new features with sections for:
- Description and problem statement
- Proposed solution
- Alternative approaches
- Use cases
- Examples
- Related issues

## GitHub Actions Secrets

No additional setup required for publishing. The workflow uses:
- `${{ secrets.GITHUB_TOKEN }}` — automatically available in all GitHub Actions
- Provides `write:packages` and `read:packages` scopes

## Release Workflow (For Maintainers)

### Creating a Release

1. **Create a Release on GitHub:**
   - Go to [Releases](https://github.com/downatthebottomofthemolehole/megalinter-mcp/releases)
   - Click "Draft a new release"
   - Set version tag (e.g., `v0.2.0`)
   - GitHub auto-generates changelog from merged PRs
   - Add any additional notes
   - Click "Publish release"

2. **Automated Publishing:**
   - `publish.yml` workflow triggers automatically
   - Builds project
   - Publishes to GitHub Packages
   - Completes within 1-2 minutes

3. **Verify Publication:**
   - Check [GitHub Packages](https://github.com/orgs/downatthebottomofthemolehole/packages)
   - Confirm new version is available

### For Pull Requests

1. **Create Feature Branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make Changes:**
   - Code changes
   - Update documentation
   - Add tests

3. **Push to Origin:**
   ```bash
   git push origin feature/my-feature
   ```

4. **Create Pull Request:**
   - Template auto-populates
   - Assign labels (`feature`, `bug`, `documentation`, etc.)
   - CI runs automatically

5. **After Merge:**
   - Delete branch
   - Create release when ready

## Labeling System

Labels determine release notes categorization and PR filtering.

**Recommended labels:**
- `bug` — bug fixes
- `enhancement`, `feature` — new features
- `documentation` — docs improvements
- `maintenance`, `chore` — maintenance tasks
- `dependencies` — dependency updates
- `ci`, `github-actions` — workflow improvements
- `duplicate`, `invalid`, `wontfix` — filters out of changelog

## Public-Facing Checklist

When making the repository public:

- [x] Issue templates configured
- [x] Pull request template configured
- [x] Release notes automation configured
- [x] CI/CD workflows (code quality, build, security)
- [x] Automated publishing to GitHub Packages
- [x] MIT license present
- [x] README with attribution and branding
- [x] Contributing guidelines (implied via templates)
- [x] Code of Conduct (consider adding)

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Packages Registry](https://docs.github.com/en/packages)
- [Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [Creating issue and PR templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests)
