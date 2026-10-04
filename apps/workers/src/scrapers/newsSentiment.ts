import axios from "axios";
import { SentimentLabel } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { searchArticles, extractDomain } from "../lib/newsapi.js";

interface SentimentResult {
  label: SentimentLabel;
  score: number;
  positive: number;
  negative: number;
  neutral: number;
}

async function analyzeSentiment(
  articleId: string,
  text: string
): Promise<SentimentResult | null> {
  const baseUrl = process.env.SENTIMENT_API_URL ?? "http://localhost:8080";
  try {
    const response = await axios.post<SentimentResult & { article_id: string }>(
      `${baseUrl}/analyze`,
      { article_id: articleId, text },
      { timeout: 10_000 }
    );
    return response.data;
  } catch (err) {
    console.warn(`[newsSentiment] sentiment service error: ${(err as Error).message}`);
    return null;
  }
}

export async function scrapeNewsSentiment(candidateId: string): Promise<void> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      election: true,
    },
  });

  if (!candidate) {
    console.warn(`[newsSentiment] candidate ${candidateId} not found`);
    return;
  }

  // NewsAPI free tier requires articles from no more than 1 month ago.
  // Use election cycle start or 30 days ago, whichever is more recent.
  const cycleStart = candidate.election.electionCycleStart;
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
  const fromDate = cycleStart > oneMonthAgo
    ? cycleStart.toISOString().split("T")[0]
    : oneMonthAgo.toISOString().split("T")[0];

  console.log(
    `[newsSentiment] fetching articles for "${candidate.fullName}" from ${fromDate}`
  );

  const articles = await searchArticles(candidate.fullName, fromDate);
  console.log(
    `[newsSentiment] ${articles.length} articles found for "${candidate.fullName}"`
  );

  if (articles.length === 0) {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { lastRefreshedAt: new Date(), dataIsStale: false },
    });
    return;
  }

  // Pre-fetch all known outlets keyed by domain for fast lookup
  const knownOutlets = await prisma.newsOutlet.findMany();
  const outletByDomain = new Map(knownOutlets.map((o) => [o.domain, o]));

  const records: Array<{
    candidateId: string;
    outletId: string;
    headline: string;
    articleUrl: string;
    publishedAt: Date;
    sentiment: SentimentLabel | null;
    sentimentScore: number | null;
    sentimentPositive: number | null;
    sentimentNegative: number | null;
    sentimentNeutral: number | null;
    analyzedAt: Date | null;
  }> = [];

  for (const article of articles) {
    if (!article.url || !article.title) continue;

    const domain = extractDomain(article.url);
    if (!domain) continue;

    const outlet = outletByDomain.get(domain);
    if (!outlet) {
      // Skip articles from outlets not in our classified list
      continue;
    }

    const publishedAt = new Date(article.publishedAt);
    if (isNaN(publishedAt.getTime())) continue;

    // Analyze headline + description; fall back to headline alone
    const textToAnalyze = [article.title, article.description]
      .filter(Boolean)
      .join(" ")
      .trim();

    const sentiment = textToAnalyze
      ? await analyzeSentiment(article.url, textToAnalyze)
      : null;

    records.push({
      candidateId,
      outletId: outlet.id,
      headline: article.title,
      articleUrl: article.url,
      publishedAt,
      sentiment: sentiment?.label ?? null,
      sentimentScore: sentiment?.score ?? null,
      sentimentPositive: sentiment?.positive ?? null,
      sentimentNegative: sentiment?.negative ?? null,
      sentimentNeutral: sentiment?.neutral ?? null,
      analyzedAt: sentiment ? new Date() : null,
    });
  }

  console.log(
    `[newsSentiment] ${records.length} articles from known outlets for "${candidate.fullName}"`
  );

  await prisma.$transaction([
    prisma.newsArticle.deleteMany({ where: { candidateId } }),
    ...(records.length > 0
      ? [prisma.newsArticle.createMany({ data: records })]
      : []),
    prisma.candidate.update({
      where: { id: candidateId },
      data: { lastRefreshedAt: new Date(), dataIsStale: false },
    }),
  ]);

  console.log(
    `[newsSentiment] stored ${records.length} articles for "${candidate.fullName}"`
  );
}
