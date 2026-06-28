import { PrismaClient, OutletBias } from "@prisma/client";

const prisma = new PrismaClient();

const NEWS_OUTLETS: { name: string; domain: string; bias: OutletBias }[] = [
  // Conservative outlets
  { name: "Fox News", domain: "foxnews.com", bias: "conservative" },
  { name: "The Wall Street Journal", domain: "wsj.com", bias: "conservative" },
  { name: "New York Post", domain: "nypost.com", bias: "conservative" },
  { name: "The Daily Wire", domain: "dailywire.com", bias: "conservative" },
  { name: "National Review", domain: "nationalreview.com", bias: "conservative" },
  { name: "The Federalist", domain: "thefederalist.com", bias: "conservative" },
  { name: "Breitbart", domain: "breitbart.com", bias: "conservative" },

  // Liberal outlets
  { name: "The New York Times", domain: "nytimes.com", bias: "liberal" },
  { name: "The Washington Post", domain: "washingtonpost.com", bias: "liberal" },
  { name: "MSNBC", domain: "msnbc.com", bias: "liberal" },
  { name: "The Guardian", domain: "theguardian.com", bias: "liberal" },
  { name: "HuffPost", domain: "huffpost.com", bias: "liberal" },
  { name: "Vox", domain: "vox.com", bias: "liberal" },
  { name: "Mother Jones", domain: "motherjones.com", bias: "liberal" },
  { name: "The Atlantic", domain: "theatlantic.com", bias: "liberal" },
  { name: "CNN", domain: "cnn.com", bias: "liberal" },
  { name: "NBC News", domain: "nbcnews.com", bias: "liberal" },

  // Neutral outlets
  { name: "Reuters", domain: "reuters.com", bias: "neutral" },
  { name: "Associated Press", domain: "apnews.com", bias: "neutral" },
  { name: "NPR", domain: "npr.org", bias: "neutral" },
  { name: "PBS NewsHour", domain: "pbs.org", bias: "neutral" },
  { name: "C-SPAN", domain: "c-span.org", bias: "neutral" },
  { name: "The Hill", domain: "thehill.com", bias: "neutral" },
  { name: "Politico", domain: "politico.com", bias: "neutral" },
  { name: "ABC News", domain: "abcnews.go.com", bias: "neutral" },
  { name: "CBS News", domain: "cbsnews.com", bias: "neutral" },
];

async function main() {
  console.log("Seeding news outlets...");

  for (const outlet of NEWS_OUTLETS) {
    await prisma.newsOutlet.upsert({
      where: { domain: outlet.domain },
      update: { name: outlet.name, bias: outlet.bias },
      create: outlet,
    });
  }

  console.log(`Seeded ${NEWS_OUTLETS.length} news outlets.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
