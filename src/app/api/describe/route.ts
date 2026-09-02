import { NextResponse } from "next/server";
import { z } from "zod";
import { gateApi } from "@/lib/auth";
import {
  isAiConfigured,
  buildDescribeRequest,
  parseDescribeResponse,
  mapAiError,
} from "@/lib/describe";

export const runtime = "nodejs";

// Character ceiling on the base64 string itself, not decoded bytes — a 1024px
// JPEG is well under this; the limit is a hostile-payload guard.
const MAX_IMAGE_CHARS = Math.floor(1.5 * 1024 * 1024);

const bodySchema = z.object({
  image: z.string().max(MAX_IMAGE_CHARS),
  title: z.string(),
  category: z.string(),
  lang: z.enum(["en", "uk"]),
});

function aiClientError(code: ReturnType<typeof mapAiError>) {
  return NextResponse.json({ error: code }, { status: 502 });
}

export async function POST(req: Request) {
  const gate = await gateApi();
  if (gate) return gate;

  if (!isAiConfigured()) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `invalid request: ${parsed.error.issues[0]?.message ?? "bad request"}` },
      { status: 400 },
    );
  }

  const apiKey = process.env.AI_API_KEY!.trim();
  const baseUrl = process.env.AI_BASE_URL!.trim();
  const model = process.env.AI_MODEL?.trim() || "qwen3.8-flash";
  // Strip a trailing slash so a base that already ends in `/v1/` does not
  // become `/v1//chat/completions`.
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildDescribeRequest(
          {
            imageBase64: parsed.data.image,
            title: parsed.data.title,
            category: parsed.data.category,
            lang: parsed.data.lang,
          },
          { model },
        ),
      ),
      signal: controller.signal,
    });
  } catch {
    // Abort and network failures must not leak a stack, URL, or provider body.
    return aiClientError("ai_failed");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    console.error("describe provider", response.status, raw.slice(0, 400));
    return aiClientError(mapAiError(response.status));
  }

  let content: unknown;
  try {
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    content = payload.choices?.[0]?.message?.content;
  } catch {
    return aiClientError("ai_failed");
  }

  if (typeof content !== "string") {
    return aiClientError("ai_failed");
  }

  try {
    return NextResponse.json(parseDescribeResponse(content));
  } catch {
    return aiClientError("ai_failed");
  }
}
