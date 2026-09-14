import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_EDIT_INTAKE, requireRole } from '@/lib/rbac';
import { upsertAnswerSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { normalizeAnswer, validateAnswer } from '@/domain/intake/normalize';
import { recordAuditEvent } from '@/lib/audit';
import type { QuestionDefinition } from '@/domain/intake/types';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_EDIT_INTAKE);
    const body = upsertAnswerSchema.parse(await req.json());

    const transition = await db.transition.findUnique({ where: { id: params.id } });
    if (!transition) return NextResponse.json({ error: 'Transition not found' }, { status: 404 });

    const questionRow = await db.questionDefinition.findUnique({ where: { key: body.questionKey } });
    if (!questionRow) return NextResponse.json({ error: `Unknown question key ${body.questionKey}` }, { status: 404 });

    const question: QuestionDefinition = {
      id: questionRow.id,
      key: questionRow.key,
      section: questionRow.section,
      prompt: questionRow.prompt,
      helpText: questionRow.helpText,
      responseType: questionRow.responseType as QuestionDefinition['responseType'],
      options: questionRow.options ? JSON.parse(questionRow.options) : null,
      required: questionRow.required,
      order: questionRow.order,
      visibilityRule: questionRow.visibilityRule ? JSON.parse(questionRow.visibilityRule) : null,
      validationRule: questionRow.validationRule ? JSON.parse(questionRow.validationRule) : null,
      highImpact: questionRow.highImpact,
      active: questionRow.active,
    };

    const { normalizedValue, errors: normalizeErrors } = normalizeAnswer(question, body.value);
    const validationErrors = [...normalizeErrors, ...validateAnswer(question, normalizedValue)];
    if (validationErrors.length && body.isConfirmed) {
      // Confirmation of an invalid value is rejected; an unconfirmed draft answer is allowed to be saved as-is
      // so the user doesn't lose in-progress work while correcting it.
      return NextResponse.json({ error: 'Answer failed validation', details: validationErrors }, { status: 400 });
    }

    const retainRawAudio = process.env.RETAIN_RAW_AUDIO === 'true';

    const saved = await db.intakeAnswer.upsert({
      where: { transitionId_questionId: { transitionId: params.id, questionId: question.id } },
      update: {
        normalizedValue: JSON.stringify(normalizedValue),
        valueType: question.responseType,
        source: body.source,
        confidence: body.confidence,
        isConfirmed: body.isConfirmed,
        rawTranscript: retainRawAudio ? body.rawTranscript : undefined,
        answeredById: user.id,
        answeredAt: new Date(),
      },
      create: {
        transitionId: params.id,
        questionId: question.id,
        section: question.section,
        normalizedValue: JSON.stringify(normalizedValue),
        valueType: question.responseType,
        source: body.source,
        confidence: body.confidence,
        isConfirmed: body.isConfirmed,
        rawTranscript: retainRawAudio ? body.rawTranscript : undefined,
        answeredById: user.id,
      },
    });

    if (transition.status === 'DRAFT') {
      await db.transition.update({ where: { id: params.id }, data: { status: 'INTAKE_IN_PROGRESS' } });
    }

    await recordAuditEvent({
      transitionId: params.id,
      actorId: user.id,
      action: 'intake.answer.updated',
      entityType: 'IntakeAnswer',
      entityId: saved.id,
      details: { questionKey: body.questionKey, isConfirmed: body.isConfirmed, source: body.source },
    });

    return NextResponse.json({ ...saved, normalizedValue, validationErrors }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
