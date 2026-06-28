import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const candidate = await db.candidate.findUnique({
    where: { profileSlug: slug },
    include: {
      election: {
        include: {
          district: { include: { jurisdiction: true } },
        },
      },
      votingRecords: { orderBy: { voteDate: "desc" }, take: 50 },
      campaignFinanceRecords: { orderBy: { filingPeriod: "desc" } },
      publicStatements: { orderBy: { statementDate: "desc" }, take: 20 },
      legalHistory: { orderBy: { caseDate: "desc" } },
      businessAffiliations: true,
      newsArticles: {
        include: { outlet: true },
        orderBy: { publishedAt: "desc" },
        take: 100,
      },
      ratings: true,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  return NextResponse.json({ candidate });
}
