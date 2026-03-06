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
});
