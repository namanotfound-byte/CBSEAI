import type { Chunk, SourceKind } from "../types";
import type { VectorStore } from "./vectorstore";

type PairedChunk = Pick<Chunk, "id" | "text"> & {
  meta: Chunk["meta"] & { pairedQuestionId?: string };
};

export function isPracticeQuestion(chunk: Pick<Chunk, "meta">): boolean {
  return (
    (chunk.meta.kind === "ncert_exercise" && chunk.meta.chunkType === "ncert_question") ||
    (chunk.meta.kind === "exemplar" && chunk.meta.chunkType === "exemplar_question") ||
    (chunk.meta.kind === "item_bank" && chunk.meta.chunkType === "item_bank_question" && chunk.meta.practiceModeEligible === true) ||
    (["sqp", "pyq", "cfpq", "apq"].includes(chunk.meta.kind) &&
      ["question_block", "question_part"].includes(chunk.meta.chunkType ?? ""))
  );
}

export function practiceAnswerKinds(kind: SourceKind): SourceKind[] {
  if (kind === "ncert_exercise") return ["ncert_exercise"];
  if (kind === "exemplar") return ["exemplar"];
  if (kind === "item_bank") return ["item_bank"];
  if (kind === "apq") return ["apq_answer"];
  return ["ms"];
}

/** Recognize short follow-ups that ask for the answer to the displayed item. */
export function isOfficialAnswerFollowup(query: string): boolean {
  return /^(?:show|give|tell)(?:\s+me)?\s+(?:(?:the\s+)?(?:official|marking[- ]scheme)\s+)?(?:the\s+)?(?:answer|solution)\b|^what(?:'s| is)\s+(?:(?:the\s+)?(?:official|marking[- ]scheme)\s+)?(?:the\s+)?answer\b/i.test(query.trim());
}

export function referencedPracticeQuestionId(
  messages: { role: string; content: { type: string; text?: string }[] }[],
): string | undefined {
  const previous = [...messages].reverse().find((message) =>
    message.role === "assistant" && message.content.some((part) =>
      part.type === "text" && /\[\[source:[^\]]+\]\]/.test(part.text ?? "")));
  const text = previous?.content.filter((part) => part.type === "text")
    .map((part) => part.text ?? "").join(" ") ?? "";
  return text.match(/\[\[source:([^\]]+)\]\]/)?.[1];
}

/** Fetch the referenced prompt and its reciprocal answer through the store API. */
export async function resolvePracticeAnswer(
  questionId: string,
  store: VectorStore,
): Promise<{ question: Chunk & { score: number }; answer: (Chunk & { score: number }) } | undefined> {
  const [question] = await store.findByIds([questionId], { route: "competency" });
  if (!question || !isPracticeQuestion(question) || !question.meta.joinPrefix) return undefined;
  const paired = await store.findByJoinPrefixes([question.meta.joinPrefix], {
    subject: question.meta.subject,
    syllabusTopicId: question.meta.syllabusTopicId,
    kinds: practiceAnswerKinds(question.meta.kind),
    route: "competency",
    topK: 24,
  });
  const answer = findPracticeAnswer(question, paired);
  return answer ? { question, answer } : undefined;
}

export function findPracticeAnswer<T extends PairedChunk>(
  question: PairedChunk,
  paired: T[],
): T | undefined {
  return paired.find((row) =>
    row.id !== question.id && (
      (question.meta.kind === "ncert_exercise" && row.meta.chunkType === "ncert_answer") ||
      (question.meta.kind === "exemplar" && row.meta.chunkType === "exemplar_answer") ||
      (question.meta.kind === "item_bank" && row.meta.kind === "item_bank" &&
        row.meta.chunkType === "item_bank_marking_scheme" && row.meta.pairedQuestionId === question.id) ||
      (question.meta.kind === "apq" && row.meta.kind === "apq_answer" &&
        row.meta.pairedQuestionId === question.id) ||
      (["sqp", "pyq", "cfpq"].includes(question.meta.kind) && row.meta.kind === "ms")
    ),
  );
}
