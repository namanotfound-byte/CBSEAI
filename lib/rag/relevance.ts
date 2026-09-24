/** A conservative evidence gate for a sparse, chapter-level pilot corpus. */
export function sourceMatchesQuestion(question: string, passage: string): boolean {
  const anchors = terms(question);
  if (!anchors.size) return false;
  const evidence = terms(passage);
  const matches = [...anchors].filter((term) => evidence.has(term)).length;
  const required = anchors.size <= 2 ? anchors.size : Math.min(3, Math.ceil(anchors.size * 0.4));
  return matches >= required;
}

function terms(text: string): Set<string> {
  const expanded = text.replace(/\bA\s*\.\s*P\s*\./gi, "arithmetic progression");
  return new Set((expanded.toLowerCase().match(/[\p{L}]{3,}/gu) ?? [])
    .map((term) => term.length > 4 && term.endsWith("s") ? term.slice(0, -1) : term)
    .filter((term) => !GENERIC.has(term)));
}

const GENERIC = new Set([
  "about", "answer", "board", "called", "chapter", "class", "define", "describe",
  "does", "each", "explain", "find", "from", "give", "have", "image", "into",
  "maths", "ncert", "please", "question", "science", "show", "solve", "that",
  "their", "them", "there", "these", "this", "those", "using", "what", "when",
  "where", "which", "with", "write", "your",
]);
