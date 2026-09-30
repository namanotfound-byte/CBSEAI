import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { Chunk } from "../lib/types";
import { validateChunks } from "../lib/rag/ingest";
import { resolvePracticeAnswer } from "../lib/rag/practice-answer";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";
import { getVectorStore } from "../lib/rag/vectorstore";

const APPROVED_IDS = [
  "cfpq.mathsv2.ch1.q02", "cfpq.mathsv2.ch1.q08", "cfpq.mathsv2.ch2.q03",
  "cfpq.mathsv2.ch3.q02", "cfpq.mathsv2.ch3.q04", "cfpq.mathsv2.ch3.q07",
  "cfpq.mathsv2.ch3.q08", "cfpq.mathsv2.ch4.q01", "cfpq.mathsv2.ch4.q02",
  "cfpq.mathsv2.ch4.q04", "cfpq.mathsv2.ch4.q05", "cfpq.mathsv2.ch4.q08",
  "cfpq.mathsv2.ch7.q09",
];

const rows = REVIEWED_ADDENDUM.filter((chunk) =>
  chunk.meta.reviewBatch === "cfpq-mathsv2-independent-qa-20260930",
);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

test("imports exactly the 13 independently approved CFPQ MathsV2 option-index pairs", () => {
  const questions = rows.filter((chunk) => chunk.meta.chunkType === "question_block");
  const answers = rows.filter((chunk) => chunk.meta.chunkType === "cfpq_answer_option_index");
  assert.equal(questions.length, 13);
  assert.equal(answers.length, 13);
  assert.deepEqual(questions.map((chunk) => chunk.id.replace(/\.question$/, "")).sort(), [...APPROVED_IDS].sort());
  assert.deepEqual(validateChunks(rows), []);

  const byId = new Map(rows.map((chunk) => [chunk.id, chunk]));
  for (const question of questions) {
    const answer = byId.get(String(question.meta.pairedAnswerId));
    assert.ok(answer, `${question.id} has its official key chunk`);
    const qMeta = question.meta as unknown as Record<string, unknown>;
    const aMeta = answer.meta as unknown as Record<string, unknown>;
    assert.equal(answer.meta.pairedQuestionId, question.id);
    assert.equal(answer.meta.joinPrefix, question.meta.joinPrefix);
    assert.equal(question.meta.answerVisibility, "question_only");
    assert.equal(answer.meta.answerVisibility, "answer_followup_only");
    assert.equal(question.meta.assessmentStatus, "formative");
    assert.equal(question.meta.inActiveSyllabus, true);
    assert.equal(question.meta.syllabusVersion, "2026-27");
    assert.equal(question.meta.syllabusTopicId, `maths.ch${String(question.meta.chapter).padStart(2, "0")}`);
    assert.equal(qMeta.sourceSha256, "bf3c9267cd63e5e43f24003989f7fdb5d4e05dbf05aff267d3722390e5a4ef6d");
    assert.equal(aMeta.sourceSha256, qMeta.sourceSha256);
    assert.match(String(qMeta.questionSourcePageTextSha256), /^[a-f0-9]{64}$/);
    assert.match(String(aMeta.answerSourcePageTextSha256), /^[a-f0-9]{64}$/);
    assert.equal(question.meta.contentSha256, qMeta.sourceSha256);
    assert.equal(answer.meta.contentSha256, aMeta.sourceSha256);
    assert.equal(qMeta.chunkTextSha256, sha256(question.text));
    assert.equal(aMeta.chunkTextSha256, sha256(answer.text));
    assert.equal(qMeta.optionIndex, undefined);
    assert.equal(aMeta.answerType, "official_option_index");
    assert.match(answer.text, /^Official answer option index: [1-4]\.$/);
    assert.equal(question.text.includes(answer.text), false);
  }
});

test("keeps the CFPQ answer key out of question-only retrieval and resolves it only for answer follow-up", async () => {
  const question = rows.find((chunk) => chunk.id === "cfpq.mathsv2.ch1.q02.question") as Chunk;
  const answer = rows.find((chunk) => chunk.id === "cfpq.mathsv2.ch1.q02.official_answer_option_index") as Chunk;
  assert.ok(question && answer);
  const store = getVectorStore();
  await store.upsert([question, answer]);

  const questionOnly = await store.findByIds([question.id, answer.id], { route: "competency" });
  assert.deepEqual(questionOnly.map((chunk) => chunk.id), [question.id]);

  const followup = await resolvePracticeAnswer(question.id, store);
  assert.equal(followup?.question.id, question.id);
  assert.equal(followup?.answer.id, answer.id);
  assert.equal(followup?.answer.text, "Official answer option index: 3.");
});
