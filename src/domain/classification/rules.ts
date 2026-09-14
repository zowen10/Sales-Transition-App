/**
 * Complexity/timeline thresholds used by the classification service.
 * These are business assumptions leaders should own — they are modeled as
 * a config object (loadable from a COMPLEXITY_FACTORS template) rather than
 * hardcoded inline in the classification logic, per the "templates are
 * governed assets" principle.
 */
export interface ClassificationRules {
  complexity: {
    integrationCountMediumThreshold: number;
    integrationCountHighThreshold: number;
    siteCountMediumThreshold: number;
    siteCountHighThreshold: number;
    multiSitePoints: number;
    programPoints: number;
    perIntegrationPoints: number;
    perSitePoints: number;
    mifPoints: number;
    customExtensionPoints: number;
    migrationConcernPoints: number;
    compliancePoints: number;
    mediumThreshold: number; // score >= this => medium
    highThreshold: number; // score >= this => high
  };
  timelinePressure: {
    highPressureMaxWeeks: number; // start -> go-live under this many weeks => high pressure
    mediumPressureMaxWeeks: number;
  };
}

export const DEFAULT_CLASSIFICATION_RULES: ClassificationRules = {
  complexity: {
    integrationCountMediumThreshold: 1,
    integrationCountHighThreshold: 3,
    siteCountMediumThreshold: 3,
    siteCountHighThreshold: 8,
    multiSitePoints: 2,
    programPoints: 4,
    perIntegrationPoints: 1.5,
    perSitePoints: 0.5,
    mifPoints: 2,
    customExtensionPoints: 2,
    migrationConcernPoints: 1.5,
    compliancePoints: 1.5,
    mediumThreshold: 3,
    highThreshold: 7,
  },
  timelinePressure: {
    highPressureMaxWeeks: 12,
    mediumPressureMaxWeeks: 20,
  },
};
