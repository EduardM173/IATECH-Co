-- Tablas adicionales para revocación de sesiones y transferencia entre hosts.
-- No modifica usuarios ni inventarios existentes.
CREATE TABLE "core"."sesion_acceso" (
  "id" VARCHAR(64) PRIMARY KEY,
  "id_usuario" INTEGER NOT NULL REFERENCES "core"."usuario"("id_usuario") ON DELETE CASCADE,
  "ambito" VARCHAR(30) NOT NULL,
  "sesion_origen" VARCHAR(64),
  "expira" TIMESTAMPTZ(3) NOT NULL,
  "revocada" TIMESTAMPTZ(3),
  "fecha_creacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sesion_acceso_id_usuario_expira_idx" ON "core"."sesion_acceso"("id_usuario", "expira");
CREATE INDEX "sesion_acceso_sesion_origen_idx" ON "core"."sesion_acceso"("sesion_origen");

CREATE TABLE "core"."transferencia_acceso" (
  "codigo_hash" VARCHAR(64) PRIMARY KEY,
  "id_usuario" INTEGER NOT NULL REFERENCES "core"."usuario"("id_usuario") ON DELETE CASCADE,
  "sesion_origen" VARCHAR(64) NOT NULL,
  "area" VARCHAR(30) NOT NULL,
  "expira" TIMESTAMPTZ(3) NOT NULL,
  "fecha_creacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "transferencia_acceso_expira_idx" ON "core"."transferencia_acceso"("expira");
