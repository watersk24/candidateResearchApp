import { db } from "./db";

export type ResolvedDistrict = {
  id: string;
  name: string;
  level: string;
  districtType: string;
  jurisdiction: {
    id: string;
    name: string;
    type: string;
  };
};

/**
 * Resolve voting districts for a lat/lng coordinate.
 * Primary: Cicero API
 * Fallback: PostGIS spatial query against stored TIGER/Line geometries
 */
export async function resolveDistricts(lat: number, lng: number): Promise<ResolvedDistrict[]> {
  if (process.env.CICERO_API_KEY) {
    try {
      return await resolveViaCicero(lat, lng);
    } catch (error) {
      console.warn("Cicero API failed, falling back to PostGIS:", error);
    }
  }

  return resolveViaPostGIS(lat, lng);
}

async function resolveViaCicero(lat: number, lng: number): Promise<ResolvedDistrict[]> {
  const url = `https://www.cicerodata.com/api/v1/official?lat=${lat}&lon=${lng}&key=${process.env.CICERO_API_KEY}&type=NATIONAL_LOWER,NATIONAL_UPPER,STATE_LOWER,STATE_UPPER,LOCAL`;

  const response = await fetch(url, { next: { revalidate: 86400 } });

  if (!response.ok) {
    throw new Error(`Cicero API error: ${response.status}`);
  }

  const data = await response.json();

  // Cicero returns officials; extract their districts and upsert into our DB
  const districts: ResolvedDistrict[] = [];

  for (const official of data?.response?.results?.officials ?? []) {
    const office = official.office;
    if (!office) continue;

    // Upsert jurisdiction + district into our database for future use
    // (abbreviated; full upsert logic goes in a dedicated service)
    districts.push({
      id: office.district?.id?.toString() ?? "",
      name: office.title ?? office.name ?? "Unknown District",
      level: mapCiceroLevel(office.level),
      districtType: office.chamber ?? office.district_type ?? "unknown",
      jurisdiction: {
        id: office.district?.state ?? "",
        name: office.district?.state ?? "Unknown",
        type: mapCiceroLevel(office.level),
      },
    });
  }

  return districts;
}

async function resolveViaPostGIS(lat: number, lng: number): Promise<ResolvedDistrict[]> {
  // Raw query using PostGIS ST_Contains to find all districts whose geometry
  // contains the given point. Requires geometry column populated from TIGER/Line shapefiles.
  const results = await db.$queryRaw<
    Array<{
      id: string;
      name: string;
      level: string;
      district_type: string;
      jurisdiction_id: string;
      jurisdiction_name: string;
      jurisdiction_type: string;
    }>
  >`
    SELECT
      d.id,
      d.name,
      d.level,
      d.district_type,
      j.id AS jurisdiction_id,
      j.name AS jurisdiction_name,
      j.type AS jurisdiction_type
    FROM districts d
    JOIN jurisdictions j ON d.jurisdiction_id = j.id
    WHERE d.geometry IS NOT NULL
      AND ST_Contains(
        ST_SetSRID(ST_GeomFromGeoJSON(d.geometry::text), 4326),
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      )
    ORDER BY
      CASE d.level
        WHEN 'federal' THEN 1
        WHEN 'state' THEN 2
        WHEN 'local' THEN 3
      END
  `;

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    level: r.level,
    districtType: r.district_type,
    jurisdiction: {
      id: r.jurisdiction_id,
      name: r.jurisdiction_name,
      type: r.jurisdiction_type,
    },
  }));
}

function mapCiceroLevel(level: string): string {
  if (!level) return "local";
  const l = level.toUpperCase();
  if (l.includes("NATIONAL")) return "federal";
  if (l.includes("STATE")) return "state";
  return "local";
}
