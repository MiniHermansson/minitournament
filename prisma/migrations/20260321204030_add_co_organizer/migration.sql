-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "coOrganizerId" TEXT;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_coOrganizerId_fkey" FOREIGN KEY ("coOrganizerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
