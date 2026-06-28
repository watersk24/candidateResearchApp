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

  // Use the Census Geocoder API — free, no key required, US-only
  const url = `https://geocoding.geo.census.gov/geocoder/locations/address?benchmark=Public_AR_Current&format=json&zip=${zip}&street=&city=&state=`;

  const res = await fetch(url, { next: { revalidate: 86400 } });

  if (!res.ok) {
    return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
  }

  const data = await res.json();
  const addressMatches = data?.result?.addressMatches;

  if (!addressMatches || addressMatches.length === 0) {
    return NextResponse.json({ error: "Zip code not found" }, { status: 404 });
  }

  const match = addressMatches[0];
  const { x: lng, y: lat } = match.coordinates;
  const label = match.addressComponents?.zip
    ? `${match.addressComponents.city ?? ""}, ${match.addressComponents.state ?? ""}`.trim().replace(/^,\s*/, "")
    : zip;

  return NextResponse.json({ lat, lng, label, zip });
}
