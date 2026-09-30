// database/seed.ts
// Crea las 7 categorias y un usuario ADMIN por cada area.
// Ejecutar con: pnpm run db:seed  (o node --experimental-strip-types seed.ts)

import { prisma } from "./client";
import * as crypto from "crypto";

// Mismo esquema de hash que backend/src/auth/auth.service.ts (scrypt nativo,
// formato "salt:hash"). Si cambia uno, debe cambiar el otro.
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

const AREAS = [
  "HARDWARE",
  "SOFTWARE",
  "REDES",
  "SEGURIDAD",
  "CALIDAD",
  "CLOUD",
  "BIG DATA ANALITICAS",
];

const PASSWORD_TEMPORAL = process.env.SEED_ADMIN_PASSWORD;

// Datos iniciales de demostración. Se guardan en PostgreSQL para que el
// frontend los consuma desde la API como cualquier activo registrado.
const ACTIVOS_DEMO = [
  { codigo: "HW-001", descripcion: "Ecógrafo Portátil Mindray M9", area: "HARDWARE", fecha: "2024-01-15", estado: "ACTIVO", detalle: { numero_serie: "MN-M9-0001", marca: "Mindray", modelo: "M9" } },
  { codigo: "HW-002", descripcion: "Monitor de Signos Vitales Philips IntelliVue", area: "HARDWARE", fecha: "2023-11-20", estado: "ACTIVO", detalle: { numero_serie: "PH-IM-0002", marca: "Philips", modelo: "IntelliVue" } },
  { codigo: "HW-003", descripcion: "Servidor PACS de Radiología Dell R750", area: "HARDWARE", fecha: "2024-02-10", estado: "ACTIVO", detalle: { numero_serie: "DL-R750-0003", marca: "Dell", modelo: "PowerEdge R750" } },
  { codigo: "HW-004", descripcion: "Workstation Médica HP Z2 Tower", area: "HARDWARE", fecha: "2024-03-01", estado: "EN MANTENIMIENTO", detalle: { numero_serie: "HP-Z2-0004", marca: "HP", modelo: "Z2 Tower" } },
  { codigo: "SW-001", descripcion: "Sistema HIS Hospitalario Enterprise", area: "SOFTWARE", fecha: "2024-01-05", estado: "ACTIVO", detalle: { version: "2024.1", tipo_licencia: "Empresarial", fecha_expiracion: "2025-01-05" } },
  { codigo: "SW-002", descripcion: "Visor DICOM Radiológico PACS", area: "SOFTWARE", fecha: "2023-12-01", estado: "ACTIVO", detalle: { version: "5.4", tipo_licencia: "Por estación", fecha_expiracion: "2025-12-01" } },
  { codigo: "SW-003", descripcion: "Software de Triaje Manchester", area: "SOFTWARE", fecha: "2024-02-15", estado: "ACTIVO", detalle: { version: "3.2", tipo_licencia: "Módulo hospitalario", fecha_expiracion: "2026-02-15" } },
  { codigo: "SW-004", descripcion: "Licencia Antivirus Endpoint Salud", area: "SOFTWARE", fecha: "2024-03-10", estado: "PENDIENTE RENOVAR", detalle: { version: "12.0", tipo_licencia: "250 equipos", fecha_expiracion: "2024-12-31" } },
  { codigo: "RD-001", descripcion: "Switch Cisco Catalyst Quirófanos", area: "REDES", fecha: "2023-10-12", estado: "ACTIVO", detalle: { direccion_ip: "10.10.1.10", tipo_conexion: "Ethernet PoE+", ancho_banda: "10 Gbps" } },
  { codigo: "RD-002", descripcion: "Router Central Enlace Telemedicina", area: "REDES", fecha: "2023-11-05", estado: "ACTIVO", detalle: { direccion_ip: "10.10.1.1", tipo_conexion: "Fibra óptica", ancho_banda: "10 Gbps" } },
  { codigo: "RD-003", descripcion: "Access Point Médico UniFi 6 UCI", area: "REDES", fecha: "2024-01-22", estado: "ACTIVO", detalle: { direccion_ip: "10.10.2.20", tipo_conexion: "Wi-Fi 6", ancho_banda: "1 Gbps" } },
  { codigo: "SG-001", descripcion: "Firewall Palo Alto Red Asistencial", area: "SEGURIDAD", fecha: "2023-09-18", estado: "ACTIVO", detalle: { tipo_seguridad: "Firewall perimetral", nivel_acceso: "Crítico", protocolo: "HTTPS / IPSec" } },
  { codigo: "SG-002", descripcion: "Lector Biométrico Acceso Farmacia", area: "SEGURIDAD", fecha: "2024-02-01", estado: "ACTIVO", detalle: { tipo_seguridad: "Biometría", nivel_acceso: "Restringido", protocolo: "TLS 1.3" } },
  { codigo: "SG-003", descripcion: "Certificado SSL Servidores Salud", area: "SEGURIDAD", fecha: "2024-01-10", estado: "ACTIVO", detalle: { tipo_seguridad: "Certificado digital", nivel_acceso: "Interno", protocolo: "TLS 1.3" } },
  { codigo: "CL-001", descripcion: "Sistema ISO 13485 Gestión Médica", area: "CALIDAD", fecha: "2023-11-30", estado: "ACTIVO", detalle: { norma_iso: "ISO 13485", certificacion: "Vigente", fecha_auditoria: "2024-11-30" } },
  { codigo: "CL-002", descripcion: "Equipo de Calibración Electromédica", area: "CALIDAD", fecha: "2024-01-18", estado: "ACTIVO", detalle: { norma_iso: "ISO 17025", certificacion: "En revisión", fecha_auditoria: "2024-10-18" } },
  { codigo: "CD-001", descripcion: "AWS HealthLake Respaldo Clínico", area: "CLOUD", fecha: "2024-01-01", estado: "ACTIVO", detalle: { proveedor: "AWS", tipo_servicio: "HealthLake / Multi-AZ", capacidad: "20 TB" } },
  { codigo: "CD-002", descripcion: "Cloud Storage S3 Archivo Historias", area: "CLOUD", fecha: "2023-08-14", estado: "ACTIVO", detalle: { proveedor: "AWS", tipo_servicio: "S3 Glacier Backup", capacidad: "80 TB" } },
  { codigo: "BD-001", descripcion: "Cluster de Analítica Epidemiológica", area: "BIG DATA ANALITICAS", fecha: "2024-02-05", estado: "ACTIVO", detalle: { herramienta: "Apache Spark", tipo_dato: "Estadísticas de urgencias", volumen_datos: "2 TB" } },
  { codigo: "BD-002", descripcion: "Base de Datos Snowflake UCI", area: "BIG DATA ANALITICAS", fecha: "2023-11-15", estado: "ACTIVO", detalle: { herramienta: "Snowflake", tipo_dato: "Ocupación y camas", volumen_datos: "5 TB" } },
];

const AREA_DETAIL_RELATION = {
  HARDWARE: "hardware",
  SOFTWARE: "software",
  REDES: "redes",
  SEGURIDAD: "seguridad",
  CALIDAD: "calidad",
  CLOUD: "cloud",
  "BIG DATA ANALITICAS": "bigdata",
} as const;

async function main() {
  if (!PASSWORD_TEMPORAL || PASSWORD_TEMPORAL.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres");
  }
  for (const nombre of AREAS) {
    const categoria = await prisma.categoria.upsert({
      where: { nombre_categoria: nombre },
      update: {},
      create: { nombre_categoria: nombre },
    });

    const correo = `admin.${nombre.toLowerCase().replace(/\s+/g, "_")}@iatech.com`;
    const contrasena_hash = hashPassword(PASSWORD_TEMPORAL);

    await prisma.usuario.upsert({
      where: { correo },
      update: {},
      create: {
        nombre: `Admin ${nombre}`,
        correo,
        contrasena_hash,
        id_categoria: categoria.id_categoria,
        rol: "ADMIN",
      },
    });

    console.log(`Categoria "${nombre}" lista, admin: ${correo}`);
  }

  for (const activo of ACTIVOS_DEMO) {
    const categoria = await prisma.categoria.findUniqueOrThrow({
      where: { nombre_categoria: activo.area },
    });
    const relation = AREA_DETAIL_RELATION[activo.area as keyof typeof AREA_DETAIL_RELATION];
    const detail = Object.fromEntries(
      Object.entries(activo.detalle).map(([key, value]) => [
        key,
        key.startsWith("fecha_") ? new Date(String(value)) : value,
      ]),
    );

    await prisma.activo.upsert({
      where: { codigo: activo.codigo },
      update: {
        descripcion: activo.descripcion,
        id_categoria: categoria.id_categoria,
        fecha_registro: new Date(activo.fecha),
        estado: activo.estado,
        [relation]: { upsert: { create: detail, update: detail } },
      },
      create: {
        codigo: activo.codigo,
        descripcion: activo.descripcion,
        id_categoria: categoria.id_categoria,
        fecha_registro: new Date(activo.fecha),
        estado: activo.estado,
        [relation]: { create: detail },
      },
    });
    console.log(`Activo "${activo.codigo}" listo`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
