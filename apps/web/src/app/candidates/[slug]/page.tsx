import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import CandidateProfile from "@/components/CandidateProfile";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const candidate = await db.candidate.findUnique({
    where: { profileSlug: slug },
    select: {
      fullName: true,
      party: true,
      election: { include: { district: true } },
    },
  });
  if (!candidate) return {};
  const party = candidate.party ? ` (${candidate.party})` : "";
  return {
    title: `${candidate.fullName}${party} — ${candidate.election.district.name} — Candidate Research`,
  };
}

export default async function CandidateProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const candidate = await db.candidate.findUnique({
    where: { profileSlug: slug },
    include: {
      election: {
        include: { district: { include: { jurisdiction: true } } },
      },
      votingRecords: { orderBy: { voteDate: "desc" } },
      campaignFinanceRecords: { orderBy: { filingPeriod: "desc" } },
      publicStatements: { orderBy: { statementDate: "desc" } },
      legalHistory: { orderBy: { caseDate: "desc" } },
      businessAffiliations: true,
      newsArticles: {
        include: { outlet: true },
        orderBy: { publishedAt: "desc" },
        take: 200,
      },
      ratings: true,
    },
  });

  if (!candidate) {
    notFound();
  }

  // Serialize to plain JSON to handle Prisma Decimal and Date types
  const data = JSON.parse(JSON.stringify(candidate));

  return (
    <>
      <Nav />
      <CandidateProfile candidate={data} />
    </>
  );
}
