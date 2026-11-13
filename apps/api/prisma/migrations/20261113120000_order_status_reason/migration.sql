-- Narrow OrderStatus to PENDING | CONFIRMED | REJECTED and add Reason.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "Reason" TEXT;

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE
      WHEN "status"::text = 'CANCELLED' THEN 'REJECTED'::"OrderStatus"
      WHEN "status"::text IN ('CONFIRMED', 'PREPARING', 'READY', 'COMPLETED') THEN 'CONFIRMED'::"OrderStatus"
      ELSE 'PENDING'::"OrderStatus"
    END
  );

ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"OrderStatus";

DROP TYPE "OrderStatus_old";
