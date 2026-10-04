import axios from "axios";

const BASE_URL = "https://newsapi.org/v2";

function client() {
  const key = process.env.NEWS_API_KEY;
  if (!key) throw new Error("NEWS_API_KEY environment variable is required");
  return axios.create({
    baseURL: BASE_URL,
    headers: { "X-Api-Key": key },
    timeout: 15_000,
  });
}

export interface NewsApiArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  content: string | null;
}

export async function searchArticles(
  query: string,
  fromDate: string, // ISO date string e.g. "2024-01-01"
  pageSize = 100
): Promise<NewsApiArticle[]> {
  const http = client();
  const response = await http.get<{
    status: string;
    totalResults: number;
    articles: NewsApiArticle[];
  }>("/everything", {
    params: {
      q: `"${query}"`, // exact phrase match
      from: fromDate,
      sortBy: "relevancy",
      language: "en",
      pageSize,
    },
  });

  if (response.data.status !== "ok") {
    throw new Error(`NewsAPI error: ${JSON.stringify(response.data)}`);
  }

  return response.data.articles ?? [];
}

export function extractDomain(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    // Strip www. prefix
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
