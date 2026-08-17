-- Phase 14: Public Reviews System
-- Creates reviews table + adds Phase 14 columns to reservations

-- AlterTable: add review-invite tracking columns to reservations
ALTER TABLE "reservations" ADD COLUMN "reviewInviteSentAt" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN "reviewTokenJtiUsed" TEXT;

-- CreateIndex: unique constraint for single-use token enforcement
CREATE UNIQUE INDEX "reservations_reviewTokenJtiUsed_key" ON "reservations"("reviewTokenJtiUsed");

-- CreateTable: reviews
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "stayDate" DATE NOT NULL,
    "reservationId" TEXT,
    "moderated" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint: enforce rating 1-5 at DB level
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5);

-- CreateIndex: composite index for public reviews query (moderated + publishedAt)
CREATE INDEX "reviews_moderated_publishedAt_idx" ON "reviews"("moderated", "publishedAt");

-- CreateIndex: index for FK lookup
CREATE INDEX "reviews_reservationId_idx" ON "reviews"("reservationId");

-- AddForeignKey: reviews.reservationId → reservations.id (SetNull on delete)
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
