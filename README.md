# Padhle

A Class X CBSE tutor built around cited Maths and Science source material. The interface, authentication and retrieval pipeline are implemented. A **59-row reviewed pilot** is live at `cbseai-seven.vercel.app`; the wider corpus remains staged and unapproved. The tutor must not answer from model memory while reviewed evidence is unavailable.

## Current scope

- Maths and Science for the 2026–27 CBSE curriculum.
- Sources: the parent folder `../Data` inside `CBSE_Style_Tutor`. The app's own `Data` directory is only a placeholder.
- Current syllabus gates every query; only approved, summative, current-topic evidence can be retrieved.
- Answers require citations to retrieved passages. Mark splits require an exact marking-scheme match.
- Formative and excluded content is kept out of year-end board answers.

See [CORPUS_WORKFLOW.md](CORPUS_WORKFLOW.md) for the inventory, extraction and review process.

## Accounts and image questions

Supabase Auth gates the app and checks the access token again on `/api/chat` and `/api/rag/search`. Email/password signup, email confirmation, sign-in, password reset, and sign-out are implemented. The project uses a dedicated Brevo SMTP key stored in Supabase to deliver public confirmation and reset emails. Google and GitHub buttons enable automatically when those providers are enabled in Supabase. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on Vercel; never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable. In Supabase Auth URL Configuration, allow the exact app return URLs. Each social provider also needs its own OAuth client ID and secret stored in Supabase Auth, with `https://<project-ref>.supabase.co/auth/v1/callback` registered at the provider.

Conversations are saved in `public.chat_threads` under the signed-in user ID. Row-level security limits reads and writes to that user. The sidebar lists recent chats, and the bottom-left account menu shows a display name with Settings and Sign out. Older conversations from before this table existed cannot be recovered because they were never stored. History keeps text and citations, but not uploaded image files. When a chat request receives a 401, the browser refreshes its session and retries once before showing a sign-in message.

An image-only question is sent to the hosted vision model to transcribe its text and diagram details and infer Maths or Science (including Physics and Chemistry). That transcription is used to retrieve current-syllabus evidence before answering. If the image is unreadable or approved evidence is missing, the tutor says so rather than guessing. The current hosted vision routes accept up to three images per request.

## Free hosted services

The configuration is API-only; it does not require a local model or GPU:

| Service | Job | Required protected settings |
| --- | --- | --- |
| OpenRouter free Qwen3.8 27B | Text and image answer generation | `MODEL_API_KEY` |
| OpenRouter free Gemma 4 31B | Answer fallback and sampled offline audit | Same OpenRouter key |
| Groq Free Qwen3.8 27B | Optional first-choice text and image route for more daily capacity | `GROQ_API_KEY` |
| Cloudflare Workers AI free BGE-M3 | Dense embeddings | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` |
| Cloudflare Workers AI BGE reranker base | Reranks candidate passages | Same Cloudflare settings |
| Qdrant Cloud free cluster | Dense + sparse index | `QDRANT_URL`, `QDRANT_API_KEY` |
| Vercel Hobby | Web app | Add the above as protected environment variables |

These services have free quotas and can stop serving when a quota is exhausted. The previously selected Qwen2.5-VL-7B and Llama 3.2 11B Vision free routes are no longer in OpenRouter's live model catalog, despite their historical listing pages. The current Qwen and Gemma routes are open-weight, support images, and have zero listed token prices. The application rejects paid OpenRouter model routes. Both OpenRouter free endpoints returned temporary upstream rate limits in the pilot answer test. A Groq-only Qwen generation test succeeded with a correctly cited Science answer. BGE reranker base is the available free API substitute for BGE-reranker-v2-m3.

With `GROQ_API_KEY` from the Groq Free plan, the app tries Groq's Qwen3.8 27B vision endpoint first, then the existing free OpenRouter routes when Groq reports temporary unavailability or a rate limit. The Groq key passed an isolated production-environment generation test with OpenRouter disabled. Published limits vary by account; the Groq console's Limits page is the authority for an actual key. A free OpenRouter account provides 50 requests per day, shared across free models; changing model names does not multiply that allowance.

`MODEL_PROVIDER=mock`, `RAG_PROVIDER=memory` and `EMBEDDINGS_PROVIDER=mock` are available only for explicit development tests. The in-memory corpus is synthetic and must not be presented as evidence of production coverage.

## How source instructions reach the model

For each question, the server resolves a current syllabus topic, retrieves content from the same topic, reranks candidates, and gives the model a fixed CBSE answer policy plus quoted source passages and source IDs. The policy tells it to use NCERT wording for definitions, write in board-answer form, cite every academic claim, refuse when evidence is missing, and never invent a mark split. A structural verifier rejects invalid citations and unsupported marks before text is shown. This is implemented in `lib/ai/policy.ts`, `lib/ai/prompt.ts`, `lib/rag/retriever.ts`, and `lib/ai/verifier.ts`.

## Corpus status

The current inventory has 725 Maths/Science PDF or ZIP-member candidates. A first pass extracted 948 staged curriculum and NCERT records. Provenance checks verified all 29 source PDFs used for those rows; extraction triage flagged 791 rows for extra review, including mathematical notation, figures, questions and unresolved PDF glyphs. Separate layout-aware passes staged 103 Science and 68 Maths paragraphs. The current sample papers and marking schemes occupy a 45-page review queue because PDF extraction scrambles some formulae, questions and figures. No source row was approved wholesale. The 59-row live pilot collection, `cbse_10_pilot_20260925_v3`, contains 27 reviewed syllabus scope records, 18 visually reviewed Science passages, 12 visually reviewed Maths passages, and two separately reviewed optics rows. Broader chapter coverage, formulas, and paper marking schemes still need review. The ingestion endpoint requires an ingestion secret and approved metadata; its temporary key was removed from future Production builds after this pilot was indexed. The ten additional page-checked passages were published through an owner-only endpoint that accepts only the bundled reviewed batch.

`/api/rag/status` reports whether the five production credentials are present, whether the Qdrant collection can be reached, and whether any corpus points have been indexed. It never returns credential values or provider error bodies. An isolated production-environment deployment verified all five values without changing either live address. OpenRouter key authentication, Cloudflare token, BGE-M3 output shape, Cloudflare reranker, and Qdrant cluster access all passed. Pilot retrieval found the intended passages for three Science and two Maths test questions and returned scope only where reviewed content was missing.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

These checks cover application types, routing, scope and ingestion gates, and the production build. Live answer and retrieval checks require the protected API credentials and approved index.
