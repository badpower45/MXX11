-- CreateEnum
CREATE TYPE "ShipmentStage" AS ENUM ('NEW', 'EXTERNAL_PROCUREMENT', 'WAREHOUSE_PREPARATION', 'PORT_CUSTOMS_CLEARANCE', 'IN_TRANSIT_TO_BERTH', 'DELIVERED_TO_VESSEL', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SHIPMENT_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'SHIPMENT_STAGE_CHANGED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "ShipSupplyOrder" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "vesselName" TEXT NOT NULL,
    "vesselImo" TEXT,
    "berthLocation" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "currentStage" "ShipmentStage" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "eta" TIMESTAMP(3),
    "etd" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "coordinatorId" TEXT,
    "procurementOfficerId" TEXT,
    "warehouseOfficerId" TEXT,
    "customsOfficerId" TEXT,
    "deliveryOfficerId" TEXT,
    "saleId" TEXT,
    "totalAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipSupplyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipSupplyOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "itemName" TEXT NOT NULL,
    "category" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL(12,2),
    "isExternallyProcured" BOOLEAN NOT NULL DEFAULT false,
    "isPrepared" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipSupplyOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentStageLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStage" "ShipmentStage",
    "toStage" "ShipmentStage" NOT NULL,
    "performedById" TEXT,
    "notes" TEXT,
    "referenceDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentStageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShipSupplyOrder_trackingNumber_key" ON "ShipSupplyOrder"("trackingNumber");

-- CreateIndex
CREATE INDEX "ShipSupplyOrder_shopId_currentStage_idx" ON "ShipSupplyOrder"("shopId", "currentStage");

-- CreateIndex
CREATE INDEX "ShipSupplyOrder_trackingNumber_idx" ON "ShipSupplyOrder"("trackingNumber");

-- CreateIndex
CREATE INDEX "ShipSupplyOrder_vesselName_idx" ON "ShipSupplyOrder"("vesselName");

-- CreateIndex
CREATE INDEX "ShipSupplyOrderItem_orderId_idx" ON "ShipSupplyOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ShipmentStageLog_orderId_createdAt_idx" ON "ShipmentStageLog"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipSupplyOrder" ADD CONSTRAINT "ShipSupplyOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipSupplyOrder" ADD CONSTRAINT "ShipSupplyOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipSupplyOrder" ADD CONSTRAINT "ShipSupplyOrder_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipSupplyOrder" ADD CONSTRAINT "ShipSupplyOrder_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipSupplyOrder" ADD CONSTRAINT "ShipSupplyOrder_procurementOfficerId_fkey" FOREIGN KEY ("procurementOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipSupplyOrder" ADD CONSTRAINT "ShipSupplyOrder_warehouseOfficerId_fkey" FOREIGN KEY ("warehouseOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipSupplyOrder" ADD CONSTRAINT "ShipSupplyOrder_customsOfficerId_fkey" FOREIGN KEY ("customsOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipSupplyOrder" ADD CONSTRAINT "ShipSupplyOrder_deliveryOfficerId_fkey" FOREIGN KEY ("deliveryOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipSupplyOrderItem" ADD CONSTRAINT "ShipSupplyOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShipSupplyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipSupplyOrderItem" ADD CONSTRAINT "ShipSupplyOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStageLog" ADD CONSTRAINT "ShipmentStageLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShipSupplyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStageLog" ADD CONSTRAINT "ShipmentStageLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
