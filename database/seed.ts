// database/seed.ts
// Crea las 7 categorias y un usuario ADMIN por cada area.
// Ejecutar con: pnpm run db:seed  (o node --experimental-strip-types seed.ts)

import { prisma } from "./client";
import * as bcrypt from "bcrypt";

const AREAS = [
  "HARDWARE",
  "SOFTWARE",
  "REDES",
  "SEGURIDAD",
  "CALIDAD",
  "CLOUD",
  "BIG DATA ANALITICAS",
];

const PASSWORD_TEMPORAL = "Admin123!"; // cambiar en el primer login

async function main() {
  for (const nombre of AREAS) {
    const categoria = await prisma.categoria.upsert({
      where: { nombre_categoria: nombre },
      update: {},
      create: { nombre_categoria: nombre },
    });

    const correo = `admin.${nombre.toLowerCase().replace(/\s+/g, "_")}@iatech.com`;
    const contrasena_hash = await bcrypt.hash(PASSWORD_TEMPORAL, 10);

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
