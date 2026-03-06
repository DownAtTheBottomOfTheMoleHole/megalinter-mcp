import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  handleGetIssueSummaryTool,
  handleGetLintersTool,
  handleParseReportsTool,
} from "./index.js";

type ToolTextResult = {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
};

function firstText(result: ToolTextResult): string {
  return result.content[0]?.text ?? "";
}

describe("MCP tool handlers", () => {
  let testDir = "";

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), "megalinter-mcp-test-"));
  });

  afterEach(async () => {
    if (!testDir) {
      return;
    }
    await rm(testDir, { recursive: true, force: true });
  });

  it("parses JSON report payloads", async () => {
    const report = {
      summary: {
        total_badges_errors: 2,
        total_badges_warnings: 1,
      },
      linter_runs: [
        { linter_name: "REPOSITORY_SEMGREP", status: "error" },
        { linter_name: "REPOSITORY_GITLEAKS", status: "warning" },
      ],
    };

    await writeFile(
      path.join(testDir, "megalinter-report.json"),
      JSON.stringify(report),
      "utf8",
    );

    const result = (await handleParseReportsTool({
      reportsPath: testDir,
      reportType: "json",
    })) as ToolTextResult;

    const text = firstText(result);
    expect(result.isError).toBeUndefined();
    expect(text).toContain("# Parsed JSON Report");
    expect(text).toContain("```json");
    expect(text).toContain('"total_badges_errors": 2');
  });

  it("uses a SARIF code fence for SARIF reports", async () => {
    const report = {
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: "MegaLinter" } },
          results: [],
        },
      ],
    };

    await writeFile(
      path.join(testDir, "megalinter-report.sarif"),
      JSON.stringify(report),
      "utf8",
    );

    const result = (await handleParseReportsTool({
      reportsPath: testDir,
      reportType: "sarif",
    })) as ToolTextResult;

    const text = firstText(result);
    expect(result.isError).toBeUndefined();
    expect(text).toContain("# Parsed SARIF Report");
    expect(text).toContain("```sarif");
  });

  it("returns an error for unsupported report types", async () => {
    const result = (await handleParseReportsTool({
      reportsPath: testDir,
      reportType: "xml",
    })) as ToolTextResult;

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain("Unsupported report type: xml");
  });

  it("counts total issues as errors plus warnings", async () => {
    const report = {
      summary: {
        total_badges_errors: 3,
        total_badges_warnings: 2,
      },
      linter_runs: [
        { linter_name: "REPOSITORY_SEMGREP", status: "error" },
        { linter_name: "REPOSITORY_SEMGREP", status: "error" },
        { linter_name: "REPOSITORY_GITLEAKS", status: "warning" },
      ],
    };

    await writeFile(
      path.join(testDir, "megalinter-report.json"),
      JSON.stringify(report),
      "utf8",
    );

    const result = (await handleGetIssueSummaryTool({
      reportsPath: testDir,
    })) as ToolTextResult;

    const text = firstText(result);
    expect(result.isError).toBeUndefined();
    expect(text).toContain("**Total Issues**: 5");
    expect(text).toContain("- REPOSITORY_SEMGREP: 2 runs");
    expect(text).toContain("- REPOSITORY_GITLEAKS: 1 runs");
  });

  it("applies severity and linter filters in issue summary output", async () => {
    const report = {
      summary: {
        total_badges_errors: 4,
        total_badges_warnings: 1,
      },
      linter_runs: [
        { linter_name: "REPOSITORY_SEMGREP", status: "error" },
        { linter_name: "REPOSITORY_GITLEAKS", status: "warning" },
      ],
    };

    await writeFile(
      path.join(testDir, "megalinter-report.json"),
      JSON.stringify(report),
      "utf8",
    );

    const result = (await handleGetIssueSummaryTool({
      reportsPath: testDir,
      severityFilter: "warning",
      linterFilter: "gitleaks",
    })) as ToolTextResult;

    const text = firstText(result);
    expect(text).toContain("**Total Issues**: 1");
    expect(text).toContain("- REPOSITORY_GITLEAKS: 1 runs");
    expect(text).not.toContain("REPOSITORY_SEMGREP");
    expect(text).toContain("Severity: warning (applies to total issue count)");
    expect(text).toContain("Linter: gitleaks");
  });

  it("filters linter catalog by security and autofix support", () => {
    const result = handleGetLintersTool({
      securityOnly: true,
      autoFixOnly: true,
    }) as ToolTextResult;

    const linters = JSON.parse(firstText(result)) as Array<{
      isSecurity: boolean;
      isAutoFix: boolean;
    }>;

    expect(linters.length).toBeGreaterThan(0);
    expect(linters.every((linter) => linter.isSecurity && linter.isAutoFix)).toBe(
      true,
    );
  });
});
