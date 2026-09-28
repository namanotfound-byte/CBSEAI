import type { Chunk, SourceKind } from "../types";

type PairedChunk = Pick<Chunk, "id" | "text"> & {
  meta: Chunk["meta"] & { pairedQuestionId?: string };
};

export function isPracticeQuestion(chunk: Pick<Chunk, "meta">): boolean {
  return (
    (chunk.meta.kind === "ncert_exercise" && chunk.meta.chunkType === "ncert_question") ||
    (chunk.meta.kind === "exemplar" && chunk.meta.chunkType === "exemplar_question") ||
    (["sqp", "pyq", "cfpq", "apq"].includes(chunk.meta.kind) &&
      ["question_block", "question_part"].includes(chunk.meta.chunkType ?? ""))
  );
}

export function practiceAnswerKinds(kind: SourceKind): SourceKind[] {
  if (kind === "ncert_exercise") return ["ncert_exercise"];
  if (kind === "exemplar") return ["exemplar"];
  if (kind === "apq") return ["apq_answer"];
  return ["ms"];
}

export function findPracticeAnswer(
  question: PairedChunk,
  paired: PairedChunk[],
): PairedChunk | undefined {
  return paired.find((row) =>
    row.id !== question.id && (
      (question.meta.kind === "ncert_exercise" && row.meta.chunkType === "ncert_answer") ||
      (question.meta.kind === "exemplar" && row.meta.chunkType === "exemplar_answer") ||
      (question.meta.kind === "apq" && row.meta.kind === "apq_answer" &&
        row.meta.pairedQuestionId === question.id) ||
      (["sqp", "pyq", "cfpq"].includes(question.meta.kind) && row.meta.kind === "ms")
    ),
  );
}
