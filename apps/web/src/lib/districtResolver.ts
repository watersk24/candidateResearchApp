import { db } from "./db";
import { OCD_US, ocdSegment, ocdState } from "./ocd";

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

// U.S. Census Geocoder: free, no key. Returns the Census geographies (state,
// congressional and state legislative districts, county, place, ...) that
// contain a coordinate (ADR-008).
const CENSUS_GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
const CENSUS_TIMEOUT_MS = 8_000;

type CensusGeography = { GEOID?: string; BASENAME?: string; STUSAB?: string };
type CensusGeographies = Record<string, CensusGeography[] | undefined>;

/** Census district code → OCD segment: "03" → "3"; "ZZZ" (undefined area) → null. */
function districtCode(geoid: string | undefined): string | null {
  if (!geoid || geoid.length <= 2) return null;
  const code = geoid.slice(2).replace(/^0+/, "").toLowerCase();
  return code && !/^z+$/.test(code) ? code : null;
}

/**
 * Converts a Census Geocoder `geographies` object to OCD division IDs.
 * Layer names carry a vintage prefix (e.g. "120th Congressional Districts",
 * "2026 State Legislative Districts - Upper"), so they are matched by suffix.
 */
export function censusToOcdIds(geographies: CensusGeographies): string[] {
  const layer = (pattern: RegExp): CensusGeography | undefined => {
    const keys = Object.keys(geographies)
      .filter((k) => pattern.test(k))
      // Prefer the newest vintage when several are returned
      .sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));
    return keys.length > 0 ? geographies[keys[0]]?.[0] : undefined;
  };

  const state = layer(/^States$/)?.STUSAB;
  if (!state) return [];

  const base = ocdState(state);
  const ids = [OCD_US, base];

  // An at-large congressional district ("00") is the state itself, already included
  const cd = districtCode(layer(/Congressional Districts$/)?.GEOID);
  if (cd) ids.push(`${base}/cd:${cd}`);

  const upper = districtCode(layer(/State Legislative Districts - Upper$/)?.GEOID);
  if (upper) ids.push(`${base}/sldu:${upper}`);

  const lower = districtCode(layer(/State Legislative Districts - Lower$/)?.GEOID);
  if (lower) ids.push(`${base}/sldl:${lower}`);

  const county = layer(/^Counties$/)?.BASENAME;
  if (county) ids.push(`${base}/county:${ocdSegment(county)}`);

  const place = layer(/^Incorporated Places$/)?.BASENAME;
  if (place) ids.push(`${base}/place:${ocdSegment(place)}`);

  return ids;
}

// 4 decimal places ≈ 11 m: far finer than any district boundary we resolve,
// coarse enough that the response cache is reused and can't be trivially
// bypassed with tiny coordinate changes.
function roundCoord(value: number): string {
  return value.toFixed(4);
}

async function lookupOcdIds(lat: number, lng: number): Promise<string[]> {
  const params = new URLSearchParams({
    x: roundCoord(lng),
    y: roundCoord(lat),
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    layers: "all",
    format: "json",
  });

  const response = await fetch(`${CENSUS_GEOCODER_URL}?${params}`, {
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(CENSUS_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Census geocoder error: ${response.status}`);
  }

  const data = await response.json();
  return censusToOcdIds(data?.result?.geographies ?? {});
}

/** Resolves every district we hold races for that contains the coordinate. */
export async function resolveDistricts(lat: number, lng: number): Promise<ResolvedDistrict[]> {
  const ocdIds = await lookupOcdIds(lat, lng);
  if (ocdIds.length === 0) return [];

  const districts = await db.district.findMany({
    where: { ocdId: { in: ocdIds } },
    include: { jurisdiction: true },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });

  return districts.map((d) => ({
    id: d.id,
    name: d.name,
    level: d.level,
    districtType: d.districtType,
    jurisdiction: {
      id: d.jurisdiction.id,
      name: d.jurisdiction.name,
      type: d.jurisdiction.type,
    },
  }));
}
