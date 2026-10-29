// Llena la plantilla Word en el navegador (igual que el Excel, que también se arma aquí).
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { TipoReporte } from "./datos";

export type Figura = { clave: string; png: Uint8Array; ancho: number; alto: number };

const PLANTILLAS: Record<TipoReporte, string> = {
  FLORA: "/plantillas/reporte-flora.docx",
  FAUNA: "/plantillas/reporte-fauna.docx",
};

// Alto máximo de una figura dentro de la página (~19 cm)
const ALTO_MAX_EMU = 6_900_000;

// Pasa la imagen subida a PNG y la achica si es muy grande, para que el Word no pese demasiado.
export async function prepararFigura(clave: string, archivo: File): Promise<Figura> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 2000 / bitmap.width);
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo leer la imagen"))), "image/png")
  );
  return { clave, png: new Uint8Array(await blob.arrayBuffer()), ancho, alto };
}

// Cada figura de la plantilla es una imagen de ejemplo cuyo nombre es su clave (figArea, figEC…).
// Se reemplaza el archivo de esa imagen y se ajusta el tamaño a la proporción de la nueva.
function insertarFigura(zip: PizZip, figura: Figura) {
  let documento = zip.file("word/document.xml")!.asText();
  const dibujo = documento
    .match(/<w:drawing>[\s\S]*?<\/w:drawing>/g)
    ?.find((d) => d.includes(`name="${figura.clave}"`));
  if (!dibujo) return;

  const rId = dibujo.match(/r:embed="([^"]+)"/)?.[1];
  const rels = zip.file("word/_rels/document.xml.rels")!.asText();
  const relacion = rels.match(new RegExp(`<Relationship [^>]*Id="${rId}"[^>]*>`))?.[0];
  const destino = relacion?.match(/Target="([^"]+)"/)?.[1];
  if (!destino) return;
  zip.file(`word/${destino}`, figura.png);

  const anchoActual = Number(dibujo.match(/<wp:extent cx="(\d+)"/)?.[1]);
  let cx = anchoActual;
  let cy = Math.round((cx * figura.alto) / figura.ancho);
  if (cy > ALTO_MAX_EMU) {
    cx = Math.round((cx * ALTO_MAX_EMU) / cy);
    cy = ALTO_MAX_EMU;
  }
  const nuevo = dibujo
    .replace(/<wp:extent cx="\d+" cy="\d+"/, `<wp:extent cx="${cx}" cy="${cy}"`)
    .replace(/<a:ext cx="\d+" cy="\d+"/, `<a:ext cx="${cx}" cy="${cy}"`);
  documento = documento.replace(dibujo, nuevo);
  zip.file("word/document.xml", documento);
}

export function llenarPlantilla(plantilla: ArrayBuffer, datos: object, figuras: Figura[]): PizZip {
  const doc = new Docxtemplater(new PizZip(plantilla), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render({ ...datos, ...Object.fromEntries(figuras.map((f) => [f.clave, true])) });
  const zip = doc.getZip();
  for (const figura of figuras) insertarFigura(zip, figura);
  return zip;
}

export async function generarWord(tipo: TipoReporte, datos: object, figuras: Figura[]): Promise<Blob> {
  const res = await fetch(PLANTILLAS[tipo], { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar la plantilla del reporte");
  return llenarPlantilla(await res.arrayBuffer(), datos, figuras).generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
}
