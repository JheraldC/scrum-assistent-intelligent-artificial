-- CreateEnum
CREATE TYPE "retro_action_status" AS ENUM ('OPEN', 'DONE', 'DISCARDED');

-- CreateTable
CREATE TABLE "retrospective" (
    "sprint_id" UUID NOT NULL,
    "positives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "problems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "improvements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retrospective_pkey" PRIMARY KEY ("sprint_id")
);

-- CreateTable
CREATE TABLE "retro_action" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sprint_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "owner_id" UUID,
    "for_next_sprint" BOOLEAN NOT NULL DEFAULT false,
    "status" "retro_action_status" NOT NULL DEFAULT 'OPEN',
    "follow_up_note" TEXT NOT NULL DEFAULT '',
    "follow_up_updated_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retro_action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retro_action_sprint_id_idx" ON "retro_action"("sprint_id");

-- AddForeignKey
ALTER TABLE "retrospective" ADD CONSTRAINT "retrospective_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_action" ADD CONSTRAINT "retro_action_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "retrospective"("sprint_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_action" ADD CONSTRAINT "retro_action_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Restricciones que Prisma no expresa (data-model.md, tarea T113)
ALTER TABLE "retro_action" ADD CONSTRAINT "retro_action_description_length" CHECK (char_length("description") BETWEEN 1 AND 300);
ALTER TABLE "retro_action" ADD CONSTRAINT "retro_action_follow_up_note_length" CHECK (char_length("follow_up_note") <= 500);
ALTER TABLE "retrospective" ADD CONSTRAINT "retrospective_positives_max" CHECK (cardinality("positives") <= 30);
ALTER TABLE "retrospective" ADD CONSTRAINT "retrospective_problems_max" CHECK (cardinality("problems") <= 30);
ALTER TABLE "retrospective" ADD CONSTRAINT "retrospective_improvements_max" CHECK (cardinality("improvements") <= 30);
