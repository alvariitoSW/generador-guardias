import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./prismaClient";

const RESIDENT_ROSTER = [
  "Alejandro Rguez", "Simone", "Antonio C", "Sofia", "Faya", "Geneva", "Emilio Hdez",
  "Alejandro Ramírez", "Sheila", "Marta D", "Miguel Liria", "Chema", "Patricia C",
  "Cinthya", "Nerea H", "Aythami", "Coral", "Carmen R", "Navya", "Miriam Guerra",
  "Rocio", "Marta S", "Alejandro Alemán", "Alejandro G", "Martín", "Alexia", "M Carmen",
  "Paula Azn", "Nerea T", "Hadriel", "Isaac", "Gara", "Pedro", "Cristian Sarmiento",
  "Javier Garcia", "Carla Santana", "Ines", "Paula León", "Claudia", "Erick García",
  "Julia Rguez", "Gabriela", "Laura Manz", "Benjamin", "Jose Juan", "Victor", "Jose C M",
  "Alberto C", "Esther", "Carlota M", "Miguel García", "Almudena", "Ana B", "Yael",
  "Alberto de Galdo", "Anabel Gil", "Carolina Kozlowski", "Carlota Rguez", "Sarah Pérez",
  "Maira Daza", "Isabel Medina", "Yeiko Suárez", "Cristian Santana", "Marta T",
  "Jose Medina", "Marta Ceada", "Pepa", "Alejandro M", "Ana Hdez", "J Juan", "Laura Bernal",
];

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
        isPrimaryAdmin: true,
      },
    });
    console.log(`Usuario admin creado: ${adminEmail} / admin1234 (cámbialo tras el primer login)`);
  } else {
    // Asegura que siga siendo el admin principal aunque la cuenta ya existiera de antes.
    if (!existingAdmin.isPrimaryAdmin) {
      await prisma.user.update({ where: { id: existingAdmin.id }, data: { isPrimaryAdmin: true } });
    }
    console.log("El usuario admin ya existía; confirmado como admin principal.");
  }

  let created = 0;
  for (const fullName of RESIDENT_ROSTER) {
    const result = await prisma.rosterName.upsert({
      where: { fullName },
      create: { fullName },
      update: {},
    });
    if (result.createdAt.getTime() > Date.now() - 5000) created++;
  }
  console.log(`Lista de residentes lista (${RESIDENT_ROSTER.length} nombres, ${created} nuevos).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
