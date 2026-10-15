-- Conserva "usuario", "categoria" y "evento_acceso" con todos sus datos.
-- El nuevo inventario comienza vacio de forma intencional.

CREATE TABLE "inventario" (
    "id_inventario" SERIAL NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "responsable" VARCHAR(100),
    "estado" VARCHAR(20) NOT NULL,
    "fecha_creacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo_equipo" VARCHAR(30),
    "marca" VARCHAR(50),
    "modelo" VARCHAR(100),
    "numero_serie" VARCHAR(100),
    "departamento" VARCHAR(100),
    "ubicacion_fisica" VARCHAR(150),
    "fecha_adquisicion" DATE,
    "fecha_fin_garantia" DATE,
    "direccion_ip" VARCHAR(45),
    "red_pertenencia" VARCHAR(100),
    "protocolo_enrutamiento" VARCHAR(30),
    "tipo_dispositivo" VARCHAR(30),
    "categoria_item" VARCHAR(50),
    "version_aprobada" VARCHAR(30),
    "fecha_ultima_actualizacion" DATE,
    "tipo_licencia" VARCHAR(50),
    "costo_total_usd" DECIMAL(10,2) DEFAULT 0,
    "fecha_expiracion" DATE,
    "criticidad" VARCHAR(10),
    "funcion_seguridad" VARCHAR(50),
    "fecha_ultima_revision" DATE,
    "resultado_revision" VARCHAR(30),
    "tipo_activo" VARCHAR(30),
    "fuente_origen" VARCHAR(100),
    "clasificacion_sensibilidad" VARCHAR(20),
    "ubicacion_repositorio" VARCHAR(200),
    "proveedor" VARCHAR(50),
    "tipo_servicio" VARCHAR(100),
    "identificador_recurso" VARCHAR(512),
    "cuenta_proyecto" VARCHAR(100),
    "region" VARCHAR(50),
    "entorno" VARCHAR(20),
    "costo_mensual_usd" DECIMAL(10,2),

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id_inventario"),
    CONSTRAINT "inventario_costo_total_usd_check"
      CHECK ("costo_total_usd" IS NULL OR "costo_total_usd" >= 0),
    CONSTRAINT "inventario_costo_mensual_usd_check"
      CHECK ("costo_mensual_usd" IS NULL OR "costo_mensual_usd" >= 0),
    CONSTRAINT "inventario_revision_completa_check"
      CHECK (("fecha_ultima_revision" IS NULL) = ("resultado_revision" IS NULL))
);

CREATE INDEX "inventario_id_categoria_estado_idx"
  ON "inventario"("id_categoria", "estado");
CREATE INDEX "inventario_id_categoria_fecha_modificacion_id_inventario_idx"
  ON "inventario"("id_categoria", "fecha_modificacion", "id_inventario");
CREATE INDEX "usuario_id_categoria_idx" ON "usuario"("id_categoria");

ALTER TABLE "inventario"
  ADD CONSTRAINT "inventario_id_categoria_fkey"
  FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL no permite que un CHECK consulte otra tabla. Este trigger usa el
-- nombre estable del area para validar los campos obligatorios y sus dominios.
CREATE OR REPLACE FUNCTION "validar_inventario_por_area"()
RETURNS TRIGGER AS $$
DECLARE
  area_nombre TEXT;
BEGIN
  SELECT "nombre_categoria" INTO area_nombre
  FROM "categoria"
  WHERE "id_categoria" = NEW."id_categoria";

  IF area_nombre IS NULL THEN
    RAISE EXCEPTION 'El area del inventario no existe' USING ERRCODE = '23503';
  END IF;

  NEW."fecha_modificacion" := CURRENT_TIMESTAMP;

  IF area_nombre = 'HARDWARE' THEN
    IF NULLIF(BTRIM(NEW."tipo_equipo"), '') IS NULL
       OR NULLIF(BTRIM(NEW."marca"), '') IS NULL
       OR NULLIF(BTRIM(NEW."modelo"), '') IS NULL
       OR NULLIF(BTRIM(NEW."numero_serie"), '') IS NULL
       OR NULLIF(BTRIM(NEW."departamento"), '') IS NULL
       OR NULLIF(BTRIM(NEW."ubicacion_fisica"), '') IS NULL
       OR NEW."fecha_adquisicion" IS NULL THEN
      RAISE EXCEPTION 'Faltan campos obligatorios de Hardware' USING ERRCODE = '23514';
    END IF;
    IF NEW."tipo_equipo" NOT IN ('Desktop', 'Laptop', 'Monitor', 'Impresora', 'Periférico', 'Otro')
       OR NEW."estado" NOT IN ('Activo', 'Inactivo', 'En mantenimiento', 'Retirado') THEN
      RAISE EXCEPTION 'Tipo o estado no permitido para Hardware' USING ERRCODE = '23514';
    END IF;

  ELSIF area_nombre = 'SOFTWARE' THEN
    IF NULLIF(BTRIM(NEW."categoria_item"), '') IS NULL
       OR NULLIF(BTRIM(NEW."version_aprobada"), '') IS NULL
       OR NULLIF(BTRIM(NEW."tipo_licencia"), '') IS NULL
       OR NEW."fecha_adquisicion" IS NULL THEN
      RAISE EXCEPTION 'Faltan campos obligatorios de Software' USING ERRCODE = '23514';
    END IF;
    IF NEW."estado" NOT IN ('Activa', 'En Evaluación', 'Deprecada') THEN
      RAISE EXCEPTION 'Estado no permitido para Software' USING ERRCODE = '23514';
    END IF;

  ELSIF area_nombre = 'REDES' THEN
    IF NULLIF(BTRIM(NEW."modelo"), '') IS NULL
       OR NULLIF(BTRIM(NEW."departamento"), '') IS NULL
       OR NULLIF(BTRIM(NEW."direccion_ip"), '') IS NULL
       OR NULLIF(BTRIM(NEW."red_pertenencia"), '') IS NULL
       OR NULLIF(BTRIM(NEW."marca"), '') IS NULL
       OR NULLIF(BTRIM(NEW."protocolo_enrutamiento"), '') IS NULL
       OR NULLIF(BTRIM(NEW."tipo_dispositivo"), '') IS NULL THEN
      RAISE EXCEPTION 'Faltan campos obligatorios de Redes' USING ERRCODE = '23514';
    END IF;
    IF NEW."departamento" NOT IN ('Administración', 'Sistemas', 'Finanzas', 'Recursos Humanos', 'Comercial', 'Operaciones')
       OR NEW."tipo_dispositivo" NOT IN ('Router', 'Switch', 'Firewall', 'Access Point', 'Servidor')
       OR NEW."protocolo_enrutamiento" NOT IN ('OSPF', 'RIP', 'EIGRP', 'BGP', 'Estático', 'No aplica')
       OR NEW."estado" NOT IN ('Activo', 'Inactivo', 'En mantenimiento') THEN
      RAISE EXCEPTION 'Valor no permitido para Redes' USING ERRCODE = '23514';
    END IF;

  ELSIF area_nombre = 'CALIDAD' THEN
    IF NULLIF(BTRIM(NEW."categoria_item"), '') IS NULL
       OR NULLIF(BTRIM(NEW."responsable"), '') IS NULL
       OR NULLIF(BTRIM(NEW."criticidad"), '') IS NULL THEN
      RAISE EXCEPTION 'Faltan campos obligatorios de Calidad' USING ERRCODE = '23514';
    END IF;
    IF NEW."categoria_item" NOT IN ('Automatización de Pruebas', 'Gestión de Bugs', 'Pruebas de Rendimiento', 'Análisis de Código')
       OR NEW."criticidad" NOT IN ('Crítica', 'Alta', 'Media', 'Baja')
       OR NEW."estado" NOT IN ('En uso', 'En revisión', 'Suspendido', 'Retirado')
       OR (NEW."resultado_revision" IS NOT NULL AND NEW."resultado_revision" NOT IN ('Conforme', 'Con observaciones', 'No conforme')) THEN
      RAISE EXCEPTION 'Valor no permitido para Calidad' USING ERRCODE = '23514';
    END IF;

  ELSIF area_nombre = 'SEGURIDAD' THEN
    IF NULLIF(BTRIM(NEW."categoria_item"), '') IS NULL
       OR NULLIF(BTRIM(NEW."funcion_seguridad"), '') IS NULL
       OR NULLIF(BTRIM(NEW."responsable"), '') IS NULL
       OR NULLIF(BTRIM(NEW."criticidad"), '') IS NULL THEN
      RAISE EXCEPTION 'Faltan campos obligatorios de Seguridad' USING ERRCODE = '23514';
    END IF;
    IF NEW."criticidad" NOT IN ('Crítica', 'Alta', 'Media', 'Baja')
       OR NEW."estado" NOT IN ('En uso', 'En revisión', 'Suspendido', 'Retirado')
       OR (NEW."resultado_revision" IS NOT NULL AND NEW."resultado_revision" NOT IN ('Conforme', 'Con observaciones', 'No conforme')) THEN
      RAISE EXCEPTION 'Valor no permitido para Seguridad' USING ERRCODE = '23514';
    END IF;

  ELSIF area_nombre = 'BIG DATA ANALITICAS' THEN
    IF NULLIF(BTRIM(NEW."tipo_activo"), '') IS NULL
       OR NULLIF(BTRIM(NEW."fuente_origen"), '') IS NULL
       OR NULLIF(BTRIM(NEW."clasificacion_sensibilidad"), '') IS NULL
       OR NULLIF(BTRIM(NEW."responsable"), '') IS NULL
       OR NULLIF(BTRIM(NEW."ubicacion_repositorio"), '') IS NULL THEN
      RAISE EXCEPTION 'Faltan campos obligatorios de Big Data' USING ERRCODE = '23514';
    END IF;
    IF NEW."tipo_activo" NOT IN ('Dataset', 'Tabla', 'Modelo ML', 'Pipeline ETL', 'Dashboard')
       OR NEW."clasificacion_sensibilidad" NOT IN ('Pública', 'Interna', 'Confidencial', 'PHI')
       OR NEW."estado" NOT IN ('Activo', 'En revisión', 'Obsoleto') THEN
      RAISE EXCEPTION 'Valor no permitido para Big Data' USING ERRCODE = '23514';
    END IF;

  ELSIF area_nombre = 'CLOUD' THEN
    IF NULLIF(BTRIM(NEW."proveedor"), '') IS NULL
       OR NULLIF(BTRIM(NEW."tipo_servicio"), '') IS NULL
       OR NULLIF(BTRIM(NEW."identificador_recurso"), '') IS NULL
       OR NULLIF(BTRIM(NEW."cuenta_proyecto"), '') IS NULL
       OR NULLIF(BTRIM(NEW."entorno"), '') IS NULL
       OR NULLIF(BTRIM(NEW."responsable"), '') IS NULL THEN
      RAISE EXCEPTION 'Faltan campos obligatorios de Cloud' USING ERRCODE = '23514';
    END IF;
    IF NEW."entorno" NOT IN ('Desarrollo', 'Pruebas', 'Producción')
       OR NEW."estado" NOT IN ('Activo', 'Detenido', 'En mantenimiento', 'Retirado') THEN
      RAISE EXCEPTION 'Valor no permitido para Cloud' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'El area no admite registros de inventario' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inventario_validar_area_trigger"
BEFORE INSERT OR UPDATE ON "inventario"
FOR EACH ROW EXECUTE FUNCTION "validar_inventario_por_area"();

-- Limpieza destructiva solicitada: solo afecta al inventario anterior.
DROP TABLE "hardware";
DROP TABLE "software";
DROP TABLE "redes";
DROP TABLE "seguridad";
DROP TABLE "calidad";
DROP TABLE "cloud";
DROP TABLE "big_data_analiticas";
DROP TABLE "activo";
