-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "tableLabel" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "language" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Order" ADD COLUMN "tableLabel" TEXT;
ALTER TABLE "Order" ADD COLUMN "language" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_externalId_key" ON "Order"("externalId");
