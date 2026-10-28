-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('MOTORCYCLE', 'SPARE_PART');

-- CreateEnum
CREATE TYPE "PaymentDrawerType" AS ENUM ('CASH', 'INSTAPAY', 'WALLET');

-- CreateEnum
CREATE TYPE "MotorcycleCondition" AS ENUM ('NEW', 'USED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('PRINTING_PAPER', 'PENS', 'STAPLES', 'ELECTRICITY', 'RENT', 'MISCELLANEOUS', 'TIPS', 'PERSONAL_WITHDRAWAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TrafficInvoiceStatus" AS ENUM ('PENDING_SEND', 'IN_TRANSIT', 'DELIVERED');

-- CreateEnum
CREATE TYPE "DealerPaymentMode" AS ENUM ('CASH', 'ON_ACCOUNT', 'DEFERRED');

-- AlterTable
ALTER TABLE "CashSession" ADD COLUMN     "closingActualCash" DECIMAL(12,2),
ADD COLUMN     "closingActualInstaPay" DECIMAL(12,2),
ADD COLUMN     "closingActualWallet" DECIMAL(12,2),
ADD COLUMN     "closingExpectedCash" DECIMAL(12,2),
ADD COLUMN     "closingExpectedInstaPay" DECIMAL(12,2),
ADD COLUMN     "closingExpectedWallet" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "assemblyCost" DECIMAL(12,2),
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "condition" "MotorcycleCondition" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "dealerCode" TEXT,
ADD COLUMN     "externalTransportCost" DECIMAL(12,2),
ADD COLUMN     "internalTransportCost" DECIMAL(12,2),
ADD COLUMN     "maintenanceCost" DECIMAL(12,2),
ADD COLUMN     "otherCosts" DECIMAL(12,2),
ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'MOTORCYCLE',
ADD COLUMN     "supplierPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "SalePayment" ADD COLUMN     "drawerType" "PaymentDrawerType";

-- CreateTable
CREATE TABLE "BranchExpense" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "recipient" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentCompanyDue" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "pullDate" TIMESTAMP(3) NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "pullAmount" DECIMAL(12,2) NOT NULL,
    "saleAmount" DECIMAL(12,2) NOT NULL,
    "adminFees" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dueAmount" DECIMAL(12,2) NOT NULL,
    "isCollected" BOOLEAN NOT NULL DEFAULT false,
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentCompanyDue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficInvoice" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "status" "TrafficInvoiceStatus" NOT NULL DEFAULT 'PENDING_SEND',
    "transportCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cairoReceiptCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receivedAtCairo" TIMESTAMP(3),
    "deliveryFeeCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveredToCustomerAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrafficInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerDebt" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "dealerCode" TEXT NOT NULL,
    "purchaseId" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingDebt" DECIMAL(12,2) NOT NULL,
    "paymentMode" "DealerPaymentMode" NOT NULL,
    "notes" TEXT,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerDebt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "motorcycleDetails" TEXT NOT NULL,
    "depositAmount" DECIMAL(12,2) NOT NULL,
    "remainingAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BranchExpense_shopId_createdAt_idx" ON "BranchExpense"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "BranchExpense_userId_createdAt_idx" ON "BranchExpense"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentCompanyDue_saleId_key" ON "InstallmentCompanyDue"("saleId");

-- CreateIndex
CREATE INDEX "InstallmentCompanyDue_shopId_dueDate_idx" ON "InstallmentCompanyDue"("shopId", "dueDate");

-- CreateIndex
CREATE INDEX "InstallmentCompanyDue_companyName_idx" ON "InstallmentCompanyDue"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "TrafficInvoice_saleId_key" ON "TrafficInvoice"("saleId");

-- CreateIndex
CREATE INDEX "TrafficInvoice_shopId_status_idx" ON "TrafficInvoice"("shopId", "status");

-- CreateIndex
CREATE INDEX "TrafficInvoice_customerName_idx" ON "TrafficInvoice"("customerName");

-- CreateIndex
CREATE INDEX "DealerDebt_shopId_isSettled_idx" ON "DealerDebt"("shopId", "isSettled");

-- CreateIndex
CREATE INDEX "Reservation_shopId_isCompleted_idx" ON "Reservation"("shopId", "isCompleted");

-- AddForeignKey
ALTER TABLE "BranchExpense" ADD CONSTRAINT "BranchExpense_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchExpense" ADD CONSTRAINT "BranchExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentCompanyDue" ADD CONSTRAINT "InstallmentCompanyDue_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentCompanyDue" ADD CONSTRAINT "InstallmentCompanyDue_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficInvoice" ADD CONSTRAINT "TrafficInvoice_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficInvoice" ADD CONSTRAINT "TrafficInvoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerDebt" ADD CONSTRAINT "DealerDebt_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerDebt" ADD CONSTRAINT "DealerDebt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
