-- DropIndex
DROP INDEX "StockCountAssignee_stockCountId_userId_key";

-- AlterTable
ALTER TABLE "StockCountAssignee" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "guestStaffId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GuestStaff" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountUserEntry" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stockCountAssigneeId" TEXT NOT NULL,
    "actualQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCountUserEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationalSubmission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "academicSubject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestStaff_shopId_idx" ON "GuestStaff"("shopId");

-- CreateIndex
CREATE INDEX "StockCountUserEntry_stockCountId_idx" ON "StockCountUserEntry"("stockCountId");

-- CreateIndex
CREATE INDEX "StockCountUserEntry_productId_idx" ON "StockCountUserEntry"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCountUserEntry_stockCountAssigneeId_productId_key" ON "StockCountUserEntry"("stockCountAssigneeId", "productId");

-- CreateIndex
CREATE INDEX "StockCountAssignee_guestStaffId_idx" ON "StockCountAssignee"("guestStaffId");

-- AddForeignKey
ALTER TABLE "StockCountAssignee" ADD CONSTRAINT "StockCountAssignee_guestStaffId_fkey" FOREIGN KEY ("guestStaffId") REFERENCES "GuestStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestStaff" ADD CONSTRAINT "GuestStaff_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountUserEntry" ADD CONSTRAINT "StockCountUserEntry_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountUserEntry" ADD CONSTRAINT "StockCountUserEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountUserEntry" ADD CONSTRAINT "StockCountUserEntry_stockCountAssigneeId_fkey" FOREIGN KEY ("stockCountAssigneeId") REFERENCES "StockCountAssignee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
