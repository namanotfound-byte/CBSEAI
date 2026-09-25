import { studyAdviceReply } from "./study-advice";

/**
 * High-confidence non-academic turns bypass RAG. This saves the free model
 * quota and keeps a greeting from being misclassified as a syllabus topic.
 * Academic definitions and problems continue through the grounded pipeline.
 */
export type ConversationIntent = "greeting" | "capabilities" | "thanks" | "wellbeing" | "study_advice";

export function conversationIntent(input: string): ConversationIntent | null {
  const text = input.trim().toLowerCase().replace(/[.!?]+$/g, "").trim();
  if (!text || text.length > 300) return null;
  if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening)|namaste|hii+)(\s+(there|padhle))?$/.test(text)) return "greeting";
  if (/^(thanks?|thank you|ty|great,? thanks|okay,? thanks)(\s+(a lot|so much|padhle))?$/.test(text)) return "thanks";
  if (/^(how are you|how's it going|what's up|how do you feel)$/.test(text)) return "wellbeing";
  if (/^(what can you (do|help (me )?with)|how can you help( me)?|what do you do|who are you|how does (this|padhle) work|can you help me)$/.test(text)) return "capabilities";
  if (/\b(how (do|should|can) i (study|prepare|revise)|study plan|study schedule|revision plan|prepare for (my |the )?(board|exam)|exam preparation|make me a (study )?timetable|i (am|'m) (stressed|worried|anxious) about (my |the )?(board|exam))s?\b/.test(text)) return "study_advice";
  return null;
}

export function conversationReply(intent: ConversationIntent, input: string): string {
  switch (intent) {
    case "greeting": return "Hi! What are you studying today? You can ask a Class 10 Maths or Science question, upload a question photo, or ask me to help you plan your revision.";
    case "thanks": return "You’re welcome! If any step is unclear, tell me which one and I’ll explain it another way.";
    case "wellbeing": return "I’m here and ready to help. How’s your studying going?";
    case "capabilities": return "I can explain Class 10 Maths and Science concepts, work through questions, read a photo of a question, and help you plan revision. For subject answers I check the current CBSE syllabus and cite the approved material I used. What would you like to start with?";
    case "study_advice": return studyAdviceReply(input);
  }
}
