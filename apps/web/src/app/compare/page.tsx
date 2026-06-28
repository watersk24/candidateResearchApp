import { redirect, notFound } from "next/navigation";
import Nav from "@/components/Nav";
import { db } from "@/lib/db";
import ComparisonView from "@/components/ComparisonView";
import CandidateSelector from "@/components/CandidateSelector";

export const metadata = { title: "Compare Candidates — Candidate Research" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;

  if (!a) redirect("/");

  const candidateA = await fetchCandidate(a);
  if (!candidateA) notFound();

  // All candidates for the selector dropdowns (name + slug only)
  const allCandidates = await db.candidate.findMany({
    where: { status: { not: "withdrawn" } },
    select: {
      profileSlug: true,
      fullName: true,
      party: true,
      election: {
        select: {
          district: { select: { name: true } },
        },
      },
    },
    orderBy: { fullName: "asc" },
  });

  if (!b) {
    const sameRaceSlugs = (
      await db.candidate.findMany({
        where: {
          electionId: candidateA.electionId,
          profileSlug: { not: a },
          status: { not: "withdrawn" },
        },
        select: { profileSlug: true },
      })
    ).map((c) => c.profileSlug);

    return (
      <>
        <Nav />
        <CandidateSelector
          candidateA={JSON.parse(JSON.stringify(candidateA))}
          allCandidates={JSON.parse(JSON.stringify(allCandidates))}
          sameRaceSlugs={sameRaceSlugs}
          slugA={a}
        />
      </>
    );
  }

  if (a === b) redirect(`/compare?a=${a}`);

  const candidateB = await fetchCandidate(b);
  if (!candidateB) notFound();

  return (
    <>
      <Nav />
      <ComparisonView
        candidateA={JSON.parse(JSON.stringify(candidateA))}
        candidateB={JSON.parse(JSON.stringify(candidateB))}
        allCandidates={JSON.parse(JSON.stringify(allCandidates))}
        slugA={a}
        slugB={b}
      />
    </>
  );
}

async function fetchCandidate(slug: string) {
  return db.candidate.findUnique({
    where: { profileSlug: slug },
    include: {
      election: {
        include: { district: { include: { jurisdiction: true } } },
      },
      votingRecords: { orderBy: { voteDate: "desc" }, take: 5 },
      campaignFinanceRecords: { orderBy: { filingPeriod: "desc" }, take: 1 },
      legalHistory: { orderBy: { caseDate: "desc" } },
      businessAffiliations: true,
      newsArticles: { include: { outlet: true }, take: 200 },
      ratings: true,
    },
  });
}
