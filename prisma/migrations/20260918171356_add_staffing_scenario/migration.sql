-- CreateTable
CREATE TABLE "StaffingScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "clientId" TEXT,
    "transitionId" TEXT,
    "currentVersionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffingScenario_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffingScenario_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "Transition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffingScenario_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffingScenarioVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "parentVersionId" TEXT,
    "label" TEXT NOT NULL DEFAULT 'Baseline',
    "leverConfig" TEXT NOT NULL,
    "scenarioInput" TEXT NOT NULL,
    "resourcePlanOverrides" TEXT,
    "resultSnapshot" TEXT NOT NULL,
    "derivedFrom" TEXT,
    "checkpointDate" DATETIME,
    "actualsImportBatchId" TEXT,
    "varianceSummary" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffingScenarioVersion_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "StaffingScenario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffingScenarioVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "StaffingScenarioVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffingScenarioVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StaffingScenario_clientId_idx" ON "StaffingScenario"("clientId");

-- CreateIndex
CREATE INDEX "StaffingScenario_transitionId_idx" ON "StaffingScenario"("transitionId");

-- CreateIndex
CREATE INDEX "StaffingScenarioVersion_scenarioId_idx" ON "StaffingScenarioVersion"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffingScenarioVersion_scenarioId_versionNumber_key" ON "StaffingScenarioVersion"("scenarioId", "versionNumber");
