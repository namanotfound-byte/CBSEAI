import type { Source } from "../types";

/** Build the direct response for a retrieved, reviewed practice item. */
export function preparePracticeQuestion(sources: Source[]) {
  const question = sources.find((source) =>
    (["cfpq", "sqp", "pyq", "apq"].includes(source.kind) &&
      ["question_block", "question_part"].includes(source.chunkType ?? "")) ||
    (source.kind === "ncert_exercise" && source.chunkType === "ncert_question") ||
    (source.kind === "exemplar" && source.chunkType === "exemplar_question") ||
    (source.kind === "question_bank" && source.chunkType === "question_bank_question") ||
    (source.kind === "item_bank" && source.chunkType === "item_bank_question"),
  );
  if (!question) return undefined;

  // Only the prompt itself is visible. A paired official key may be present in
  // retrieval results for the follow-up path, but must not reveal the answer.
  const visibleSources = [
    ...sources.filter((source) => source.kind === "syllabus").slice(0, 1),
    question,
  ];
  const text = `Practice question:\n\n${question.content ?? question.snippet} [[source:${question.id}]]`;
  return { question, visibleSources, text };
}
