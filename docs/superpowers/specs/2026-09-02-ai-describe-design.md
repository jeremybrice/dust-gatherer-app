# AI description suggestion: design

**Date:** 2026-09-02
**Status:** approved (key choice: Token Plan, see Risks)

## Why

Her request: "add AI, I want it to be able to make a short description: what style it is
and for what occasion." A button on the item form that looks at the photo and proposes two
sentences she can accept, edit, or discard.

## Provider and model

Alibaba Cloud Model Studio, Qwen `qwen3.8-flash` (vision native, flash speed), called through
the OpenAI-compatible chat completions endpoint with a plain `fetch`. No SDK, no new
dependency.

Model rationale, from the research on 2026-09-02:

- `qwen3.8-flash` is the newest flash-tier vision model, list price $0.15 / $0.47 per 1M
  input / output tokens. A 1024 x 768 photo is about 770 input tokens (`h x w / 1024 + 2`);
  two sentences are about 80 output tokens. That is roughly $0.00016 per description, about
  three cents for the entire 208-item inventory at pay-as-you-go rates.
- `qwen3.7-flash` is five times cheaper ($0.03 / $0.13) and is what Alibaba's own vision
  guide suggests as the budget step down from `qwen3.7-plus`. Kept as the fallback; the
  difference across the whole inventory is two cents, so quality wins.
- `qwen3.7-plus` is flagship quality at about 13x the cost of 3.8-flash and slower. Not
  needed for two sentences.
- Thinking mode is turned off (`enable_thinking: false`). Reasoning tokens would add latency
  and cost and change nothing in a two-sentence caption.

The model id is configuration, not code.

## Key and endpoint

Decision: the Token Plan (Personal Edition) API key (`sk-sp-...`) with the base URL shown on
the Token Plan subscription page in the Model Studio console. The plan lists `qwen3.8-flash`
with visual understanding.

Three environment variables, all server-only:

| Variable | Meaning |
|---|---|
| `AI_API_KEY` | The key. Token Plan today; a general pay-as-you-go key works unchanged. |
| `AI_BASE_URL` | OpenAI-compatible base, ending in `/v1`. Must be the pair that matches the key: Token Plan URL for an `sk-sp-` key, `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (or the workspace URL) for a general `sk-` key. Mixing them fails with 401. |
| `AI_MODEL` | Defaults to `qwen3.8-flash`. |

When `AI_API_KEY` is absent the feature is hidden, not broken: the form does not render the
button and the route answers 503.

## Risks, recorded

1. **Token Plan terms.** The plan page states: "API calls are strictly prohibited: This plan
   is intended for use only within coding tools and agent tools ... Using the API for
   automation scripts, custom application backends, or any non-interactive batch call
   scenarios is prohibited ... may result in subscription suspension or API Key banning."
   A Netlify function is a custom application backend. Our calls are single and
   user-initiated, never batch or scheduled, but the clause still applies. Jeremy accepted
   this risk on 2026-09-02. Mitigation: the swap to a general key is `AI_API_KEY` +
   `AI_BASE_URL` only; a general key has a 1,000,000-token free quota per model for 90 days
   and then costs cents.
2. **Credits, not dollars.** Token Plan bills in Credits with undisclosed per-model
   coefficients and a 7-day window (Lite 2,500 / Standard 10,000 / Pro 40,000). Check the
   console's usage detail after the first few descriptions to learn the real per-call cost.
   A 429 "Allocated quota exceeded" means the window is spent; the UI says so plainly.
3. **Photos leave the device.** The image goes to Alibaba Cloud (Singapore region, Global
   deployment; cross-border inference). Acceptable for thrift-store photos; a one-line note
   under the button says where the photo goes.

## Behaviour

- On the item form, next to the Description label: **Suggest description** (Запропонувати
  опис). Enabled when the item has a photo (a freshly chosen file or a saved `imageKey`) and
  the form is not busy. Disabled with a hint when there is no photo.
- Tap: the client downscales the photo to a 1024px long edge JPEG (about 100 to 150 KB,
  reusing `downscaleImage`), base64-encodes it, and posts it with the title, category, and
  UI language to `POST /api/describe`. For a saved item the client fetches
  `/api/images/{key}` first; the server never reads Blobs for this, so there is one code path.
- The server builds one chat completion: a fixed English system prompt, the image as a
  `data:image/jpeg;base64,...` URL, and a short user text carrying title, category, and the
  output language. `enable_thinking: false`, `response_format: { type: "json_object" }`,
  `max_tokens: 200`, 20 s timeout.
- Expected answer: `{ "style": "...", "occasion": "..." }`, each one sentence, in the UI
  language. The server validates, tolerates fenced or prose output by falling back to the raw
  text, and returns `{ style, occasion, text }` where `text` joins the two.
- The form shows the suggestion in a box under Description with three actions: **Use**
  (replaces an empty description, otherwise appends on a new line and the label reads
  **Add to description**), **Try again**, **Dismiss**. Nothing is saved until she saves the
  item. The suggestion never overwrites text without her tapping Use.
- Errors are human: 401 "AI key rejected, check Settings on the server", 429 "AI quota
  reached for now, try later", timeouts and 5xx "Could not get a suggestion." The key and
  provider error bodies never reach the client.

## Prompt

System (English regardless of UI language, output language given in the user turn):

> You write short listing notes for a second-hand and thrift resale seller. Look at the
> photo. Answer with JSON only: {"style": "...", "occasion": "..."}. "style" is one
> sentence on the style, era or aesthetic, and visible material or pattern. "occasion" is
> one sentence on the occasion or setting the item suits. Be concrete about what is
> visible. No price, no hashtags, no emoji, no brand names unless clearly legible in the
> photo. Write both sentences in {language}.

User text: `Title: {title}. Category: {category}.` (fields omitted when empty) followed by
`Language: Ukrainian` or `Language: English`.

## Files

- `src/lib/describe.ts`: pure helpers, `buildDescribeRequest`, `parseDescribeResponse`,
  `mapAiError`, `isAiConfigured`; unit-tested, no network.
- `src/app/api/describe/route.ts`: gate, zod body (image base64 up to 1.5 MB, title,
  category, lang), calls the provider, maps errors.
- `src/components/ItemForm.tsx`: button, suggestion box, photo bytes helper; receives
  `aiEnabled` from the page.
- `src/app/items/new/page.tsx`, `src/app/items/[id]/page.tsx`: pass `aiEnabled`.
- `i18n/en.json`, `i18n/uk.json`: strings.
- `CLAUDE.md`: environment table and a trap entry for the key/URL pairing and the plan terms.

## Testing

- Unit: request shape (model, `enable_thinking` false, JSON response format, data URL,
  language line), response parsing (clean JSON, fenced JSON, prose fallback, empty is an
  error), error mapping, configured/unconfigured.
- Manual with the real key in `.env.local` (never committed): new item with a camera photo,
  saved item with a stored photo, Ukrainian and English output, Use / append / Try again /
  Dismiss, feature hidden when the key is unset, 429 message when the plan window is spent.
- Deploy: set the three variables in Netlify, run one description from her phone, then read
  the Credits consumed in the Token Plan console.
