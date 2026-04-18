import { describe, it, expect, afterEach } from "vitest";
import { stripJsonFences, isAIConfigured, OPENAI_MODEL } from "./client";

describe("isAIConfigured", () => {
  const original = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  });

  it("returns true when key is set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isAIConfigured()).toBe(true);
  });

  it("returns false when key is missing", () => {
    delete process.env.OPENAI_API_KEY;
    expect(isAIConfigured()).toBe(false);
  });

  it("OPENAI_MODEL is exported as a string constant", () => {
    expect(typeof OPENAI_MODEL).toBe("string");
    expect(OPENAI_MODEL.length).toBeGreaterThan(0);
  });
});

describe("stripJsonFences", () => {
  it("returns plain text unchanged", () => {
    expect(stripJsonFences(`{"a":1}`)).toBe(`{"a":1}`);
  });

  it("strips ```json ... ``` fences", () => {
    const input = "```json\n{\"a\":1}\n```";
    expect(stripJsonFences(input)).toBe(`{"a":1}`);
  });

  it("strips bare ``` ... ``` fences (no lang)", () => {
    const input = "```\n{\"a\":1}\n```";
    expect(stripJsonFences(input)).toBe(`{"a":1}`);
  });

  it("handles uppercase JSON lang tag", () => {
    const input = "```JSON\n{\"a\":1}\n```";
    expect(stripJsonFences(input)).toBe(`{"a":1}`);
  });

  it("strips surrounding whitespace", () => {
    expect(stripJsonFences("   {\"a\":1}   ")).toBe(`{"a":1}`);
  });

  it("leaves internal whitespace / newlines alone", () => {
    const input = "```json\n{\n  \"a\": 1\n}\n```";
    expect(stripJsonFences(input)).toBe(`{\n  "a": 1\n}`);
  });

  it("is a no-op when no fences are present", () => {
    const input = "just a regular string";
    expect(stripJsonFences(input)).toBe("just a regular string");
  });
});
