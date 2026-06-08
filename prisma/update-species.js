/**
 * Actualiza la tabla Species en la base de datos desde species-data.json
 * usando upsert — NO borra ocurrencias ni otros datos existentes.
 *
 * Ejecutar:
 *   node prisma/update-species.js
 */
const { PrismaClient } = require("@prisma/client");
const speciesData = require("./species-data.json");

const prisma = new PrismaClient();

async function main() {
  console.log(`Actualizando ${speciesData.length} especies...`);

  const BATCH = 100;
  let updated = 0;

  for (let i = 0; i < speciesData.length; i += BATCH) {
    const batch = speciesData.slice(i, i + BATCH);
    await Promise.all(
      batch.map((sp) =>
        prisma.species.upsert({
          where: { id: sp.id },
          update: {
            family:             sp.family,
            genus:              sp.genus,
            species:            sp.species,
            commonName:         sp.commonName ?? null,
            type:               sp.type,
            conservationStatus: sp.conservationStatus ?? null,
            endemic:            sp.endemic,
            origen:             sp.origen ?? null,
            habito:             sp.habito ?? null,
            macrofitasHabito:   sp.macrofitasHabito ?? null,
            division:           sp.division ?? null,
            clase:              sp.clase ?? null,
            orden:              sp.orden ?? null,
          },
          create: {
            id:                 sp.id,
            family:             sp.family,
            genus:              sp.genus,
            species:            sp.species,
            commonName:         sp.commonName ?? null,
            type:               sp.type,
            conservationStatus: sp.conservationStatus ?? null,
            endemic:            sp.endemic,
            origen:             sp.origen ?? null,
            habito:             sp.habito ?? null,
            macrofitasHabito:   sp.macrofitasHabito ?? null,
            division:           sp.division ?? null,
            clase:              sp.clase ?? null,
            orden:              sp.orden ?? null,
          },
        })
      )
    );
    updated += batch.length;
    process.stdout.write(`\r  ${updated}/${speciesData.length}`);
  }

  console.log(`\n✓ ${updated} especies actualizadas en la base de datos`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
