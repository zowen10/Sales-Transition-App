import type { EstimationResult } from '../estimation/types';
import type { ClassificationResult } from '../classification/types';

export type ArtifactType =
  | 'SALES_TRANSITION_BRIEF'
  | 'APPROVED_BURN_PLAN'
  | 'SDS_STARTER_PACKAGE'
  | 'DRAFT_SOW'
  | 'KICKOFF_PACKAGE';

export interface ArtifactMetadata {
  transitionId: string;
  transitionName: string;
  planVersionId: string;
  planVersionLabel: string; // e.g. "v2 — Accelerated schedule"
  generatedAt: string;
  status: 'Draft' | 'Approved';
  templateName: string;
  templateVersion: number;
  preparedBy: string;
}

export interface ArtifactContext {
  metadata: ArtifactMetadata;
  transition: {
    clientName: string;
    opportunityId: string | null;
    planType: string;
    productsInScope: string[];
    ownerName: string;
    salesLeadName: string | null;
    sponsorName: string | null;
  };
  classification: ClassificationResult | null;
  result: EstimationResult;
  assumptions: { description: string }[];
  risks: { description: string }[];
  decisions: { description: string }[];
}
