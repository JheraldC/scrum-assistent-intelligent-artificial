-- CreateEnum
CREATE TYPE "scrum_responsibility" AS ENUM ('SCRUM_MASTER', 'PRODUCT_OWNER', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('TODO', 'DOING', 'DONE');

-- CreateEnum
CREATE TYPE "decision_kind" AS ENUM ('DECISION', 'AGREEMENT');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('ACTIVE', 'OUTDATED');

-- CreateEnum
CREATE TYPE "suggestion_kind" AS ENUM ('STORY', 'ACCEPTANCE_CRITERIA', 'TASK', 'RISK', 'DEPENDENCY', 'QUESTION');

-- CreateEnum
CREATE TYPE "suggestion_status" AS ENUM ('PROPOSED', 'ACCEPTED', 'DISCARDED');

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "definition_of_done" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "project_member" ADD COLUMN     "responsibilities" "scrum_responsibility"[] DEFAULT ARRAY[]::"scrum_responsibility"[];

-- CreateTable
CREATE TABLE "evidence_attachment" (
    "evidence_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_attachment_pkey" PRIMARY KEY ("evidence_id")
);

-- CreateTable
CREATE TABLE "sprint_task" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sprint_id" UUID NOT NULL,
    "backlog_item_id" UUID,
    "title" TEXT NOT NULL,
    "status" "task_status" NOT NULL DEFAULT 'TODO',
    "assignee_id" UUID,
    "from_ai" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprint_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "kind" "decision_kind" NOT NULL,
    "text" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'ACTIVE',
    "include_in_context" BOOLEAN NOT NULL DEFAULT true,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_document_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "text_content" TEXT,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_document_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "interaction_id" UUID,
    "asked_by" UUID NOT NULL,
    "kind" "suggestion_kind" NOT NULL,
    "payload" JSONB NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "target_version" INTEGER,
    "status" "suggestion_status" NOT NULL DEFAULT 'PROPOSED',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "applied_entity" TEXT,
    "applied_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sprint_task_sprint_id_idx" ON "sprint_task"("sprint_id");

-- CreateIndex
CREATE INDEX "decision_project_id_created_at_idx" ON "decision"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "project_document_project_id_idx" ON "project_document"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_document_version_document_id_version_key" ON "project_document_version"("document_id", "version");

-- CreateIndex
CREATE INDEX "ai_suggestion_project_id_created_at_idx" ON "ai_suggestion"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "evidence_attachment" ADD CONSTRAINT "evidence_attachment_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_task" ADD CONSTRAINT "sprint_task_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_task" ADD CONSTRAINT "sprint_task_backlog_item_id_fkey" FOREIGN KEY ("backlog_item_id") REFERENCES "backlog_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_task" ADD CONSTRAINT "sprint_task_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_task" ADD CONSTRAINT "sprint_task_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision" ADD CONSTRAINT "decision_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision" ADD CONSTRAINT "decision_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_document_version" ADD CONSTRAINT "project_document_version_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "project_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_document_version" ADD CONSTRAINT "project_document_version_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_asked_by_fkey" FOREIGN KEY ("asked_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Restricciones que Prisma no expresa
ALTER TABLE "project" ADD CONSTRAINT "project_definition_of_done_length" CHECK (char_length("definition_of_done") <= 2000);
ALTER TABLE "sprint_task" ADD CONSTRAINT "sprint_task_title_length" CHECK (char_length("title") BETWEEN 1 AND 200);
ALTER TABLE "decision" ADD CONSTRAINT "decision_text_length" CHECK (char_length("text") BETWEEN 1 AND 1000);
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_name_length" CHECK (char_length("name") BETWEEN 1 AND 120);
ALTER TABLE "project_document_version" ADD CONSTRAINT "project_document_version_size" CHECK ("size_bytes" BETWEEN 1 AND 2097152);
ALTER TABLE "evidence_attachment" ADD CONSTRAINT "evidence_attachment_size" CHECK ("size_bytes" BETWEEN 1 AND 5242880);
