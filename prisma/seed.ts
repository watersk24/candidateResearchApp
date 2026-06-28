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

  // ─── Dev seed: Austin, TX jurisdictions, districts, elections, candidates ───

  console.log("Seeding jurisdictions...");

  const usJurisdiction = await prisma.jurisdiction.upsert({
    where: { id: "seed-jurisdiction-us" },
    update: {},
    create: {
      id: "seed-jurisdiction-us",
      name: "United States",
      type: "federal",
    },
  });

  const txJurisdiction = await prisma.jurisdiction.upsert({
    where: { id: "seed-jurisdiction-tx" },
    update: {},
    create: {
      id: "seed-jurisdiction-tx",
      name: "Texas",
      type: "state",
      parentId: usJurisdiction.id,
      fipsCode: "48",
    },
  });

  const travisJurisdiction = await prisma.jurisdiction.upsert({
    where: { id: "seed-jurisdiction-travis" },
    update: {},
    create: {
      id: "seed-jurisdiction-travis",
      name: "Travis County",
      type: "county",
      parentId: txJurisdiction.id,
      fipsCode: "48453",
    },
  });

  const austinJurisdiction = await prisma.jurisdiction.upsert({
    where: { id: "seed-jurisdiction-austin" },
    update: {},
    create: {
      id: "seed-jurisdiction-austin",
      name: "City of Austin",
      type: "city",
      parentId: travisJurisdiction.id,
    },
  });

  console.log("Seeding districts...");

  const districts = await Promise.all([
    prisma.district.upsert({
      where: { id: "seed-district-tx35" },
      update: {},
      create: {
        id: "seed-district-tx35",
        jurisdictionId: usJurisdiction.id,
        name: "U.S. House — Texas 35th District",
        level: "federal",
        districtType: "congressional",
      },
    }),
    prisma.district.upsert({
      where: { id: "seed-district-tx-senate" },
      update: {},
      create: {
        id: "seed-district-tx-senate",
        jurisdictionId: usJurisdiction.id,
        name: "U.S. Senate — Texas",
        level: "federal",
        districtType: "senate",
      },
    }),
    prisma.district.upsert({
      where: { id: "seed-district-tx-house-49" },
      update: {},
      create: {
        id: "seed-district-tx-house-49",
        jurisdictionId: txJurisdiction.id,
        name: "Texas House — District 49",
        level: "state",
        districtType: "state_house",
      },
    }),
    prisma.district.upsert({
      where: { id: "seed-district-tx-senate-14" },
      update: {},
      create: {
        id: "seed-district-tx-senate-14",
        jurisdictionId: txJurisdiction.id,
        name: "Texas Senate — District 14",
        level: "state",
        districtType: "state_senate",
      },
    }),
    prisma.district.upsert({
      where: { id: "seed-district-austin-council-9" },
      update: {},
      create: {
        id: "seed-district-austin-council-9",
        jurisdictionId: austinJurisdiction.id,
        name: "Austin City Council — District 9",
        level: "local",
        districtType: "city_council",
      },
    }),
    prisma.district.upsert({
      where: { id: "seed-district-travis-pct-3" },
      update: {},
      create: {
        id: "seed-district-travis-pct-3",
        jurisdictionId: travisJurisdiction.id,
        name: "Travis County Commissioner — Precinct 3",
        level: "local",
        districtType: "county_commissioner",
      },
    }),
  ]);

  const [distTx35, distTxSenate, distTxHouse49, distTxSenate14, distAustinCouncil9, distTravisPct3] = districts;

  console.log("Seeding elections...");

  const electionDate = new Date("2026-11-03");
  const cycleStart = new Date("2026-01-01");

  const elections = await Promise.all([
    prisma.election.upsert({
      where: { id: "seed-election-tx35-2026" },
      update: {},
      create: {
        id: "seed-election-tx35-2026",
        districtId: distTx35.id,
        name: "U.S. House TX-35 General Election",
        electionType: "general",
        electionDate,
        electionCycleStart: cycleStart,
        status: "upcoming",
      },
    }),
    prisma.election.upsert({
      where: { id: "seed-election-tx-senate-2026" },
      update: {},
      create: {
        id: "seed-election-tx-senate-2026",
        districtId: distTxSenate.id,
        name: "U.S. Senate Texas General Election",
        electionType: "general",
        electionDate,
        electionCycleStart: cycleStart,
        status: "upcoming",
      },
    }),
    prisma.election.upsert({
      where: { id: "seed-election-tx-house-49-2026" },
      update: {},
      create: {
        id: "seed-election-tx-house-49-2026",
        districtId: distTxHouse49.id,
        name: "Texas House District 49 General Election",
        electionType: "general",
        electionDate,
        electionCycleStart: cycleStart,
        status: "upcoming",
      },
    }),
    prisma.election.upsert({
      where: { id: "seed-election-tx-senate-14-2026" },
      update: {},
      create: {
        id: "seed-election-tx-senate-14-2026",
        districtId: distTxSenate14.id,
        name: "Texas Senate District 14 General Election",
        electionType: "general",
        electionDate,
        electionCycleStart: cycleStart,
        status: "upcoming",
      },
    }),
    prisma.election.upsert({
      where: { id: "seed-election-austin-council-9-2026" },
      update: {},
      create: {
        id: "seed-election-austin-council-9-2026",
        districtId: distAustinCouncil9.id,
        name: "Austin City Council District 9 General Election",
        electionType: "general",
        electionDate,
        electionCycleStart: cycleStart,
        status: "upcoming",
      },
    }),
    prisma.election.upsert({
      where: { id: "seed-election-travis-pct-3-2026" },
      update: {},
      create: {
        id: "seed-election-travis-pct-3-2026",
        districtId: distTravisPct3.id,
        name: "Travis County Commissioner Precinct 3 General Election",
        electionType: "general",
        electionDate,
        electionCycleStart: cycleStart,
        status: "upcoming",
      },
    }),
  ]);

  const [elTx35, elTxSenate, elTxHouse49, elTxSenate14, elAustinCouncil9, elTravisPct3] = elections;

  console.log("Seeding candidates...");

  const candidates = [
    // U.S. House TX-35
    { id: "seed-cand-tx35-r", electionId: elTx35.id, fullName: "Marcus Delgado", party: "Republican", profileSlug: "marcus-delgado-tx35", isIncumbent: false, transparencyScore: 62, dataStatus: "current" as const },
    { id: "seed-cand-tx35-d", electionId: elTx35.id, fullName: "Priya Okonkwo", party: "Democrat", profileSlug: "priya-okonkwo-tx35", isIncumbent: true, transparencyScore: 81, dataStatus: "current" as const },
    { id: "seed-cand-tx35-l", electionId: elTx35.id, fullName: "James Whitfield", party: "Libertarian", profileSlug: "james-whitfield-tx35", isIncumbent: false, transparencyScore: 34, dataStatus: "limited" as const },

    // U.S. Senate TX
    { id: "seed-cand-txsen-r", electionId: elTxSenate.id, fullName: "Robert Hensley", party: "Republican", profileSlug: "robert-hensley-tx-senate", isIncumbent: true, transparencyScore: 74, dataStatus: "current" as const },
    { id: "seed-cand-txsen-d", electionId: elTxSenate.id, fullName: "Carmen Villanueva", party: "Democrat", profileSlug: "carmen-villanueva-tx-senate", isIncumbent: false, transparencyScore: 68, dataStatus: "current" as const },

    // TX House 49
    { id: "seed-cand-txh49-d", electionId: elTxHouse49.id, fullName: "Aisha Thornton", party: "Democrat", profileSlug: "aisha-thornton-txh49", isIncumbent: true, transparencyScore: 77, dataStatus: "current" as const },
    { id: "seed-cand-txh49-r", electionId: elTxHouse49.id, fullName: "Derek Saunders", party: "Republican", profileSlug: "derek-saunders-txh49", isIncumbent: false, transparencyScore: 55, dataStatus: "current" as const },

    // TX Senate 14
    { id: "seed-cand-txs14-d", electionId: elTxSenate14.id, fullName: "Nguyen Kim", party: "Democrat", profileSlug: "nguyen-kim-txs14", isIncumbent: false, transparencyScore: 41, dataStatus: "limited" as const },
    { id: "seed-cand-txs14-r", electionId: elTxSenate14.id, fullName: "Patricia Romero", party: "Republican", profileSlug: "patricia-romero-txs14", isIncumbent: true, transparencyScore: 70, dataStatus: "current" as const },

    // Austin Council 9
    { id: "seed-cand-atx9-a", electionId: elAustinCouncil9.id, fullName: "Samuel Obi", party: null, profileSlug: "samuel-obi-atx9", isIncumbent: false, transparencyScore: 58, dataStatus: "current" as const },
    { id: "seed-cand-atx9-b", electionId: elAustinCouncil9.id, fullName: "Laura Fitzpatrick", party: null, profileSlug: "laura-fitzpatrick-atx9", isIncumbent: true, transparencyScore: 83, dataStatus: "current" as const },
    { id: "seed-cand-atx9-c", electionId: elAustinCouncil9.id, fullName: "Raj Patel", party: null, profileSlug: "raj-patel-atx9", isIncumbent: false, transparencyScore: 49, dataStatus: "current" as const },

    // Travis County Commissioner Pct 3
    { id: "seed-cand-trav3-a", electionId: elTravisPct3.id, fullName: "Gloria Hutchins", party: "Democrat", profileSlug: "gloria-hutchins-travis-pct3", isIncumbent: true, transparencyScore: 66, dataStatus: "current" as const },
    { id: "seed-cand-trav3-b", electionId: elTravisPct3.id, fullName: "Scott Meyers", party: "Republican", profileSlug: "scott-meyers-travis-pct3", isIncumbent: false, transparencyScore: 52, dataStatus: "stale" as const },
  ];

  for (const c of candidates) {
    const { transparencyScore, dataStatus, ...candidateData } = c;
    const candidate = await prisma.candidate.upsert({
      where: { id: c.id },
      update: {},
      create: {
        ...candidateData,
        status: "active",
      },
    });

    await prisma.candidateRatings.upsert({
      where: { candidateId: candidate.id },
      update: {},
      create: {
        candidateId: candidate.id,
        transparencyScore,
        dataStatus,
      },
    });
  }

  console.log(`Seeded ${candidates.length} candidates across ${elections.length} elections.`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
