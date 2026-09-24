import { ACTIVE_SUBJECTS } from "../data/syllabus";
import type { SubjectId } from "../types";

const ALIASES: Partial<Record<SubjectId, Record<number, string[]>>> = {
  science: {
    1: ["chemical reaction", "equation", "oxidation", "reduction", "corrosion"],
    2: ["acid", "base", "salt", "ph", "indicator"],
    3: ["metals", "non-metals", "reactivity", "ionic compound"],
    5: ["life process", "nutrition", "photosynthesis", "respiration", "amoeba", "stomata", "leaf", "pores", "guard cells", "water loss"],
    6: ["control", "coordination", "neuron", "hormone", "reflex"],
    7: ["reproduction", "gamete", "fertilisation", "fertilization", "pollination"],
    8: ["heredity", "mendel", "mendelian", "inheritance", "sex determination"],
    9: ["light", "reflection", "refraction", "mirror", "lens", "ray diagram"],
    10: ["eye lens", "accommodation", "myopia", "hypermetropia", "presbyopia", "prism", "dispersion", "scattering"],
    11: ["electricity", "ohm", "resistance", "current", "voltage", "circuit"],
    12: ["magnetic", "electromagnet", "fleming", "solenoid", "domestic circuit"],
  },
  maths: {
    1: ["real number", "euclid", "hcf", "lcm"],
    2: ["polynomial", "zeroes"],
    3: ["linear equation", "two variables"],
    4: ["quadratic", "discriminant", "roots"],
    5: ["arithmetic progression", "a.p.", "common difference", "nth term"],
    6: ["similar triangles", "basic proportionality theorem"],
    7: ["coordinate geometry", "distance formula", "section formula"],
    8: ["trigonometry", "sine", "cosine", "tangent"],
    10: ["tangent to a circle", "tangent", "point of contact"],
    11: ["area", "circle", "sector", "segment"],
    12: ["surface area", "volume", "cone", "cylinder", "hemisphere"],
    13: ["mean", "median", "mode", "statistics"],
    14: ["probability"],
  },
};

export function inferSyllabusScope(query: string, preferredSubject?: SubjectId) {
  if (preferredSubject && preferredSubject !== "science" && preferredSubject !== "maths") {
    return { subject: preferredSubject, chapters: undefined, outOfSyllabus: true };
  }
  if (/(?:\bevolution\b|\bspeciation\b|\bfossils?\b|\belectric motors?\b|\belectric generators?\b|\belectromagnetic induction\b)/i.test(query) &&
      !/\bevolution of (?:a |the )?gas\b/i.test(query)) {
    return { subject: preferredSubject, chapters: undefined, outOfSyllabus: true };
  }
  if (/\b(?:sources of energy|management of natural resources|construction of a triangle|periodic classification|euclid(?:['’]s|s)? division (?:algorithm|lemma))\b/i.test(query)) {
    return { subject: preferredSubject, chapters: undefined, outOfSyllabus: true };
  }
  const queryTerms = new Set(tokens(query));
  const candidates = ACTIVE_SUBJECTS
    .filter((subject) => !preferredSubject || subject.id === preferredSubject)
    .flatMap((subject) =>
      subject.chapters.map((chapter) => {
        const aliases = ALIASES[subject.id]?.[chapter.no] ?? [];
        const vocabulary = [
          ...tokens(chapter.name),
          ...aliases.filter((alias) => tokens(alias).length === 1).flatMap(tokens),
        ];
        // A partial match on "eye lens" must not route a generic "lens"
        // question to Human Eye. Multiword aliases count only as phrases.
        const phraseScore = aliases.reduce((total, phrase) =>
          tokens(phrase).length > 1 && query.toLowerCase().includes(phrase.toLowerCase())
            ? total + 8 : total, 0);
        const score = phraseScore + vocabulary.reduce(
          (total, token) => total + (queryTerms.has(token) ? Math.max(1, token.length / 5) : 0),
          0,
        );
        return { subject: subject.id, chapter: chapter.no, score };
      }),
    )
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return { subject: preferredSubject, chapters: undefined, outOfSyllabus: false };
  const subject = candidates[0].subject;
  const bestScore = candidates[0].score;
  const chapters = candidates
    .filter((candidate) => candidate.subject === subject && candidate.score >= bestScore - 2)
    .slice(0, 3)
    .map((candidate) => candidate.chapter);
  return { subject, chapters, outOfSyllabus: false };
}

function tokens(text: string) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .map((token) => token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

const STOP_WORDS = new Set([
  "about", "and", "are", "chapter", "compare", "current", "deleted",
  "describe", "does", "explain", "for", "from", "give", "how", "into",
  "not", "old", "out", "should", "show", "the", "through", "using", "what",
  "when", "where", "which", "why", "with", "write",
]);
