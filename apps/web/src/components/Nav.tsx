import Link from "next/link";

export default function Nav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href="/" className="font-semibold text-slate-900 text-sm tracking-tight">
          Candidate Research
        </Link>
        <nav className="flex items-center gap-6 text-sm text-slate-600">
          <Link href="/rankings" className="hover:text-slate-900 transition-colors">
            State Rankings
          </Link>
          <Link href="/methodology" className="hover:text-slate-900 transition-colors">
            Methodology
          </Link>
        </nav>
      </div>
    </header>
  );
}
