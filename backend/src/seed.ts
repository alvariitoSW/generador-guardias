import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./prismaClient";

async function main() {
  const service = await prisma.service.upsert({
    where: { name: "Urgencias" },
    create: {
      name: "Urgencias",
      posts: {
        create: [
          { name: "P1", slotsPerDay: 2, order: 0 },
          { name: "P2", slotsPerDay: 2, order: 1 },
          { name: "P3", slotsPerDay: 2, order: 2 },
          { name: "P4", slotsPerDay: 2, order: 3 },
        ],
      },
    },
    update: {},
  });
  console.log(`Servicio "Urgencias" listo (${service.id}) con puertas P1-P4.`);

  const adminEmail = "admin@guardias.local";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin1234", 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Administrador",
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(`Usuario admin creado: ${adminEmail} / admin1234 (cámbialo tras el primer login)`);
  } else {
    console.log("El usuario admin ya existía, no se ha modificado.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
