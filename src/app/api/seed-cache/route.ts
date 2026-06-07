import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [projects, campaigns, stations, species] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, name: true, region: true, commune: true, status: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      select: { id: true, projectId: true, name: true, surveyType: true, methodology: true, status: true, shermanTrapCount: true, cameraTrapCount: true },
      orderBy: { name: "asc" },
    }),
    prisma.station.findMany({
      select: { id: true, campaignId: true, name: true, parentId: true, latitude: true, longitude: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.species.findMany({
      select: { id: true, family: true, genus: true, species: true, commonName: true, type: true, conservationStatus: true },
      orderBy: { genus: "asc" },
    }),
  ]);

  return NextResponse.json({ projects, campaigns, stations, species });
}
