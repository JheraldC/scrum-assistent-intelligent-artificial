-- CreateEnum
CREATE TYPE "tracking_kind" AS ENUM ('PROGRESS', 'IMPEDIMENT', 'OBSERVATION', 'DAILY_NOTE');

-- CreateEnum
CREATE TYPE "goal_assessment" AS ENUM ('ACHIEVED', 'PARTIAL', 'NOT_ACHIEVED');

-- CreateTable
CREATE TABLE "tracking_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sprint_id" UUID NOT NULL,
    "kind" "tracking_kind" NOT NULL,
    "content" TEXT NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_review" (
    "sprint_id" UUID NOT NULL,
    "results" TEXT NOT NULL DEFAULT '',
    "increment" TEXT NOT NULL DEFAULT '',
    "feedback" TEXT NOT NULL DEFAULT '',
    "goal_assessment" "goal_assessment",
    "goal_assessment_note" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprint_review_pkey" PRIMARY KEY ("sprint_id")
);

-- CreateIndex
CREATE INDEX "tracking_entry_sprint_id_created_at_idx" ON "tracking_entry"("sprint_id", "created_at");

-- AddForeignKey
ALTER TABLE "tracking_entry" ADD CONSTRAINT "tracking_entry_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_entry" ADD CONSTRAINT "tracking_entry_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_review" ADD CONSTRAINT "sprint_review_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Restricciones que Prisma no expresa (data-model.md)
ALTER TABLE "tracking_entry" ADD CONSTRAINT "tracking_entry_content_length" CHECK (char_length("content") BETWEEN 1 AND 2000);
ALTER TABLE "tracking_entry" ADD CONSTRAINT "tracking_entry_resolved_only_impediment" CHECK ("resolved_at" IS NULL OR "kind" = 'IMPEDIMENT');
ALTER TABLE "sprint_review" ADD CONSTRAINT "sprint_review_results_length" CHECK (char_length("results") <= 5000);
ALTER TABLE "sprint_review" ADD CONSTRAINT "sprint_review_increment_length" CHECK (char_length("increment") <= 5000);
ALTER TABLE "sprint_review" ADD CONSTRAINT "sprint_review_feedback_length" CHECK (char_length("feedback") <= 5000);
ALTER TABLE "sprint_review" ADD CONSTRAINT "sprint_review_goal_note_length" CHECK (char_length("goal_assessment_note") <= 2000);
