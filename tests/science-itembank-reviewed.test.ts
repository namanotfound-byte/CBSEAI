import assert from "node:assert/strict";
import test from "node:test";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";

const batch = REVIEWED_ADDENDUM.filter((chunk) =>
  chunk.id.startsWith("itembank.science.class10."),
);

test("only independently approved Science Item Bank pairs are in the reviewed corpus", () => {
  assert.equal(batch.length, 6);
  assert.deepEqual(
    [...new Set(batch.map((chunk) => chunk.meta.itemIdentity))].sort(),
    ["Science10DP2", "Science10PB1", "Science10R5"],
  );

  const byId = new Map(batch.map((chunk) => [chunk.id, chunk]));
  for (const question of batch.filter((chunk) => chunk.meta.chunkType === "item_bank_question")) {
    const answer = byId.get(String(question.meta.pairedAnswerId));
    assert.ok(answer, `${question.id} has a paired official key`);
    const questionMeta = question.meta as unknown as Record<string, unknown>;
    const answerMeta = answer.meta as unknown as Record<string, unknown>;
    assert.equal(answerMeta.pairedQuestionId, question.id);
    assert.equal(question.meta.answerVisibility, "question_only");
    assert.equal(answer.meta.answerVisibility, "solution_only");
    assert.equal(question.meta.reviewStatus, "approved");
    assert.equal(question.meta.inActiveSyllabus, true);
    assert.equal(question.meta.practiceModeEligible, true);
    assert.equal(questionMeta.sourceSha256, "50358d394cb4aa499432e841904bb517dc21d55e10a9882a834bd72b81b91498");
    assert.match(String(question.meta.officialUrl), /^https:\/\/cbseacademic\.nic\.in\/cbe\/documents\/Item-Bank---Science-Class-10\.pdf$/);
    assert.ok(questionMeta.questionSourcePageTextSha256);
    assert.ok(answerMeta.answerSourcePageTextSha256);
    assert.ok(questionMeta.noveltyAssessment);
  }
});

test("item-bank prompts preserve their source wording without answer text", () => {
  const pb1 = batch.find((chunk) => chunk.meta.itemIdentity === "Science10PB1" && chunk.meta.chunkType === "item_bank_question");
  const pb1Answer = batch.find((chunk) => chunk.meta.itemIdentity === "Science10PB1" && chunk.meta.chunkType === "item_bank_marking_scheme");
  const r5 = batch.find((chunk) => chunk.meta.itemIdentity === "Science10R5" && chunk.meta.chunkType === "item_bank_question");
  const r5Answer = batch.find((chunk) => chunk.meta.itemIdentity === "Science10R5" && chunk.meta.chunkType === "item_bank_marking_scheme");
  const dp2 = batch.find((chunk) => chunk.meta.itemIdentity === "Science10DP2" && chunk.meta.chunkType === "item_bank_question");
  const dp2Answer = batch.find((chunk) => chunk.meta.itemIdentity === "Science10DP2" && chunk.meta.chunkType === "item_bank_marking_scheme");

  assert.equal(pb1?.text, "1 Methane gas is burnt in air.\nState whether the reaction is exothermic or endothermic.\n(1 mark)");
  assert.equal(r5?.text, "1 Decomposition is a type of chemical reaction.\n1 (a) Using water as an example, state and explain what happens in electrolytic\ndecomposition.\n(4 marks)\n1 (b) Suggest why pure water does not undergo electrolytic decomposition.\n(1 marks)");
  assert.equal(dp2?.text, "1 Examples of responses to hormones are listed.\n1. growth of facial hair\n2. increased blood pressure and pulse rate\n3. widened pupils\n1 (a) Which responses are caused by the hormone adrenaline?\nA. 1 and 2 only\nB. 1 and 3 only\nC. 2 and 3 only\nD. 1, 2 and 3\n(1 marks)");
  assert.ok(pb1Answer?.text.includes("It is exothermic reaction (1)"));
  assert.equal(pb1?.text.includes("It is exothermic reaction (1)"), false);
  assert.ok(r5Answer?.text.includes("Any four from:"));
  assert.ok(r5Answer?.text.includes("it is not ionic / no ions are present."));
  assert.equal(r5?.text.includes("Any four from:"), false);
  assert.ok(dp2Answer?.text.endsWith("\nC"));
});
