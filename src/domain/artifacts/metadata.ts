import type { ArtifactMetadata } from './types';

function metadataBlock(m: ArtifactMetadata): string {
  return [
    `> **Transition:** ${m.transitionName} (\`${m.transitionId}\`)`,
    `> **Plan version:** ${m.planVersionLabel} (\`${m.planVersionId}\`)`,
    `> **Generated:** ${m.generatedAt}`,
    `> **Status:** ${m.status}${m.status === 'Draft' ? ' — not yet approved; values may change' : ''}`,
    `> **Template used:** ${m.templateName} v${m.templateVersion}`,
    `> **Prepared by:** ${m.preparedBy}`,
  ].join('\n');
}

export { metadataBlock };
