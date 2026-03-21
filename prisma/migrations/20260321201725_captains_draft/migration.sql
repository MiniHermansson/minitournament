-- CreateEnum
CREATE TYPE "TeamMode" AS ENUM ('PRE_MADE', 'CAPTAINS_DRAFT');

-- AlterEnum
ALTER TYPE "PlayerRole" ADD VALUE 'FILL';

-- AlterEnum
ALTER TYPE "TournamentStatus" ADD VALUE 'DRAFTING';

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "teamMode" "TeamMode" NOT NULL DEFAULT 'PRE_MADE';

-- CreateTable
CREATE TABLE "PlayerSignup" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mainRole" "PlayerRole" NOT NULL,
    "secondaryRole" "PlayerRole",
    "wantsCaptain" BOOLEAN NOT NULL DEFAULT false,
    "opGgLink" TEXT,
    "discordName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftState" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "totalTeams" INTEGER NOT NULL,
    "currentPick" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftCaptain" (
    "id" TEXT NOT NULL,
    "draftStateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamNumber" INTEGER NOT NULL,

    CONSTRAINT "DraftCaptain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPick" (
    "id" TEXT NOT NULL,
    "draftStateId" TEXT NOT NULL,
    "teamNumber" INTEGER NOT NULL,
    "pickNumber" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSignup_tournamentId_userId_key" ON "PlayerSignup"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftState_tournamentId_key" ON "DraftState"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftCaptain_draftStateId_teamNumber_key" ON "DraftCaptain"("draftStateId", "teamNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DraftCaptain_draftStateId_userId_key" ON "DraftCaptain"("draftStateId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_draftStateId_pickNumber_key" ON "DraftPick"("draftStateId", "pickNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_draftStateId_userId_key" ON "DraftPick"("draftStateId", "userId");

-- AddForeignKey
ALTER TABLE "PlayerSignup" ADD CONSTRAINT "PlayerSignup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSignup" ADD CONSTRAINT "PlayerSignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftState" ADD CONSTRAINT "DraftState_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftCaptain" ADD CONSTRAINT "DraftCaptain_draftStateId_fkey" FOREIGN KEY ("draftStateId") REFERENCES "DraftState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftCaptain" ADD CONSTRAINT "DraftCaptain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_draftStateId_fkey" FOREIGN KEY ("draftStateId") REFERENCES "DraftState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
