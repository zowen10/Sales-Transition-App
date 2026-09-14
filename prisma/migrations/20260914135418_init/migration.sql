-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roles" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Transition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "name" TEXT NOT NULL,
    "transitionOwnerId" TEXT NOT NULL,
    "salesLeadId" TEXT,
    "executiveSponsorId" TEXT,
    "expectedDecisionDate" DATETIME,
    "planType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentPlanVersionId" TEXT,
    "productsInScope" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transition_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transition_transitionOwnerId_fkey" FOREIGN KEY ("transitionOwnerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transition_salesLeadId_fkey" FOREIGN KEY ("salesLeadId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transition_executiveSponsorId_fkey" FOREIGN KEY ("executiveSponsorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "helpText" TEXT,
    "responseType" TEXT NOT NULL,
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "visibilityRule" TEXT,
    "validationRule" TEXT,
    "highImpact" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntakeAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transitionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "rawTranscript" TEXT,
    "normalizedValue" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" REAL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "answeredById" TEXT NOT NULL,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntakeAnswer_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "Transition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IntakeAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IntakeAnswer_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Classification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transitionId" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "productMix" TEXT NOT NULL,
    "siteProfile" TEXT NOT NULL,
    "complexityLevel" TEXT NOT NULL,
    "integrationProfile" TEXT NOT NULL,
    "extensionProfile" TEXT NOT NULL,
    "dataReadinessProfile" TEXT NOT NULL,
    "timelinePressure" TEXT NOT NULL,
    "commercialModel" TEXT NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Classification_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "Transition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateFamilyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" DATETIME,
    "applicablePlanTypes" TEXT NOT NULL,
    "applicableProducts" TEXT NOT NULL,
    "changeNotes" TEXT,
    "body" TEXT NOT NULL,
    "clonedFromId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Template_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transitionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "parentVersionId" TEXT,
    "planType" TEXT NOT NULL,
    "scenarioName" TEXT NOT NULL DEFAULT 'Baseline',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "primaryTemplateId" TEXT NOT NULL,
    "templateSnapshot" TEXT NOT NULL,
    "inputSnapshot" TEXT NOT NULL,
    "calculationSnapshot" TEXT NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanVersion_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "Transition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "PlanVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlanVersion_primaryTemplateId_fkey" FOREIGN KEY ("primaryTemplateId") REFERENCES "Template" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "phaseType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "investment" REAL NOT NULL,
    CONSTRAINT "Phase_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "resourceGroup" TEXT NOT NULL,
    "productWorkstream" TEXT NOT NULL,
    "totalHours" REAL NOT NULL,
    "weeklyHours" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "overrideReason" TEXT,
    CONSTRAINT "RoleAllocation_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'intake',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assumption_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'intake',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Risk_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'intake',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Decision_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approverRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "Approval_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtifactJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "templateVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "fileReference" TEXT,
    "metadata" TEXT,
    "errorMessage" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ArtifactJob_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArtifactJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transitionId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "Transition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Transition_clientId_idx" ON "Transition"("clientId");

-- CreateIndex
CREATE INDEX "Transition_opportunityId_idx" ON "Transition"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionDefinition_key_key" ON "QuestionDefinition"("key");

-- CreateIndex
CREATE INDEX "QuestionDefinition_section_order_idx" ON "QuestionDefinition"("section", "order");

-- CreateIndex
CREATE INDEX "IntakeAnswer_transitionId_section_idx" ON "IntakeAnswer"("transitionId", "section");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeAnswer_transitionId_questionId_key" ON "IntakeAnswer"("transitionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Classification_transitionId_key" ON "Classification"("transitionId");

-- CreateIndex
CREATE INDEX "Template_templateFamilyId_idx" ON "Template"("templateFamilyId");

-- CreateIndex
CREATE INDEX "Template_type_status_idx" ON "Template"("type", "status");

-- CreateIndex
CREATE INDEX "PlanVersion_transitionId_idx" ON "PlanVersion"("transitionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_transitionId_versionNumber_key" ON "PlanVersion"("transitionId", "versionNumber");

-- CreateIndex
CREATE INDEX "Phase_planVersionId_idx" ON "Phase"("planVersionId");

-- CreateIndex
CREATE INDEX "RoleAllocation_planVersionId_idx" ON "RoleAllocation"("planVersionId");

-- CreateIndex
CREATE INDEX "Assumption_planVersionId_idx" ON "Assumption"("planVersionId");

-- CreateIndex
CREATE INDEX "Risk_planVersionId_idx" ON "Risk"("planVersionId");

-- CreateIndex
CREATE INDEX "Decision_planVersionId_idx" ON "Decision"("planVersionId");

-- CreateIndex
CREATE INDEX "Approval_planVersionId_idx" ON "Approval"("planVersionId");

-- CreateIndex
CREATE INDEX "ArtifactJob_planVersionId_idx" ON "ArtifactJob"("planVersionId");

-- CreateIndex
CREATE INDEX "AuditEvent_transitionId_idx" ON "AuditEvent"("transitionId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");
