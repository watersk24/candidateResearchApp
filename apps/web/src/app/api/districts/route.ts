import { NextRequest, NextResponse } from "next/server";
import { resolveDistricts } from "@/lib/districtResolver";
import { z } from "zod";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const parsed = querySchema.safeParse({
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "lat and lng query parameters are required and must be valid coordinates" },
      { status: 400 }
    );
  }

  const { lat, lng } = parsed.data;

  try {
    const districts = await resolveDistricts(lat, lng);
    return NextResponse.json({ lat, lng, districts });
  } catch (error) {
    console.error("District resolution error:", error);
    return NextResponse.json(
      { error: "Failed to resolve districts for the given coordinates" },
      { status: 500 }
    );
  }
}
