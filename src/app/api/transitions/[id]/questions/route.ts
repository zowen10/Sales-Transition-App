import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { handleApiError } from '@/server/apiError';
import { computeIntakeProgress, getApplicableQuestions } from '@/domain/intake/service';
import { loadAnswerMap } from '@/server/intakeAnswers';
import type { QuestionDefinition } from '@/domain/intake/types';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCurrentUser();
    const transition = await db.transition.findUnique({ where: { id: params.id } });
    if (!transition) return NextResponse.json({ error: 'Transition not found' }, { status: 404 });

    const dbQuestions = await db.questionDefinition.findMany({ where: { active: true } });
    const questions: QuestionDefinition[] = dbQuestions.map((q) => ({
      id: q.id,
      key: q.key,
      section: q.section,
      prompt: q.prompt,
      helpText: q.helpText,
      responseType: q.responseType as QuestionDefinition['responseType'],
      options: q.options ? JSON.parse(q.options) : null,
      required: q.required,
      order: q.order,
      visibilityRule: q.visibilityRule ? JSON.parse(q.visibilityRule) : null,
      validationRule: q.validationRule ? JSON.parse(q.validationRule) : null,
      highImpact: q.highImpact,
      active: q.active,
    }));

    const { answers, confirmedKeys } = await loadAnswerMap(params.id);
    const applicable = getApplicableQuestions(questions, answers);
    const progress = computeIntakeProgress(questions, answers, confirmedKeys);

    return NextResponse.json({
      questions: applicable,
      answers,
      confirmedKeys: Array.from(confirmedKeys),
      progress,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
