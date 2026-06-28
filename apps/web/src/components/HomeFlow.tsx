"use client";

import { useState } from "react";
import LocationPermissionScreen from "./LocationPermissionScreen";
import ZipCodeFallback from "./ZipCodeFallback";
import Dashboard from "./Dashboard";

type Screen = "permission" | "zipcode" | "loading" | "dashboard" | "error";

export type ResolvedDistrict = {
  id: string;
  name: string;
  level: string;
  districtType: string;
  jurisdiction: { id: string; name: string; type: string };
};

export type Election = {
  id: string;
  name: string;
  electionType: string;
  electionDate: string;
  status: string;
  district: {
    name: string;
    level: string;
    jurisdiction: { name: string };
  };
  candidates: {
    id: string;
    fullName: string;
    party: string | null;
    status: string;
    profileSlug: string;
    hasLimitedData: boolean;
    ratings: { transparencyScore: number | null } | null;
  }[];
};

export default function HomeFlow() {
  const [screen, setScreen] = useState<Screen>("permission");
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [districts, setDistricts] = useState<ResolvedDistrict[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [loadingMessage, setLoadingMessage] = useState("Finding your districts...");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLocationGranted(lat: number, lng: number) {
    setLoadingMessage("Finding your districts...");
    setScreen("loading");

    try {
      const districtRes = await fetch(`/api/districts?lat=${lat}&lng=${lng}`);
      if (!districtRes.ok) throw new Error("District resolution failed");
      const districtData = await districtRes.json();
      const resolvedDistricts: ResolvedDistrict[] = districtData.districts;

      if (resolvedDistricts.length === 0) {
        setDistricts([]);
        setElections([]);
        setLocationLabel(formatLocationLabel(lat, lng));
        setScreen("dashboard");
        return;
      }

      setLoadingMessage("Loading your races...");
      const ids = resolvedDistricts.map((d) => d.id).join(",");
      const racesRes = await fetch(`/api/races?districtIds=${ids}`);
      if (!racesRes.ok) throw new Error("Races fetch failed");
      const racesData = await racesRes.json();

      setDistricts(resolvedDistricts);
      setElections(racesData.elections);
      setLocationLabel(buildLocationLabel(resolvedDistricts));
      setScreen("dashboard");
    } catch {
      setErrorMessage("We couldn't load races for your location. Please try again.");
      setScreen("error");
    }
  }

  async function handleZipSubmit(zip: string) {
    setLoadingMessage("Finding your districts...");
    setScreen("loading");

    try {
      const geoRes = await fetch(`/api/geocode?zip=${zip}`);
      if (!geoRes.ok) throw new Error("Geocode failed");
      const { lat, lng, label } = await geoRes.json();
      setLocationLabel(label);
      await handleLocationGranted(lat, lng);
      if (label) setLocationLabel(label);
    } catch {
      setErrorMessage("We couldn't find races for that zip code. Please check the zip code and try again.");
      setScreen("error");
    }
  }

  if (screen === "permission") {
    return (
      <LocationPermissionScreen
        onLocationGranted={handleLocationGranted}
        onUseZip={() => setScreen("zipcode")}
        onLocationDenied={() => setScreen("zipcode")}
      />
    );
  }

  if (screen === "zipcode") {
    return (
      <ZipCodeFallback
        onSubmit={handleZipSubmit}
        onBack={() => setScreen("permission")}
      />
    );
  }

  if (screen === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 mb-4" />
          <p className="text-slate-600 text-sm">{loadingMessage}</p>
        </div>
      </main>
    );
  }

  if (screen === "error") {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-slate-800 font-medium mb-2">Something went wrong</p>
          <p className="text-slate-500 text-sm mb-6">{errorMessage}</p>
          <button
            onClick={() => setScreen("permission")}
            className="text-sm text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <Dashboard
      locationLabel={locationLabel}
      districts={districts}
      elections={elections}
      onRefineLocation={() => setScreen("zipcode")}
    />
  );
}

function buildLocationLabel(districts: ResolvedDistrict[]): string {
  const stateDistrict = districts.find((d) => d.level === "state");
  const jurisdiction = stateDistrict?.jurisdiction.name ?? districts[0]?.jurisdiction.name ?? "";
  return jurisdiction;
}

function formatLocationLabel(lat: number, lng: number): string {
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}
