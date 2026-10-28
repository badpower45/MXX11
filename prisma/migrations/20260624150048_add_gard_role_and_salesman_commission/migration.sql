-- AlterEnum
ALTER TYPE "ShopRole" ADD VALUE 'STOCK_COUNTER';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "salesmanCommission" DECIMAL(12,2),
ADD COLUMN     "salesmanId" TEXT;

-- AlterTable
ALTER TABLE "UserShop" ADD COLUMN     "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StockCountAssignee" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCountAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockCountAssignee_stockCountId_idx" ON "StockCountAssignee"("stockCountId");

-- CreateIndex
CREATE INDEX "StockCountAssignee_userId_idx" ON "StockCountAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCountAssignee_stockCountId_userId_key" ON "StockCountAssignee"("stockCountId", "userId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountAssignee" ADD CONSTRAINT "StockCountAssignee_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountAssignee" ADD CONSTRAINT "StockCountAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
