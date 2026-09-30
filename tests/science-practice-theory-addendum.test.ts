import assert from "node:assert/strict";
import test from "node:test";
import theoryReviewed from "../data/corpus/theory-reviewed-2026-27.json";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";
import { validateChunks } from "../lib/rag/ingest";
import type { Chunk } from "../lib/types";

const theory = theoryReviewed as Chunk[];

test("source-reviewed theory is included once in the deployable corpus", () => {
  assert.equal(theory.length, 8);
  assert.deepEqual(validateChunks(theory), []);
  for (const chunk of theory) {
    assert.equal(REVIEWED_ADDENDUM.filter((row) => row.id === chunk.id).length, 1);
    assert.equal(chunk.meta.reviewStatus, "approved");
    assert.equal(chunk.meta.inActiveSyllabus, true);
    assert.equal(chunk.meta.assessmentStatus, "summative");
    assert.ok(chunk.meta.extractiveQuote);
  }
});

test("the audited duplicate NCERT batch is not republished", () => {
  const duplicatedBatch = REVIEWED_ADDENDUM.filter((chunk) =>
    chunk.meta.reviewBatch === "science-ncert-exact-pair-review-20260929",
  );
  assert.equal(duplicatedBatch.length, 0);
});
