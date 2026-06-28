"use client";

import { useState } from "react";

type Props = {
  onLocationGranted: (lat: number, lng: number) => void;
  onUseZip: () => void;
  onLocationDenied: () => void;
};

export default function LocationPermissionScreen({ onLocationGranted, onUseZip, onLocationDenied }: Props) {
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  function requestLocation() {
    if (!navigator.geolocation) {
      onLocationDenied();
      return;
    }

    setRequesting(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRequesting(false);
        onLocationGranted(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setRequesting(false);
        setDenied(true);
        onLocationDenied();
      },
      { timeout: 10000 }
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">Find your races</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            We use your location to show you every race on your ballot — federal, state,
            and local. No account required. Your location is never stored.
          </p>
        </div>

        {denied && (
          <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm mb-5">
            Location access was denied. Enter your zip code to continue.
          </p>
        )}

        <button
          onClick={requestLocation}
          disabled={requesting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm py-3 px-4 rounded-lg transition-colors mb-4"
        >
          {requesting ? "Requesting location..." : "Allow location access"}
        </button>

        <button
          onClick={onUseZip}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors underline underline-offset-2"
        >
          Enter my zip code instead
        </button>
      </div>
    </main>
  );
}
