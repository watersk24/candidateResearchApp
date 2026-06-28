import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    zip: request.nextUrl.searchParams.get("zip"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "zip must be a 5-digit US zip code" }, { status: 400 });
  }

  const { zip } = parsed.data;

  // Zippopotam.us — free, no key required, US zip code centroids
  const url = `https://api.zippopotam.us/us/${zip}`;

  const res = await fetch(url, { next: { revalidate: 86400 } });

  if (res.status === 404) {
    return NextResponse.json({ error: "Zip code not found" }, { status: 404 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
  }

  const data = await res.json();
  const place = data?.places?.[0];

  if (!place) {
    return NextResponse.json({ error: "Zip code not found" }, { status: 404 });
  }

  const lat = parseFloat(place.latitude);
  const lng = parseFloat(place.longitude);
  const label = `${place["place name"]}, ${place["state abbreviation"]}`;

  return NextResponse.json({ lat, lng, label, zip });
}
