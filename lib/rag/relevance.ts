/** A conservative evidence gate for a sparse, chapter-level pilot corpus. */
export function sourceMatchesQuestion(question: string, passage: string): boolean {
  const anchors = terms(question);
  if (!anchors.size) return false;
  const evidence = terms(passage);
  const matches = [...anchors].filter((term) => evidence.has(term)).length;
  const required = anchors.size <= 2 ? anchors.size : Math.min(3, Math.ceil(anchors.size * 0.4));
  if (matches < required) return false;

  // A one-word definition request needs an actual definition. A paragraph
  // mentioning a specialised form of the word (for example magnetic force)
  // does not define the general concept the student asked about.
  const target = question.trim().match(/^(?:what\s+is|define)\s+(?:(?:a|an|the)\s+)?([\p{L}]{3,})\s*[?.!]?$/iu)?.[1];
  if (!target) return true;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[.!?]\\s+)(?:(?:a|an|the)\\s+)?${escaped}\\s+(?:is|are|means|refers\\s+to|takes\\s+place|involves|occurs|can\\s+be\\s+defined\\s+as)\\b|\\b(?:called|known\\s+as|forms)\\s+(?:(?:a|an|the)\\s+)?${escaped}\\b`, "iu").test(passage);
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
