CREATE SCHEMA IF NOT EXISTS "cloud";

CREATE TABLE "cloud"."recursos_cloud" (
  "id_recurso_cloud" SERIAL PRIMARY KEY,
  "nombre_recurso" VARCHAR(150),
  "tipo_recurso" VARCHAR(50),
  "proveedor_cloud" VARCHAR(20),
  "region_zona" VARCHAR(50),
  "ambiente" VARCHAR(20),
  "estado_operativo" VARCHAR(25),
  "criticidad" VARCHAR(10),
  "responsable_equipo" VARCHAR(100),
  "fecha_creacion" DATE,
  "costo_mensual_usd" DECIMAL(10,2)
);
