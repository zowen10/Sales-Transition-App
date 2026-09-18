-- CreateTable
CREATE TABLE "ScenarioChatTurn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioVersionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "proposedChange" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScenarioChatTurn_scenarioVersionId_fkey" FOREIGN KEY ("scenarioVersionId") REFERENCES "StaffingScenarioVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScenarioChatTurn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ScenarioChatTurn_scenarioVersionId_idx" ON "ScenarioChatTurn"("scenarioVersionId");
