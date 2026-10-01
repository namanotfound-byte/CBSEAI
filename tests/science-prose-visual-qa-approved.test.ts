import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import chunksJson from "../data/corpus/science-prose-visual-qa-approved-20261001.json";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";
import { validateChunks } from "../lib/rag/ingest";
import type { Chunk } from "../lib/types";

const chunks = chunksJson as Chunk[];

test("only the two independently approved NCERT prose passages enter the reviewed corpus", () => {
  assert.deepEqual(chunks.map((chunk) => chunk.id).sort(), [
    "ncert.science.ch10.p002.near_far_point_cataract",
    "ncert.science.ch11.p003.potential_difference",
  ]);
  assert.deepEqual(validateChunks(chunks), []);

  const expected = new Map([
    ["ncert.science.ch11.p003.potential_difference", { topic: "science.ch11", page: 3, printedPage: 173, candidate: "afb.36bf9e0ecc9320428abb", sourceSha: "640a680a24070d4add6d580d03d5377768ee5a6b4f89f9bfb66b350d457ab52f" }],
    ["ncert.science.ch10.p002.near_far_point_cataract", { topic: "science.ch10", page: 2, printedPage: 162, candidate: "afb.ac565ea5b736051664a5", sourceSha: "c8ed49fa55eedeb9ee5d5fbfa6d02061adb94075e94a32ca9bd16f4caf67c423" }],
  ]);
  const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  for (const chunk of chunks) {
    const item = expected.get(chunk.id)!;
    assert.equal(chunk.meta.subject, "science");
    assert.equal(chunk.meta.syllabusTopicId, item.topic);
    assert.equal(chunk.meta.page, item.page);
    assert.equal(chunk.meta.printedPage, item.printedPage);
    assert.equal(chunk.meta.sourcePath?.startsWith("NCERTs/Science_2026.zip!/"), true);
    assert.equal(chunk.meta.sourcePdfSha256, item.sourceSha);
    assert.equal(chunk.meta.candidateId, item.candidate);
    assert.equal(chunk.meta.sourceBlockSha256, createHash("sha256").update(chunk.text, "utf8").digest("hex"));
    assert.ok(chunk.meta.sourcePageTextSha256);
    assert.ok(chunk.meta.visualRenderSha256);
    assert.ok(chunk.meta.topicMappingRationale);
    assert.match(chunk.meta.reviewEvidence ?? "", /archive-fast-batch-text-prose-visual-qa-report\.md/);
    assert.equal(chunk.meta.reviewStatus, "approved");
    assert.equal(chunk.meta.assessmentStatus, "summative");
    assert.equal(REVIEWED_ADDENDUM.filter((row) => row.id === chunk.id).length, 1);
    assert.equal(REVIEWED_ADDENDUM.filter((row) => normalize(row.text) === normalize(chunk.text)).length, 1);
  }
});
