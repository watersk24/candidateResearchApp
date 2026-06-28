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

  // ─── Accessibility scores ─────────────────────────────────────────────────

  console.log("Seeding accessibility data...");

  // Austin ISD as a local jurisdiction
  await prisma.jurisdiction.upsert({
    where: { id: "seed-jurisdiction-austin-isd" },
    update: {},
    create: {
      id: "seed-jurisdiction-austin-isd",
      name: "Austin Independent School District",
      type: "school_district",
      parentId: travisJurisdiction.id,
      electionOfficialsUrl: "https://www.austinisd.org/board-trustees/elections",
      electionOfficialsContactUrl: "https://www.austinisd.org/contact",
    },
  });

  // Additional state jurisdictions for the rankings page
  const stateJurisdictions = [
    { id: "seed-jurisdiction-ca", name: "California",  fipsCode: "06", officialsUrl: "https://www.sos.ca.gov/elections",                      contactUrl: "https://www.sos.ca.gov/about/contact" },
    { id: "seed-jurisdiction-ny", name: "New York",    fipsCode: "36", officialsUrl: "https://elections.ny.gov",                              contactUrl: "https://elections.ny.gov/contact-us" },
    { id: "seed-jurisdiction-wa", name: "Washington",  fipsCode: "53", officialsUrl: "https://www.sos.wa.gov/elections",                      contactUrl: "https://www.sos.wa.gov/contact" },
    { id: "seed-jurisdiction-co", name: "Colorado",    fipsCode: "08", officialsUrl: "https://www.sos.state.co.us/pubs/elections/main.html",  contactUrl: "https://www.sos.state.co.us/pubs/aboutUs/contactUs.html" },
    { id: "seed-jurisdiction-mn", name: "Minnesota",   fipsCode: "27", officialsUrl: "https://www.sos.state.mn.us/elections-voting",          contactUrl: "https://www.sos.state.mn.us/about/contact-us" },
    { id: "seed-jurisdiction-va", name: "Virginia",    fipsCode: "51", officialsUrl: "https://www.elections.virginia.gov",                   contactUrl: "https://www.elections.virginia.gov/about-the-department/contact-us" },
    { id: "seed-jurisdiction-fl", name: "Florida",     fipsCode: "12", officialsUrl: "https://dos.fl.gov/elections",                         contactUrl: "https://dos.fl.gov/contact" },
    { id: "seed-jurisdiction-ga", name: "Georgia",     fipsCode: "13", officialsUrl: "https://sos.ga.gov/elections",                         contactUrl: "https://sos.ga.gov/contact-us" },
    { id: "seed-jurisdiction-oh", name: "Ohio",        fipsCode: "39", officialsUrl: "https://www.ohiosos.gov/elections",                    contactUrl: "https://www.ohiosos.gov/about/contact-us" },
    { id: "seed-jurisdiction-tn", name: "Tennessee",   fipsCode: "47", officialsUrl: "https://sos.tn.gov/elections",                         contactUrl: "https://sos.tn.gov/contact" },
    { id: "seed-jurisdiction-la", name: "Louisiana",   fipsCode: "22", officialsUrl: "https://www.sos.la.gov/ElectionsAndVoting",            contactUrl: "https://www.sos.la.gov/ContactUs" },
    { id: "seed-jurisdiction-ms", name: "Mississippi", fipsCode: "28", officialsUrl: "https://www.sos.ms.gov/elections-voting",              contactUrl: "https://www.sos.ms.gov/contact" },
    { id: "seed-jurisdiction-wy", name: "Wyoming",     fipsCode: "56", officialsUrl: "https://sos.wyo.gov/elections",                        contactUrl: "https://sos.wyo.gov/contact" },
  ];

  for (const s of stateJurisdictions) {
    await prisma.jurisdiction.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        name: s.name,
        type: "state",
        parentId: usJurisdiction.id,
        fipsCode: s.fipsCode,
        electionOfficialsUrl: s.officialsUrl,
        electionOfficialsContactUrl: s.contactUrl,
      },
    });
  }

  // Add contact URLs to Texas
  await prisma.jurisdiction.update({
    where: { id: "seed-jurisdiction-tx" },
    data: {
      electionOfficialsUrl: "https://www.sos.state.tx.us/elections/index.shtml",
      electionOfficialsContactUrl: "https://www.sos.state.tx.us/about/contactsos.shtml",
    },
  });

  type ScoreInput = {
    jurisdictionId: string;
    overallScore: number;
    filingPublic: boolean;
    machineReadable: boolean;
    noAuthRequired: boolean;
    timely: boolean;
    votingRecordsAvailable: boolean;
    financeDetailed: boolean;
    robotsTxtBlocks: boolean;
    hasNoDataAtAll: boolean;
  };

  const accessibilityScores: ScoreInput[] = [
    // States
    { jurisdictionId: "seed-jurisdiction-ca",        overallScore: 91, filingPublic: true,  machineReadable: true,  noAuthRequired: true,  timely: true,  votingRecordsAvailable: true,  financeDetailed: true,  robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-ny",        overallScore: 88, filingPublic: true,  machineReadable: true,  noAuthRequired: true,  timely: true,  votingRecordsAvailable: true,  financeDetailed: false, robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-wa",        overallScore: 84, filingPublic: true,  machineReadable: true,  noAuthRequired: true,  timely: false, votingRecordsAvailable: true,  financeDetailed: true,  robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-co",        overallScore: 79, filingPublic: true,  machineReadable: true,  noAuthRequired: true,  timely: true,  votingRecordsAvailable: true,  financeDetailed: false, robotsTxtBlocks: true,  hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-mn",        overallScore: 74, filingPublic: true,  machineReadable: true,  noAuthRequired: true,  timely: true,  votingRecordsAvailable: false, financeDetailed: true,  robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-va",        overallScore: 70, filingPublic: true,  machineReadable: false, noAuthRequired: true,  timely: true,  votingRecordsAvailable: true,  financeDetailed: false, robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-tx",        overallScore: 66, filingPublic: true,  machineReadable: true,  noAuthRequired: true,  timely: false, votingRecordsAvailable: true,  financeDetailed: false, robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-fl",        overallScore: 55, filingPublic: true,  machineReadable: false, noAuthRequired: false, timely: true,  votingRecordsAvailable: false, financeDetailed: false, robotsTxtBlocks: true,  hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-ga",        overallScore: 47, filingPublic: true,  machineReadable: false, noAuthRequired: false, timely: false, votingRecordsAvailable: false, financeDetailed: false, robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-oh",        overallScore: 43, filingPublic: true,  machineReadable: false, noAuthRequired: true,  timely: false, votingRecordsAvailable: false, financeDetailed: false, robotsTxtBlocks: true,  hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-tn",        overallScore: 35, filingPublic: true,  machineReadable: false, noAuthRequired: false, timely: false, votingRecordsAvailable: false, financeDetailed: false, robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-la",        overallScore: 21, filingPublic: false, machineReadable: false, noAuthRequired: false, timely: false, votingRecordsAvailable: false, financeDetailed: false, robotsTxtBlocks: true,  hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-ms",        overallScore: 14, filingPublic: false, machineReadable: false, noAuthRequired: false, timely: false, votingRecordsAvailable: false, financeDetailed: false, robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-wy",        overallScore:  7, filingPublic: false, machineReadable: false, noAuthRequired: false, timely: false, votingRecordsAvailable: false, financeDetailed: false, robotsTxtBlocks: true,  hasNoDataAtAll: true  },
    // Local
    { jurisdictionId: "seed-jurisdiction-travis",    overallScore: 62, filingPublic: true,  machineReadable: false, noAuthRequired: true,  timely: true,  votingRecordsAvailable: true,  financeDetailed: false, robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-austin",    overallScore: 71, filingPublic: true,  machineReadable: true,  noAuthRequired: true,  timely: true,  votingRecordsAvailable: false, financeDetailed: false, robotsTxtBlocks: false, hasNoDataAtAll: false },
    { jurisdictionId: "seed-jurisdiction-austin-isd", overallScore: 34, filingPublic: true,  machineReadable: false, noAuthRequired: false, timely: false, votingRecordsAvailable: false, financeDetailed: false, robotsTxtBlocks: false, hasNoDataAtAll: false },
  ];

  for (const score of accessibilityScores) {
    await prisma.dataAccessibilityScore.upsert({
      where: { jurisdictionId_electionCycle: { jurisdictionId: score.jurisdictionId, electionCycle: "2026" } },
      update: {},
      create: { ...score, electionCycle: "2026" },
    });
  }

  console.log(`Seeded ${accessibilityScores.length} accessibility scores.`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
