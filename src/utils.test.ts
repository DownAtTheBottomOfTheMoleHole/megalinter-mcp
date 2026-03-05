import { describe, expect, it } from "vitest";
import {
  formatOutput,
  readBool,
  readNumber,
  readString,
  readStringArray,
  resolveRunnerPackage,
} from "./utils.js";

describe("readString", () => {
  it("returns string value for valid string", () => {
    expect(readString({ key: "hello" }, "key")).toBe("hello");
  });

  it("trims whitespace", () => {
    expect(readString({ key: "  hello  " }, "key")).toBe("hello");
  });

  it("returns undefined for empty string after trimming", () => {
    expect(readString({ key: "   " }, "key")).toBeUndefined();
  });

  it("returns undefined for non-string value", () => {
    expect(readString({ key: 42 }, "key")).toBeUndefined();
    expect(readString({ key: true }, "key")).toBeUndefined();
    expect(readString({ key: null }, "key")).toBeUndefined();
  });

  it("returns undefined for missing key", () => {
    expect(readString({}, "key")).toBeUndefined();
  });
});

describe("readBool", () => {
  it("returns true for boolean true", () => {
    expect(readBool({ key: true }, "key")).toBe(true);
  });

  it("returns false for boolean false", () => {
    expect(readBool({ key: false }, "key")).toBe(false);
  });

  it("returns true for truthy string values", () => {
    expect(readBool({ key: "true" }, "key")).toBe(true);
    expect(readBool({ key: "1" }, "key")).toBe(true);
    expect(readBool({ key: "yes" }, "key")).toBe(true);
    expect(readBool({ key: "y" }, "key")).toBe(true);
    expect(readBool({ key: "YES" }, "key")).toBe(true);
  });

  it("returns false for falsy string values", () => {
    expect(readBool({ key: "false" }, "key")).toBe(false);
    expect(readBool({ key: "0" }, "key")).toBe(false);
    expect(readBool({ key: "no" }, "key")).toBe(false);
    expect(readBool({ key: "n" }, "key")).toBe(false);
  });

  it("returns default value for unrecognised string", () => {
    expect(readBool({ key: "maybe" }, "key", false)).toBe(false);
    expect(readBool({ key: "maybe" }, "key", true)).toBe(true);
  });

  it("returns default value for missing key", () => {
    expect(readBool({}, "key")).toBe(false);
    expect(readBool({}, "key", true)).toBe(true);
  });

  it("returns default value for non-boolean/non-string values", () => {
    expect(readBool({ key: 42 }, "key", false)).toBe(false);
    expect(readBool({ key: null }, "key", true)).toBe(true);
  });
});

describe("readNumber", () => {
  it("returns numeric value for valid number", () => {
    expect(readNumber({ key: 42 }, "key", 0)).toBe(42);
    expect(readNumber({ key: 0 }, "key", 10)).toBe(0);
  });

  it("parses numeric string", () => {
    expect(readNumber({ key: "99" }, "key", 0)).toBe(99);
  });

  it("returns default for non-finite number", () => {
    expect(readNumber({ key: Infinity }, "key", 5)).toBe(5);
    expect(readNumber({ key: NaN }, "key", 5)).toBe(5);
  });

  it("returns default for non-numeric string", () => {
    expect(readNumber({ key: "abc" }, "key", 7)).toBe(7);
  });

  it("returns default for missing key", () => {
    expect(readNumber({}, "key", 3)).toBe(3);
  });
});

describe("readStringArray", () => {
  it("returns array of strings", () => {
    expect(readStringArray({ key: ["a", "b", "c"] }, "key")).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("filters out non-string items", () => {
    expect(readStringArray({ key: ["a", 1, true, "b"] }, "key")).toEqual([
      "a",
      "b",
    ]);
  });

  it("trims whitespace and filters empty entries", () => {
    expect(readStringArray({ key: ["  a  ", "  ", "b"] }, "key")).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns empty array for non-array value", () => {
    expect(readStringArray({ key: "string" }, "key")).toEqual([]);
    expect(readStringArray({ key: 42 }, "key")).toEqual([]);
  });

  it("returns empty array for missing key", () => {
    expect(readStringArray({}, "key")).toEqual([]);
  });
});

describe("formatOutput", () => {
  it("returns output unchanged when within limit", () => {
    const short = "hello world";
    expect(formatOutput(short)).toBe(short);
  });

  it("truncates long output and includes truncation marker", () => {
    const long = "x".repeat(200_000);
    const result = formatOutput(long);
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain("... output truncated ...");
  });

  it("preserves head and tail of long output", () => {
    const head = "A".repeat(100_000);
    const tail = "Z".repeat(100_000);
    const long = head + tail;
    const result = formatOutput(long);
    expect(result.startsWith("A")).toBe(true);
    expect(result.endsWith("Z")).toBe(true);
  });

  it("respects custom maxChars", () => {
    const input = "x".repeat(200);
    const result = formatOutput(input, 100);
    expect(result).toContain("... output truncated ...");
  });

  it("returns empty string for maxChars <= 0", () => {
    const input = "x".repeat(100);
    expect(formatOutput(input, 0)).toBe("");
    expect(formatOutput(input, -5)).toBe("");
  });

  it("handles very small maxChars by returning prefix", () => {
    const input = "hello world";
    const result = formatOutput(input, 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe("resolveRunnerPackage", () => {
  it("returns bare package name for latest", () => {
    expect(resolveRunnerPackage("latest")).toBe("mega-linter-runner");
  });

  it("returns versioned package name for specific version", () => {
    expect(resolveRunnerPackage("1.2.3")).toBe("mega-linter-runner@1.2.3");
    expect(resolveRunnerPackage("v8.0.0")).toBe("mega-linter-runner@v8.0.0");
  });
});
