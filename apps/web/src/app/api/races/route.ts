import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const querySchema = z.object({
  districtIds: z.string().transform((s) => s.split(",").filter(Boolean)),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const parsed = querySchema.safeParse({
    districtIds: searchParams.get("districtIds") ?? "",
  });

  if (!parsed.success || parsed.data.districtIds.length === 0) {
    return NextResponse.json(
      { error: "districtIds query parameter is required (comma-separated)" },
      { status: 400 }
    );
  }

  const { districtIds } = parsed.data;

  const elections = await db.election.findMany({
    where: {
      districtId: { in: districtIds },
      status: { in: ["upcoming", "active"] },
    },
    include: {
      district: {
        include: { jurisdiction: true },
      },
      candidates: {
        where: { status: { not: "withdrawn" } },
        include: { ratings: true },
        orderBy: { fullName: "asc" },
      },
    },
    orderBy: [{ electionDate: "asc" }],
  });

  return NextResponse.json({ elections });
}
