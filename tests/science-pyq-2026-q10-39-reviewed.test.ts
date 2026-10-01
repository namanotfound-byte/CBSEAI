import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { validateChunks } from "../lib/rag/ingest";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";

const REVIEW_BATCH = "science-2026-31-7-1-q10-39-independent-qa-20261001";
const APPROVED_QUESTION_NUMBERS = [10, 13, 14, 15, 17, 20, 21, 22, 23, 24, 30, 31, 32, 36, 37];
const SOURCE_STAGE_HOLDS = [11, 12, 16, 25, 26, 27, 28, 29, 33, 34, 35, 38, 39];
const rows = REVIEWED_ADDENDUM.filter((chunk) => chunk.meta.reviewBatch === REVIEW_BATCH);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

test("imports only the 15 independently approved Science 31/7/1 Q10–Q39 pairs", () => {
  const questions = rows.filter((chunk) => chunk.meta.chunkType === "question_block");
  const answers = rows.filter((chunk) => chunk.meta.chunkType === "marking_scheme");
  assert.equal(rows.length, 30);
  assert.equal(questions.length, 15);
  assert.equal(answers.length, 15);
  assert.deepEqual(questions.map((chunk) => Number((chunk.meta as unknown as Record<string, unknown>).questionNumber)).sort((a, b) => a - b), APPROVED_QUESTION_NUMBERS);
  assert.deepEqual(validateChunks(rows), []);

  const byId = new Map(rows.map((chunk) => [chunk.id, chunk]));
  for (const question of questions) {
    const answer = byId.get(String(question.meta.pairedAnswerId));
    assert.ok(answer, `${question.id} has a paired official MS answer`);
    const qMeta = question.meta as unknown as Record<string, unknown>;
    const aMeta = answer.meta as unknown as Record<string, unknown>;
    const n = Number(qMeta.questionNumber);
    assert.equal(answer.meta.pairedQuestionId, question.id);
    assert.equal(answer.meta.joinPrefix, question.meta.joinPrefix);
    assert.equal(question.meta.answerVisibility, "question_only");
    assert.equal(question.meta.practiceModeEligible, true);
    assert.equal(answer.meta.answerVisibility, "answer_followup_only");
    assert.equal(answer.meta.practiceModeEligible, false);
    assert.equal(question.meta.syllabusVersion, "2026-27");
    assert.equal(question.meta.inActiveSyllabus, true);
    assert.equal(question.text.includes(answer.text), false);
    assert.equal(question.meta.optionIndex, undefined);

    assert.equal(qMeta.questionSourceSha256, "20e25c2eb5a2092e4076159b680063957af6879cd1944280e1ecb334f8c89a9c");
    assert.equal(aMeta.answerSourceSha256, "d3c7f64e80fa78c70ce110006e86a3aac6ffa28a3bcf2b390aa403392bf61706");
    assert.match(String(qMeta.questionSourcePageTextSha256), /^[a-f0-9]{64}$/);
    assert.match(String(aMeta.answerSourcePageTextSha256), /^[a-f0-9]{64}$/);
    assert.equal(qMeta.chunkTextSha256, sha256(question.text));
    assert.equal(aMeta.chunkTextSha256, sha256(answer.text));
    assert.equal(question.meta.joinKey, `2026-second-board|086|31/7/1|Q${n}|question`);
    assert.equal(answer.meta.joinKey, `2026-second-board|086|31/7/1|Q${n}|official_answer`);
    assert.equal((qMeta.joinProof as Record<string, unknown>).questionNumberAgrees, true);
    assert.equal((qMeta.joinProof as Record<string, unknown>).qpSourceSha256, qMeta.questionSourceSha256);
    assert.equal((aMeta.joinProof as Record<string, unknown>).msSourceSha256, aMeta.answerSourceSha256);
    assert.equal((qMeta.independentQa as { decision: string }).decision, "approved");
    assert.equal((qMeta.independentQa as { evidence: { visualReviewPages: string } }).evidence.visualReviewPages.length > 0, true);
    assert.equal((qMeta.syllabusMapping as { mappingStatus: string }).mappingStatus, "active_exact_verified");
    assert.equal(question.meta.officialUrl, "https://www.cbse.gov.in/cbsenew/question-paper.html");
    assert.equal(answer.meta.officialUrl, "https://www.cbse.gov.in/cbsenew/marking-scheme.html");
  }

  assert.equal(rows.some((chunk) => /\.q(?:18|19)\./.test(chunk.id)), false);
  for (const held of SOURCE_STAGE_HOLDS) {
    assert.equal(rows.some((chunk) => chunk.id.includes(`.q${held}.`)), false, `source-stage hold Q${held} stays excluded`);
  }
});
