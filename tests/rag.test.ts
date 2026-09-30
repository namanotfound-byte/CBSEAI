import assert from "node:assert/strict";
import test from "node:test";
import { verifyAnswer } from "../lib/ai/verifier";
import { buildSystemPrompt, canShowMarkAllocation } from "../lib/ai/prompt";
import { validateChunks } from "../lib/rag/ingest";
import { routeQuery } from "../lib/rag/router";
import { hasApprovedCompetencyQuestion, practicePhraseMatch, retrieve } from "../lib/rag/retriever";
import { sourceMatchesQuestion } from "../lib/rag/relevance";
import { createQdrantStore, getVectorStore } from "../lib/rag/vectorstore";
import { inferSyllabusScope } from "../lib/rag/syllabus-index";
import { getSyllabusRestriction } from "../lib/rag/syllabus-index";
import { findAlreadyPublishedReviewedChunks } from "../lib/rag/reviewed-publication";
import { findPracticeAnswer, isOfficialAnswerFollowup, isPracticeQuestion, practiceAnswerKinds, referencedPracticeQuestionId, resolvePracticeAnswer } from "../lib/rag/practice-answer";
import { preparePracticeQuestion } from "../lib/rag/practice-question";
import { conversationIntent, conversationReply } from "../lib/ai/conversation";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";
import type { Chunk, Source } from "../lib/types";

test("unrelated marking rows cannot create a mark split for a theory answer", () => {
  const nearbyScheme = { id: "ms.nearby", kind: "ms", chunkType: "marking_scheme", joinPrefix: "paper|q1", label: "Nearby key", snippet: "1 mark" } as Source;
  assert.equal(canShowMarkAllocation([nearbyScheme]), false);
  const prompt = buildSystemPrompt({ grade: 10, mode: "answer" }, [nearbyScheme]);
  assert.equal(prompt.includes("MARKS: <total"), false);
  const matchedQuestion = { id: "sqp.q1", kind: "sqp", chunkType: "question_block", joinPrefix: "paper|q1", label: "Question", snippet: "Question" } as Source;
  assert.equal(canShowMarkAllocation([matchedQuestion, nearbyScheme]), true);
  assert.equal(buildSystemPrompt({ grade: 10, mode: "answer" }, [matchedQuestion, nearbyScheme]).includes("MARKS: <total"), false);
  assert.equal(buildSystemPrompt({ grade: 10, mode: "answer", marks: 1 }, [matchedQuestion, nearbyScheme]).includes("MARKS: <total"), true);
});

test("routes canonical query types", () => {
  assert.equal(routeQuery("draw a ray diagram"), "diagram");
  assert.equal(routeQuery("show the marking scheme"), "marking");
  assert.equal(routeQuery("solve this numerical"), "numerical");
  assert.equal(routeQuery("2025 PYQ question"), "pyq");
  assert.equal(routeQuery("give me a competency-based question"), "competency");
  assert.equal(routeQuery("Give me an NCERT exercise question on prime factorisation"), "competency");
  assert.equal(routeQuery("Give me an NCERT Science exercise question about corrective lens power."), "competency");
  assert.equal(routeQuery("Give me an NCERT Exemplar Science question about solder"), "competency");
  assert.equal(routeQuery("Give me a Science sample-paper question about soap in hard water"), "competency");
  assert.equal(routeQuery("Give me a CBSE Maths item-bank question about quadratic roots"), "competency");
  assert.equal(routeQuery("Give me a CBSE Science question-bank question about photosynthesis"), "competency");
  assert.equal(routeQuery("Solve this sample-paper question about soap"), "pyq");
  assert.equal(routeQuery("explain photosynthesis"), "theory");
});

test("direct practice rendering preserves source text, hides the answer, and cites the question", () => {
  const prompt = "Which process is described?\na. photolysis\nd. sphotolysis";
  const question: Source = {
    id: "cfpq-science-q1", kind: "cfpq", chunkType: "question_block",
    label: "CFPQ · Science · Ch 5 · p. 12", snippet: prompt, content: prompt,
  };
  const answer: Source = {
    id: "ms-science-q1", kind: "ms", chunkType: "marking_scheme",
    label: "Marking scheme", snippet: "Correct answer: d", content: "Correct answer: d",
  };
  const result = preparePracticeQuestion([
    { id: "scope", kind: "syllabus", chunkType: "syllabus_scope", label: "Scope", snippet: "In syllabus" },
    question,
    answer,
  ]);
  assert.ok(result);
  assert.equal(result.text, `Practice question:\n\n${prompt} [[source:${question.id}]]`);
  assert.ok(result.visibleSources.some((source) => source.id === question.id));
  assert.equal(result.visibleSources.some((source) => source.id === answer.id), false);
  assert.match(result.text, new RegExp(`\\[\\[source:${question.id}\\]\\]$`));
  assert.equal(preparePracticeQuestion([{
    id: "item-bank-q1", kind: "item_bank", chunkType: "item_bank_question",
    label: "Item bank", snippet: "Exact prompt", content: "Exact prompt",
  }])?.question.id, "item-bank-q1");
  assert.equal(preparePracticeQuestion([{
    id: "question-bank-q1", kind: "question_bank", chunkType: "question_bank_question",
    label: "Question bank", snippet: "Exact prompt", content: "Exact prompt",
  }])?.question.id, "question-bank-q1");
});

test("an explicitly named exercise phrase outranks nearby questions", () => {
  const query = "Give me the NCERT Science exercise question: Why should chemical equations be balanced?";
  assert.equal(practicePhraseMatch(query,
    "4. What is a balanced chemical equation? Why should chemical equations be balanced?"), true);
  assert.equal(practicePhraseMatch(query,
    "5. Translate the following statements into chemical equations and then balance them."), false);
});

test("an explicit NCERT exercise roman subpart retrieves only that subpart", async () => {
  const first = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "ncert.maths.ch04.ex4_1.q2i");
  const second = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "ncert.maths.ch04.ex4_1.q2ii");
  assert.ok(first && second);
  await getVectorStore().upsert([
    {
      id: "test-maths-exercise-4-1-scope",
      text: "Quadratic Equations: quadratic equations and word problems.",
      meta: {
        kind: "syllabus", subject: "maths", chapter: 4, sourceYear: "2026",
        syllabusVersion: "2026-27", syllabusTopicId: "maths.ch04",
        chunkType: "syllabus_scope", inActiveSyllabus: true,
        reviewStatus: "approved", assessmentStatus: "summative",
      },
    },
    first,
    second,
  ] as Chunk[]);

  const query = "Give me NCERT Maths Exercise 4.1 Question 2(i) without the answer";
  assert.equal(routeQuery(query), "competency");
  const sources = await retrieve(query, { subject: "maths", chapter: 4, route: "competency" });
  assert.ok(sources.some((source) => source.id === first.id));
  assert.equal(sources.some((source) => source.id === second.id), false);
});

test("APQ follow-up resolves Q1 to its exact official answer block", () => {
  const question = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "apq.science.2021.term1.q01");
  const answer = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "apq.science.2021.term1.q01.answer");
  assert.ok(question && answer);
  assert.equal(isPracticeQuestion(question), true);
  assert.deepEqual(practiceAnswerKinds(question.meta.kind), ["apq_answer"]);
  assert.equal(findPracticeAnswer(question, [answer])?.id, answer.id);
  assert.match(answer.text, /A — above the arrow/);
});

test("official-answer phrasing resolves a persisted APQ citation through Qdrant point and join lookups", async () => {
  const question = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "apq.science.2021.term1.q01");
  const answer = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "apq.science.2021.term1.q01.answer");
  assert.ok(question && answer);
  assert.equal(isOfficialAnswerFollowup("Show the official answer."), true);
  assert.equal(isOfficialAnswerFollowup("Give me the marking scheme answer"), true);
  assert.equal(isOfficialAnswerFollowup("Explain why this is correct"), false);

  // The browser persists the exact assistant text (including its source marker)
  // and sends it back with the follow-up. Exercise that history shape here.
  const questionId = referencedPracticeQuestionId([
    { role: "user", content: [{ type: "text", text: "Give me an APQ Science question" }] },
    { role: "assistant", content: [{ type: "text", text: `Practice question: ${question.text} [[source:${question.id}]]` }] },
  ]);
  assert.equal(questionId, question.id);

  const originalFetch = globalThis.fetch;
  const calls: { path: string; body?: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ path: url.pathname, body });
    if (url.pathname === "/collections/test-apq") return Response.json({ result: { status: "green" } });
    if (url.pathname.endsWith("/points") && init?.method === "POST") {
      assert.equal((body?.ids as string[]).length, 1);
      assert.match((body?.ids as string[])[0], /^[0-9a-f-]{36}$/i);
      return Response.json({ result: [{ id: (body?.ids as string[])[0], payload: { sourceId: question.id, text: question.text, meta: question.meta } }] });
    }
    if (url.pathname.endsWith("/points/scroll")) {
      const must = ((body?.filter as { must: { key: string; match: Record<string, unknown> }[] }).must);
      assert.ok(must.some((clause) => clause.key === "meta.joinPrefix" &&
        JSON.stringify(clause.match).includes(question.meta.joinPrefix!)));
      assert.ok(must.some((clause) => clause.key === "meta.kind" &&
        JSON.stringify(clause.match).includes("apq_answer")));
      return Response.json({ result: { points: [{ id: "answer-point", payload: { sourceId: answer.id, text: answer.text, meta: answer.meta } }] } });
    }
    throw new Error(`Unexpected Qdrant request: ${url.pathname}`);
  }) as typeof fetch;
  try {
    const store = createQdrantStore({
      qdrantUrl: "http://qdrant.test", qdrantCollection: "test-apq", qdrantApiKey: "",
      qdrantAutoCreate: false, qdrantVectorSize: 1024, syllabusVersion: "2026-27", hybridSearch: false,
    });
    assert.equal(isOfficialAnswerFollowup("Show the official answer."), true);
    const pair = await resolvePracticeAnswer(questionId!, store);
    assert.equal(pair?.question.id, question.id);
    assert.equal(pair?.answer.id, answer.id);
    assert.match(pair?.answer.text ?? "", /A — above the arrow/);
    assert.equal(calls.filter((call) => call.path.endsWith("/points")).length, 1);
    assert.equal(calls.filter((call) => call.path.endsWith("/points/scroll")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("named item-bank Qdrant filters use the existing indexed join-prefix field", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { path: string; body?: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ path: url.pathname, body });
    if (url.pathname === "/collections/test-item-bank") return Response.json({ result: { status: "green" } });
    if (url.pathname.endsWith("/points/query")) return Response.json({ result: { points: [] } });
    throw new Error(`Unexpected Qdrant request: ${url.pathname}`);
  }) as typeof fetch;
  try {
    const store = createQdrantStore({
      qdrantUrl: "http://qdrant.test", qdrantCollection: "test-item-bank", qdrantApiKey: "",
      qdrantAutoCreate: false, qdrantVectorSize: 1024, syllabusVersion: "2026-27", hybridSearch: false,
    });
    await store.search("Give me item bank Maths10SS8", {
      subject: "maths", route: "competency", kinds: ["item_bank"], itemIdentitySearch: "maths10ss8",
    });
    const queryCall = calls.find((call) => call.path.endsWith("/points/query"));
    assert.ok(queryCall);
    const prefetch = queryCall.body?.prefetch as { filter: { must: { key: string; match: Record<string, unknown> }[] } }[];
    const clauses = prefetch[0].filter.must;
    assert.ok(clauses.some((clause) => clause.key === "meta.joinPrefix" &&
      JSON.stringify(clause.match).includes("2026|CBSE-CBE-ItemBank|Maths10|Maths10SS8") &&
      JSON.stringify(clause.match).includes("Maths10SS8|Q1")));
    assert.equal(clauses.some((clause) => clause.key === "meta.itemIdentitySearch"), false);
    assert.equal(calls.some((call) => call.path.endsWith("/index")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("handles ordinary conversation without confusing it with academic retrieval", () => {
  assert.equal(conversationIntent("Hi!"), "greeting");
  assert.match(conversationReply("greeting", "Hi"), /Maths or Science/);
  assert.equal(conversationIntent("What can you help me with?"), "capabilities");
  assert.equal(conversationIntent("How should I prepare for my board exams?"), "study_advice");
  assert.equal(conversationIntent("What is a lens?"), null);
  assert.equal(conversationIntent("Explain photosynthesis"), null);
});

test("distinguishes formative curriculum from missing evidence", () => {
  assert.equal(getSyllabusRestriction("What is evolution?", "science"), "formative");
  assert.equal(getSyllabusRestriction("What is a lens?", "science"), null);
  assert.equal(getSyllabusRestriction("What is a prism?", "science"), null);
  assert.equal(getSyllabusRestriction("Euclid's division algorithm", "maths"), "excluded");
});

test("infers a narrow syllabus scope", () => {
  assert.deepEqual(inferSyllabusScope("state Ohm's law"), {
    subject: "science",
    chapters: [11],
    outOfSyllabus: false,
  });
});

test("keeps formative-only Science and unlaunched subjects out of board answers", () => {
  assert.equal(inferSyllabusScope("explain electric motor", "science").outOfSyllabus, true);
  assert.equal(inferSyllabusScope("explain evolution", "science").outOfSyllabus, true);
  assert.equal(inferSyllabusScope("explain photosynthesis", "social").outOfSyllabus, true);
  assert.equal(inferSyllabusScope("evolution of a gas during a reaction", "science").outOfSyllabus, false);
  assert.equal(inferSyllabusScope("Euclid's division algorithm", "maths").outOfSyllabus, true);
  assert.equal(inferSyllabusScope("periodic classification", "science").outOfSyllabus, true);
});

test("routes distinctive curriculum terms to the right chapter", () => {
  assert.deepEqual(inferSyllabusScope("tangent to a circle", "maths").chapters, [10]);
  assert.deepEqual(inferSyllabusScope("section formula", "maths").chapters, [7]);
  assert.deepEqual(inferSyllabusScope("What is the common difference of the A.P. 2, 5, 8, 11, ...?").chapters, [5]);
  assert.deepEqual(inferSyllabusScope("Mendelian inheritance", "science").chapters, [8]);
  assert.deepEqual(inferSyllabusScope("What is the ability of the eye lens to adjust its focal length called?").chapters, [10]);
  assert.deepEqual(inferSyllabusScope("What is a lens?").chapters, [9]);
  assert.deepEqual(inferSyllabusScope("soap and detergent in hard water", "science").chapters, [4]);
});

test("rejects chapter-neighbour passages that do not answer the question", () => {
  assert.equal(sourceMatchesQuestion(
    "What is a lens?",
    "Concave mirrors are commonly used in torches and vehicle headlights to get parallel beams of light.",
  ), false);
  assert.equal(sourceMatchesQuestion(
    "What is a lens?",
    "A lens is a transparent optical medium bounded by two surfaces.",
  ), true);
  assert.equal(sourceMatchesQuestion(
    "What is the common difference of the A.P. 2, 5, 8, 11?",
    "In an arithmetic progression, the fixed number obtained by subtracting one term from the succeeding term is called the common difference.",
  ), true);
  assert.equal(sourceMatchesQuestion(
    "What is force?",
    "A current-carrying conductor experiences a force when placed in a magnetic field.",
  ), false);
  assert.equal(sourceMatchesQuestion(
    "What is force?",
    "Force is a push or pull that can change the motion of an object.",
  ), true);
  assert.equal(sourceMatchesQuestion(
    "What is photosynthesis?",
    "Photosynthesis takes place in three events: absorption of light energy, splitting of water, and reduction of carbon dioxide to carbohydrates.",
  ), true);
});

test("strips invented marks when no marking scheme is present", async () => {
  const sources: Source[] = [{
    id: "ncert-1",
    kind: "ncert",
    chunkType: "ncert_section",
    label: "NCERT",
    snippet: "Supported fact.",
    content: "Supported fact.",
  }];
  const result = await verifyAnswer(
    "Supported fact. [[source:ncert-1]] [1 Mark]\nMARKS: 1 | 1 — fact",
    sources,
    "marking",
  );
  assert.equal(result.marksOk, false);
  assert.doesNotMatch(result.text, /mark/i);
  assert.ok(result.notice);
});

test("rejects citation ids outside context", async () => {
  const result = await verifyAnswer(
    "Claim. [[source:missing]]",
    [],
    "theory",
  );
  assert.equal(result.citationOk, false);
});

test("accepts canonical ingestion metadata", () => {
  const chunks: Chunk[] = [{
    id: "ncert-sci-1",
    text: "Balanced equations conserve atoms.",
    meta: {
      kind: "ncert",
      subject: "science",
      chapter: 1,
      sourceYear: "2025",
      syllabusVersion: "2026-27",
      syllabusTopicId: "science.chemical-reactions.balancing-equations",
      chunkType: "ncert_section",
      officialUrl: "https://ncert.nic.in/textbook.php",
      inActiveSyllabus: true,
      reviewStatus: "approved",
      assessmentStatus: "summative",
      contentSha256: "a".repeat(64),
      language: "en",
    },
  }];
  assert.deepEqual(validateChunks(chunks), []);
  const officialHistorical = structuredClone(chunks);
  officialHistorical[0].meta.officialUrl = "https://www.cbse.gov.in/cbsenew/question-paper/2025/X/041_Mathematics_Standard.zip";
  assert.deepEqual(validateChunks(officialHistorical), []);
  officialHistorical[0].meta.officialUrl = "https://cbse.gov.in.attacker.example/paper.pdf";
  assert.ok(validateChunks(officialHistorical).some((error) => error.includes("officialUrl")));
});

test("every deployable reviewed record is valid and uniquely identified", () => {
  assert.ok(REVIEWED_ADDENDUM.length >= 107);
  assert.deepEqual(validateChunks(REVIEWED_ADDENDUM), []);
  assert.equal(new Set(REVIEWED_ADDENDUM.map((chunk) => chunk.id)).size, REVIEWED_ADDENDUM.length);
  const reviewedText = REVIEWED_ADDENDUM.filter((chunk) =>
    !["ncert_answer", "exemplar_answer"].includes(chunk.meta.chunkType ?? "") && chunk.meta.kind !== "ms",
  ).map((chunk) => chunk.text.trim().toLowerCase());
  assert.equal(new Set(reviewedText).size, reviewedText.length);
  const sampleQuestions = REVIEWED_ADDENDUM.filter((chunk) => chunk.meta.kind === "sqp");
  assert.ok(sampleQuestions.length >= 21);
  for (const question of sampleQuestions) {
    assert.ok(REVIEWED_ADDENDUM.some((chunk) =>
      chunk.meta.kind === "ms" && chunk.meta.joinPrefix === question.meta.joinPrefix,
    ));
    assert.equal(/marking scheme:/i.test(question.text), false, `${question.id} includes its answer`);
    if (/^Assertion \(A\):/.test(question.text)) {
      for (const option of ["(A)", "(B)", "(C)", "(D)"]) {
        assert.ok(question.text.includes(option), `${question.id} is missing ${option}`);
      }
    }
  }
  for (const [id, chapter] of [
    ["sqp.maths.standard.2026-27.q17", 9],
    ["sqp.maths.standard.2026-27.q20", 2],
  ] as const) {
    const question = REVIEWED_ADDENDUM.find((chunk) => chunk.id === id);
    assert.equal(question?.meta.chapter, chapter);
    assert.equal(question?.meta.syllabusTopicId, `maths.ch${String(chapter).padStart(2, "0")}`);
  }
});

test("imports only the 18 newly approved pairs with original source kinds and statuses", async () => {
  const rows = REVIEWED_ADDENDUM.filter((chunk) =>
    chunk.meta.reviewBatch === "maths-item-bank-visual-review-batch6-20260928" ||
    chunk.meta.reviewBatch === "science-exemplar-visual-review-batch19" ||
    chunk.meta.reviewBatch === "science-cbse-question-bank-visual-review-batch1",
  );
  assert.equal(rows.length, 36);
  assert.equal(new Set(rows.map((row) => row.id)).size, 36);
  assert.deepEqual(validateChunks(rows), []);
  assert.equal(rows.filter((row) => row.meta.kind === "item_bank").length, 2);
  assert.equal(rows.filter((row) => row.meta.kind === "exemplar").length, 10);
  assert.equal(rows.filter((row) => row.meta.kind === "exemplar_answer").length, 10);
  assert.equal(rows.filter((row) => row.meta.kind === "question_bank").length, 7);
  assert.equal(rows.filter((row) => row.meta.kind === "question_bank_answer").length, 7);
  assert.equal(rows.filter((row) => row.meta.assessmentStatus === "practice").length, 14);
  assert.equal(rows.filter((row) => row.meta.assessmentStatus === "formative").length, 2);
  for (const question of rows.filter((row) => ["item_bank", "question_bank"].includes(row.meta.kind) && row.meta.answerVisibility === "question_only")) {
    const answer = rows.find((row) => row.id === question.meta.pairedAnswerId);
    assert.ok(answer, `${question.id} answer exists`);
    assert.equal(answer.meta.pairedQuestionId, question.id);
    assert.equal(answer.meta.joinPrefix, question.meta.joinPrefix);
  }

  const question = rows.find((row) => row.id === "questionbank.science.q1_3.visual_question");
  const answer = rows.find((row) => row.id === "questionbank.science.q1_3.visual_answer");
  assert.ok(question && answer);
  assert.equal(isPracticeQuestion(question), true);
  await getVectorStore().upsert([question, answer]);
  assert.equal((await getVectorStore().findByIds([question.id, answer.id], {})).length, 0);
  assert.equal((await getVectorStore().findByIds([question.id, answer.id], { route: "competency" })).length, 2);
  assert.equal((await resolvePracticeAnswer(question.id, getVectorStore()))?.answer.id, answer.id);
  const retrieved = await retrieve("Give me a CBSE Science question-bank question about photosynthesis", {
    subject: "science", chapter: 5, route: "competency",
  });
  assert.equal(retrieved[0]?.kind, "syllabus");
  assert.equal(retrieved[0]?.chapter, question.meta.chapter);
  assert.ok(retrieved.some((source) => source.id === question.id));
  assert.ok(retrieved.some((source) => source.id === answer.id));
  assert.deepEqual(await retrieve("Give me a CBSE Science question-bank question about photosynthesis", {
    subject: "science", chapter: 99, route: "competency",
  }), []);
});

test("rejects content without an explicit syllabus mapping", () => {
  const chunk = {
    id: "legacy",
    text: "Old content.",
    meta: {
      kind: "ncert",
      subject: "science",
      chapter: 1,
      sourceYear: "2019",
      syllabusVersion: "2026-27",
      chunkType: "ncert_section",
      officialUrl: "https://ncert.nic.in/textbook.php",
      inActiveSyllabus: true,
      contentSha256: "a".repeat(64),
      language: "en",
    },
  } as unknown as Chunk;
  assert.ok(validateChunks([chunk]).some((error) => error.includes("syllabusTopicId")));
});

test("prevents staged and formative chunks from being ingested", () => {
  const chunk: Chunk = {
    id: "staged",
    text: "An unreviewed paragraph.",
    meta: {
      kind: "ncert", subject: "science", chapter: 8, sourceYear: "undated",
      syllabusVersion: "2026-27", syllabusTopicId: "science.ch08",
      chunkType: "ncert_section", officialUrl: "https://ncert.nic.in/textbook.php",
      inActiveSyllabus: true, reviewStatus: "staging", assessmentStatus: "formative",
      contentSha256: "a".repeat(64), language: "en",
    },
  };
  const errors = validateChunks([chunk]);
  assert.ok(errors.some((error) => error.includes("reviewStatus")));
  assert.ok(errors.some((error) => error.includes("summative")));
});

test("approved formative item-bank pairs are valid only as practice material", async () => {
  const question = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "itembank.maths.class10.polynomials.maths10ss8.question");
  const answer = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "itembank.maths.class10.polynomials.maths10ss8.answer");
  assert.ok(question && answer);
  assert.deepEqual(validateChunks([question, answer]), []);
  assert.equal(hasApprovedCompetencyQuestion([{
    id: question.id, kind: "item_bank", chunkType: "item_bank_question",
    label: "CBSE item bank", snippet: question.text,
  }]), true);

  const malformed = { ...question, id: "bad-formative-item", meta: { ...question.meta, pairedAnswerId: undefined } } as Chunk;
  assert.ok(validateChunks([malformed]).some((error) => error.includes("item-bank chunks")));

  const scope: Chunk = {
    id: "test-maths-item-bank-scope", text: "Polynomials: zeros and coefficients of a quadratic polynomial.",
    meta: {
      kind: "syllabus", subject: "maths", chapter: 2, sourceYear: "2026", syllabusVersion: "2026-27",
      syllabusTopicId: "maths.ch02", chunkType: "syllabus_scope", inActiveSyllabus: true,
      reviewStatus: "approved", assessmentStatus: "summative",
    },
  };
  await getVectorStore().upsert([scope, question, answer] as Chunk[]);
  assert.equal((await getVectorStore().findByIds([question.id, answer.id], {})).length, 0);
  assert.equal((await findAlreadyPublishedReviewedChunks(getVectorStore(), [question.id, answer.id])).length, 2);
  const officialPair = await resolvePracticeAnswer(question.id, getVectorStore());
  assert.equal(officialPair?.answer.id, answer.id);

  const practice = await retrieve("Give me CBSE Maths item bank question Maths10SS8 without the answer.", {
    subject: "maths", chapter: 3, route: "competency",
  });
  assert.ok(practice.some((source) => source.id === question.id));
  assert.ok(practice.some((source) => source.id === answer.id));
  assert.ok(practice.some((source) => source.label.startsWith("CBSE item bank")));
  assert.ok(practice.some((source) => source.kind === "syllabus" && source.syllabusTopicId === question.meta.syllabusTopicId));

  const theory = await retrieve("What is the sum and product of polynomial zeroes?", {
    subject: "maths", chapter: 2, route: "theory",
  });
  assert.equal(theory.some((source) => source.id === question.id || source.id === answer.id), false);
});

test("retrieval resolves the active syllabus before returning evidence", async () => {
  const sources = await retrieve("explain Ohm's law", {
    subject: "science",
    chapter: 11,
  });
  assert.equal(sources[0]?.kind, "syllabus");
  assert.equal(sources[0]?.syllabusTopicId, "science.electricity.ohms-law");
  assert.ok(sources.slice(1).every((source) => source.syllabusTopicId === sources[0].syllabusTopicId));
});

test("a nearby syllabus mention cannot become evidence for a general definition", async () => {
  const meta = {
    subject: "science" as const, chapter: 12, sourceYear: "2026",
    syllabusVersion: "2026-27", syllabusTopicId: "science.ch12",
    officialUrl: "https://ncert.nic.in/textbook.php", inActiveSyllabus: true,
    reviewStatus: "approved" as const, assessmentStatus: "summative" as const,
  };
  await getVectorStore().upsert([
    { id: "test-magnetism-scope", text: "Magnetic effects: force on a current-carrying conductor.", meta: { ...meta, kind: "syllabus", chunkType: "syllabus_scope" } },
    { id: "test-magnetism-force", text: "A current-carrying conductor experiences a force in a magnetic field.", meta: { ...meta, kind: "ncert", chunkType: "ncert_section" } },
  ]);
  assert.deepEqual(await retrieve("What is force?", { subject: "science", chapter: 12 }), []);
});

test("competency retrieval only accepts an approved mapped question block", async () => {
  const sources = await retrieve("give me a competency question on quadratic word problems", {
    subject: "maths",
    chapter: 4,
    route: "competency",
  });
  assert.equal(hasApprovedCompetencyQuestion(sources), true);
  assert.ok(sources.filter((source) => source.kind !== "syllabus").every((source) => ["cfpq", "sqp", "pyq", "ms", "apq_answer", "item_bank"].includes(source.kind)));
});

test("a reviewed sample-paper question brings its exact marking row", async () => {
  await getVectorStore().upsert([
    {
      id: "test-science-environment-scope",
      text: "Our Environment: food chains and trophic levels, including primary and secondary consumers.",
      meta: {
        kind: "syllabus", subject: "science", chapter: 13, sourceYear: "2026",
        syllabusVersion: "2026-27", syllabusTopicId: "science.ch13",
        chunkType: "syllabus_scope", inActiveSyllabus: true,
        reviewStatus: "approved", assessmentStatus: "summative",
      },
    },
    ...REVIEWED_ADDENDUM.filter((chunk) =>
      chunk.id === "sqp.science.2026-27.q07" || chunk.id === "ms.science.2026-27.q07",
    ),
  ] as Chunk[]);
  const sources = await retrieve("Give me a competency question about a fish eating insect larvae in a pond", {
    subject: "science", chapter: 13, route: "competency",
  });
  assert.ok(sources.some((source) => source.id === "sqp.science.2026-27.q07"));
  assert.ok(sources.some((source) => source.id === "ms.science.2026-27.q07"));
  assert.equal(sources.filter((source) => source.kind === "ms").length, 1);
});

test("a soap practice request retrieves the correct Chapter 4 paper question", async () => {
  const question = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "sqp.science.2026-27.q19");
  const answer = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "ms.science.2026-27.q19");
  assert.ok(question && answer);
  assert.equal(question.meta.syllabusTopicId, "science.ch04");
  assert.equal(answer.meta.syllabusTopicId, "science.ch04");
  await getVectorStore().upsert([
    {
      id: "test-science-soap-scope",
      text: "Carbon and Its Compounds: soaps and detergents, including their behaviour in hard water.",
      meta: {
        kind: "syllabus", subject: "science", chapter: 4, sourceYear: "2026",
        syllabusVersion: "2026-27", syllabusTopicId: "science.ch04",
        chunkType: "syllabus_scope", inActiveSyllabus: true,
        reviewStatus: "approved", assessmentStatus: "summative",
      },
    },
    question,
    answer,
  ] as Chunk[]);
  const query = "Give me a Science sample-paper question about soap in hard water";
  assert.equal(routeQuery(query), "competency");
  const sources = await retrieve(query, { subject: "science", route: "competency" });
  assert.ok(sources.some((source) => source.id === question.id));
  assert.ok(sources.some((source) => source.id === answer.id));
});

test("Maths Standard practice keeps the paper track and exact answer join", async () => {
  await getVectorStore().upsert([
    {
      id: "test-maths-real-numbers-scope",
      text: "Real Numbers: highest common factor and applications of prime factorisation.",
      meta: {
        kind: "syllabus", subject: "maths", chapter: 1, sourceYear: "2026",
        syllabusVersion: "2026-27", syllabusTopicId: "maths.ch01",
        chunkType: "syllabus_scope", inActiveSyllabus: true,
        reviewStatus: "approved", assessmentStatus: "summative",
      },
    },
    ...REVIEWED_ADDENDUM.filter((chunk) =>
      chunk.id === "sqp.maths.standard.2026-27.q01" ||
      chunk.id === "ms.maths.standard.2026-27.q01",
    ),
  ] as Chunk[]);
  const sources = await retrieve("Give me a practice question about numbers dividing 134 and 188", {
    subject: "maths", chapter: 1, route: "competency",
  });
  assert.ok(sources.some((source) => source.id === "sqp.maths.standard.2026-27.q01"));
  assert.ok(sources.some((source) => source.id === "ms.maths.standard.2026-27.q01"));
  assert.ok(sources.some((source) => source.label.includes("Maths Standard")));
});

test("NCERT exercise practice keeps its answer separate from theory retrieval", async () => {
  const question = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "ncert.maths.ch01.ex1_1.q1_i");
  const answer = REVIEWED_ADDENDUM.find((chunk) => chunk.id === "ncert.maths.ch01.ex1_1.q1_i.answer");
  assert.ok(question && answer);
  assert.equal(question.meta.kind, "ncert_exercise");
  assert.equal(answer.meta.chunkType, "ncert_answer");
  await getVectorStore().upsert([question, answer]);
  const sources = await retrieve("Give me an NCERT exercise question about expressing 140 as prime factors", {
    subject: "maths", chapter: 1, route: "competency",
  });
  assert.ok(sources.some((source) => source.id === question.id));
  assert.ok(sources.some((source) => source.id === answer.id));
  assert.equal(hasApprovedCompetencyQuestion(sources), true);
  const theory = await retrieve("What is prime factorisation?", {
    subject: "maths", chapter: 1, route: "theory",
  });
  assert.ok(theory.every((source) => source.kind !== "ncert_exercise"));
});

test("excluded Euclid division material cannot enter the live corpus", () => {
  const source = REVIEWED_ADDENDUM.find((chunk) => chunk.meta.subject === "maths" && chunk.meta.chapter === 1);
  assert.ok(source);
  const row = { ...source, id: "test-excluded-euclid", text: "Euclid's division algorithm finds the HCF." };
  assert.ok(validateChunks([row]).some((error) => error.includes("outside the current board-answer scope")));
});

test("page citations require numeric PDF page numbers", () => {
  const source = REVIEWED_ADDENDUM.find((chunk) => chunk.meta.page);
  assert.ok(source);
  const row = { ...source, id: "test-string-page", meta: { ...source.meta, page: "18" as unknown as number } };
  assert.ok(validateChunks([row]).some((error) => error.includes("meta.page must be a positive integer")));
});
