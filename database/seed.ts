// Crea las categorías y cuentas iniciales; nunca reemplaza contraseñas ni inventarios.
import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres");
  const { prisma } = await import("./client");
  try {
    for (const nombre of [
      "HARDWARE",
      "SOFTWARE",
      "REDES",
      "SEGURIDAD",
      "CALIDAD",
      "CLOUD",
      "BIG DATA ANALITICAS",
    ]) {
      const categoria = await prisma.categoria.upsert({
        where: { nombre_categoria: nombre },
        update: {},
        create: { nombre_categoria: nombre },
      });
      const correo =
        "admin." + nombre.toLowerCase().replace(/\s+/g, "_") + "@iatech.com";
      const salt = randomBytes(16).toString("hex");
      await prisma.usuario.upsert({
        where: { correo },
        update: {},
        create: {
          nombre: "Admin " + nombre,
          correo,
          contrasena_hash:
            salt + ":" + scryptSync(password, salt, 32).toString("hex"),
          id_categoria: categoria.id_categoria,
          rol: "ADMIN",
        },
      });
      console.log("Área y cuenta disponibles: " + nombre);
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
