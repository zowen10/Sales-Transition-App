import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_EDIT_INTAKE, requireRole } from '@/lib/rbac';
import { handleApiError } from '@/server/apiError';
import { resolveProjectDocument } from '@/server/documentStorage';
import { extractDocumentText } from '@/server/extractDocumentText';
import { getDocumentIntakeExtractor } from '@/adapters/documentExtraction';
import { normalizeAnswer } from '@/domain/intake/normalize';
import { recordAuditEvent } from '@/lib/audit';
import type { QuestionDefinition } from '@/domain/intake/types';

/**
 * Reads the project's uploaded documents (SharePoint links are not fetched —
 * no Graph API credentials are configured) and asks the configured extractor
 * to suggest answers to the current intake questions. Every suggestion is
 * saved as an UNCONFIRMED, editable answer (source: 'imported') — nothing
 * here is written as final. If no ANTHROPIC_API_KEY is configured, or there
 * are no readable documents, this is a safe no-op with an explanatory note.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_EDIT_INTAKE);

    const transition = await db.transition.findUnique({ where: { id: params.id } });
    if (!transition) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        filled: 0,
        documentsUsed: 0,
        note: 'Automatic document extraction isn’t configured (no ANTHROPIC_API_KEY). Add uploaded documents and fill in the assessment manually, or configure ANTHROPIC_API_KEY to enable this.',
      });
    }

    const uploadedDocs = await db.projectDocument.findMany({
      where: { transitionId: params.id, source: 'upload', storagePath: { not: null } },
    });

    const documents: { filename: string; text: string }[] = [];
    for (const doc of uploadedDocs) {
      if (!doc.storagePath) continue;
      try {
        const buffer = await readFile(resolveProjectDocument(doc.storagePath));
        const text = await extractDocumentText(buffer, doc.filename);
        if (text && text.trim().length > 0) documents.push({ filename: doc.filename, text });
      } catch {
        // Skip unreadable files; extraction proceeds with whatever else is available.
      }
    }

    if (documents.length === 0) {
      return NextResponse.json({
        filled: 0,
        documentsUsed: 0,
        note: 'No readable uploaded documents found (SharePoint links are not fetched, and only .txt/.docx uploads can be read today). Upload a document to try prepopulation.',
      });
    }

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

    const extractor = getDocumentIntakeExtractor();
    const suggestions = await extractor.extract({
      documents,
      questions: questions.map((q) => ({ key: q.key, prompt: q.prompt })),
    });

    let filled = 0;
    for (const question of questions) {
      const suggestion = suggestions[question.key];
      if (!suggestion) continue;
      const { normalizedValue } = normalizeAnswer(question, suggestion.value);
      if (normalizedValue === null || normalizedValue === '') continue;

      await db.intakeAnswer.upsert({
        where: { transitionId_questionId: { transitionId: params.id, questionId: question.id } },
        update: {
          normalizedValue: JSON.stringify(normalizedValue),
          valueType: question.responseType,
          source: 'imported',
          confidence: suggestion.confidence,
          isConfirmed: false,
          answeredById: user.id,
          answeredAt: new Date(),
        },
        create: {
          transitionId: params.id,
          questionId: question.id,
          section: question.section,
          normalizedValue: JSON.stringify(normalizedValue),
          valueType: question.responseType,
          source: 'imported',
          confidence: suggestion.confidence,
          isConfirmed: false,
          answeredById: user.id,
        },
      });
      filled++;
    }

    await recordAuditEvent({
      transitionId: params.id,
      actorId: user.id,
      action: 'intake.prefilled_from_documents',
      entityType: 'Transition',
      entityId: params.id,
      details: { filled, documentsUsed: documents.length },
    });

    return NextResponse.json({ filled, documentsUsed: documents.length });
  } catch (err) {
    return handleApiError(err);
  }
}
