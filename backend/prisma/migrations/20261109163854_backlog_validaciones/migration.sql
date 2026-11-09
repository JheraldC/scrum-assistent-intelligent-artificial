-- CreateEnum
CREATE TYPE "backlog_kind" AS ENUM ('USER_STORY', 'ITEM');

-- CreateEnum
CREATE TYPE "target_type" AS ENUM ('BACKLOG_ITEM', 'SPRINT', 'SPRINT_REVIEW', 'RETROSPECTIVE');

-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('PASSED', 'FAILED', 'ERROR');

-- CreateEnum
CREATE TYPE "ai_status" AS ENUM ('OK', 'NOT_REQUESTED', 'TIMEOUT', 'PROVIDER_ERROR', 'INVALID_RESPONSE', 'BUDGET_EXCEEDED');

-- CreateEnum
CREATE TYPE "origin" AS ENUM ('OFFICIAL', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "outcome" AS ENUM ('MET', 'NOT_MET', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "backlog_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "backlog_kind" NOT NULL,
    "title" TEXT NOT NULL,
    "as_a" TEXT,
    "i_want" TEXT,
    "so_that" TEXT,
    "description" TEXT,
    "acceptance_criteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backlog_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_run" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "gate_id" TEXT NOT NULL,
    "target_type" "target_type" NOT NULL,
    "target_id" UUID NOT NULL,
    "target_version" INTEGER NOT NULL,
    "target_snapshot" JSONB NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "status" "run_status" NOT NULL,
    "catalog_version" TEXT NOT NULL,
    "ai_status" "ai_status" NOT NULL,
    "requested_by" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "validation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criterion_result" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "validation_run_id" UUID NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "origin" "origin" NOT NULL,
    "mandatory" BOOLEAN NOT NULL,
    "outcome" "outcome" NOT NULL,
    "evidence" TEXT NOT NULL DEFAULT '',
    "explanation" TEXT NOT NULL DEFAULT '',
    "recommendation" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "criterion_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backlog_item_project_id_priority_idx" ON "backlog_item"("project_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "backlog_item_project_id_code_key" ON "backlog_item"("project_id", "code");

-- CreateIndex
CREATE INDEX "validation_run_project_id_target_type_target_id_attempt_no_idx" ON "validation_run"("project_id", "target_type", "target_id", "attempt_no" DESC);

-- CreateIndex
CREATE INDEX "validation_run_project_id_finished_at_idx" ON "validation_run"("project_id", "finished_at");

-- CreateIndex
CREATE UNIQUE INDEX "validation_run_project_id_gate_id_target_type_target_id_att_key" ON "validation_run"("project_id", "gate_id", "target_type", "target_id", "attempt_no");

-- CreateIndex
CREATE UNIQUE INDEX "criterion_result_validation_run_id_criterion_id_key" ON "criterion_result"("validation_run_id", "criterion_id");

-- AddForeignKey
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_run" ADD CONSTRAINT "validation_run_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_run" ADD CONSTRAINT "validation_run_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criterion_result" ADD CONSTRAINT "criterion_result_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "validation_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Restricciones que Prisma no expresa (data-model.md, tarea T059)

-- Rol, necesidad y beneficio obligatorios (no nulos) solo para historias de usuario
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_story_fields" CHECK (
  "kind" = 'ITEM' OR ("as_a" IS NOT NULL AND "i_want" IS NOT NULL AND "so_that" IS NOT NULL)
);
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_priority_min" CHECK ("priority" >= 1);
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_criteria_max" CHECK (cardinality("acceptance_criteria") <= 20);
-- Cota gruesa de longitud (20 criterios de hasta 300 caracteres); el limite por criterio lo valida la API
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_criteria_length" CHECK (char_length(array_to_string("acceptance_criteria", '')) <= 6000);
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_title_length" CHECK (char_length("title") BETWEEN 1 AND 120);
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_as_a_length" CHECK (char_length("as_a") <= 200);
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_i_want_length" CHECK (char_length("i_want") <= 500);
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_so_that_length" CHECK (char_length("so_that") <= 500);
ALTER TABLE "backlog_item" ADD CONSTRAINT "backlog_item_description_length" CHECK (char_length("description") <= 2000);

-- Evaluaciones: intento >= 1 y compuertas conocidas
ALTER TABLE "validation_run" ADD CONSTRAINT "validation_run_attempt_min" CHECK ("attempt_no" >= 1);
ALTER TABLE "validation_run" ADD CONSTRAINT "validation_run_gate_id" CHECK ("gate_id" IN ('GATE-STORY','GATE-PLAN','GATE-REVIEW','GATE-RETRO'));
