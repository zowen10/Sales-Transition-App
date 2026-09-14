import { evaluateVisibility } from './visibility';
import type { AnswerMap, QuestionDefinition } from './types';

export interface IntakeProgress {
  section: string;
  totalApplicable: number;
  answered: number;
  confirmed: number;
  unresolved: number; // applicable, high-impact, and not confirmed
}

/**
 * Returns the questions currently applicable to a transition, in order,
 * given prior answers. A question with no visibility rule, or whose rule
 * evaluates true against the current answer map, is applicable. Inactive
 * questions are never applicable.
 */
export function getApplicableQuestions(questions: QuestionDefinition[], answers: AnswerMap): QuestionDefinition[] {
  return questions
    .filter((q) => q.active)
    .filter((q) => evaluateVisibility(q.visibilityRule, answers))
    .sort((a, b) => (a.section === b.section ? a.order - b.order : a.section.localeCompare(b.section)));
}

/**
 * A high-impact question requires explicit confirmation before a plan can
 * be submitted for approval, even if a value has been extracted for it.
 */
export function unresolvedHighImpactQuestions(
  questions: QuestionDefinition[],
  answers: AnswerMap,
  confirmedKeys: Set<string>
): QuestionDefinition[] {
  return getApplicableQuestions(questions, answers).filter(
    (q) => q.highImpact && q.required && !confirmedKeys.has(q.key)
  );
}

export function computeIntakeProgress(
  questions: QuestionDefinition[],
  answers: AnswerMap,
  confirmedKeys: Set<string>
): IntakeProgress[] {
  const applicable = getApplicableQuestions(questions, answers);
  const sections = Array.from(new Set(applicable.map((q) => q.section)));
  return sections.map((section) => {
    const inSection = applicable.filter((q) => q.section === section);
    const answered = inSection.filter((q) => answers[q.key] !== undefined && answers[q.key] !== '');
    const confirmed = inSection.filter((q) => confirmedKeys.has(q.key));
    const unresolved = inSection.filter((q) => q.highImpact && q.required && !confirmedKeys.has(q.key));
    return {
      section,
      totalApplicable: inSection.length,
      answered: answered.length,
      confirmed: confirmed.length,
      unresolved: unresolved.length,
    };
  });
}
