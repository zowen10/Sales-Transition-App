export type ComplexityLevel = 'low' | 'medium' | 'high' | 'custom';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type CommercialModel = 'fixed_fee' | 'time_and_materials' | 'milestone' | 'hybrid' | 'other';

export interface ClassificationReason {
  field: string;
  reason: string;
  sourceQuestionKeys: string[];
}

export interface ClassificationResult {
  planType: string;
  productMix: string[];
  siteProfile: {
    siteCount: number | null;
    geography: string | null;
    rolloutSequence: string | null;
  };
  complexityLevel: ComplexityLevel;
  integrationProfile: {
    integrationCount: number | null;
    usesMif: boolean;
  };
  extensionProfile: {
    hasCustomExtensions: boolean;
    extensionCount: number | null;
  };
  dataReadinessProfile: {
    hasMigrationConcerns: boolean;
    hasComplianceRequirements: boolean;
  };
  timelinePressure: 'low' | 'medium' | 'high';
  commercialModel: CommercialModel;
  confidenceLevel: ConfidenceLevel;
  reasons: ClassificationReason[];
}
