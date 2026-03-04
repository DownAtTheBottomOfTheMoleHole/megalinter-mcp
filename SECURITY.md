# Security Policy

## Supported Versions

The following versions of MegaLinter MCP Server are currently supported with security updates:

| Version | Status | Support Ends |
|:--|:--|:--|
| >= 1.0.0 | Active | N/A (current) |
| < 1.0.0 | Pre-release | End of current minor version |

Pre-release versions (0.x.x) receive security updates only for the latest minor version. Upgrading to the latest version is recommended.

## Reporting a Vulnerability

**Do not** open a public GitHub issue for security vulnerabilities. Instead:

### Reporting Process

1. **Email the security report** to the maintainer at the contact address listed in the repository
   - Include a clear description of the vulnerability
   - Provide steps to reproduce (if applicable)
   - Specify the affected version(s)

2. **Allow time for review** — We will acknowledge receipt within 48 hours and provide an estimated timeline for a fix

3. **Coordinate disclosure** — We will work with you on:
   - Verifying the vulnerability
   - Developing and testing a fix
   - Releasing a patched version
   - Public disclosure timing (typically 90 days)

### What to Include

- Type of vulnerability (e.g., RCE, privilege escalation, data leak)
- Component affected (e.g., tool runner, argument parsing)
- Steps to reproduce or proof of concept
- Potential impact
- Suggested fix (if you have one)

## Security Best Practices

### For Users

1. **Keep dependencies updated:**
   ```bash
   npm update
   npm audit
   ```

2. **Run MegaLinter in limited environments:**
   - The `megalinter_run` tool executes `mega-linter-runner` via Docker
   - Ensure Docker is properly configured with appropriate resource limits
   - Use read-only volumes when possible

3. **Validate input:**
   - When passing configuration via the `megalinter_write_config` tool, validate file paths
   - Avoid dynamic path construction with untrusted input

4. **Monitor for updates:**
   - Subscribe to [Release notifications](../../releases)
   - Check this SECURITY.md file for supported versions

### For Developers

1. **Code Review:**
   - All contributions are reviewed before merge
   - Security-focused review for PRs modifying argument parsing, file I/O, or process execution

2. **Dependency Management:**
   - Regular security audits via `npm audit`
   - Automated dependency updates via Renovate
   - Vulnerability alerts are reviewed immediately

3. **Compliance:**
   - All code is subject to MegaLinter checks (`FAIL_IF_ERRORS: true`)
   - TypeScript type safety enforced
   - No code reaches production without passing compliance scan

## Known Issues

Currently, there are no known unpatched security vulnerabilities in released versions.

If you discover a vulnerability in a released version, please report it following the process above.

## Security Advisories

Security advisories will be published in the [GitHub Security Advisories](../../security/advisories) section when a vulnerability is:
1. Confirmed
2. Fixed in a released version
3. Public disclosure period completed

## Responsible Disclosure

We follow [Coordinated Vulnerability Disclosure](https://en.wikipedia.org/wiki/Vulnerability_disclosure#Coordinated) principles:
- We do not publish vulnerability details until a fix is available
- We provide reasonable time for users to update
- We credit researchers who responsibly disclose vulnerabilities

## Security Features

### Input Validation
- Argument validation for all MCP tools
- File path normalization
- Command injection prevention via proper argument escaping

### Process Isolation
- Tools run via Docker (when available)
- Process timeouts enforce resource limits (default 3600s)
- Output truncation prevents memory exhaustion (max 120KB)

### Dependency Security
- Regular `npm audit` checks in CI/CD
- Automated vulnerability alerts via GitHub
- Renovate security update PRs
- Semantic versioning for safe upgrades

## Contact

For security-related inquiries, contact the repository maintainer. Do not open public issues for security vulnerabilities.

---

**Last Updated:** March 4, 2026
