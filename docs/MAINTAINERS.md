# Maintainer Guide

This guide contains operational details for release management, compliance, and automation.

## Release Publishing

Publishing is automated via GitHub Releases.

1. Merge approved changes into `main`.
2. Create a GitHub release (for example, `v0.1.0`).
3. GitHub Actions executes `.github/workflows/publish.yml`.
4. Package is published to GitHub Packages if checks pass.

## Compliance Gate

The publish workflow enforces two jobs:

- `compliance`: runs MegaLinter checks
- `publish`: runs only if compliance succeeds

This blocks non-compliant releases.

## CI and Automation

Primary workflow files:

- `.github/workflows/ci.yml`
- `.github/workflows/publish.yml`
- `.github/release.yml`

CI validates:

- type checks
- build
- audit
- MegaLinter compliance

## Renovate Policy

`renovate.json` controls dependency updates.

Current behaviour:

- patch updates: auto-merge
- minor updates: auto-merge
- major updates: manual review
- security updates: manual review

## Local Maintainer Checks

Run before cutting a release:

```bash
npm run check
npm run build
npm audit --production
```

Optional (with Docker): run MegaLinter locally using `.mega-linter.yml`.
