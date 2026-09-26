import assert from "node:assert/strict";
import test from "node:test";
import { verifyAnswer } from "../lib/ai/verifier";
import { validateChunks } from "../lib/rag/ingest";
import { routeQuery } from "../lib/rag/router";
import { hasApprovedCompetencyQuestion, retrieve } from "../lib/rag/retriever";
import { sourceMatchesQuestion } from "../lib/rag/relevance";
import { getVectorStore } from "../lib/rag/vectorstore";
import { inferSyllabusScope } from "../lib/rag/syllabus-index";
import { getSyllabusRestriction } from "../lib/rag/syllabus-index";
import { conversationIntent, conversationReply } from "../lib/ai/conversation";
import { REVIEWED_ADDENDUM } from "../lib/rag/reviewed-addendum";
import type { Chunk, Source } from "../lib/types";

test("routes canonical query types", () => {
  assert.equal(routeQuery("draw a ray diagram"), "diagram");
  assert.equal(routeQuery("show the marking scheme"), "marking");
  assert.equal(routeQuery("solve this numerical"), "numerical");
  assert.equal(routeQuery("2025 PYQ question"), "pyq");
  assert.equal(routeQuery("give me a competency-based question"), "competency");
  assert.equal(routeQuery("explain photosynthesis"), "theory");
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
});

test("every deployable reviewed record is valid and uniquely identified", () => {
  assert.equal(REVIEWED_ADDENDUM.length, 45);
  assert.deepEqual(validateChunks(REVIEWED_ADDENDUM), []);
  assert.equal(new Set(REVIEWED_ADDENDUM.map((chunk) => chunk.id)).size, REVIEWED_ADDENDUM.length);
  const reviewedText = REVIEWED_ADDENDUM.map((chunk) => chunk.text.trim().toLowerCase());
  assert.equal(new Set(reviewedText).size, reviewedText.length);
  const sampleQuestions = REVIEWED_ADDENDUM.filter((chunk) => chunk.meta.kind === "sqp");
  assert.equal(sampleQuestions.length, 5);
  for (const question of sampleQuestions) {
    assert.ok(REVIEWED_ADDENDUM.some((chunk) =>
      chunk.meta.kind === "ms" && chunk.meta.joinPrefix === question.meta.joinPrefix,
    ));
  }
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
  assert.ok(sources.filter((source) => source.kind !== "syllabus").every((source) => ["cfpq", "sqp", "pyq", "ms"].includes(source.kind)));
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
