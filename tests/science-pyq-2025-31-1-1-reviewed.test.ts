import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { validateChunks } from "../lib/rag/ingest";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";
import { resolvePracticeAnswer } from "../lib/rag/practice-answer";
import { getVectorStore } from "../lib/rag/vectorstore";

const REVIEW_BATCH = "science-pyq-2025-31-1-1-reviewed-qa-batch2";
const QUESTION_NUMBERS = [14, 16, 20, 26];
const rows = REVIEWED_ADDENDUM.filter((chunk) => chunk.meta.reviewBatch === REVIEW_BATCH);
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const sha256File = (path: string) => createHash("sha256").update(readFileSync(resolve(process.cwd(), "..", path))).digest("hex");

test("integrates exactly the four independently approved 31/1/1 question and MS pairs", () => {
  const questions = rows.filter((chunk) => chunk.meta.chunkType === "question_block");
  const answers = rows.filter((chunk) => chunk.meta.chunkType === "marking_scheme");
  assert.equal(rows.length, 8);
  assert.equal(questions.length, 4);
  assert.equal(answers.length, 4);
  assert.deepEqual(questions.map((chunk) => Number((chunk.meta as unknown as Record<string, unknown>).questionNumber)).sort((a, b) => a - b), QUESTION_NUMBERS);
  assert.deepEqual(validateChunks(rows), []);

  const topicByQuestion: Record<number, { chapter: number; topicId: string }> = {
    14: { chapter: 10, topicId: "science.ch10" },
    16: { chapter: 13, topicId: "science.ch13" },
    20: { chapter: 13, topicId: "science.ch13" },
    26: { chapter: 13, topicId: "science.ch13" },
  };
  const byId = new Map(rows.map((chunk) => [chunk.id, chunk]));
  for (const question of questions) {
    const qmeta = question.meta as unknown as Record<string, unknown>;
    const n = Number(qmeta.questionNumber);
    const answer = byId.get(String(question.meta.pairedAnswerId));
    assert.ok(answer, `Q${n} has its official MS answer`);
    const ameta = answer.meta as unknown as Record<string, unknown>;
    assert.equal(answer.meta.pairedQuestionId, question.id);
    assert.equal(answer.meta.joinPrefix, question.meta.joinPrefix);
    assert.equal(qmeta.paperCode, "31/1/1");
    assert.equal(question.meta.sourceYear, "2025");
    assert.equal(question.meta.syllabusVersion, "2026-27");
    assert.equal(question.meta.assessmentStatus, "summative");
    assert.equal(question.meta.reviewStatus, "approved");
    assert.equal(question.meta.inActiveSyllabus, true);
    assert.equal(question.meta.chapter, topicByQuestion[n].chapter);
    assert.equal(question.meta.syllabusTopicId, topicByQuestion[n].topicId);
    assert.equal(question.meta.answerVisibility, "question_only");
    assert.equal(question.meta.practiceModeEligible, true);
    assert.equal(answer.meta.answerVisibility, "answer_followup_only");
    assert.equal(answer.meta.practiceModeEligible, false);
    assert.equal(qmeta.questionSourceSha256, "d753039479520adcf8ca690b7a52208a444fc7160667e12452dc867bec025801");
    assert.equal(ameta.answerSourceSha256, "6aaf56c0f86194a6e9e1933817c72e8473883a9f0735aa6f8be960abc0f5f47a");
    assert.match(String(qmeta.questionSourcePageTextSha256), /^[a-f0-9]{64}$/);
    assert.match(String(qmeta.questionSourcePageImageSha256), /^[a-f0-9]{64}$/);
    assert.match(String(ameta.answerSourcePageTextSha256), /^[a-f0-9]{64}$/);
    assert.match(String(ameta.answerSourcePageImageSha256), /^[a-f0-9]{64}$/);
    const qPageHashes = qmeta.questionSourcePageTextSha256s as string[];
    const qImageHashes = qmeta.questionSourcePageImageSha256s as string[];
    const qImagePaths = qmeta.questionSourcePageImagePaths as string[];
    const aPageHashes = ameta.answerSourcePageTextSha256s as string[];
    const aImageHashes = ameta.answerSourcePageImageSha256s as string[];
    const aImagePaths = ameta.answerSourcePageImagePaths as string[];
    assert.equal(qPageHashes.length, (qmeta.questionSourcePages as number[]).length);
    assert.equal(qImageHashes.length, qPageHashes.length);
    assert.equal(qImagePaths.length, qImageHashes.length);
    assert.equal(aPageHashes.length, (ameta.answerSourcePages as number[]).length);
    assert.equal(aImageHashes.length, aPageHashes.length);
    assert.equal(aImagePaths.length, aImageHashes.length);
    for (const [index, digest] of qImageHashes.entries()) {
      assert.match(digest, /^[a-f0-9]{64}$/);
      assert.equal(sha256File(qImagePaths[index]), digest, `${question.id} QP page image hash`);
    }
    for (const [index, digest] of aImageHashes.entries()) {
      assert.match(digest, /^[a-f0-9]{64}$/);
      assert.equal(sha256File(aImagePaths[index]), digest, `${answer.id} MS page image hash`);
    }
    assert.equal(qmeta.chunkTextSha256, sha256(question.text));
    assert.equal(ameta.chunkTextSha256, sha256(answer.text));
    assert.equal(qmeta.joinKey, `${question.meta.joinPrefix}|question`);
    assert.equal(ameta.joinKey, `${question.meta.joinPrefix}|answer`);
  }

  const q20 = questions.find((chunk) => (chunk.meta as unknown as Record<string, unknown>).questionNumber === 20)!;
  const q20Meta = q20.meta as unknown as Record<string, unknown>;
  assert.deepEqual(q20Meta.questionSourcePages, [11, 13]);
  assert.equal(q20.meta.page, 13);
  const q20Hashes = q20Meta.questionSourcePageTextSha256s as string[];
  assert.equal(q20Hashes.length, 2);
  const q20QaHashes = (q20Meta.independentQa as { evidence: { qaLedgerPageTextSha256: Record<string, string> } }).evidence.qaLedgerPageTextSha256;
  assert.equal(q20QaHashes["qp:11"], "432ab06f859124a0f7049b4728433c27fd8ac29d596b5f9e1b543a8175fbd9dd");
  assert.equal(q20QaHashes["qp:13"], "36bf3559816686c2c3848b5f672ad60293832e3a9f257166f1113269d53a07ee");
  assert.match(q20.text, /\(A\) Both Assertion \(A\) and Reason \(R\) are true/);
  assert.match(q20.text, /20\. Assertion \(A\)/);
  assert.doesNotMatch(q20.text, /SECTION B|Questions no\. 21/);
});

test("keeps these official answers out of ordinary practice retrieval until follow-up", async () => {
  const questions = rows.filter((chunk) => chunk.meta.chunkType === "question_block");
  const answers = rows.filter((chunk) => chunk.meta.chunkType === "marking_scheme");
  const store = getVectorStore();
  await store.upsert(rows);

  const visible = await store.findByIds(rows.map((chunk) => chunk.id), { route: "competency" });
  assert.deepEqual(visible.map((chunk) => chunk.id).sort(), questions.map((chunk) => chunk.id).sort());
  for (const question of questions) {
    const result = await resolvePracticeAnswer(question.id, store);
    assert.ok(result, `${question.id} resolves its answer after follow-up`);
    assert.equal(result.answer.id, question.meta.pairedAnswerId);
    assert.ok(answers.some((answer) => answer.id === result.answer.id));
  }
});
