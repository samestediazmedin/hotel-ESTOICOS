-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL');

-- CreateTable
CREATE TABLE "guest_contact_events" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "method" "ContactMethod" NOT NULL,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_contact_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_contact_events_guestId_createdAt_idx" ON "guest_contact_events"("guestId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "guest_contact_events_staffUserId_createdAt_idx" ON "guest_contact_events"("staffUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "guest_contact_events" ADD CONSTRAINT "guest_contact_events_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_contact_events" ADD CONSTRAINT "guest_contact_events_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
