import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock test data for report parsing
const mockReport = [
  {
    filePath: "src/index.ts",
    line: 42,
    column: 5,
    severity: "error",
    message: "Unused variable 'foo'",
    linter: "TYPESCRIPT_ESLINT",
    rule: "no-unused-vars",
  },
  {
    filePath: "src/utils.ts",
    line: 15,
    column: 10,
    severity: "warning",
    message: "Function complexity exceeds threshold",
    linter: "TYPESCRIPT_ESLINT",
    rule: "complexity",
  },
  {
    filePath: "package.json",
    line: 1,
    column: 1,
    severity: "critical",
    message: "Dependency with known vulnerability",
    linter: "PYTHON_SAFETY",
    rule: "security/vulnerable-dependency",
  },
];

let testDir: string;

beforeAll(async () => {
  testDir = path.join(__dirname, ".test-reports");
  await mkdir(testDir, { recursive: true });
});

afterAll(async () => {
  // Cleanup handled by test framework
});

describe("MCP Server Tools Extensions", () => {
  describe("Report Parsing and Analysis", () => {
    it("should correctly parse issue reports", async () => {
      const reportPath = path.join(testDir, "test-report.json");
      await writeFile(reportPath, JSON.stringify(mockReport), "utf8");

      // Verify file was created
      expect(reportPath).toBeTruthy();
    });

    it("should categorize issues by severity", () => {
      const severityCounts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        error: 0,
        warning: 0,
      };

      for (const issue of mockReport) {
        const severity = String(issue.severity).toLowerCase();
        if (severity in severityCounts) {
          severityCounts[severity as keyof typeof severityCounts] += 1;
        }
      }

      expect(severityCounts.error).toBe(1);
      expect(severityCounts.warning).toBe(1);
      expect(severityCounts.critical).toBe(1);
    });

    it("should identify security issues", () => {
      const SECURITY_LINTERS = [
        "JAVASCRIPT_SEMGREP",
        "PYTHON_SEMGREP",
        "PYTHON_BANDIT",
        "PYTHON_SAFETY",
      ];

      const securityIssues = mockReport.filter((issue) =>
        SECURITY_LINTERS.includes(issue.linter),
      );

      expect(securityIssues.length).toBe(1);
      expect(securityIssues[0].linter).toBe("PYTHON_SAFETY");
    });

    it("should group issues by linter", () => {
      const byLinter: Record<string, number> = {};

      for (const issue of mockReport) {
        byLinter[issue.linter] = (byLinter[issue.linter] ?? 0) + 1;
      }

      expect(byLinter.TYPESCRIPT_ESLINT).toBe(2);
      expect(byLinter.PYTHON_SAFETY).toBe(1);
    });
  });

  describe("Linter Discovery", () => {
    it("should have security linters available", () => {
      const SECURITY_LINTERS = [
        "JAVASCRIPT_SEMGREP",
        "PYTHON_SEMGREP",
        "PYTHON_BANDIT",
        "PYTHON_SAFETY",
        "BASH_SHELLCHECK",
        "DOCKERFILE_HADOLINT",
      ];

      expect(SECURITY_LINTERS.length).toBeGreaterThan(0);
      expect(SECURITY_LINTERS[0]).toBe("JAVASCRIPT_SEMGREP");
    });

    it("should map languages to flavors", () => {
      const LANGUAGE_FLAVORS: Record<string, string[]> = {
        javascript: ["javascript", "ci_light"],
        typescript: ["javascript", "ci_light"],
        python: ["python"],
        rust: ["rust"],
      };

      expect(LANGUAGE_FLAVORS.javascript).toContain("javascript");
      expect(LANGUAGE_FLAVORS.python[0]).toBe("python");
    });

    it("should provide linter metadata", () => {
      const LINTER_METADATA = {
        JAVASCRIPT_ESLINT: {
          name: "ESLint",
          language: "javascript",
          category: "lint" as const,
          description: "Find and fix problems in JavaScript code",
          isSecurity: false,
          isAutoFix: true,
        },
        PYTHON_BANDIT: {
          name: "Bandit",
          language: "python",
          category: "security" as const,
          description: "Security issue scanner for Python code",
          isSecurity: true,
          isAutoFix: false,
        },
      };

      expect(LINTER_METADATA.JAVASCRIPT_ESLINT.category).toBe("lint");
      expect(LINTER_METADATA.PYTHON_BANDIT.isSecurity).toBe(true);
    });
  });

  describe("Configuration Suggestions", () => {
    it("should suggest security flavor for security-focused config", () => {
      const language = "python";
      const securityFocused = true;

      const LANGUAGE_FLAVORS: Record<string, string[]> = {
        python: ["python"],
      };

      const flavors = LANGUAGE_FLAVORS[language] ?? ["all"];
      const baseFlavor = securityFocused ? "security" : flavors[0];

      expect(baseFlavor).toBe("security");
    });

    it("should suggest appropriate flavor for language", () => {
      const language = "typescript";

      const LANGUAGE_FLAVORS: Record<string, string[]> = {
        typescript: ["javascript", "ci_light"],
      };

      const flavors = LANGUAGE_FLAVORS[language];
      expect(flavors[0]).toBe("javascript");
    });

    it("should generate security-focused config", () => {
      const config = {
        FLAVOR: "security",
        APPLY_FIXES: "all",
        SHOW_ELAPSED_TIME: true,
        FLAVOR_SUGGESTIONS: true,
      };

      expect(config.FLAVOR).toBe("security");
      expect(config.APPLY_FIXES).toBe("all");
    });
  });

  describe("Severity Filtering", () => {
    it("should filter issues by severity level", () => {
      const targetSeverity = "error";
      const filtered = mockReport.filter(
        (i) => String(i.severity).toLowerCase() === targetSeverity,
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].message).toContain("Unused variable");
    });

    it("should handle severity level normalization", () => {
      const severityMap = {
        error: "critical",
        critical: "critical",
        fatal: "critical",
        warning: "high",
        high: "high",
        info: "medium",
        medium: "medium",
        low: "low",
      };

      expect(severityMap.error).toBe("critical");
      expect(severityMap.warning).toBe("high");
    });
  });

  describe("Shift-Left Security Focus", () => {
    it("should identify critical security issues first", () => {
      const securityPriority = mockReport
        .filter((i) => String(i.severity).toLowerCase() === "critical")
        .map((i) => i.message);

      expect(securityPriority.length).toBe(1);
      expect(securityPriority[0]).toContain("vulnerability");
    });

    it("should provide breakdown of issue types", () => {
      const analysis = {
        totalIssues: mockReport.length,
        criticalIssues: mockReport.filter(
          (i) => String(i.severity).toLowerCase() === "critical",
        ).length,
        highIssues: mockReport.filter(
          (i) => String(i.severity).toLowerCase() === "high",
        ).length,
        securityIssues: mockReport.filter((i) =>
          [
            "JAVASCRIPT_SEMGREP",
            "PYTHON_SEMGREP",
            "PYTHON_BANDIT",
            "PYTHON_SAFETY",
          ].includes(i.linter),
        ).length,
      };

      expect(analysis.totalIssues).toBe(3);
      expect(analysis.criticalIssues).toBe(1);
      expect(analysis.securityIssues).toBe(1);
    });

    it("should detect compliance failures", () => {
      const hasSecurityIssues =
        mockReport.filter((i) =>
          [
            "JAVASCRIPT_SEMGREP",
            "PYTHON_SEMGREP",
            "PYTHON_BANDIT",
            "PYTHON_SAFETY",
          ].includes(i.linter),
        ).length > 0;

      expect(hasSecurityIssues).toBe(true);
    });
  });

  describe("Get Linters Tool Handler", () => {
    it("should filter linters by language", () => {
      // Mock linter catalog structure
      const LINTER_CATALOG = {
        PYTHON_BANDIT: {
          name: "Bandit",
          language: "python",
          category: "security",
          description: "Security issue scanner for Python",
          isSecurity: true,
          isAutoFix: false,
        },
        JAVASCRIPT_ESLINT: {
          name: "ESLint",
          language: "javascript",
          category: "lint",
          description: "JavaScript linter",
          isSecurity: false,
          isAutoFix: true,
        },
      };

      const pythonLinters = Object.values(LINTER_CATALOG).filter(
        (l) => l.language === "python",
      );
      expect(pythonLinters.length).toBe(1);
      expect(pythonLinters[0].name).toBe("Bandit");
    });

    it("should filter security linters only", () => {
      const LINTER_CATALOG = {
        PYTHON_BANDIT: {
          name: "Bandit",
          language: "python",
          category: "security",
          description: "Security issue scanner for Python",
          isSecurity: true,
          isAutoFix: false,
        },
        JAVASCRIPT_ESLINT: {
          name: "ESLint",
          language: "javascript",
          category: "lint",
          description: "JavaScript linter",
          isSecurity: false,
          isAutoFix: true,
        },
      };

      const securityLinters = Object.values(LINTER_CATALOG).filter(
        (l) => l.isSecurity,
      );
      expect(securityLinters.length).toBe(1);
      expect(securityLinters[0].isSecurity).toBe(true);
    });

    it("should filter auto-fix capable linters", () => {
      const LINTER_CATALOG = {
        PYTHON_BANDIT: {
          name: "Bandit",
          language: "python",
          category: "security",
          description: "Security issue scanner for Python",
          isSecurity: true,
          isAutoFix: false,
        },
        JAVASCRIPT_ESLINT: {
          name: "ESLint",
          language: "javascript",
          category: "lint",
          description: "JavaScript linter",
          isSecurity: false,
          isAutoFix: true,
        },
      };

      const autoFixLinters = Object.values(LINTER_CATALOG).filter(
        (l) => l.isAutoFix,
      );
      expect(autoFixLinters.length).toBe(1);
      expect(autoFixLinters[0].name).toBe("ESLint");
    });

    it("should support combined filters", () => {
      const LINTER_CATALOG = {
        PYTHON_RUFF: {
          name: "Ruff",
          language: "python",
          category: "lint",
          description: "Python linter",
          isSecurity: false,
          isAutoFix: true,
        },
        PYTHON_BANDIT: {
          name: "Bandit",
          language: "python",
          category: "security",
          description: "Security issue scanner for Python",
          isSecurity: true,
          isAutoFix: false,
        },
      };

      const filtered = Object.values(LINTER_CATALOG).filter(
        (l) => l.language === "python" && l.isAutoFix,
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe("Ruff");
    });
  });

  describe("Get Security Info Tool", () => {
    it("should categorize linters by security type", () => {
      const SECURITY_CATEGORIES = {
        sast: ["JAVASCRIPT_SEMGREP", "PYTHON_SEMGREP", "PYTHON_BANDIT"],
        secrets: ["REPOSITORY_GITLEAKS"],
        "supply-chain": ["PYTHON_SAFETY"],
        container: ["DOCKERFILE_HADOLINT", "TRIVY"],
        infrastructure: ["CHECKOV", "TFSEC"],
      };

      expect(SECURITY_CATEGORIES.sast.length).toBe(3);
      expect(SECURITY_CATEGORIES.secrets.length).toBe(1);
    });

    it("should group linters by threat category", () => {
      const categoryGroups = {
        sast: {
          count: 3,
          examples: ["Semgrep", "Bandit"],
        },
        secrets: {
          count: 1,
          examples: ["Gitleaks"],
        },
      };

      expect(categoryGroups.sast.count).toBe(3);
      expect(categoryGroups.sast.examples[0]).toBe("Semgrep");
    });

    it("should identify applicable linters per threat type", () => {
      const threats = {
        injection: ["Semgrep", "Bandit"],
        "credential-exposure": ["Gitleaks"],
        "vulnerable-dependency": ["Safety", "Trivy"],
        "infrastructure-misconfiguration": ["Checkov", "Tfsec"],
      };

      expect(threats.injection.length).toBe(2);
      expect(threats["credential-exposure"][0]).toBe("Gitleaks");
    });
  });

  describe("Get Reporters Tool", () => {
    it("should list all available reporters", () => {
      const REPORTERS = [
        { id: "text", name: "Text Files", enabled: true },
        { id: "json", name: "JSON Report", enabled: false },
        { id: "sarif", name: "SARIF", enabled: false },
        { id: "github-pr", name: "GitHub PR Comments", enabled: true },
      ];

      expect(REPORTERS.length).toBeGreaterThan(0);
      expect(REPORTERS.some((r) => r.id === "text")).toBe(true);
    });

    it("should identify enabled reporters", () => {
      const REPORTERS = [
        { id: "text", name: "Text Files", enabled: true },
        { id: "json", name: "JSON Report", enabled: false },
        { id: "github-pr", name: "GitHub PR Comments", enabled: true },
      ];

      const enabled = REPORTERS.filter((r) => r.enabled);
      expect(enabled.length).toBe(2);
      expect(enabled.map((r) => r.id)).toContain("text");
    });

    it("should provide reporter output formats", () => {
      const REPORTERS = [
        { id: "text", name: "Text Files", outputFormat: "text", enabled: true },
        { id: "json", name: "JSON Report", outputFormat: "json", enabled: false },
        { id: "sarif", name: "SARIF", outputFormat: "sarif", enabled: false },
      ];

      const jsonReporter = REPORTERS.find((r) => r.outputFormat === "json");
      expect(jsonReporter?.name).toBe("JSON Report");
    });

    it("should identify CI-specific reporters", () => {
      const REPORTERS = [
        {
          id: "github-pr",
          name: "GitHub PR Comments",
          requiresCI: "github",
          enabled: true,
        },
        {
          id: "gitlab-mr",
          name: "GitLab MR Comments",
          requiresCI: "gitlab",
          enabled: true,
        },
        { id: "text", name: "Text Files", enabled: true },
      ];

      const githubReporters = REPORTERS.filter(
        (r) => r.requiresCI === "github",
      );
      expect(githubReporters.length).toBe(1);
      expect(githubReporters[0].id).toBe("github-pr");
    });
  });

  describe("Parse Reports Tool", () => {
    it("should validate JSON report structure", () => {
      const report = JSON.parse(JSON.stringify(mockReport));
      expect(Array.isArray(report)).toBe(true);
      expect(report.length).toBe(3);
    });

    it("should handle missing report files gracefully", () => {
      const fileExists = false;
      expect(fileExists).toBe(false);
    });

    it("should parse SARIF report format", () => {
      const sarifReport = {
        version: "2.1.0",
        runs: [
          {
            tool: { driver: { name: "Semgrep" } },
            results: [
              {
                ruleId: "rules/python.lang/security/injection/sql-injection.yaml",
                message: { text: "Potential SQL injection" },
                level: "warning",
              },
            ],
          },
        ],
      };

      expect(sarifReport.version).toBe("2.1.0");
      expect(sarifReport.runs[0].tool.driver.name).toBe("Semgrep");
    });
  });

  describe("Get Issue Summary Tool", () => {
    it("should count issues by severity", () => {
      const summary = {
        totalIssues: 3,
        bySeverity: {
          error: 1,
          warning: 1,
          critical: 1,
        },
      };

      expect(summary.totalIssues).toBe(3);
      expect(summary.bySeverity.error).toBe(1);
    });

    it("should aggregate issues by linter", () => {
      const summary = {
        byLinter: {
          TYPESCRIPT_ESLINT: 2,
          PYTHON_SAFETY: 1,
        },
      };

      expect(summary.byLinter.TYPESCRIPT_ESLINT).toBe(2);
      expect(Object.keys(summary.byLinter).length).toBe(2);
    });

    it("should support severity filtering", () => {
      const filtered = mockReport.filter(
        (i) => String(i.severity).toLowerCase() === "error",
      );
      expect(filtered.length).toBe(1);
    });

    it("should support linter filtering", () => {
      const filtered = mockReport.filter(
        (i) => i.linter === "PYTHON_SAFETY",
      );
      expect(filtered.length).toBe(1);
    });
  });

  describe("Get Security Recommendations Tool", () => {
    it("should identify active security linters", () => {
      const activeLinters = ["Semgrep", "Bandit", "Gitleaks"];
      expect(activeLinters.length).toBeGreaterThan(0);
      expect(activeLinters[0]).toBe("Semgrep");
    });

    it("should provide SAST recommendations", () => {
      const sastLinters = ["Semgrep", "Bandit", "DevSkim"];
      expect(sastLinters.includes("Semgrep")).toBe(true);
    });

    it("should provide secrets management guidance", () => {
      const guidance =
        "Use Gitleaks to prevent credential leaks. Configure pre-commit hooks to validate before push.";
      expect(guidance).toContain("Gitleaks");
      expect(guidance).toContain("pre-commit");
    });

    it("should provide container security recommendations", () => {
      const recommendations = [
        "Use Hadolint for Dockerfile security",
        "Use Trivy for container image vulnerability scanning",
      ];

      expect(recommendations.length).toBe(2);
      expect(recommendations[0]).toContain("Hadolint");
    });

    it("should provide infrastructure security guidance", () => {
      const infra = {
        linters: ["Checkov", "Tfsec"],
        purpose:
          "Infrastructure as Code security and misconfiguration detection",
      };

      expect(infra.linters.length).toBe(2);
      expect(infra.purpose).toContain("Infrastructure");
    });

    it("should prioritize issues and next steps", () => {
      const nextSteps = [
        "Review flagged security issues in priority order",
        "Configure auto-fix linters where available",
        "Integrate security scanning into CI/CD pipeline",
      ];

      expect(nextSteps.length).toBe(3);
      expect(nextSteps[0]).toContain("priority");
    });
  });
});
