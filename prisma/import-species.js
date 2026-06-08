/**
 * Lee la hoja "ESPECIE (2)" de "Listado Especies.xlsx" y sobreescribe
 * prisma/species-data.json con los datos normalizados.
 *
 * Ejecutar:
 *   node prisma/import-species.js
 */
const XLSX = require("xlsx");
const fs   = require("fs");
const path = require("path");

const SHEET = "ESPECIE (2)";
const xlsxPath = path.join(__dirname, "..", "Listado Especies.xlsx");
const outPath  = path.join(__dirname, "species-data.json");

const wb = XLSX.readFile(xlsxPath);

if (!wb.SheetNames.includes(SHEET)) {
  console.error(`Error: la hoja "${SHEET}" no existe en el Excel.`);
  console.error("Hojas disponibles:", wb.SheetNames.join(", "));
  process.exit(1);
}

const ws   = wb.Sheets[SHEET];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

// Row 0 = headers, rows 1+ = data
const [headers, ...dataRows] = rows;
console.log("Columnas detectadas:", headers);

function col(row, name) {
  const idx = headers.indexOf(name);
  if (idx === -1) return undefined;
  const v = row[idx];
  return v === undefined || v === null || v === "" ? null : v;
}

const species = dataRows
  .filter((row) => {
    if (!row.length || !col(row, "IDESPECIE")) return false;
    // Descartar filas sin familia, género o epíteto (placeholders como "Sin Captura")
    if (!col(row, "FAMILIA") || !col(row, "GENERO") || !col(row, "EPÍTETO ESPECÍFICO")) return false;
    return true;
  })
  .map((row) => {
    const origen = col(row, "ORIGEN") ?? null;
    // LIMNO (macrófitas acuáticas) se agrupa bajo FLORA para las búsquedas de campaña
    const tipoRaw = (col(row, "TIPO") ?? "").toString().toUpperCase();
    const tipo = tipoRaw === "LIMNO" ? "FLORA" : tipoRaw;

    return {
      id:                 String(col(row, "IDESPECIE")),
      family:             col(row, "FAMILIA")              ?? null,
      genus:              col(row, "GENERO")               ?? null,
      species:            col(row, "EPÍTETO ESPECÍFICO")   ?? null,
      commonName:         col(row, "NOMBRE COMÚN")         ?? null,
      type:               tipo || null,
      conservationStatus: col(row, "ESTADO CONSERVACIÓN")  ?? null,
      endemic:            origen === "Endémico",
      origen,
      habito:             col(row, "HABITO")               ?? null,
      macrofitasHabito:   col(row, "MACROFITAS_HABITO")    ?? null,
      division:           col(row, "FILO_DIVISION")        ?? null,
      clase:              col(row, "CLASE")                ?? null,
      orden:              col(row, "ORDEN")                ?? null,
    };
  });

fs.writeFileSync(outPath, JSON.stringify(species), "utf8");

console.log(`\n✓ ${species.length} especies exportadas → prisma/species-data.json`);
console.log("  Tipos:", [...new Set(species.map((s) => s.type))].join(", "));
console.log("  Endémicas:", species.filter((s) => s.endemic).length);
