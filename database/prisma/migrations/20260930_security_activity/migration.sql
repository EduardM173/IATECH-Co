CREATE TABLE "evento_acceso" (
  "id" SERIAL NOT NULL,
  "correo" VARCHAR(254) NOT NULL,
  "ip" VARCHAR(45) NOT NULL,
  "resultado" VARCHAR(10) NOT NULL,
  "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evento_acceso_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "evento_acceso_resultado_check" CHECK ("resultado" IN ('EXITOSO', 'FALLIDO'))
);
CREATE INDEX "evento_acceso_fecha_id_idx" ON "evento_acceso"("fecha", "id");
CREATE INDEX "evento_acceso_resultado_fecha_correo_idx" ON "evento_acceso"("resultado", "fecha", "correo");
