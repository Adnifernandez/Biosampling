// One-time runner: imports species from species-data.json into the database
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const speciesData = require("./species-data.json");

const prisma = new PrismaClient();

async function main() {
  console.log("Sembrando base de datos...");

  const hashedPassword = await bcrypt.hash("biosampling2024", 10);
  await prisma.user.upsert({
    where: { email: "admin@biosampling.cl" },
    update: {},
    create: {
      email: "admin@biosampling.cl",
      name: "Administrador",
      password: hashedPassword,
      active: true,
    },
  });
  console.log("✓ Usuario admin creado");

  console.log("Eliminando especies anteriores (y sus ocurrencias)...");
  await prisma.occurrence.deleteMany({});
  await prisma.species.deleteMany({});

  console.log(`Importando ${speciesData.length} especies del listado oficial...`);
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < speciesData.length; i += BATCH) {
    const batch = speciesData.slice(i, i + BATCH);
    await prisma.species.createMany({
      data: batch.map((sp) => ({
        id: sp.id,
        family: sp.family,
        genus: sp.genus,
        species: sp.species,
        commonName: sp.commonName ?? null,
        type: sp.type,
        conservationStatus: sp.conservationStatus ?? null,
        endemic: sp.endemic,
        origen: sp.origen ?? null,
        habito: sp.habito ?? null,
        macrofitasHabito: sp.macrofitasHabito ?? null,
        division: sp.division ?? null,
        clase: sp.clase ?? null,
        orden: sp.orden ?? null,
      })),
      skipDuplicates: true,
    });
    inserted += batch.length;
    process.stdout.write(`\r  ${inserted}/${speciesData.length} especies...`);
  }

  console.log(`\n✓ ${inserted} especies importadas`);
  console.log("\nDatos de acceso: admin@biosampling.cl / biosampling2024");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
