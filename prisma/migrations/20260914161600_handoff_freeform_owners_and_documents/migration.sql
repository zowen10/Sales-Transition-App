/*
  Warnings:

  - You are about to drop the column `executiveSponsorId` on the `Transition` table. All the data in the column will be lost.
  - You are about to drop the column `expectedDecisionDate` on the `Transition` table. All the data in the column will be lost.
  - You are about to drop the column `opportunityId` on the `Transition` table. All the data in the column will be lost.
  - You are about to drop the column `salesLeadId` on the `Transition` table. All the data in the column will be lost.
  - You are about to drop the column `transitionOwnerId` on the `Transition` table. All the data in the column will be lost.
  - Added the required column `engagementDirectorName` to the `Transition` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transitionId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT,
    "sharepointUrl" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectDocument_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "Transition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "approverId" TEXT,
    "approverRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "Approval_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Approval" ("approverId", "approverRole", "comment", "id", "planVersionId", "requestedAt", "respondedAt", "status") SELECT "approverId", "approverRole", "comment", "id", "planVersionId", "requestedAt", "respondedAt", "status" FROM "Approval";
DROP TABLE "Approval";
ALTER TABLE "new_Approval" RENAME TO "Approval";
CREATE INDEX "Approval_planVersionId_idx" ON "Approval"("planVersionId");
CREATE TABLE "new_Transition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "salesforceOpportunityUrl" TEXT,
    "name" TEXT NOT NULL,
    "engagementDirectorName" TEXT NOT NULL,
    "salesLeadName" TEXT,
    "executiveSponsorName" TEXT,
    "salesTransitionFolderUrl" TEXT,
    "planType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentPlanVersionId" TEXT,
    "productsInScope" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transition_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transition" ("clientId", "createdAt", "createdBy", "currentPlanVersionId", "id", "name", "planType", "productsInScope", "status", "updatedAt") SELECT "clientId", "createdAt", "createdBy", "currentPlanVersionId", "id", "name", "planType", "productsInScope", "status", "updatedAt" FROM "Transition";
DROP TABLE "Transition";
ALTER TABLE "new_Transition" RENAME TO "Transition";
CREATE INDEX "Transition_clientId_idx" ON "Transition"("clientId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProjectDocument_transitionId_idx" ON "ProjectDocument"("transitionId");
