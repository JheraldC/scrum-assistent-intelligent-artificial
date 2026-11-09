-- CreateEnum
CREATE TYPE "agent_kind" AS ENUM ('CHAT', 'VALIDATION_FEEDBACK');

-- CreateEnum
CREATE TYPE "agent_status" AS ENUM ('OK', 'TIMEOUT', 'PROVIDER_ERROR', 'INVALID_RESPONSE', 'BUDGET_EXCEEDED', 'RATE_LIMITED');

-- CreateTable
CREATE TABLE "agent_interaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "agent_kind" NOT NULL,
    "validation_run_id" UUID,
    "prompt_version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "model_config" JSONB NOT NULL,
    "question" TEXT NOT NULL,
    "response" JSONB,
    "status" "agent_status" NOT NULL,
    "latency_ms" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_interaction_project_id_created_at_idx" ON "agent_interaction"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_interaction_project_id_user_id_created_at_idx" ON "agent_interaction"("project_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_interaction_created_at_idx" ON "agent_interaction"("created_at");

-- AddForeignKey
ALTER TABLE "agent_interaction" ADD CONSTRAINT "agent_interaction_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_interaction" ADD CONSTRAINT "agent_interaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_interaction" ADD CONSTRAINT "agent_interaction_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "validation_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Restricciones que Prisma no expresa (data-model.md, tarea T094)
-- La retroalimentacion de validacion solo puede ligarse a una evaluacion; el chat no
ALTER TABLE "agent_interaction" ADD CONSTRAINT "agent_interaction_run_only_feedback" CHECK (
  ("kind" = 'VALIDATION_FEEDBACK') OR ("validation_run_id" IS NULL)
);
ALTER TABLE "agent_interaction" ADD CONSTRAINT "agent_interaction_tokens_nonneg" CHECK (
  ("input_tokens" IS NULL OR "input_tokens" >= 0) AND ("output_tokens" IS NULL OR "output_tokens" >= 0)
);
