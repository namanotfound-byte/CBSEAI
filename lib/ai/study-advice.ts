/**
 * Student preparation guidance is kept separate from academic RAG policy.
 * When the owner supplies a chart/PDF, review it and replace this versioned
 * baseline with approved guidance. Never pass raw PDF text as instructions.
 */
export const STUDY_ADVICE_VERSION = "baseline-2026-09-25";

export const STUDY_STEPS = [
  "Choose one chapter or topic for the next session.",
  "Read the relevant NCERT section and note what is unclear.",
  "Practise a few questions and check each mistake.",
  "Revisit the difficult points in a later session.",
] as const;

export function studyAdviceReply(input: string): string {
  const subject = /\b(math|maths|mathematics)\b/i.test(input) ? "Maths" : /\b(science|physics|chemistry|biology)\b/i.test(input) ? "Science" : "Maths or Science";
  if (/stressed|worried|anxious/i.test(input)) {
    return `It’s understandable to feel pressure about exams. Pick one small ${subject} topic to work on today, then try a few questions and review the mistakes. Tell me what feels hardest and how much time you have; I’ll help you make the next step manageable.`;
  }
  return `Let’s make a ${subject} plan around your actual time and weak areas. Start by choosing a chapter, read its NCERT explanation, practise a few questions, and review any mistakes before moving on. Tell me your exam date, available study time, and difficult chapters, and I’ll turn that into a more specific timetable. I won’t guess your exam date or your weak areas.`;
}
