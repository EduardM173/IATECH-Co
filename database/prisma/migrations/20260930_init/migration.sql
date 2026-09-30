-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "categoria" (
    "id_categoria" SERIAL NOT NULL,
    "nombre_categoria" VARCHAR(50) NOT NULL,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "activo" (
    "id_activo" SERIAL NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "fecha_registro" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "activo_pkey" PRIMARY KEY ("id_activo")
);

-- CreateTable
CREATE TABLE "hardware" (
    "id_activo" INTEGER NOT NULL,
    "numero_serie" VARCHAR(50) NOT NULL,
    "modelo" VARCHAR(50),
    "marca" VARCHAR(50),

    CONSTRAINT "hardware_pkey" PRIMARY KEY ("id_activo")
);

-- CreateTable
CREATE TABLE "software" (
    "id_activo" INTEGER NOT NULL,
    "version" VARCHAR(20),
    "tipo_licencia" VARCHAR(50),
    "fecha_expiracion" DATE,

    CONSTRAINT "software_pkey" PRIMARY KEY ("id_activo")
);

-- CreateTable
CREATE TABLE "redes" (
    "id_activo" INTEGER NOT NULL,
    "direccion_ip" VARCHAR(45),
    "tipo_conexion" VARCHAR(50),
    "ancho_banda" VARCHAR(30),

    CONSTRAINT "redes_pkey" PRIMARY KEY ("id_activo")
);

-- CreateTable
CREATE TABLE "seguridad" (
    "id_activo" INTEGER NOT NULL,
    "tipo_seguridad" VARCHAR(50),
    "nivel_acceso" VARCHAR(30),
    "protocolo" VARCHAR(50),

    CONSTRAINT "seguridad_pkey" PRIMARY KEY ("id_activo")
);

-- CreateTable
CREATE TABLE "calidad" (
    "id_activo" INTEGER NOT NULL,
    "norma_iso" VARCHAR(30),
    "certificacion" VARCHAR(50),
    "fecha_auditoria" DATE,

    CONSTRAINT "calidad_pkey" PRIMARY KEY ("id_activo")
);

-- CreateTable
CREATE TABLE "cloud" (
    "id_activo" INTEGER NOT NULL,
    "proveedor" VARCHAR(50),
    "tipo_servicio" VARCHAR(50),
    "capacidad" VARCHAR(30),

    CONSTRAINT "cloud_pkey" PRIMARY KEY ("id_activo")
);

-- CreateTable
CREATE TABLE "big_data_analiticas" (
    "id_activo" INTEGER NOT NULL,
    "herramienta" VARCHAR(50),
    "tipo_dato" VARCHAR(50),
    "volumen_datos" VARCHAR(30),

    CONSTRAINT "big_data_analiticas_pkey" PRIMARY KEY ("id_activo")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(100) NOT NULL,
    "contrasena_hash" VARCHAR(255) NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "rol" VARCHAR(20) NOT NULL DEFAULT 'USUARIO',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateIndex
CREATE UNIQUE INDEX "categoria_nombre_categoria_key" ON "categoria"("nombre_categoria");

-- CreateIndex
CREATE UNIQUE INDEX "activo_codigo_key" ON "activo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- AddForeignKey
ALTER TABLE "activo" ADD CONSTRAINT "activo_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware" ADD CONSTRAINT "hardware_id_activo_fkey" FOREIGN KEY ("id_activo") REFERENCES "activo"("id_activo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software" ADD CONSTRAINT "software_id_activo_fkey" FOREIGN KEY ("id_activo") REFERENCES "activo"("id_activo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redes" ADD CONSTRAINT "redes_id_activo_fkey" FOREIGN KEY ("id_activo") REFERENCES "activo"("id_activo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguridad" ADD CONSTRAINT "seguridad_id_activo_fkey" FOREIGN KEY ("id_activo") REFERENCES "activo"("id_activo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calidad" ADD CONSTRAINT "calidad_id_activo_fkey" FOREIGN KEY ("id_activo") REFERENCES "activo"("id_activo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud" ADD CONSTRAINT "cloud_id_activo_fkey" FOREIGN KEY ("id_activo") REFERENCES "activo"("id_activo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "big_data_analiticas" ADD CONSTRAINT "big_data_analiticas_id_activo_fkey" FOREIGN KEY ("id_activo") REFERENCES "activo"("id_activo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;
