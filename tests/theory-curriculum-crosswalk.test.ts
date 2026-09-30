import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import theoryChunksJson from "../data/corpus/theory-reviewed-2026-27.json";
import syllabusJson from "../data/corpus/syllabus_2026_27.json";
import { ACTIVE_SUBJECTS } from "../lib/data/syllabus";
import { validateChunks } from "../lib/rag/ingest";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";
import { inferSyllabusScope } from "../lib/rag/syllabus-index";
import type { Chunk } from "../lib/types";

const chunks = theoryChunksJson as Chunk[];
const syllabus = syllabusJson as {
  version: string;
  topics: Array<{ id: string; subject: string; chapter: number; title: string; scope: string; assessmentStatus: string }>;
};

test("theory staging chunks map to exact active summative chapter topics", async () => {
  assert.equal(syllabus.version, "2026-27");
  assert.equal(chunks.length, 8);
  assert.deepEqual(validateChunks(chunks), []);

  const topics = new Map(syllabus.topics.map((topic) => [topic.id, topic]));
  const ids = new Set<string>();
  for (const chunk of chunks) {
    assert.ok(!ids.has(chunk.id), `duplicate id ${chunk.id}`);
    ids.add(chunk.id);
    const topic = topics.get(chunk.meta.syllabusTopicId);
    assert.ok(topic, `${chunk.id}: missing canonical syllabus topic`);
    assert.equal(topic.subject, chunk.meta.subject);
    assert.equal(topic.chapter, chunk.meta.chapter);
    assert.equal(topic.assessmentStatus, "summative");
    const activeSubject = ACTIVE_SUBJECTS.find((subject) => subject.id === chunk.meta.subject);
    const activeChapter = activeSubject?.chapters.find((chapter) => chapter.no === chunk.meta.chapter);
    assert.equal(activeChapter?.name, topic.title, `${chunk.id}: app chapter index disagrees with syllabus topic`);

    const indexResult = inferSyllabusScope(`${topic.title}. ${topic.scope}. ${chunk.text}`, chunk.meta.subject);
    assert.equal(indexResult.subject, chunk.meta.subject);
    assert.ok(indexResult.chapters?.includes(chunk.meta.chapter), `${chunk.id}: syllabus index lost the source chapter`);
    assert.equal(chunk.meta.inActiveSyllabus, true);
    assert.equal(chunk.meta.reviewStatus, "approved");
    assert.equal(chunk.meta.assessmentStatus, "summative");
    assert.equal(chunk.meta.contentSha256, createHash("sha256").update(chunk.text, "utf8").digest("hex"));
    assert.equal(chunk.meta.sourceTransform, "verbatim_source_text_after_individual_visual_review");
  }
});

test("ambiguous individually reviewed blocks remain outside the app chunks", async () => {
  const root = path.resolve(process.cwd(), "..");
  const crosswalk = JSON.parse(await readFile(path.join(root, "Data/reports/theory-topic-crosswalk-20260929.json"), "utf8"));
  assert.equal(crosswalk.mappedCount, 8);
  assert.equal(crosswalk.eligibleForReviewedPublishCount, 8);
  assert.equal(crosswalk.heldCount, 2);
  assert.equal(crosswalk.validation.status, "passed");
  assert.deepEqual(crosswalk.validation.errors, []);
  assert.match(crosswalk.publicationReadiness, /did not publish/);
  const outputById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const eligible = crosswalk.rows.filter((row: { eligibleForReviewedPublish: boolean }) => row.eligibleForReviewedPublish);
  const held = crosswalk.rows.filter((row: { disposition: string }) => row.disposition === "hold");
  assert.equal(eligible.length, 8);
  assert.equal(held.length, 2);
  assert.ok(eligible.every((row: { disposition: string }) => row.disposition === "eligible_for_reviewed_publish"));
  assert.ok(held.every((row: { chunkId?: string }) => !row.chunkId || !outputById.has(row.chunkId)));

  // The live bundle must contain each reviewed passage exactly once.
  assert.deepEqual(validateChunks(REVIEWED_ADDENDUM), []);
  const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const chunk of chunks) {
    const exactId = REVIEWED_ADDENDUM.filter((candidate) => candidate.id === chunk.id);
    const exactText = REVIEWED_ADDENDUM.filter((candidate) => normalize(candidate.text) === normalize(chunk.text));
    assert.equal(exactId.length, 1, `${chunk.id} must be present once`);
    assert.equal(exactText.length, 1, `${chunk.id} must be the only copy of its text`);
  }
});
