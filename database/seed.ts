// Conserva/crea las siete areas y un administrador por area.
// El inventario queda vacio: ya no se insertan activos de demostracion.

import * as crypto from "crypto";
import * as dotenv from "dotenv";
import path from "path";

let prisma: (typeof import("./client"))["prisma"] | undefined;

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

async function main() {
  dotenv.config({ path: path.join(process.cwd(), ".env") });
  ({ prisma } = await import("./client"));

  const passwordTemporal = process.env.SEED_ADMIN_PASSWORD;
  if (!passwordTemporal || passwordTemporal.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres");
  }

  for (const nombre of AREAS) {
    const categoria = await prisma.categoria.upsert({
      where: { nombre_categoria: nombre },
      update: {},
      create: { nombre_categoria: nombre },
    });
    const correo = `admin.${nombre.toLowerCase().replace(/\s+/g, "_")}@iatech.com`;

    await prisma.usuario.upsert({
      where: { correo },
      update: {},
      create: {
        nombre: `Admin ${nombre}`,
        correo,
        contrasena_hash: hashPassword(passwordTemporal),
        id_categoria: categoria.id_categoria,
        rol: "ADMIN",
      },
    });

    console.log(`Area "${nombre}" lista, admin: ${correo}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
