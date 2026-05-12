import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SPECIES_DATA = [
  // ===== FLORA =====
  // Árboles nativos
  { family: "Araucariaceae", genus: "Araucaria", species: "araucana", commonName: "Pehuén / Araucaria", type: "FLORA", category: "Árbol nativo", conservationStatus: "VU", endemic: true },
  { family: "Fagaceae", genus: "Nothofagus", species: "obliqua", commonName: "Roble", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: false },
  { family: "Fagaceae", genus: "Nothofagus", species: "pumilio", commonName: "Lenga", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: false },
  { family: "Fagaceae", genus: "Nothofagus", species: "betuloides", commonName: "Coigüe de Magallanes", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: false },
  { family: "Fagaceae", genus: "Nothofagus", species: "dombeyi", commonName: "Coigüe", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: false },
  { family: "Myrtaceae", genus: "Luma", species: "apiculata", commonName: "Arrayán", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: false },
  { family: "Myrtaceae", genus: "Tepualia", species: "stipularis", commonName: "Tepú", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: true },
  { family: "Lauraceae", genus: "Persea", species: "lingue", commonName: "Lingue", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: false },
  { family: "Winteraceae", genus: "Drimys", species: "winteri", commonName: "Canelo", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: false },
  { family: "Proteaceae", genus: "Gevuina", species: "avellana", commonName: "Avellano", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: true },
  { family: "Proteaceae", genus: "Embothrium", species: "coccineum", commonName: "Notro / Ciruelillo", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: false },
  { family: "Podocarpaceae", genus: "Podocarpus", species: "salignus", commonName: "Mañío de hojas largas", type: "FLORA", category: "Árbol nativo", conservationStatus: "VU", endemic: true },
  { family: "Podocarpaceae", genus: "Saxegothaea", species: "conspicua", commonName: "Mañío macho", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: true },
  { family: "Rhamnaceae", genus: "Retanilla", species: "trinervia", commonName: "Tevo", type: "FLORA", category: "Arbusto nativo", conservationStatus: "LC", endemic: true },
  { family: "Myrtaceae", genus: "Myrceugenia", species: "planipes", commonName: "Petrillo", type: "FLORA", category: "Árbol nativo", conservationStatus: "LC", endemic: true },
  // Arbustos nativos
  { family: "Bromeliaceae", genus: "Puya", species: "berteroniana", commonName: "Chagual", type: "FLORA", category: "Arbusto nativo", conservationStatus: "LC", endemic: true },
  { family: "Solanaceae", genus: "Cestrum", species: "parqui", commonName: "Palqui", type: "FLORA", category: "Arbusto nativo", conservationStatus: "LC", endemic: false },
  { family: "Asteraceae", genus: "Baccharis", species: "linearis", commonName: "Romerillo", type: "FLORA", category: "Arbusto nativo", conservationStatus: "LC", endemic: false },
  { family: "Asteraceae", genus: "Flourensia", species: "thurifera", commonName: "Incienso", type: "FLORA", category: "Arbusto nativo", conservationStatus: "LC", endemic: true },
  { family: "Berberidaceae", genus: "Berberis", species: "darwinii", commonName: "Michay", type: "FLORA", category: "Arbusto nativo", conservationStatus: "LC", endemic: false },
  { family: "Philesiaceae", genus: "Lapageria", species: "rosea", commonName: "Copihue", type: "FLORA", category: "Enredadera nativa", conservationStatus: "NT", endemic: true },
  { family: "Cactaceae", genus: "Echinopsis", species: "chiloensis", commonName: "Quisco", type: "FLORA", category: "Cactus nativo", conservationStatus: "LC", endemic: true },
  { family: "Cactaceae", genus: "Copiapoa", species: "cinerea", commonName: "Copiapoa cinérea", type: "FLORA", category: "Cactus nativo", conservationStatus: "VU", endemic: true },
  // Hierbas nativas
  { family: "Alstroemeriaceae", genus: "Alstroemeria", species: "aurea", commonName: "Amancay", type: "FLORA", category: "Hierba nativa", conservationStatus: "LC", endemic: false },
  { family: "Iridaceae", genus: "Libertia", species: "grandiflora", commonName: "Calle-calle", type: "FLORA", category: "Hierba nativa", conservationStatus: "LC", endemic: true },
  { family: "Calceolariaceae", genus: "Calceolaria", species: "uniflora", commonName: "Capachito", type: "FLORA", category: "Hierba nativa", conservationStatus: "LC", endemic: false },
  { family: "Asteraceae", genus: "Leucanthemum", species: "vulgare", commonName: "Margarita", type: "FLORA", category: "Hierba introducida", conservationStatus: "LC", endemic: false },
  { family: "Poaceae", genus: "Nassella", species: "chilensis", commonName: "Coirón", type: "FLORA", category: "Gramínea nativa", conservationStatus: "LC", endemic: true },
  { family: "Bromeliaceae", genus: "Tillandsia", species: "landbeckii", commonName: "Clavel del aire", type: "FLORA", category: "Hierba nativa", conservationStatus: "LC", endemic: true },
  { family: "Apiaceae", genus: "Eryngium", species: "paniculatum", commonName: "Cardilla", type: "FLORA", category: "Hierba nativa", conservationStatus: "LC", endemic: true },
  // Helechos y musgos
  { family: "Blechnaceae", genus: "Blechnum", species: "chilense", commonName: "Costilla de vaca", type: "FLORA", category: "Helecho nativo", conservationStatus: "LC", endemic: false },
  { family: "Dicksoniaceae", genus: "Dicksonia", species: "antarctica", commonName: "Ampe / Palmilla", type: "FLORA", category: "Helecho arbóreo nativo", conservationStatus: "NT", endemic: false },
  // Árboles introducidos
  { family: "Pinaceae", genus: "Pinus", species: "radiata", commonName: "Pino insigne", type: "FLORA", category: "Árbol introducido", conservationStatus: "LC", endemic: false },
  { family: "Myrtaceae", genus: "Eucalyptus", species: "globulus", commonName: "Eucalipto", type: "FLORA", category: "Árbol introducido", conservationStatus: "LC", endemic: false },
  { family: "Salicaceae", genus: "Populus", species: "nigra", commonName: "Álamo negro", type: "FLORA", category: "Árbol introducido", conservationStatus: "LC", endemic: false },
  // ===== FAUNA =====
  // Aves
  { family: "Spheniscidae", genus: "Spheniscus", species: "humboldti", commonName: "Pingüino de Humboldt", type: "FAUNA", category: "Ave", conservationStatus: "VU", endemic: false },
  { family: "Spheniscidae", genus: "Spheniscus", species: "magellanicus", commonName: "Pingüino de Magallanes", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: false },
  { family: "Rheidae", genus: "Rhea", species: "pennata", commonName: "Suri / Ñandú del norte", type: "FAUNA", category: "Ave", conservationStatus: "VU", endemic: false },
  { family: "Phoenicopteridae", genus: "Phoenicopterus", species: "chilensis", commonName: "Flamenco chileno", type: "FAUNA", category: "Ave", conservationStatus: "NT", endemic: false },
  { family: "Phoenicopteridae", genus: "Phoenicoparrus", species: "andinus", commonName: "Parina grande", type: "FAUNA", category: "Ave", conservationStatus: "VU", endemic: false },
  { family: "Accipitridae", genus: "Geranoaetus", species: "melanoleucus", commonName: "Águila", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: false },
  { family: "Falconidae", genus: "Falco", species: "peregrinus", commonName: "Halcón peregrino", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: false },
  { family: "Psittacidae", genus: "Enicognathus", species: "ferrugineus", commonName: "Cachaña", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: true },
  { family: "Psittacidae", genus: "Enicognathus", species: "leptorhynchus", commonName: "Choroy", type: "FAUNA", category: "Ave", conservationStatus: "NT", endemic: true },
  { family: "Furnariidae", genus: "Cinclodes", species: "patagonicus", commonName: "Churrete", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: false },
  { family: "Rhinocryptidae", genus: "Pteroptochos", species: "tarnii", commonName: "Hued-hued del sur", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: true },
  { family: "Trochilidae", genus: "Sephanoides", species: "sephaniodes", commonName: "Picaflor chico", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: true },
  { family: "Laridae", genus: "Larus", species: "dominicanus", commonName: "Gaviota dominicana", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: false },
  { family: "Ardeidae", genus: "Ardea", species: "cocoi", commonName: "Garza cuca", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: false },
  { family: "Anatidae", genus: "Merganetta", species: "armata", commonName: "Pato de torrentes", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: false },
  { family: "Corvidae", genus: "Curaeus", species: "curaeus", commonName: "Tordo", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: true },
  { family: "Strigidae", genus: "Bubo", species: "magellanicus", commonName: "Tucúquere", type: "FAUNA", category: "Ave", conservationStatus: "LC", endemic: false },
  { family: "Cathartidae", genus: "Vultur", species: "gryphus", commonName: "Cóndor", type: "FAUNA", category: "Ave", conservationStatus: "VU", endemic: false },
  // Mamíferos
  { family: "Felidae", genus: "Puma", species: "concolor", commonName: "Puma", type: "FAUNA", category: "Mamífero", conservationStatus: "LC", endemic: false },
  { family: "Felidae", genus: "Leopardus", species: "guigna", commonName: "Güiña / Kodkod", type: "FAUNA", category: "Mamífero", conservationStatus: "VU", endemic: true },
  { family: "Felidae", genus: "Leopardus", species: "colocola", commonName: "Gato colocolo", type: "FAUNA", category: "Mamífero", conservationStatus: "LC", endemic: false },
  { family: "Canidae", genus: "Lycalopex", species: "culpaeus", commonName: "Zorro culpeo", type: "FAUNA", category: "Mamífero", conservationStatus: "LC", endemic: false },
  { family: "Canidae", genus: "Lycalopex", species: "griseus", commonName: "Zorro chilla", type: "FAUNA", category: "Mamífero", conservationStatus: "LC", endemic: false },
  { family: "Camelidae", genus: "Vicugna", species: "vicugna", commonName: "Vicuña", type: "FAUNA", category: "Mamífero", conservationStatus: "LC", endemic: false },
  { family: "Camelidae", genus: "Lama", species: "guanicoe", commonName: "Guanaco", type: "FAUNA", category: "Mamífero", conservationStatus: "LC", endemic: false },
  { family: "Cervidae", genus: "Hippocamelus", species: "bisulcus", commonName: "Huemul", type: "FAUNA", category: "Mamífero", conservationStatus: "EN", endemic: true },
  { family: "Cervidae", genus: "Pudu", species: "puda", commonName: "Pudú", type: "FAUNA", category: "Mamífero", conservationStatus: "VU", endemic: true },
  { family: "Mustelidae", genus: "Lontra", species: "provocax", commonName: "Huillín", type: "FAUNA", category: "Mamífero", conservationStatus: "EN", endemic: false },
  { family: "Mustelidae", genus: "Lontra", species: "felina", commonName: "Chungungo / Nutria de mar", type: "FAUNA", category: "Mamífero", conservationStatus: "EN", endemic: false },
  { family: "Chinchillidae", genus: "Chinchilla", species: "lanigera", commonName: "Chinchilla de cola corta", type: "FAUNA", category: "Mamífero", conservationStatus: "CR", endemic: true },
  { family: "Abrocomidae", genus: "Abrocoma", species: "bennettii", commonName: "Ratón chinchilla", type: "FAUNA", category: "Mamífero", conservationStatus: "NT", endemic: true },
  { family: "Delphinidae", genus: "Cephalorhynchus", species: "eutropia", commonName: "Delfín chileno", type: "FAUNA", category: "Mamífero marino", conservationStatus: "NT", endemic: true },
  // Reptiles
  { family: "Liolaemidae", genus: "Liolaemus", species: "nitidus", commonName: "Lagarto nítido", type: "FAUNA", category: "Reptil", conservationStatus: "LC", endemic: true },
  { family: "Liolaemidae", genus: "Liolaemus", species: "chiliensis", commonName: "Lagartija chilena", type: "FAUNA", category: "Reptil", conservationStatus: "LC", endemic: true },
  { family: "Colubridae", genus: "Philodryas", species: "chamissonis", commonName: "Culebra de cola larga", type: "FAUNA", category: "Reptil", conservationStatus: "LC", endemic: true },
  { family: "Teiidae", genus: "Callopistes", species: "palluma", commonName: "Iguana chilena", type: "FAUNA", category: "Reptil", conservationStatus: "VU", endemic: true },
  // Anfibios
  { family: "Rhinodermatidae", genus: "Rhinoderma", species: "darwinii", commonName: "Ranita de Darwin", type: "FAUNA", category: "Anfibio", conservationStatus: "VU", endemic: true },
  { family: "Rhinodermatidae", genus: "Rhinoderma", species: "rufum", commonName: "Ranita de Chile", type: "FAUNA", category: "Anfibio", conservationStatus: "CR", endemic: true },
  { family: "Calyptocephalellidae", genus: "Calyptocephalella", species: "gayi", commonName: "Rana grande del sur", type: "FAUNA", category: "Anfibio", conservationStatus: "VU", endemic: true },
  { family: "Batrachylidae", genus: "Batrachyla", species: "taeniata", commonName: "Ranita jaspeada", type: "FAUNA", category: "Anfibio", conservationStatus: "NT", endemic: true },
  { family: "Bufonidae", genus: "Rhinella", species: "spinulosa", commonName: "Sapo andino", type: "FAUNA", category: "Anfibio", conservationStatus: "LC", endemic: false },
  // Peces
  { family: "Percichthyidae", genus: "Percichthys", species: "trucha", commonName: "Perca / Trucha criolla", type: "FAUNA", category: "Pez", conservationStatus: "VU", endemic: true },
  { family: "Galaxiidae", genus: "Galaxias", species: "maculatus", commonName: "Puye", type: "FAUNA", category: "Pez", conservationStatus: "LC", endemic: false },
  { family: "Aplocheilidae", genus: "Orestias", species: "ascotanensis", commonName: "Pez del Ascotán", type: "FAUNA", category: "Pez", conservationStatus: "CR", endemic: true },
];

async function main() {
  console.log("Sembrando base de datos...");

  // Admin user
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

  // Species
  let count = 0;
  for (const sp of SPECIES_DATA) {
    await prisma.species.upsert({
      where: { id: `${sp.genus}_${sp.species}`.toLowerCase().replace(/\s/g, "_") },
      update: {},
      create: {
        id: `${sp.genus}_${sp.species}`.toLowerCase().replace(/\s/g, "_"),
        ...sp,
      },
    });
    count++;
  }
  console.log(`✓ ${count} especies creadas`);

  console.log("\nDatos de acceso:");
  console.log("  Email:    admin@biosampling.cl");
  console.log("  Password: biosampling2024");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
