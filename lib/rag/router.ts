import type { QueryRoute } from "../types";

const PYQ_RE = /\b(pyq|past paper|previous year|board question|sample paper|sqp)\b/i;
const COMPETENCY_RE = /\b(competency(?:-based)?|cbq|case stud(?:y|ies)|assertion(?:\s+and)?\s+reason)\b/i;
const MARKING_RE = /\b(marking scheme|marks?|mark allocation|how many marks|examiner|answer key)\b/i;
const DIAGRAM_RE = /\b(diagram|figure|labelled|label|draw|ray diagram|graph)\b/i;
const NUMERICAL_RE = /\b(calculate|find|solve|value|resistance|current|voltage|speed|distance|area|roots?|equation)\b|[0-9]+\s*(v|a|ohm|Ω|cm|m|s|kg|mol)\b/i;

export function routeQuery(query: string): QueryRoute {
  if (COMPETENCY_RE.test(query)) return "competency";
  if (MARKING_RE.test(query)) return "marking";
  if (PYQ_RE.test(query)) return "pyq";
  if (DIAGRAM_RE.test(query)) return "diagram";
  if (NUMERICAL_RE.test(query)) return "numerical";
  return "theory";
}

export function isExamStyleRoute(route: QueryRoute) {
  return route === "marking" || route === "pyq" || route === "competency";
}
