import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ACTIVE_SUBJECTS } from "../lib/data/syllabus";
import { inferSyllabusScope } from "../lib/rag/syllabus-index";
import { validateChunks } from "../lib/rag/ingest";
import type { Chunk, SubjectId } from "../lib/types";

const root = path.resolve(process.cwd(), "..");
const appRoot = process.cwd();
const sourceManifest = path.join(root, "Data/processed/science-maths-2026-27/theory-block-candidates.jsonl");
const outputPath = path.join(appRoot, "data/corpus/theory-reviewed-2026-27.json");
const crosswalkPath = path.join(root, "Data/reports/theory-topic-crosswalk-20260929.json");
const syllabusPath = path.join(appRoot, "data/corpus/syllabus_2026_27.json");

const mappings: Record<string, { topicId: string; rationale: string }> = {
  // Textbook chapter 6's map example is an introductory scale-factor context,
  // not one of the active similarity topics explicitly named by the curriculum.
  // The alloy oxidation fact similarly is not itself part of the current scope.
  "theory.0053fa74bedf684f5deb": {
    topicId: "maths.ch06",
    rationale: "The passage states the AA similarity criterion, explicitly included under similarity criteria in the current Triangles scope.",
  },
  "theory.4924b40e09b3ff379a1e": {
    topicId: "maths.ch09",
    rationale: "Line of sight is a defining concept for the active heights-and-distances applications in Some Applications of Trigonometry.",
  },
  "theory.e983dca0331a70234fc8": {
    topicId: "maths.ch10",
    rationale: "The passage states the active theorem that a tangent is perpendicular to the radius at the point of contact.",
  },
  "theory.5a4a2bafa5edc54333df": {
    topicId: "maths.ch14",
    rationale: "The historical sentence refers directly to Laplace's classical definition of probability, the named active Probability scope.",
  },
  "theory.2c698e405f8606327cd1": {
    topicId: "science.ch05",
    rationale: "The sentence explains transport from capillaries to tissue fluid/lymph, within transport in animals.",
  },
  "theory.121bfd0f65c7c74e4f0b": {
    topicId: "science.ch10",
    rationale: "The sentence is in the scattering-of-light section and explains the true-solution comparison used in that active topic.",
  },
  "theory.78f1d24cc862134e8a9e": {
    topicId: "science.ch11",
    rationale: "The passage explicitly addresses temperature's effect on resistance and resistivity, both named in the active Electricity scope.",
  },
  "theory.a24e7a4f6622ff7a0413": {
    topicId: "science.ch11",
    rationale: "The sentence defines power as rate of doing work, directly within the active Electricity power topic.",
  },
};
const holdReasons: Record<string, string> = {
  "theory.ea4b0850ba49e024affc": "Held: introductory map/blueprint scale-factor context is not explicitly in the active topic scope; source chapter alone is insufficient for an exact topic mapping.",
  "theory.a481a24df13b7aa60b60": "Held: alloy oxidation is adjacent to the heating-elements discussion but is not explicitly included in the active Electricity scope.",
};

async function main() {
  const rows = (await readFile(sourceManifest, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const reviewed = rows.filter((row) => row.individualVisualReview?.decision === "approved_staging_only");
  if (reviewed.length !== 10) throw new Error(`Expected 10 individually reviewed blocks, got ${reviewed.length}`);
  const reviewedIds = new Set(reviewed.map((row) => row.blockId));
  if (Object.keys(mappings).length + Object.keys(holdReasons).length !== reviewed.length) throw new Error("Every reviewed block needs one mapping or explicit hold decision");
  for (const id of [...Object.keys(mappings), ...Object.keys(holdReasons)]) {
    if (!reviewedIds.has(id)) throw new Error(`Crosswalk decision is stale or unreviewed: ${id}`);
  }

  const syllabus = JSON.parse(await readFile(syllabusPath, "utf8")) as {
    version: string;
    topics: Array<{ id: string; subject: SubjectId; chapter: number; title: string; scope: string; assessmentStatus: string }>;
  };
  if (syllabus.version !== "2026-27") throw new Error(`Unexpected syllabus version: ${syllabus.version}`);
  const topics = new Map(syllabus.topics.map((topic) => [topic.id, topic]));
  const chunks: Chunk[] = [];
  const crosswalk = [];

  for (const row of reviewed) {
    const mapping = mappings[row.blockId];
    if (!mapping) {
      crosswalk.push({
        blockId: row.blockId, sourcePath: row.sourcePath, subject: row.subject, chapter: row.chapter,
        pdfPage: row.pdfPage, disposition: "hold", topicId: null, sourceBlockSha256: row.sourceBlockSha256,
        sourcePdfSha256: row.sourcePdfSha256, pageTextSha256: row.pageTextSha256,
        rationale: holdReasons[row.blockId],
        eligibilityReason: holdReasons[row.blockId],
      });
      continue;
    }
    const topic = topics.get(mapping.topicId);
    if (!topic || topic.subject !== row.subject || topic.chapter !== row.chapter || topic.assessmentStatus !== "summative") {
      throw new Error(`Topic mapping does not exactly match a current summative source chapter: ${row.blockId} -> ${mapping.topicId}`);
    }
    const activeSubject = ACTIVE_SUBJECTS.find((subject) => subject.id === row.subject);
    const activeChapter = activeSubject?.chapters.find((chapter) => chapter.no === row.chapter);
    if (!activeChapter || activeChapter.name !== topic.title) throw new Error(`Syllabus index/corpus mismatch for ${mapping.topicId}`);
    // The runtime router is a chapter-level index. Include canonical chapter and
    // scope terms as well as the passage so this assertion exercises that index.
    const inferred = inferSyllabusScope(`${topic.title}. ${topic.scope}. ${row.text}`, row.subject as SubjectId);
    if (inferred.subject !== row.subject || !inferred.chapters?.includes(row.chapter)) {
      throw new Error(`The runtime syllabus index does not retain the mapped source chapter for ${row.blockId}`);
    }
    const contentSha256 = createHash("sha256").update(row.text, "utf8").digest("hex");
    if (contentSha256 !== row.sourceBlockSha256) throw new Error(`Reviewed text changed since visual QA: ${row.blockId}`);
    const chapterTitle = activeChapter.name;
    const officialUrl = row.subject === "maths"
      ? "https://ncert.nic.in/textbook.php?jemh1=0-14"
      : "https://ncert.nic.in/textbook.php?jesc1=0-13";
    const chunk: Chunk = {
      id: `ncert.${row.subject}.ch${String(row.chapter).padStart(2, "0")}.p${String(row.pdfPage).padStart(3, "0")}.theory_${row.blockId.split(".").at(-1)}`,
      text: row.text,
      meta: {
        kind: "ncert", subject: row.subject, chapter: row.chapter, page: row.pdfPage,
        sourceYear: "2026", syllabusVersion: "2026-27",
        syllabusTopicId: mapping.topicId, inActiveSyllabus: true, assessmentStatus: "summative",
        reviewStatus: "approved", officialUrl, language: "en", chunkType: "ncert_theory_fact",
        heading: `${chapterTitle} · PDF p. ${row.pdfPage}`,
        contentSha256, sourcePath: row.sourcePath,
        extractionVersion: "archive_pdf_dual_extractor_visual_qa_v1",
        sourceTransform: "verbatim_source_text_after_individual_visual_review",
        reviewBatch: "theory-source-topic-crosswalk-2026-27",
        reviewEvidence: "Data/reports/theory-block-individual-visual-review-20260929.jsonl; Data/reports/theory-topic-crosswalk-20260929.json",
        conceptTags: [topic.title],
        extractiveQuote: row.text,
      },
    };
    chunks.push(chunk);
    crosswalk.push({
      blockId: row.blockId, chunkId: chunk.id, sourcePath: row.sourcePath, subject: row.subject,
      chapter: row.chapter, pdfPage: row.pdfPage, disposition: "mapped_pending_ingest_validation",
      eligibleForReviewedPublish: false,
      topicId: topic.id, topicTitle: topic.title, sourceBlockSha256: row.sourceBlockSha256,
      sourcePdfSha256: row.sourcePdfSha256, pageTextSha256: row.pageTextSha256,
      rationale: mapping.rationale,
      eligibilityReason: "Pending ingest validation",
    });
  }

  if (chunks.length !== 8) throw new Error(`Expected 8 exact topic mappings, got ${chunks.length}`);
  const validationErrors = validateChunks(chunks);
  if (validationErrors.length) throw new Error(`Reviewed-publish validation failed: ${validationErrors.join("; ")}`);
  const eligibleRows = crosswalk.filter((row) => row.disposition === "mapped_pending_ingest_validation");
  for (const row of eligibleRows) {
    row.disposition = "eligible_for_reviewed_publish";
    row.eligibleForReviewedPublish = true;
    row.eligibilityReason = "Passes current validateChunks rules, exact active topic mapping, hash-bound individual visual QA, and source chapter match.";
  }
  for (const row of crosswalk.filter((row) => row.disposition === "hold")) {
    row.eligibleForReviewedPublish = false;
    row.eligibilityReason = row.rationale;
  }
  await writeFile(outputPath, `${JSON.stringify(chunks, null, 2)}\n`, "utf8");
  await writeFile(crosswalkPath, `${JSON.stringify({
    syllabusVersion: syllabus.version,
    sourceReview: "10 individually source-page reviewed blocks; two held for ambiguous active-topic mapping.",
    topicIdsAreChapterLevel: true,
    pageCitationConvention: "page and pdfPage refer to the source PDF page; printedPage is omitted when not printed on the source page.",
    activeSubjectsFrom: "CBSEAI-app/lib/data/syllabus.ts via syllabus-index.ts",
    syllabusScopesFrom: "CBSEAI-app/data/corpus/syllabus_2026_27.json",
    mappedCount: chunks.length,
    eligibleForReviewedPublishCount: eligibleRows.length,
    heldCount: crosswalk.filter((row) => row.disposition === "hold").length,
    publicationReadiness: "eligible rows pass current ingest validation and are included in the owner-only reviewed-publish bundle; this review did not publish them or query live vector presence.",
    validation: { validator: "CBSEAI-app/lib/rag/ingest.ts validateChunks", status: "passed", errors: validationErrors },
    chunksFile: "CBSEAI-app/data/corpus/theory-reviewed-2026-27.json",
    rows: crosswalk,
  }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ mapped: chunks.length, held: crosswalk.length - chunks.length, outputPath, crosswalkPath }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
