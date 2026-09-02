/**
 * Pure helpers for the AI description suggestion feature.
 * No network — the route builds the request and calls fetch.
 */

export const DESCRIBE_SYSTEM_PROMPT =
  'You write short listing notes for a second-hand and thrift resale seller. Look at the photo. Answer with JSON only: {"style": "...", "occasion": "..."}. "style" is one sentence on the style, era or aesthetic, and visible material or pattern. "occasion" is one sentence on the occasion or setting the item suits. Be concrete about what is visible. No price, no hashtags, no emoji, no brand names unless clearly legible in the photo. Write both sentences in {language}.';

export type DescribeLang = "en" | "uk";

export type DescribeRequestInput = {
  imageBase64: string;
  title: string;
  category: string;
  lang: DescribeLang;
};

export type DescribeRequestOptions = {
  model: string;
};

type ContentPart =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

export type DescribeChatRequest = {
  model: string;
  enable_thinking: false;
  response_format: { type: "json_object" };
  max_tokens: 200;
  messages: Array<
    | { role: "system"; content: string }
    | { role: "user"; content: ContentPart[] }
  >;
};

export type DescribeResult = {
  style: string | null;
  occasion: string | null;
  text: string;
};

export type AiErrorCode = "ai_key_rejected" | "ai_quota" | "ai_failed";

function languageName(lang: DescribeLang): string {
  return lang === "uk" ? "Ukrainian" : "English";
}

function buildUserText(title: string, category: string, lang: DescribeLang): string {
  const parts: string[] = [];
  const trimmedTitle = title.trim();
  const trimmedCategory = category.trim();
  if (trimmedTitle) parts.push(`Title: ${trimmedTitle}.`);
  if (trimmedCategory) parts.push(`Category: ${trimmedCategory}.`);
  parts.push(`Language: ${languageName(lang)}`);
  return parts.join(" ");
}

export function buildDescribeRequest(
  { imageBase64, title, category, lang }: DescribeRequestInput,
  { model }: DescribeRequestOptions,
): DescribeChatRequest {
  const language = languageName(lang);
  return {
    model,
    enable_thinking: false,
    response_format: { type: "json_object" },
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: DESCRIBE_SYSTEM_PROMPT.replace("{language}", language),
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
          {
            type: "text",
            text: buildUserText(title, category, lang),
          },
        ],
      },
    ],
  };
}

function tryParseStyleOccasion(raw: string): { style: string; occasion: string } | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { style?: unknown }).style === "string" &&
      typeof (parsed as { occasion?: unknown }).occasion === "string"
    ) {
      const style = (parsed as { style: string }).style.trim();
      const occasion = (parsed as { occasion: string }).occasion.trim();
      if (style && occasion) return { style, occasion };
    }
  } catch {
    // not JSON
  }
  return null;
}

function stripFence(content: string): string {
  const trimmed = content.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}

export function parseDescribeResponse(content: string): DescribeResult {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("empty describe response");
  }

  const candidates = [trimmed, stripFence(trimmed)];
  for (const candidate of candidates) {
    const parsed = tryParseStyleOccasion(candidate);
    if (parsed) {
      return {
        style: parsed.style,
        occasion: parsed.occasion,
        text: `${parsed.style} ${parsed.occasion}`,
      };
    }
    // A candidate that looks like the start of our JSON object but failed to
    // parse (or parse into {style, occasion}) is a truncated response, not
    // prose — surfacing it as text would leak a raw JSON fragment to the seller.
    if (candidate.startsWith("{")) {
      throw new Error("truncated describe response");
    }
  }

  // Prose fallback: keep the raw text, no structured fields.
  return {
    style: null,
    occasion: null,
    text: trimmed,
  };
}

export function mapAiError(status: number): AiErrorCode {
  if (status === 401) return "ai_key_rejected";
  if (status === 429) return "ai_quota";
  return "ai_failed";
}

export function isAiConfigured(): boolean {
  const key = process.env.AI_API_KEY?.trim() ?? "";
  const base = process.env.AI_BASE_URL?.trim() ?? "";
  return key.length > 0 && base.length > 0;
}
