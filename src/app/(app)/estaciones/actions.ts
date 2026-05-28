"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createEstaciones(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  const campaignId = formData.get("campaignId") as string;
  const type = formData.get("type") as "PARCELA" | "TRANSECTO";
  const sizeMode = formData.get("sizeMode") as "dimensions" | "area";
  const lengthVal = formData.get("length") as string | null;
  const widthVal = formData.get("width") as string | null;
  const areaVal = formData.get("area") as string | null;
  const quantityVal = formData.get("quantity") as string;
  const notes = (formData.get("notes") as string) || null;
  const latitudeVal = formData.get("latitude") as string | null;
  const longitudeVal = formData.get("longitude") as string | null;

  if (!campaignId || !type || !quantityVal) {
    return { error: "Faltan campos requeridos" };
  }

  const quantity = parseInt(quantityVal, 10);
  if (isNaN(quantity) || quantity < 1 || quantity > 20) {
    return { error: "La cantidad debe ser entre 1 y 20" };
  }

  const methodology = formData.get("methodology") as string | null;

  // Look up the campaign to get projectId
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, projectId: true, methodology: true, project: { select: { status: true } } },
  });
  if (!campaign) return { error: "Campaña no encontrada" };
  if (campaign.project?.status === "COMPLETED") return { error: "El proyecto está cerrado y no permite cambios" };

  // Get existing stations to determine next number
  const existingStations = await prisma.station.findMany({
    where: { campaignId },
    select: { name: true },
  });

  const effectiveMethodology = methodology ?? campaign.methodology;
  const isGrilla = effectiveMethodology === "GRILLA";

  const prefix =
    isGrilla ? "T"
    : type === "TRANSECTO" ? "T"
    : effectiveMethodology === "PARCELAS_FORESTALES" ? "PF"
    : effectiveMethodology === "MICRORUTEO" ? "R"
    : effectiveMethodology === "RESCATE_MICRORUTEO" ? "R"
    : "P";
  const regex = new RegExp(`^${prefix}(\\d+)$`);

  const stationsToCount = isGrilla
    ? existingStations.filter((s) => /^T\d+$/.test(s.name))
    : existingStations;

  let maxNum = 0;
  for (const s of stationsToCount) {
    const match = s.name.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNumber = maxNum + 1;

  // Calculate area
  let area: number | null = null;
  let length: number | null = null;
  let width: number | null = null;

  if (sizeMode === "dimensions") {
    length = lengthVal ? parseFloat(lengthVal) : null;
    width = widthVal ? parseFloat(widthVal) : null;
    if (length && width) area = length * width;
  } else {
    area = areaVal ? parseFloat(areaVal) : null;
  }

  const latitude = latitudeVal ? parseFloat(latitudeVal) : null;
  const longitude = longitudeVal ? parseFloat(longitudeVal) : null;

  if (isGrilla) {
    // Count existing grilla child stations to determine next G number
    const existingGrillas = await prisma.station.count({
      where: { campaignId, type: "GRILLA" },
    });

    // Create transectos + 4 grilla children each
    for (let i = 0; i < quantity; i++) {
      const transecto = await prisma.station.create({
        data: {
          campaignId,
          name: `T${nextNumber + i}`,
          type: "TRANSECTO",
          area,
          length,
          width,
          latitude,
          longitude,
          notes,
        },
      });
      const gOffset = existingGrillas + i * 4;
      await prisma.station.createMany({
        data: Array.from({ length: 4 }, (_, j) => ({
          campaignId,
          name: `G${gOffset + j + 1}`,
          type: "GRILLA",
          parentId: transecto.id,
        })),
      });
    }
  } else {
    // Regular station creation
    const stationsData = Array.from({ length: quantity }, (_, i) => ({
      campaignId,
      name: `${prefix}${nextNumber + i}`,
      type,
      area,
      length,
      width,
      latitude,
      longitude,
      notes,
    }));
    await prisma.station.createMany({ data: stationsData });
  }

  revalidatePath("/estaciones");
  revalidatePath(`/proyectos/${campaign.projectId}/campanas/${campaignId}`);

  return {
    success: true,
    projectId: campaign.projectId,
    campaignId,
    count: quantity,
  };
}
