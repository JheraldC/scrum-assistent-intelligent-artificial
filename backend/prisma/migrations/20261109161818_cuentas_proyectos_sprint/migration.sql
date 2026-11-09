-- CreateEnum
CREATE TYPE "role" AS ENUM ('PARTICIPANT', 'FACILITATOR');

-- CreateEnum
CREATE TYPE "sprint_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "stage_type" AS ENUM ('PLANNING', 'TRACKING', 'REVIEW', 'RETROSPECTIVE');

-- CreateEnum
CREATE TYPE "stage_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'NEEDS_CORRECTION', 'VALIDATED');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "pseudonym" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "product_goal" TEXT NOT NULL,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_member" (
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "role" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_pkey" PRIMARY KEY ("project_id","user_id")
);

-- CreateTable
CREATE TABLE "sprint" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "sprint_status" NOT NULL DEFAULT 'OPEN',
    "sprint_goal" TEXT NOT NULL DEFAULT '',
    "work_plan" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_stage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sprint_id" UUID NOT NULL,
    "type" "stage_type" NOT NULL,
    "status" "stage_status" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprint_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stage_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" BIGSERIAL NOT NULL,
    "project_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_pseudonym_key" ON "user"("pseudonym");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_hash_key" ON "session"("token_hash");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- CreateIndex
CREATE INDEX "project_member_user_id_idx" ON "project_member"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sprint_project_id_number_key" ON "sprint"("project_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "sprint_stage_sprint_id_type_key" ON "sprint_stage"("sprint_id", "type");

-- CreateIndex
CREATE INDEX "activity_log_project_id_occurred_at_id_idx" ON "activity_log"("project_id", "occurred_at", "id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint" ADD CONSTRAINT "sprint_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_stage" ADD CONSTRAINT "sprint_stage_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "sprint_stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Restricciones que Prisma no expresa (data-model.md, tasks T035)

-- Un solo Sprint abierto por proyecto
CREATE UNIQUE INDEX "sprint_one_open_per_project" ON "sprint" ("project_id") WHERE "status" = 'OPEN';

-- Seudonimo con patron P-XXXXXX (alfabeto A-Z y 2-9)
ALTER TABLE "user" ADD CONSTRAINT "user_pseudonym_format" CHECK ("pseudonym" ~ '^P-[A-Z2-9]{6}$');
ALTER TABLE "user" ADD CONSTRAINT "user_email_lowercase" CHECK ("email" = lower("email"));

-- Longitudes de texto
ALTER TABLE "project" ADD CONSTRAINT "project_name_length" CHECK (char_length("name") BETWEEN 3 AND 100);
ALTER TABLE "project" ADD CONSTRAINT "project_description_length" CHECK (char_length("description") <= 1000);
ALTER TABLE "project" ADD CONSTRAINT "project_product_goal_length" CHECK (char_length("product_goal") BETWEEN 1 AND 500);
ALTER TABLE "sprint" ADD CONSTRAINT "sprint_goal_length" CHECK (char_length("sprint_goal") <= 500);
ALTER TABLE "sprint" ADD CONSTRAINT "sprint_work_plan_length" CHECK (char_length("work_plan") <= 5000);
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_content_length" CHECK (char_length("content") BETWEEN 1 AND 2000);

-- completed_at solo para etapas validadas
ALTER TABLE "sprint_stage" ADD CONSTRAINT "sprint_stage_completed_only_validated" CHECK ("completed_at" IS NULL OR "status" = 'VALIDATED');
