// database/prisma7.config.ts
//
// OJO: Prisma busca por defecto un archivo llamado "prisma.config.ts".
// Si lo dejas con el nombre "prisma7.config.ts", vas a tener que pasar
// la bandera --config en cada comando, ej:
//   pnpm prisma migrate dev --config prisma7.config.ts
// Lo mas simple es renombrarlo a "prisma.config.ts" y asi el CLI
// lo detecta solo, sin bandera extra.

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
