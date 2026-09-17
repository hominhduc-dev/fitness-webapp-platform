CREATE TYPE "PushDeliveryStatus" AS ENUM ('pending', 'processing', 'retrying', 'sent', 'failed');

ALTER TABLE "PushSubscription"
ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';

CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

CREATE TABLE "PushDelivery" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushDelivery_notificationId_subscriptionId_key"
ON "PushDelivery"("notificationId", "subscriptionId");

CREATE INDEX "PushDelivery_status_nextAttemptAt_idx"
ON "PushDelivery"("status", "nextAttemptAt");

CREATE INDEX "PushDelivery_subscriptionId_status_idx"
ON "PushDelivery"("subscriptionId", "status");

ALTER TABLE "PushDelivery"
ADD CONSTRAINT "PushDelivery_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushDelivery"
ADD CONSTRAINT "PushDelivery_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
