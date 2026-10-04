"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, FormEvent } from "react";

type Props = {
  initialQuery?: string;
};

export default function Nav({ initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      inputRef.current?.focus();
      return;
    }
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex items-center justify-between h-14 gap-4">
        <Link href="/" className="font-semibold text-slate-900 text-sm tracking-tight shrink-0">
          Candidate Research
        </Link>

        {/* Inline search — hidden on small screens */}
        <form onSubmit={handleSubmit} className="hidden sm:flex flex-1 max-w-xs">
          <div className="relative w-full">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search candidates..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </form>

        <nav className="flex items-center gap-4 sm:gap-6 text-sm text-slate-600 shrink-0">
          {/* Mobile search icon */}
          <Link
            href="/search"
            aria-label="Search candidates"
            className="sm:hidden text-slate-500 hover:text-slate-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </Link>
          <Link href="/rankings" className="hover:text-slate-900 transition-colors">
            State Rankings
          </Link>
          <Link href="/methodology" className="hover:text-slate-900 transition-colors hidden sm:inline">
            Methodology
          </Link>
        </nav>
      </div>
    </header>
  );
}
