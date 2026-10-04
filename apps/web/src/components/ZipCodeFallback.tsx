"use client";

import { useState } from "react";

type Props = {
  onSubmit: (zip: string) => void;
  onBack: () => void;
};

export default function ZipCodeFallback({ onSubmit, onBack }: Props) {
  const [zip, setZip] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = zip.trim();

    if (!/^\d{5}$/.test(trimmed)) {
      setError("Please enter a valid 5-digit US zip code.");
      return;
    }

    setError("");
    setLoading(true);
    onSubmit(trimmed);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>

        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Enter your zip code</h1>
        <p className="text-slate-500 text-sm mb-6">
          We&apos;ll use this to find all races in your area. Your zip code is not stored.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="12345"
            value={zip}
            onChange={(e) => {
              setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
              if (error) setError("");
            }}
            className={`w-full border rounded-lg px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1 ${
              error ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
            }`}
            autoFocus
          />
          {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
          {!error && <div className="mb-3" />}

          <button
            type="submit"
            disabled={loading || zip.length !== 5}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? "Finding races..." : "Find my races"}
          </button>
        </form>
      </div>
    </main>
  );
}
