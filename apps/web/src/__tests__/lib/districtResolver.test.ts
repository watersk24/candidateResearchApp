/**
 * districtResolver tests (ADR-008)
 *
 * Covers:
 *  - censusToOcdIds(): Census Geocoder layers → OCD-IDs (real response shape
 *    captured 2026-10-03 for downtown Greenville, NC)
 *  - vintage-prefixed layer names, at-large and undefined districts, non-US points
 *  - resolveDistricts(): queries districts by OCD-ID and maps the result;
 *    propagates Census errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  district: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { censusToOcdIds, resolveDistricts } from "@/lib/districtResolver";

// Trimmed from a live Census Geocoder response for 35.6127, -77.3664
const GREENVILLE_NC = {
  "Incorporated Places": [{ GEOID: "3728080", BASENAME: "Greenville" }],
  Counties: [{ GEOID: "37147", BASENAME: "Pitt" }],
  "Unified School Districts": [{ GEOID: "3700012", BASENAME: "Pitt County Schools" }],
  States: [{ GEOID: "37", BASENAME: "North Carolina", STUSAB: "NC" }],
  "County Subdivisions": [{ GEOID: "3714791328", BASENAME: "Greenville" }],
  "2026 State Legislative Districts - Upper": [{ GEOID: "37005", BASENAME: "5" }],
  "120th Congressional Districts": [{ GEOID: "3703", BASENAME: "3" }],
  "2026 State Legislative Districts - Lower": [{ GEOID: "37008", BASENAME: "8" }],
  "Census Tracts": [{ GEOID: "37147000101", BASENAME: "1.01" }],
};

const NC = "ocd-division/country:us/state:nc";

describe("censusToOcdIds", () => {
  it("maps a North Carolina point to every division we key races on", () => {
    expect(censusToOcdIds(GREENVILLE_NC)).toEqual([
      "ocd-division/country:us",
      NC,
      `${NC}/cd:3`,
      `${NC}/sldu:5`,
      `${NC}/sldl:8`,
      `${NC}/county:pitt`,
      `${NC}/place:greenville`,
    ]);
  });

  it("returns nothing for a point outside the US (no States layer)", () => {
    expect(censusToOcdIds({})).toEqual([]);
  });

  it("prefers the newest congressional vintage when several are returned", () => {
    const ids = censusToOcdIds({
      States: [{ STUSAB: "NC" }],
      "118th Congressional Districts": [{ GEOID: "3701" }],
      "120th Congressional Districts": [{ GEOID: "3703" }],
    });
    expect(ids).toContain(`${NC}/cd:3`);
    expect(ids).not.toContain(`${NC}/cd:1`);
  });

  it("treats an at-large congressional district as the state itself", () => {
    const ids = censusToOcdIds({
      States: [{ STUSAB: "WY" }],
      "120th Congressional Districts": [{ GEOID: "5600" }],
    });
    expect(ids).toEqual(["ocd-division/country:us", "ocd-division/country:us/state:wy"]);
  });

  it("skips undefined legislative districts (ZZZ) and keeps alphanumeric codes", () => {
    const ids = censusToOcdIds({
      States: [{ STUSAB: "VT" }],
      "2026 State Legislative Districts - Upper": [{ GEOID: "50ZZZ" }],
      "2026 State Legislative Districts - Lower": [{ GEOID: "50CHI-1" }],
    });
    expect(ids).not.toContainEqual(expect.stringContaining("sldu"));
    expect(ids).toContain("ocd-division/country:us/state:vt/sldl:chi-1");
  });

  it("omits place when the point is in an unincorporated area", () => {
    const unincorporated = { ...GREENVILLE_NC, "Incorporated Places": undefined };
    expect(censusToOcdIds(unincorporated).some((id) => id.includes("/place:"))).toBe(false);
  });
});

describe("resolveDistricts", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    mockDb.district.findMany.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("looks up districts by the OCD-IDs Census returns", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: { geographies: GREENVILLE_NC } }),
    });
    mockDb.district.findMany.mockResolvedValue([
      {
        id: "d-1",
        name: "U.S. House — North Carolina District 3",
        level: "federal",
        districtType: "congressional",
        jurisdiction: { id: "j-us", name: "United States", type: "federal" },
      },
    ]);

    const result = await resolveDistricts(35.6127, -77.3664);

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
    expect(url.searchParams.get("x")).toBe("-77.3664");
    expect(url.searchParams.get("y")).toBe("35.6127");

    expect(mockDb.district.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ocdId: { in: expect.arrayContaining([`${NC}/cd:3`, `${NC}/county:pitt`]) } },
      })
    );
    expect(result).toEqual([
      {
        id: "d-1",
        name: "U.S. House — North Carolina District 3",
        level: "federal",
        districtType: "congressional",
        jurisdiction: { id: "j-us", name: "United States", type: "federal" },
      },
    ]);
  });

  it("returns an empty list without querying the DB for non-US points", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: { geographies: {} } }) });

    expect(await resolveDistricts(51.5, -0.12)).toEqual([]);
    expect(mockDb.district.findMany).not.toHaveBeenCalled();
  });

  it("throws when the Census Geocoder fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    await expect(resolveDistricts(35.6, -77.3)).rejects.toThrow("Census geocoder error: 503");
  });
});
