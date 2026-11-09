-- CreateTable
CREATE TABLE "sprint_item" (
    "sprint_id" UUID NOT NULL,
    "backlog_item_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprint_item_pkey" PRIMARY KEY ("sprint_id","backlog_item_id")
);

-- CreateTable
CREATE TABLE "gate_exception" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "validation_run_id" UUID NOT NULL,
    "authorized_by" UUID NOT NULL,
    "justification" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_exception_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gate_exception_validation_run_id_key" ON "gate_exception"("validation_run_id");

-- AddForeignKey
ALTER TABLE "sprint_item" ADD CONSTRAINT "sprint_item_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_item" ADD CONSTRAINT "sprint_item_backlog_item_id_fkey" FOREIGN KEY ("backlog_item_id") REFERENCES "backlog_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_exception" ADD CONSTRAINT "gate_exception_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "validation_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_exception" ADD CONSTRAINT "gate_exception_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Restricciones que Prisma no expresa (data-model.md, tarea T077)

-- La justificacion de una excepcion es obligatoria: al menos 10 caracteres sin espacios sobrantes
ALTER TABLE "gate_exception" ADD CONSTRAINT "gate_exception_justification_length" CHECK (length(btrim("justification")) >= 10);
ALTER TABLE "gate_exception" ADD CONSTRAINT "gate_exception_justification_max" CHECK (char_length("justification") <= 1000);
