# Maths and Science corpus workflow (2026–27)

The source corpus is `../Data` in `CBSE_Style_Tutor`, not the placeholder `CBSEAI-app/Data`. Original PDFs and ZIPs stay in place. The scripts create virtual manifests and processed files under the parent `Data` directory.

## Authority and answer behavior

1. `data/corpus/syllabus_2026_27.json` maps the active CBSE curriculum to 27 Class X year-end chapters, plus separate formative and internal-assessment topics. Its PDFs in `../Data/Curriculum-2026` remain the authority. The map is a retrieval filter, not educational source text in place of the PDFs.
2. Current NCERT passages are the first source for explanations and definitions. Every answer must cite retrieved evidence. Missing evidence produces a refusal to guess.
3. A marking scheme can supply marks only when it is joined to its exact paper, question and part. No current paper page is approved for this yet.
4. Formative-only and excluded topics must not be described as part of the year-end board paper. The curriculum's broad Heredity note conflicts with its detailed content and the current sample paper; the mapping treats Mendelian Heredity as examinable and Evolution as formative, pending a new official clarification.
5. Maths Standard (041) and Basic (241) are separate tracks. A ZIP filename is not a track label. A source's internal cover or subject code must be checked.
6. The curriculum distinguishes proof of the Basic Proportionality Theorem from statements without proof of its converse and the similarity criteria. Science NCERT boxed text is excluded from the year-end assessment. Practical work requires its own reviewed sources before the tutor can answer internal-assessment questions.

## Generated artifacts

| Artifact | Purpose | Current status |
| --- | --- | --- |
| `../Data/manifests/science-maths-inventory.jsonl` | PDF/member checksums, internal cover evidence, path and role candidates, subject, track, session and warning labels | 725 Maths/Science candidates; all pending review |
| `../Data/processed/science-maths-2026-27/staging.jsonl` | 27 curriculum scope records and 921 NCERT passage records with page citations | Staging only; never sent to the live index automatically |
| `../Data/processed/science-maths-2026-27/paper-review-queue.jsonl` | Current SQP and marking-scheme page text, candidate question numbers and QA flags | 45 pages pending question/part and visual review |
| `../Data/reports/*.json` | Inventory, extraction and paper warning counts | QA audit trail |
| `../Data/reports/science-maths-qa.json` | Source checksum checks and row-level extraction risk flags | Triage only; 791 of 948 rows flagged for extra review |
| `../Data/processed/science-maths-2026-27/science-paragraph-staging.jsonl` | Layout-aware main-column Science paragraphs | 103 staging rows; each was visually inspected, with only 12 chosen for the pilot |
| `../Data/processed/science-maths-2026-27/maths-paragraph-staging.jsonl` | Layout-aware Maths prose, excluding notation and visual-dependent text | 68 staging rows, with 8 visually reviewed for the pilot |
| `../Data/processed/science-maths-2026-27/pilot-reviewed-batch.jsonl` | Checksum-pinned, source-verified pilot copy of 27 curriculum scope rows, 12 Science passages and 8 Maths passages | 47 approved pilot records, staged only |
| `../Data/processed/science-maths-2026-27/optics-reviewed-addendum.jsonl` | Visually checked NCERT Table 9.4 row and lens definition | Two approved rows, indexed in the 49-row pilot |
| `../Data/reports/maths-independent-source-audit.md` | Independent Maths PDF and notation audit | Identifies two false OCR statements that remain quarantined |
| `../Data/reports/lens-definition-source-review.md` | Rendered NCERT lens definition and provenance | Supports the live Chapter 9 definition row |

The inventory excludes Social Science documents mislabeled by path. Internally dated 2021 item banks are not treated as 2026 sources. Historical papers and exemplars are withheld until they are mapped to current subtopics and assessed for stale content.

## Safe promotion

`reviewStatus=staging` in generated passage rows prevents ingestion. The ingestion API requires `reviewStatus=approved`, `assessmentStatus=summative`, a 2026–27 topic mapping, official source URL, content checksum and a server-side ingestion key. Qdrant queries filter approved summative rows again. A reviewer must inspect formulae, diagrams, tables, OCR, current scope and page citations before changing a row to approved. For papers, the reviewer must also check track, set, question number, alternative/accessible version, and exact marking-scheme part before publishing joined chunks.

For updates, save the previous manifest, regenerate the inventory, and run `scripts/compare_corpus_manifests.py previous.jsonl current.jsonl --output ../Data/reports/update-dry-run.json`. It reports unchanged, changed, added, removed, renamed and duplicate content by checksum. Re-extract only affected sources after review; do not carry removed source points into the new collection.

The text extractor failed on one NCERT Science Heredity page and flagged one low-text and one noisy Maths unit. These are excluded pending an OCR or visual correction. PDF page numbers are stored separately from any printed textbook page number; only verified page numbers should be displayed.

Publish a reviewed batch to its own versioned Qdrant collection, run retrieval evaluations against that collection, then run `scripts/promote_qdrant.mjs` with the live alias, target collection and expected minimum point count. The script only shows a dry run unless `--apply` is passed. Qdrant switches aliases atomically. Rollback uses the same script with the previous collection printed at promotion. The app's `QDRANT_COLLECTION` points at `cbse_10_live`; auto-creation is disabled by default so a missing alias cannot silently create an empty live collection.

`scripts/ingest_reviewed.mjs` accepts only a separate approved JSONL file and defaults to a dry run. Its `--apply` mode sends 16-row batches to `STAGING_INGEST_URL` using `INGEST_API_KEY`. That staging deployment must target the versioned collection, never the live alias. No generated `staging.jsonl` file can pass its approval check as-is.

## Rebuild staging

Use any Python environment with the version in `requirements-corpus.txt`:

```sh
python scripts/corpus_inventory.py --data-root ../Data
python scripts/extract_science_maths.py --data-root ../Data
python scripts/stage_current_papers.py --data-root ../Data
python scripts/qa_staging.py
python scripts/extract_science_paragraphs.py
python scripts/extract_maths_paragraphs.py
python scripts/prepare_pilot_batch.py
```

No model is installed locally. Hosted answers now try Groq Free Qwen3.8 27B, then free OpenRouter routes; BGE-M3 embeddings use Cloudflare Workers AI's daily free allowance via API. Sparse retrieval uses deterministic lexical weights with Qdrant. The 49-point pilot collection `cbse_10_pilot_20260925_v3` backs the live Padhle domain. A live “What is a lens?” check returned the NCERT definition with the Chapter 9 citation; a “What is a prism?” check produced an in-syllabus source-gap message. Chapter routing no longer counts a partial match on a multiword alias such as “eye lens”, and answer retrieval requires question-to-passage overlap so neighbouring paragraphs cannot be used as evidence. The earlier 47-point and 39-point pilot collections remain separate. Keep API keys in protected Vercel environment variables, never in this repository or a chat message. Free answer models can be rate-limited; the tutor shows a labelled NCERT excerpt when a model is busy and suitable evidence exists.

The second selected model is now Gemma 4 31B because the original Llama 3.2 11B Vision free endpoint is absent from OpenRouter's current catalog. It has a bounded offline role in `scripts/audit_answers.mjs` and serves as an answer fallback if Qwen is unavailable. The audit script samples reviewed evaluation answers, compares them with the supplied evidence and writes a report. Its verdict is a review signal, not ground truth. It uses at most three API calls by default to respect free-tier limits.
