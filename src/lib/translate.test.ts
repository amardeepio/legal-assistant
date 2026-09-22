import { describe, expect, it } from "vitest";
import {
  LANGUAGES,
  TranslationTarget,
  cacheKey,
  chunkText,
  decodeEntities,
  hashText,
} from "@/lib/translate";

describe("hashText / cacheKey", () => {
  it("is deterministic and collision-sane", () => {
    expect(hashText("hello")).toBe(hashText("hello"));
    expect(hashText("hello")).not.toBe(hashText("world"));
  });

  it("scopes cache keys by target language", () => {
    expect(cacheKey("x", "hi")).not.toBe(cacheKey("x", "mr"));
  });
});

describe("chunkText", () => {
  it("returns short text as a single chunk", () => {
    expect(chunkText("short", 100)).toEqual(["short"]);
  });

  it("splits on paragraph boundaries within budget", () => {
    const paras = ["a".repeat(60), "b".repeat(60), "c".repeat(60)];
    const chunks = chunkText(paras.join("\n\n"), 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("\n\n")).toBe(paras.join("\n\n"));
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
  });

  it("hard-splits a single oversized paragraph", () => {
    const chunks = chunkText("x".repeat(250), 100);
    expect(chunks).toHaveLength(3);
    expect(chunks.join("")).toBe("x".repeat(250));
  });
});

describe("decodeEntities", () => {
  it("decodes Google's escaped entities", () => {
    expect(decodeEntities("it&#39;s &quot;quoted&quot; &amp; &lt;ok&gt;")).toBe(
      `it's "quoted" & <ok>`,
    );
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeEntities("a &unknown; b")).toBe("a &unknown; b");
  });
});

describe("TranslationTarget / LANGUAGES", () => {
  it("excludes English as a target", () => {
    expect(TranslationTarget.safeParse("en").success).toBe(false);
    expect(TranslationTarget.safeParse("hi").success).toBe(true);
    expect(TranslationTarget.safeParse("xx").success).toBe(false);
  });

  it("covers 9 Indian languages plus English", () => {
    expect(LANGUAGES).toHaveLength(10);
    const codes = LANGUAGES.map((l) => l.code);
    expect(codes).toContain("hi");
    expect(codes).toContain("ta");
  });
});
