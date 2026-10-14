-- Fase 2. Datos antiguos de inventario descartables, autorizado por el usuario.
-- Conserva las cuentas, contraseñas, categorías y registros de acceso.
-- Nulabilidad no especificada: NULL provisional (excepto PK y fechas automáticas).
BEGIN;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS seguridad;
CREATE SCHEMA IF NOT EXISTS software;
CREATE SCHEMA IF NOT EXISTS bigdata;
CREATE SCHEMA IF NOT EXISTS calidad;
CREATE SCHEMA IF NOT EXISTS redes;

ALTER TABLE public.categoria SET SCHEMA core;
ALTER TABLE public.usuario SET SCHEMA core;
ALTER TABLE public.evento_acceso SET SCHEMA core;

-- Borra únicamente el inventario de prueba. Sus detalles se borran por las FK.
DELETE FROM public.activo;

CREATE TABLE "seguridad"."recursos_seguridad" (
  "id_activo" SERIAL PRIMARY KEY,
  "nombre" VARCHAR(150),
  "categoria_recurso" VARCHAR(50),
  "funcion_seguridad" VARCHAR(50),
  "responsable" VARCHAR(100),
  "criticidad" VARCHAR(10) CONSTRAINT "seguridad_criticidad_dominio" CHECK ("criticidad" IN ('Crítica', 'Alta', 'Media', 'Baja')),
  "estado_gestion" VARCHAR(20) CONSTRAINT "seguridad_estado_gestion_dominio" CHECK ("estado_gestion" IN ('En uso', 'En revisión', 'Suspendido', 'Retirado')),
  "fecha_ultima_revision" DATE,
  "resultado_revision" VARCHAR(30) CONSTRAINT "seguridad_resultado_revision_dominio" CHECK ("resultado_revision" IN ('Conforme', 'Con observaciones', 'No conforme')),
  "fecha_creacion" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_modificacion" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION "seguridad".actualizar_modificacion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.fecha_modificacion = LOCALTIMESTAMP; RETURN NEW; END;
$$;
CREATE TRIGGER actualizar_modificacion BEFORE UPDATE ON "seguridad"."recursos_seguridad"
FOR EACH ROW EXECUTE FUNCTION "seguridad".actualizar_modificacion();

CREATE TABLE "software"."herramientas_desarrollo" (
  "id_herramienta_dev" SERIAL PRIMARY KEY,
  "nombre_herramienta" VARCHAR(100) NOT NULL,
  "categoria_dev" VARCHAR(50) NOT NULL,
  "estado_funcionamiento" VARCHAR(20) NOT NULL DEFAULT 'Activa' CONSTRAINT "software_estado_funcionamiento_dominio" CHECK ("estado_funcionamiento" IN ('Activa', 'En Evaluación', 'Deprecada')),
  "version_aprobada" VARCHAR(30) NOT NULL,
  "fecha_ultima_actualizacion" DATE,
  "tipo_licencia" VARCHAR(50) NOT NULL,
  "costo_total_usd" DECIMAL(10,2) DEFAULT 0.00,
  "fecha_adquisicion" DATE NOT NULL,
  "fecha_expiracion" DATE
);

CREATE TABLE "bigdata"."activos_datos" (
  "id_activo" SERIAL PRIMARY KEY,
  "nombre_activo" VARCHAR(150),
  "fecha_creacion" DATE,
  "fecha_modificacion" DATE,
  "tipo_activo" VARCHAR(30) CONSTRAINT "bigdata_tipo_activo_dominio" CHECK ("tipo_activo" IN ('Dataset', 'Tabla', 'Modelo ML', 'Pipeline ETL', 'Dashboard')),
  "fuente_origen" VARCHAR(100),
  "clasificacion_sensibilidad" VARCHAR(20) CONSTRAINT "bigdata_clasificacion_sensibilidad_dominio" CHECK ("clasificacion_sensibilidad" IN ('Pública', 'Interna', 'Confidencial', 'PHI')),
  "responsable_owner" VARCHAR(100),
  "ubicacion_repositorio" VARCHAR(200),
  "estado" VARCHAR(20) CONSTRAINT "bigdata_estado_dominio" CHECK ("estado" IN ('Activo', 'En revisión', 'Obsoleto'))
);

CREATE TABLE "calidad"."herramientas_calidad" (
  "id_herramienta" SERIAL PRIMARY KEY,
  "nombre_herramienta" VARCHAR(150),
  "categoria_herramienta" VARCHAR(50) CONSTRAINT "calidad_categoria_herramienta_dominio" CHECK ("categoria_herramienta" IN ('Automatización de Pruebas', 'Gestión de Bugs', 'Pruebas de Rendimiento', 'Análisis de Código')),
  "responsable" VARCHAR(100),
  "criticidad" VARCHAR(10) CONSTRAINT "calidad_criticidad_dominio" CHECK ("criticidad" IN ('Crítica', 'Alta', 'Media', 'Baja')),
  "estado_gestion" VARCHAR(20) CONSTRAINT "calidad_estado_gestion_dominio" CHECK ("estado_gestion" IN ('En uso', 'En revisión', 'Suspendido', 'Retirado')),
  "fecha_ultima_revision" DATE,
  "resultado_revision" VARCHAR(30) CONSTRAINT "calidad_resultado_revision_dominio" CHECK ("resultado_revision" IN ('Conforme', 'Con observaciones', 'No conforme')),
  "fecha_creacion" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_modificacion" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION "calidad".actualizar_modificacion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.fecha_modificacion = LOCALTIMESTAMP; RETURN NEW; END;
$$;
CREATE TRIGGER actualizar_modificacion BEFORE UPDATE ON "calidad"."herramientas_calidad"
FOR EACH ROW EXECUTE FUNCTION "calidad".actualizar_modificacion();

CREATE TABLE "redes"."dispositivos_red" (
  "id_dispositivo" SERIAL PRIMARY KEY,
  "nombre_dispositivo" VARCHAR(100),
  "modelo" VARCHAR(100),
  "area_pertenencia" VARCHAR(100) CONSTRAINT "redes_area_pertenencia_dominio" CHECK ("area_pertenencia" IN ('Administración', 'Sistemas', 'Finanzas', 'Recursos Humanos', 'Comercial', 'Operaciones')),
  "direccion_ip" VARCHAR(45),
  "red_pertenencia" VARCHAR(100),
  "marca" VARCHAR(50),
  "protocolo_enrutamiento" VARCHAR(30) CONSTRAINT "redes_protocolo_enrutamiento_dominio" CHECK ("protocolo_enrutamiento" IN ('OSPF', 'RIP', 'EIGRP', 'BGP', 'Estático', 'No aplica')),
  "tipo_dispositivo" VARCHAR(30) CONSTRAINT "redes_tipo_dispositivo_dominio" CHECK ("tipo_dispositivo" IN ('Router', 'Switch', 'Firewall', 'Access Point', 'Servidor')),
  "estado" VARCHAR(20) CONSTRAINT "redes_estado_dominio" CHECK ("estado" IN ('Activo', 'Inactivo', 'En mantenimiento'))
);

COMMIT;
