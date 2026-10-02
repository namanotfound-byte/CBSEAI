import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { validateChunks } from "../lib/rag/ingest";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";
import { resolvePracticeAnswer } from "../lib/rag/practice-answer";
import { getVectorStore } from "../lib/rag/vectorstore";

const BATCH = "maths-ncert-six-independent-qa-20261002";
const APPROVED = [
  "ncert.maths.ch06.ex6_3.q15",
  "ncert.maths.ch07.ex7_1.q10",
  "ncert.maths.ch10.ex10_2.q6",
  "ncert.maths.ch10.ex10_2.q7",
  "ncert.maths.ch12.ex12_1.q8",
  "ncert.maths.ch12.ex12_2.q6",
];
const rows = REVIEWED_ADDENDUM.filter((chunk) => chunk.meta.reviewBatch === BATCH);
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

test("imports exactly six independently approved NCERT Maths question-answer pairs", () => {
  const questions = rows.filter((chunk) => chunk.meta.chunkType === "ncert_question");
  const answers = rows.filter((chunk) => chunk.meta.chunkType === "ncert_answer");
  assert.equal(rows.length, 12);
  assert.equal(questions.length, 6);
  assert.equal(answers.length, 6);
  assert.deepEqual(questions.map((chunk) => chunk.id).sort(), [...APPROVED].sort());
  assert.deepEqual(validateChunks(rows), []);

  const byId = new Map(rows.map((chunk) => [chunk.id, chunk]));
  const topics: Record<string, number> = {
    "ncert.maths.ch06.ex6_3.q15": 6,
    "ncert.maths.ch07.ex7_1.q10": 7,
    "ncert.maths.ch10.ex10_2.q6": 10,
    "ncert.maths.ch10.ex10_2.q7": 10,
    "ncert.maths.ch12.ex12_1.q8": 12,
    "ncert.maths.ch12.ex12_2.q6": 12,
  };
  const memberHashes: Record<number, string> = {
    6: "028a1243ccd005e952fca0f9c498be86cd526b74deb0bc6cd5147e15eef12f58",
    7: "ca7a4c2071221ddad13eca8c3bf2deba6be2f21b2a47b07f10443131bad53f04",
    10: "aef0ee7e58d4ec4dc043e943843da7981b4b782483b7b8b8bcdd08657bad1ae3",
    12: "5108400be07a99d6df322df607b90d51ba841f8a060276d05f9e75accc2b8be9",
  };
  const pageHashes: Record<string, { question: string; answer: string }> = {
    "ncert.maths.ch06.ex6_3.q15": { question: "30aa77cf0134adb12f06b41beeac07e50e1eb53aee83182dcb105ce60a35befb", answer: "8e41935209af4d69716ab57fc269756ce6c464da5d10a9fad74a8b373bf28e5e" },
    "ncert.maths.ch07.ex7_1.q10": { question: "45ec0fc35d496e2df77a71392c88ab2a6e365039cf3eb4fc0a5281f50c64a17d", answer: "d9cd746b5777ac3a6c933568788d3a7578c0c7f7edd7f471b2f83a1f31aca865" },
    "ncert.maths.ch10.ex10_2.q6": { question: "345f14c793a47e1a56589ee881341fa155431aa2c98da933e986369a1c402e2a", answer: "0631ecf4dd36b702dbdc3aa5e1d379b42beb4adf33664197234d0959c9971757" },
    "ncert.maths.ch10.ex10_2.q7": { question: "345f14c793a47e1a56589ee881341fa155431aa2c98da933e986369a1c402e2a", answer: "0631ecf4dd36b702dbdc3aa5e1d379b42beb4adf33664197234d0959c9971757" },
    "ncert.maths.ch12.ex12_1.q8": { question: "580a06268ff76e1f4b43867b2fb25d766dfb8c36d30b6477dc9c18f4d5232462", answer: "32986ca41289522ae3d053952f3cd4110f42f723f127e5641c83000d61982e09" },
    "ncert.maths.ch12.ex12_2.q6": { question: "baaeef269e9ef2d384d1d36f0c49fde759cd269b64338e0705626b656a289bcd", answer: "32986ca41289522ae3d053952f3cd4110f42f723f127e5641c83000d61982e09" },
  };

  for (const question of questions) {
    const qm = question.meta as unknown as Record<string, unknown>;
    const answer = byId.get(String(qm.pairedAnswerId));
    assert.ok(answer, `${question.id} has its official NCERT answer`);
    const am = answer.meta as unknown as Record<string, unknown>;
    assert.equal(answer.meta.pairedQuestionId, question.id);
    assert.equal(answer.meta.joinPrefix, question.meta.joinPrefix);
    assert.equal(question.meta.kind, "ncert_exercise");
    assert.equal(answer.meta.kind, "ncert_exercise");
    assert.equal(answer.meta.chunkType, "ncert_answer");
    assert.equal(question.meta.syllabusVersion, "2026-27");
    assert.equal(question.meta.inActiveSyllabus, true);
    assert.equal(question.meta.assessmentStatus, "summative");
    assert.equal(question.meta.reviewStatus, "approved");
    assert.equal(question.meta.chapter, topics[question.id]);
    assert.equal(question.meta.syllabusTopicId, `maths.ch${topics[question.id].toString().padStart(2, "0")}`);
    assert.equal(question.meta.answerVisibility, "question_only");
    assert.equal(question.meta.practiceModeEligible, true);
    assert.equal(answer.meta.answerVisibility, "solution_only");
    assert.equal(answer.meta.practiceModeEligible, false);
    assert.equal(questions.find((q) => q.id === question.id)?.text.includes(answer.text), false);
    assert.equal(REVIEWED_ADDENDUM.filter((row) => row.id === question.id).length, 1);
    assert.equal(REVIEWED_ADDENDUM.filter((row) => row.id === answer.id).length, 1);

    const chapter = topics[question.id];
    assert.equal(qm.contentSha256, memberHashes[chapter]);
    assert.equal(am.contentSha256, "02dadcf156d050b2dfa97de75be35ca4b5649f88d8f096c7bf45941337e81968");
    assert.deepEqual(qm.sourcePageTextSha256s, [pageHashes[question.id].question]);
    assert.deepEqual(am.sourcePageTextSha256s, [pageHashes[question.id].answer]);
    assert.match(String(qm.sourcePageTextSha256), /^[a-f0-9]{64}$/);
    assert.match(String(am.sourcePageTextSha256), /^[a-f0-9]{64}$/);
    assert.equal((qm.sourcePageTextSha256s as string[]).length, (qm.supportingPages as number[]).length);
    assert.equal((am.sourcePageTextSha256s as string[]).length, (am.supportingPages as number[]).length);
    assert.equal(qm.chunkTextSha256, sha256(question.text));
    assert.equal(am.chunkTextSha256, sha256(answer.text));
    assert.equal(qm.joinKey, `${question.meta.joinPrefix}|question`);
    assert.equal(am.joinKey, `${question.meta.joinPrefix}|answer`);
    assert.match(question.text, /^Exercise \d+\.\d+, Question \d+:/);
  }
});

test("resolves each official NCERT solution as a separate follow-up record", async () => {
  const questions = rows.filter((chunk) => chunk.meta.chunkType === "ncert_question");
  const store = getVectorStore();
  await store.upsert(rows);
  for (const question of questions) {
    const resolved = await resolvePracticeAnswer(question.id, store);
    assert.ok(resolved, `${question.id} resolves through its exercise join`);
    assert.equal(resolved.question.id, question.id);
    assert.equal(resolved.answer.meta.chunkType, "ncert_answer");
    assert.equal(resolved.answer.meta.pairedQuestionId, question.id);
    assert.notEqual(resolved.question.text, resolved.answer.text);
  }
});
