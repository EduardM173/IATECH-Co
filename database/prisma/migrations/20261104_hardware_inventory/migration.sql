CREATE SCHEMA IF NOT EXISTS "hardware";

CREATE TABLE "hardware"."recursos_hardware" (
  "id_activo" SERIAL PRIMARY KEY,
  "nombre" VARCHAR(150),
  "categoria_recurso" VARCHAR(50),
  "funcion_seguridad" VARCHAR(50),
  "responsable" VARCHAR(100),
  "criticidad" VARCHAR(10),
  "estado_gestion" VARCHAR(20),
  "fecha_ultima_revision" DATE,
  "resultado_revision" VARCHAR(30),
  "fecha_creacion" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_modificacion" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE FUNCTION "hardware".actualizar_modificacion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.fecha_modificacion = LOCALTIMESTAMP; RETURN NEW; END;
$$;
CREATE TRIGGER actualizar_modificacion BEFORE UPDATE ON "hardware"."recursos_hardware"
FOR EACH ROW EXECUTE FUNCTION "hardware".actualizar_modificacion();
