import Nav from "@/components/Nav";

export const metadata = { title: "State Data Accessibility Rankings — Candidate Research" };

export default function RankingsPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900 mb-3">State Data Accessibility Rankings</h1>
        <p className="text-slate-500 text-sm leading-relaxed max-w-prose">
          Rankings will appear here once the data pipeline is running. Each state is scored on
          whether candidate and election data is publicly available, machine-readable, accessible
          without authentication, and updated in a timely manner.
        </p>
      </main>
    </>
  );
}
