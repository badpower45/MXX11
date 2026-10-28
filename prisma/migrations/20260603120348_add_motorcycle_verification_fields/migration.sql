-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "chassisNumber" TEXT,
ADD COLUMN     "chassisPhotoUrl" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "motorNumber" TEXT,
ADD COLUMN     "motorPhotoUrl" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "customerNationalId" TEXT,
ADD COLUMN     "customerNationalIdPhoto" TEXT,
ADD COLUMN     "motorcycleChassisNumber" TEXT,
ADD COLUMN     "motorcycleChassisPhoto" TEXT,
ADD COLUMN     "motorcycleColor" TEXT,
ADD COLUMN     "motorcycleMotorNumber" TEXT,
ADD COLUMN     "motorcycleMotorPhoto" TEXT;
