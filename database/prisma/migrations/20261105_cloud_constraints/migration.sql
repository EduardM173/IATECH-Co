ALTER TABLE "cloud"."recursos_cloud"
  ADD CONSTRAINT "cloud_tipo_recurso_dominio" CHECK ("tipo_recurso" IN ('Instancia VM', 'Contenedor/K8s', 'Bucket almacenamiento', 'Base de datos', 'Función serverless', 'Red/VPC/Balanceador', 'Monitoreo/Backup')),
  ADD CONSTRAINT "cloud_proveedor_cloud_dominio" CHECK ("proveedor_cloud" IN ('AWS', 'Azure', 'GCP')),
  ADD CONSTRAINT "cloud_region_zona_dominio" CHECK ("region_zona" IN ('us-east-1', 'us-west-2', 'sa-east-1', 'eu-west-1', 'eastus', 'brazilsouth', 'westeurope', 'us-central1', 'southamerica-east1', 'europe-west1')),
  ADD CONSTRAINT "cloud_ambiente_dominio" CHECK ("ambiente" IN ('Producción', 'Desarrollo', 'QA/Pruebas')),
  ADD CONSTRAINT "cloud_estado_operativo_dominio" CHECK ("estado_operativo" IN ('En ejecución', 'Detenido', 'En aprovisionamiento', 'Suspendido')),
  ADD CONSTRAINT "cloud_criticidad_dominio" CHECK ("criticidad" IN ('Crítica', 'Alta', 'Media', 'Baja')),
  ADD CONSTRAINT "cloud_responsable_equipo_dominio" CHECK ("responsable_equipo" IN ('CloudOps', 'DevOps', 'Backend', 'Data', 'Seguridad Cloud')),
  ADD CONSTRAINT "cloud_costo_mensual_usd_no_negativo" CHECK ("costo_mensual_usd" >= 0);
