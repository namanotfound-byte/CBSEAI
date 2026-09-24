# CBSEAI Data Contract

Send extracted rows to `POST /api/ingest` as pre-chunked records whenever
possible. The API validates metadata, embeds the text, and writes it unchanged
to the active store. Send `Authorization: Bearer <INGEST_API_KEY>`.

The current syllabus is the control plane. Ingest it first as small
`syllabus_scope` chunks, one per canonical topic. Every textbook paragraph,
question, diagram, and marking-scheme row must then point to exactly one of
those topics.

```json
{
  "chunks": [
    {
      "id": "syllabus_science_life_processes_photosynthesis",
      "text": "Photosynthesis: autotrophic nutrition, raw materials and major events.",
      "meta": {
        "kind": "syllabus",
        "chunkType": "syllabus_scope",
        "subject": "science",
        "chapter": 5,
        "sourceYear": "2026-27",
        "syllabusVersion": "2026-27",
        "syllabusTopicId": "science.life-processes.photosynthesis",
        "officialUrl": "https://cbseacademic.nic.in",
        "inActiveSyllabus": true,
        "contentSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "language": "en"
      }
    },
    {
      "id": "ncert_sci_ch5_s51_p95",
      "text": "Short extractive text used for retrieval and citation.",
      "meta": {
        "kind": "ncert",
        "chunkType": "ncert_section",
        "subject": "science",
        "chapter": 5,
        "page": 95,
        "sourceYear": "2025",
        "syllabusVersion": "2026-27",
        "syllabusTopicId": "science.life-processes.photosynthesis",
        "heading": "Nutrition in plants",
        "officialUrl": "https://ncert.nic.in/textbook.php",
        "inActiveSyllabus": true,
        "contentSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "language": "en"
      }
    }
  ]
}
```

## Required fields

- `id`: stable chunk id.
- `text`: syllabus statement, extractive text, question block, diagram caption,
  or marking-scheme text.
- `meta.kind`: `syllabus`, `ncert`, `exemplar`, `pyq`, `sqp`, `ms`, `diagram`,
  `model`, `cfpq`, or `notes`.
- `meta.subject` and `meta.chapter`: current syllabus location.
- `meta.chunkType`: `syllabus_scope`, parent/child question type,
  `marking_scheme`, `diagram`, or another canonical content type.
- `meta.sourceYear`: original publication or exam year. Ingestion never changes it.
- `meta.syllabusVersion`: syllabus release used for review, such as `2026-27`.
- `meta.syllabusTopicId`: canonical topic id from an active `syllabus_scope` row.
- `meta.inActiveSyllabus`: explicit boolean. Missing values are denied.
- `meta.officialUrl`: allowlisted official source URL.
- `meta.contentSha256`: SHA-256 of the immutable raw file.
- `meta.language`: normally `en` or `hi`.

Legacy `meta.year` is rejected because it confuses publication year with
syllabus applicability.

## Official source policy

`meta.officialUrl` must use HTTPS and come from NCERT, ePathshala, or CBSE
Academic.

## Competency questions and exam joins

Competency/drill retrieval admits only `cfpq`, `sqp`, or `pyq` rows whose
`chunkType` is `question_block` or `question_part`, and whose topic mapping is
active in the configured syllabus version. If none exists, the app says so; it
does not ask the model to invent one.

Question-bank and marking-scheme chunks need `joinPrefix`. Child chunks also
need `parentId`; retrieving a child returns its complete parent. Diagram rows
need vocabulary-gated `conceptTags`, and their crop must be stored as
`data/diagrams/<chunk-id>.webp` (or under `DIAGRAM_DIR`).

## Local checks

- `GET /api/rag/status` shows the active syllabus version and chunk count.
- `GET /api/rag/search?q=ohm's+law&subject=science&chapter=11` previews the
  syllabus scope followed by eligible evidence.
- `POST /api/ingest` rejects unmapped, inactive, or legacy-format chunks.
