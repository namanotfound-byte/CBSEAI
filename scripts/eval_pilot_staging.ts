/** Read-only retrieval smoke test against the versioned pilot collection. */

async function main() {
  if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY ||
      !process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
    throw new Error("Protected Qdrant and Cloudflare credentials are required");
  }
  process.env.QDRANT_COLLECTION = "cbse_10_pilot_20260924_v2";
  process.env.QDRANT_AUTO_CREATE = "false";
  const { retrieve } = await import("../lib/rag/retriever");
  const cases = [
    { query: "How does acid rain affect aquatic life?", subject: "science" as const,
      chapter: 2, expected: "ncert.science.ch02.p010.para16" },
    { query: "How do villi help absorb digested food?", subject: "science" as const,
      chapter: 5, expected: "ncert.science.ch05.p008.para04" },
    { query: "What are the biotic and abiotic components of an ecosystem?", subject: "science" as const,
      chapter: 13, expected: "ncert.science.ch13.p001.para08" },
    { query: "State the fundamental theorem of arithmetic", subject: "maths" as const,
      chapter: 1, expected: "ncert.maths.ch01.p003.para02" },
    { query: "What is the common difference in an arithmetic progression?", subject: "maths" as const,
      chapter: 5, expected: "ncert.maths.ch05.p003.para13" },
  ];
  for (const test of cases) {
    const sources = await retrieve(test.query, { subject: test.subject, chapter: test.chapter, topK: 4 });
    const ids = sources.map((source) => source.id);
    const passed = ids.includes(`${test.subject}.ch${String(test.chapter).padStart(2, "0")}`) && ids.includes(test.expected);
    console.log(JSON.stringify({ subject: test.subject, chapter: test.chapter, passed, retrievedIds: ids }));
    if (!passed) throw new Error(`Pilot retrieval failed for ${test.subject} chapter ${test.chapter}`);
  }
  for (const test of [
    { query: "Explain Mendel's law of inheritance", subject: "science" as const, chapter: 8 },
    { query: "What is the area of a sector of a circle?", subject: "maths" as const, chapter: 11 },
  ]) {
    const sources = await retrieve(test.query, { subject: test.subject, chapter: test.chapter, topK: 4 });
    const passed = sources.every((source) => source.kind === "syllabus");
    console.log(JSON.stringify({ subject: test.subject, chapter: test.chapter,
                                 missingEvidenceFallback: passed, retrievedIds: sources.map((source) => source.id) }));
    if (!passed) throw new Error("Missing-evidence fallback returned content unexpectedly");
  }

  if (!process.argv.includes("--generation")) return;
  const { getChatProvider } = await import("../lib/ai/provider");
  const { buildSystemPrompt, buildContextBlock } = await import("../lib/ai/prompt");
  const { verifyAnswer } = await import("../lib/ai/verifier");
  const question = cases[0].query;
  const sources = await retrieve(question, { subject: "science", chapter: 2, topK: 4 });
  const context = { grade: 10 as const, subject: "science" as const, chapter: 2,
                    mode: "answer" as const, marks: 2 as const };
  let answer = "";
  for await (const token of getChatProvider().stream({
    system: buildSystemPrompt(context, sources, "theory"),
    messages: [
      { role: "user", content: [{ type: "text", text: buildContextBlock(sources) }] },
      { role: "user", content: [{ type: "text", text: question }] },
    ],
  })) answer += token;
  const checked = await verifyAnswer(answer, sources, "theory");
  console.log(JSON.stringify({ model: "free-route", answerChars: answer.length,
    citationOk: checked.citationOk, marksOk: checked.marksOk, nliConfigured: !checked.notice,
    citedIds: [...answer.matchAll(/\[\[source:([^\]]+)\]\]/g)].map((match) => match[1]),
    answerPreview: checked.text.slice(0, 700) }));
  if (!checked.citationOk || !checked.marksOk || !answer.trim()) {
    throw new Error("Pilot model answer did not satisfy the source citation contract");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Pilot evaluation failed");
  process.exitCode = 1;
});
