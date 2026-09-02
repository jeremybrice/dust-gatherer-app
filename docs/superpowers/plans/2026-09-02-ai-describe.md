# AI Description Suggestion Implementation Plan

**Goal:** A "Suggest description" button on the item form that sends the photo to Qwen
`qwen3.8-flash` and proposes two sentences (style, occasion) in the UI language, which she
can use, append, retry, or dismiss.

**Architecture:** One server route `POST /api/describe` wrapping a plain `fetch` to the
OpenAI-compatible chat completions endpoint (base URL, key, and model from env). Pure
request-building and response-parsing helpers in `src/lib/describe.ts` carry the tests. The
client downscales the photo and posts base64; the server never touches Blobs.

**Tech Stack:** Next.js 15 route handler (Node runtime), zod, existing `downscaleImage`.
No new dependencies.

**Spec:** [docs/superpowers/specs/2026-09-02-ai-describe-design.md](../specs/2026-09-02-ai-describe-design.md)

## Global constraints

- `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` are server-only. Never `NEXT_PUBLIC_`, never in a
  client bundle, never in a response body or log line.
- No provider SDK. `fetch` with an `AbortController` timeout of 20 s.
- The feature disappears cleanly when `AI_API_KEY` is unset: no button, route returns 503.
- The suggestion is never written to the database by the route. Only the form's Save does.
- `enable_thinking: false` on every call.
- Branch `ai-describe`, PR to `main`. Do not stage the Relay block in `CLAUDE.md`,
  `.claude/skills/`, or `.relay/`.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/describe.ts` (create) | `isAiConfigured`, `buildDescribeRequest`, `parseDescribeResponse`, `mapAiError`, prompt text |
| `tests/unit/describe.test.ts` (create) | Pure tests for the above |
| `src/app/api/describe/route.ts` (create) | Gate, validate, call provider, map errors |
| `src/components/ItemForm.tsx` (modify) | Button, suggestion box, photo bytes helper |
| `src/app/items/new/page.tsx`, `src/app/items/[id]/page.tsx` (modify) | Pass `aiEnabled` |
| `src/app/globals.css` (modify) | `.ai-suggestion`, `.ai-actions`, label row |
| `i18n/en.json`, `i18n/uk.json` (modify) | Strings |
| `CLAUDE.md`, `docs/handoff.md` (modify) | Env table, trap, current state |

---

### Task 1: Pure helpers with tests

- [ ] `tests/unit/describe.test.ts`:
  - `buildDescribeRequest({ imageBase64, title, category, lang }, { model })` yields
    `model`, `enable_thinking: false`, `response_format: { type: "json_object" }`,
    `max_tokens: 200`, one system message, one user message whose content has an
    `image_url` with a `data:image/jpeg;base64,` prefix and a text part containing
    `Language: Ukrainian` for `uk`, and omits `Title:` / `Category:` when empty.
  - `parseDescribeResponse` handles `{style, occasion}` JSON, the same inside a ```json
    fence, prose (falls back to `text` = trimmed prose, style/occasion null), and empty
    content (throws).
  - `mapAiError(401)` → `ai_key_rejected`, `429` → `ai_quota`, others → `ai_failed`.
  - `isAiConfigured` true only when key and base URL are non-empty.
- [ ] Implement `src/lib/describe.ts`.

### Task 2: Route

- [ ] `src/app/api/describe/route.ts`: `runtime = "nodejs"`, `gateApi()`, 503 when not
  configured, zod body `{ image: string (base64, max 1.5 MB), title: string, category:
  string, lang: "en" | "uk" }`, `fetch(`${AI_BASE_URL}/chat/completions`)` with
  `Authorization: Bearer`, timeout, map non-2xx via `mapAiError`, parse content, return
  `{ style, occasion, text }`. Log provider status and a truncated body server-side only.

### Task 3: Form

- [ ] Strings (en + uk): `suggest_description`, `ai_thinking`, `ai_use`, `ai_append`,
  `ai_retry`, `ai_dismiss`, `ai_needs_photo`, `ai_failed`, `ai_quota`, `ai_key_rejected`,
  `ai_privacy_hint`.
- [ ] `ItemForm`: `aiEnabled` prop; label row with the button; `photoBytes()` returns a
  1024px JPEG base64 from `photoFile` or `/api/images/{imageKey}`; `suggest()` posts and
  stores `{ text, error }`; suggestion box with Use / Add to description, Try again,
  Dismiss; Use sets or appends; hint line under the box.
- [ ] Pages pass `aiEnabled={isAiConfigured()}`.
- [ ] CSS for the box and the label row.

### Task 4: Verify and ship

- [ ] `npm test`, `npm run typecheck`, `npm run build`.
- [ ] Local run with the real key in `.env.local`: new item + photo, saved item, both
  languages, all four actions, unset key hides the button.
- [ ] `CLAUDE.md`: env table rows, trap ("Token Plan key and URL must be the matching pair;
  the plan's terms exclude application backends, accepted 2026-09-02; swap is env-only"),
  current state. `docs/handoff.md` current state.
- [ ] Netlify: add the three variables, deploy by merging, one description from her phone,
  read Credits used in the Token Plan console.
