-- CreateTable
CREATE TABLE "IssueImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "stageLabel" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'baseline',
    "asOfDate" DATETIME,
    "suggestedMapping" TEXT,
    "confirmedMapping" TEXT,
    "mappingConfirmedById" TEXT,
    "mappingConfirmedAt" DATETIME,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "decision" TEXT NOT NULL DEFAULT 'needs_review',
    "pmNote" TEXT,
    "expectedUplift" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueImportBatch_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "StaffingScenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IssueImportBatch_mappingConfirmedById_fkey" FOREIGN KEY ("mappingConfirmedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IssueImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT NOT NULL,
    "externalId" TEXT,
    "issueType" TEXT,
    "priority" TEXT,
    "status" TEXT,
    "createdDate" DATETIME,
    "resolvedDate" DATETIME,
    "reopenedCount" INTEGER NOT NULL DEFAULT 0,
    "blockedTestCaseCount" INTEGER NOT NULL DEFAULT 0,
    "raw" TEXT NOT NULL,
    CONSTRAINT "IssueRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "IssueImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "IssueImportBatch_scenarioId_idx" ON "IssueImportBatch"("scenarioId");

-- CreateIndex
CREATE INDEX "IssueRecord_importBatchId_idx" ON "IssueRecord"("importBatchId");
