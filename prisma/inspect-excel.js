// Prints the sheet names and first row (headers) of Listado Especies.xlsx
const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "..", "Listado Especies.xlsx");
const wb = XLSX.readFile(filePath);

console.log("=== Hojas disponibles ===");
wb.SheetNames.forEach((name) => console.log(" -", name));

const sheetName = wb.SheetNames.find((s) => s === "ESPECIE (2)") ?? wb.SheetNames[0];
console.log("\n=== Leyendo hoja:", sheetName, "===");

const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log("Columnas (fila 1):", rows[0]);
console.log("Ejemplo fila 2:  ", rows[1]);
console.log("Total filas (con header):", rows.length);
