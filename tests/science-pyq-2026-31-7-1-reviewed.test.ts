import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { Chunk } from "../lib/types";
import { validateChunks } from "../lib/rag/ingest";
import { resolvePracticeAnswer } from "../lib/rag/practice-answer";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";
import { getVectorStore } from "../lib/rag/vectorstore";

const APPROVED_QUESTION_NUMBERS = [1, 3, 4, 5, 8, 9];
const REVIEW_BATCH = "science-2026-31-7-1-independent-qa-20261001";
const rows = REVIEWED_ADDENDUM.filter((chunk) => chunk.meta.reviewBatch === REVIEW_BATCH);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

test("imports exactly the six independently approved Science 31/7/1 QP/MS pairs", () => {
  const questions = rows.filter((chunk) => chunk.meta.chunkType === "question_block");
  const answers = rows.filter((chunk) => chunk.meta.chunkType === "marking_scheme");
  assert.equal(questions.length, 6);
  assert.equal(answers.length, 6);
  assert.deepEqual(questions.map((chunk) => Number((chunk.meta as unknown as Record<string, unknown>).questionNumber)).sort(), APPROVED_QUESTION_NUMBERS);
  assert.equal(rows.some((chunk) => /\.q(?:2|6|7)\./.test(chunk.id)), false);
  assert.deepEqual(validateChunks(rows), []);

  const byId = new Map(rows.map((chunk) => [chunk.id, chunk]));
  for (const question of questions) {
    const answer = byId.get(String(question.meta.pairedAnswerId));
    assert.ok(answer, `${question.id} has its official MS answer`);
    const qMeta = question.meta as unknown as Record<string, unknown>;
    const aMeta = answer.meta as unknown as Record<string, unknown>;
    assert.equal(answer.meta.pairedQuestionId, question.id);
    assert.equal(answer.meta.joinPrefix, question.meta.joinPrefix);
    assert.equal(question.meta.answerVisibility, "question_only");
    assert.equal(question.meta.practiceModeEligible, true);
    assert.equal(answer.meta.answerVisibility, "answer_followup_only");
    assert.equal(answer.meta.practiceModeEligible, false);
    assert.equal(question.meta.syllabusVersion, "2026-27");
    assert.equal(question.meta.inActiveSyllabus, true);
    assert.match(String(qMeta.questionSourceSha256), /^[a-f0-9]{64}$/);
    assert.match(String(aMeta.answerSourceSha256), /^[a-f0-9]{64}$/);
    assert.match(String(qMeta.questionSourcePageTextSha256), /^[a-f0-9]{64}$/);
    assert.match(String(aMeta.answerSourcePageTextSha256), /^[a-f0-9]{64}$/);
    assert.equal(qMeta.chunkTextSha256, sha256(question.text));
    assert.equal(aMeta.chunkTextSha256, sha256(answer.text));
    assert.equal(question.text.includes(answer.text), false);
    assert.equal(question.meta.optionIndex, undefined);
  }
});

test("keeps official Science keys out of practice retrieval and resolves them on answer follow-up", async () => {
  const question = rows.find((chunk) => chunk.id.endsWith("q1.question")) as Chunk;
  const answer = rows.find((chunk) => chunk.id === question.meta.pairedAnswerId) as Chunk;
  assert.ok(question && answer);
  const store = getVectorStore();
  await store.upsert([question, answer]);

  const practice = await store.findByIds([question.id, answer.id], { route: "competency" });
  assert.deepEqual(practice.map((chunk) => chunk.id), [question.id]);

  const followup = await resolvePracticeAnswer(question.id, store);
  assert.equal(followup?.question.id, question.id);
  assert.equal(followup?.answer.id, answer.id);
  assert.match(followup?.answer.text ?? "", /Pepsin/);
});
