import type { TopicMastery } from "../types";

/**
 * Mastery must come from the signed-in student's graded answer history.
 *
 * The persistence and grading loop are not connected yet, so the honest
 * initial state is empty. Screens consuming this list must render onboarding
 * states instead of invented strengths, weaknesses, or study priorities.
 */
export const MASTERY: TopicMastery[] = [];
