-- AlterTable
ALTER TABLE "PlayerSignup" ADD COLUMN     "riotPuuid" TEXT;

-- CreateTable
CREATE TABLE "RankedData" (
    "id" TEXT NOT NULL,
    "puuid" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "summonerName" TEXT NOT NULL,
    "tagLine" TEXT NOT NULL,
    "tier" TEXT,
    "rank" TEXT,
    "lp" INTEGER,
    "wins" INTEGER,
    "losses" INTEGER,
    "previousTiers" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankedData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RankedData_puuid_key" ON "RankedData"("puuid");
