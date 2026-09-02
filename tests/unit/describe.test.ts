import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildDescribeRequest,
  parseDescribeResponse,
  mapAiError,
  isAiConfigured,
} from "@/lib/describe";

const SYSTEM_PROMPT =
  'You write short listing notes for a second-hand and thrift resale seller. Look at the photo. Answer with JSON only: {"style": "...", "occasion": "..."}. "style" is one sentence on the style, era or aesthetic, and visible material or pattern. "occasion" is one sentence on the occasion or setting the item suits. Be concrete about what is visible. No price, no hashtags, no emoji, no brand names unless clearly legible in the photo. Write both sentences in {language}.';

describe("buildDescribeRequest", () => {
  const imageBase64 = "abc123";

  it("sets model, thinking off, JSON format, and max_tokens", () => {
    const body = buildDescribeRequest(
      { imageBase64, title: "Coat", category: "Outerwear", lang: "en" },
      { model: "qwen3.8-flash" },
    );
    expect(body.model).toBe("qwen3.8-flash");
    expect(body.enable_thinking).toBe(false);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.max_tokens).toBe(200);
  });

  it("sends one system message with the English prompt and language filled in", () => {
    const body = buildDescribeRequest(
      { imageBase64, title: "Coat", category: "Outerwear", lang: "uk" },
      { model: "qwen3.8-flash" },
    );
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({
      role: "system",
      content: SYSTEM_PROMPT.replace("{language}", "Ukrainian"),
    });
  });

  it("puts a JPEG data URL and Language: Ukrainian in the user message for uk", () => {
    const body = buildDescribeRequest(
      { imageBase64, title: "Coat", category: "Outerwear", lang: "uk" },
      { model: "qwen3.8-flash" },
    );
    const user = body.messages[1];
    expect(user.role).toBe("user");
    expect(Array.isArray(user.content)).toBe(true);
    const parts = user.content as Array<{ type: string; image_url?: { url: string }; text?: string }>;
    const image = parts.find((p) => p.type === "image_url");
    const text = parts.find((p) => p.type === "text");
    expect(image?.image_url?.url).toBe("data:image/jpeg;base64,abc123");
    expect(text?.text).toContain("Language: Ukrainian");
    expect(text?.text).toContain("Title: Coat.");
    expect(text?.text).toContain("Category: Outerwear.");
  });

  it("uses Language: English for en", () => {
    const body = buildDescribeRequest(
      { imageBase64, title: "Coat", category: "Outerwear", lang: "en" },
      { model: "qwen3.8-flash" },
    );
    expect(body.messages[0].content).toBe(
      SYSTEM_PROMPT.replace("{language}", "English"),
    );
    const textPart = (body.messages[1].content as Array<{ type: string; text?: string }>)
      .find((p) => p.type === "text");
    expect(textPart?.text).toContain("Language: English");
  });

  it("omits Title and Category when empty", () => {
    const body = buildDescribeRequest(
      { imageBase64, title: "", category: "  ", lang: "en" },
      { model: "qwen3.8-flash" },
    );
    const textPart = (body.messages[1].content as Array<{ type: string; text?: string }>)
      .find((p) => p.type === "text");
    expect(textPart?.text).not.toContain("Title:");
    expect(textPart?.text).not.toContain("Category:");
    expect(textPart?.text).toBe("Language: English");
  });
});

describe("parseDescribeResponse", () => {
  it("parses clean style/occasion JSON and joins text", () => {
    expect(
      parseDescribeResponse('{"style": "Vintage denim.", "occasion": "Weekend casual."}'),
    ).toEqual({
      style: "Vintage denim.",
      occasion: "Weekend casual.",
      text: "Vintage denim. Weekend casual.",
    });
  });

  it("parses JSON inside a fenced code block", () => {
    const fenced = '```json\n{"style": "Soft knit.", "occasion": "Cool evenings."}\n```';
    expect(parseDescribeResponse(fenced)).toEqual({
      style: "Soft knit.",
      occasion: "Cool evenings.",
      text: "Soft knit. Cool evenings.",
    });
  });

  it("falls back to trimmed prose when JSON is missing", () => {
    expect(parseDescribeResponse("  Soft knit for cool evenings.  ")).toEqual({
      style: null,
      occasion: null,
      text: "Soft knit for cool evenings.",
    });
  });

  it("throws on empty content", () => {
    expect(() => parseDescribeResponse("")).toThrow();
    expect(() => parseDescribeResponse("   ")).toThrow();
  });

  it("throws on truncated JSON instead of leaking it as prose", () => {
    expect(() => parseDescribeResponse('{"style": "Вінтажна')).toThrow();
  });
});

describe("mapAiError", () => {
  it("maps 401 to ai_key_rejected", () => {
    expect(mapAiError(401)).toBe("ai_key_rejected");
  });

  it("maps 429 to ai_quota", () => {
    expect(mapAiError(429)).toBe("ai_quota");
  });

  it("maps other statuses to ai_failed", () => {
    expect(mapAiError(500)).toBe("ai_failed");
    expect(mapAiError(403)).toBe("ai_failed");
    expect(mapAiError(0)).toBe("ai_failed");
  });
});

describe("isAiConfigured", () => {
  const prevKey = process.env.AI_API_KEY;
  const prevBase = process.env.AI_BASE_URL;

  beforeEach(() => {
    delete process.env.AI_API_KEY;
    delete process.env.AI_BASE_URL;
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = prevKey;
    if (prevBase === undefined) delete process.env.AI_BASE_URL;
    else process.env.AI_BASE_URL = prevBase;
  });

  it("is true only when key and base URL are both non-empty", () => {
    expect(isAiConfigured()).toBe(false);

    process.env.AI_API_KEY = "sk-sp-test";
    expect(isAiConfigured()).toBe(false);

    process.env.AI_BASE_URL = "https://example.com/v1";
    expect(isAiConfigured()).toBe(true);
  });

  it("treats whitespace-only values as empty", () => {
    process.env.AI_API_KEY = "   ";
    process.env.AI_BASE_URL = "https://example.com/v1";
    expect(isAiConfigured()).toBe(false);

    process.env.AI_API_KEY = "sk-sp-test";
    process.env.AI_BASE_URL = "  ";
    expect(isAiConfigured()).toBe(false);
  });
});
