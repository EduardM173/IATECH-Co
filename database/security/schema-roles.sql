-- Ejecutar como administrador SOLO tras las migraciones y en el entorno elegido.
-- Roles NOLOGIN independientes; no modifica cuentas de la aplicación.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iatech_seguridad') THEN CREATE ROLE iatech_seguridad NOLOGIN NOINHERIT; END IF; END $$;
REVOKE ALL ON SCHEMA "seguridad" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "seguridad" FROM PUBLIC;
GRANT USAGE ON SCHEMA "seguridad" TO iatech_seguridad;
GRANT SELECT, INSERT, UPDATE ON "seguridad"."recursos_seguridad" TO iatech_seguridad;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "seguridad" TO iatech_seguridad;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iatech_software') THEN CREATE ROLE iatech_software NOLOGIN NOINHERIT; END IF; END $$;
REVOKE ALL ON SCHEMA "software" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "software" FROM PUBLIC;
GRANT USAGE ON SCHEMA "software" TO iatech_software;
GRANT SELECT, INSERT, UPDATE ON "software"."herramientas_desarrollo" TO iatech_software;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "software" TO iatech_software;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iatech_bigdata') THEN CREATE ROLE iatech_bigdata NOLOGIN NOINHERIT; END IF; END $$;
REVOKE ALL ON SCHEMA "bigdata" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "bigdata" FROM PUBLIC;
GRANT USAGE ON SCHEMA "bigdata" TO iatech_bigdata;
GRANT SELECT, INSERT, UPDATE ON "bigdata"."activos_datos" TO iatech_bigdata;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "bigdata" TO iatech_bigdata;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iatech_calidad') THEN CREATE ROLE iatech_calidad NOLOGIN NOINHERIT; END IF; END $$;
REVOKE ALL ON SCHEMA "calidad" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "calidad" FROM PUBLIC;
GRANT USAGE ON SCHEMA "calidad" TO iatech_calidad;
GRANT SELECT, INSERT, UPDATE ON "calidad"."herramientas_calidad" TO iatech_calidad;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "calidad" TO iatech_calidad;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iatech_redes') THEN CREATE ROLE iatech_redes NOLOGIN NOINHERIT; END IF; END $$;
REVOKE ALL ON SCHEMA "redes" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "redes" FROM PUBLIC;
GRANT USAGE ON SCHEMA "redes" TO iatech_redes;
GRANT SELECT, INSERT, UPDATE ON "redes"."dispositivos_red" TO iatech_redes;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "redes" TO iatech_redes;
DO $$ DECLARE area TEXT; BEGIN
 FOREACH area IN ARRAY ARRAY['seguridad','software','bigdata','calidad','redes'] LOOP
 EXECUTE format('GRANT %I TO %I', 'iatech_' || area, current_user);
 END LOOP;
END $$;
