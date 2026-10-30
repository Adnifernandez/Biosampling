// Excel con el listado completo de especies (se arma en el navegador, igual que el Excel de Reportes)

type EspecieExportable = {
  type: string;
  division: string | null;
  clase: string | null;
  orden: string | null;
  family: string;
  genus: string;
  species: string;
  commonName: string | null;
  origen: string | null;
  endemic: boolean;
  conservationStatus: string | null;
  habito: string | null;
  macrofitasHabito: string | null;
  category: string | null;
  updatedAt: Date | string;
  createdBy: { name: string } | null;
  updatedBy: { name: string } | null;
  _count: { occurrences: number };
};

const COLUMNAS = [
  { header: "Tipo", key: "tipo", width: 8 },
  { header: "División", key: "division", width: 16 },
  { header: "Clase", key: "clase", width: 16 },
  { header: "Orden", key: "orden", width: 18 },
  { header: "Familia", key: "familia", width: 18 },
  { header: "Género", key: "genero", width: 16 },
  { header: "Epíteto específico", key: "epiteto", width: 18 },
  { header: "Nombre científico", key: "cientifico", width: 30 },
  { header: "Nombre común", key: "comun", width: 30 },
  { header: "Origen", key: "origen", width: 12 },
  { header: "Endémica", key: "endemica", width: 10 },
  { header: "Estado de conservación", key: "estado", width: 34 },
  { header: "Hábito", key: "habito", width: 14 },
  { header: "Hábito macrófitas", key: "macrofitas", width: 20 },
  { header: "Categoría", key: "categoria", width: 14 },
  { header: "N° registros", key: "registros", width: 12 },
  { header: "Agregada por", key: "agregada", width: 20 },
  { header: "Última edición por", key: "editada", width: 20 },
  { header: "Última actualización", key: "actualizada", width: 18 },
];

// Columnas con nombres científicos (van en cursiva)
const CURSIVA = new Set(["genero", "epiteto", "cientifico"]);

export async function crearLibroEspecies(especies: EspecieExportable[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Especies", { views: [{ state: "frozen", ySplit: 1 }] });
  // Formato por columna (no celda por celda): con ~2.500 especies es mucho más rápido
  const borde = { style: "thin" as const, color: { argb: "FF000000" } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };
  ws.columns = COLUMNAS.map((c) => ({
    ...c,
    style: { font: { name: "Tahoma", size: 10, italic: CURSIVA.has(c.key) }, border: bordes },
  }));

  for (const sp of especies) {
    ws.addRow({
      tipo: sp.type === "FAUNA" ? "Fauna" : "Flora",
      division: sp.division ?? "",
      clase: sp.clase ?? "",
      orden: sp.orden ?? "",
      familia: sp.family,
      genero: sp.genus,
      epiteto: sp.species,
      cientifico: `${sp.genus} ${sp.species}`.trim(),
      comun: sp.commonName ?? "",
      origen: sp.origen ?? "",
      endemica: sp.endemic ? "Sí" : "No",
      estado: sp.conservationStatus?.replace(/\s+/g, " ").trim() ?? "",
      habito: sp.habito ?? "",
      macrofitas: sp.macrofitasHabito ?? "",
      categoria: sp.category ?? "",
      registros: sp._count.occurrences,
      agregada: sp.createdBy?.name ?? "Listado inicial",
      editada: sp.updatedBy?.name ?? "",
      actualizada: new Date(sp.updatedAt).toLocaleDateString("es-CL"),
    });
  }

  // Encabezado con el mismo estilo que el Excel de Reportes: verde-azulado DSS, letra blanca
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF08697E" } };
    cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS.length } };
  return wb.xlsx.writeBuffer();
}

export async function exportarListadoEspecies(especies: EspecieExportable[]) {
  const buffer = await crearLibroEspecies(especies);
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Listado de especies BioSampling - ${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
