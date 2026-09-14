import { db } from '@/lib/db';
import type { AnswerMap } from '@/domain/intake/types';

export async function loadAnswerMap(transitionId: string): Promise<{ answers: AnswerMap; confirmedKeys: Set<string> }> {
  const rows = await db.intakeAnswer.findMany({
    where: { transitionId },
    include: { question: true },
  });
  const answers: AnswerMap = {};
  const confirmedKeys = new Set<string>();
  for (const row of rows) {
    answers[row.question.key] = JSON.parse(row.normalizedValue);
    if (row.isConfirmed) confirmedKeys.add(row.question.key);
  }
  return { answers, confirmedKeys };
}
