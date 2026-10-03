import { prisma } from "../lib/db.js";

/** ExternalRef source for FEC candidate IDs (ADR-008 Slice 4). */
export const FEC_SOURCE = "fec";

/** The FEC candidate ID linked to a candidate, or null if unlinked. */
export async function linkedFecId(candidateId: string): Promise<string | null> {
  const ref = await prisma.externalRef.findFirst({
    where: { source: FEC_SOURCE, entityType: "candidate", entityId: candidateId },
  });
  return ref?.externalId ?? null;
}
