# Race Import and Enrichment Operations (Production)

How North Carolina races and candidates are kept current in production, and how federal candidates get FEC campaign finance data ([ADR-008](../architecture/ADR-008-open-data-sources.md), Slices 1, 3, and 4). Run all commands in Cloud Shell under project `candidate-research-app`.

## How it runs

| Resource | Name | Purpose |
|---|---|---|
| Cloud Scheduler job | `ingest-races-daily` (us-east1) | Daily at 06:00 America/New_York, POSTs to the Cloud Run Jobs API to run `ingest-races` |
| Cloud Scheduler job | `enrich-candidates-daily` (us-east1) | Daily at 06:30 America/New_York, runs `enrich-candidates` after the import |
| Service account | `ingest-scheduler@candidate-research-app.iam.gserviceaccount.com` | Used by both Scheduler jobs; only role is `roles/run.invoker` on `ingest-races` and `enrich-candidates` |
| Cloud Run Job | `ingest-races` (us-east1) | Workers image; runs `node apps/workers/dist/scripts/ingestRaces.js ncsbe 2026-11-03`. No retries, 15-minute timeout, `DATABASE_URL` from Secret Manager, VPC connector `cra-connector` |
| Cloud Run Job | `enrich-candidates` (us-east1) | Workers image; runs `node apps/workers/dist/scripts/enrichCandidates.js 2026-11-03`: links federal candidates to FEC IDs, then stores campaign finance totals. No retries, 30-minute timeout, `DATABASE_URL` and `FEC_API_KEY` from Secret Manager, VPC connector `cra-connector` |
| Secret | `fec-api-key` | api.data.gov key for the FEC API; the default compute service account can read it |
| Alert policy | `ingest-races execution failed` | Emails when an import execution fails |
| Alert policy | `ingest-races-daily trigger error` | Emails when Scheduler cannot start the import |
| Alert policy | `enrich-candidates execution failed` | Emails when an enrichment execution fails (any race or candidate failed) |
| Alert policy | `enrich-candidates-daily trigger error` | Emails when Scheduler cannot start enrichment |

Both jobs are idempotent; running them again with unchanged sources changes nothing. A normal enrichment run reports `0 newly linked`, `40 already linked`, and `0 failed`.

## Common tasks

Check recent runs (`RUN BY` shows `ingest-scheduler@…` for scheduled runs):

```bash
gcloud run jobs executions list --job=ingest-races --region=us-east1 --limit=5
gcloud run jobs executions list --job=enrich-candidates --region=us-east1 --limit=5
```

Check both schedules (`status: {}` means the last trigger worked):

```bash
for j in ingest-races-daily enrich-candidates-daily; do
  gcloud scheduler jobs describe $j --location=us-east1 --format='yaml(state,status,lastAttemptTime,scheduleTime)'
done
```

Read the last import's output (counts, unmatched contests, errors):

```bash
gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="ingest-races"' \
  --freshness=1d --limit=60 --format='value(textPayload)'
```

Read the last enrichment summary:

```bash
gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="enrich-candidates"' \
  --freshness=1d --limit=200 --format='value(textPayload)' \
  | grep -E "races:|linked|stale|unmatched|confirmation|ambiguous|failed|^    -"
```

Run either job now:

```bash
gcloud scheduler jobs run ingest-races-daily --location=us-east1
gcloud scheduler jobs run enrich-candidates-daily --location=us-east1
```

Pause or resume a schedule:

```bash
gcloud scheduler jobs pause ingest-races-daily --location=us-east1
gcloud scheduler jobs resume ingest-races-daily --location=us-east1
```

## Reviewing FEC links

The enrichment summary lists candidates it did not link. None of these is an error, and none raises an alert:

- **unmatched**: no FEC filer in the race has a matching name. Common for candidates who raised under $5,000 (not required to file) or whose name the FEC spells differently.
- **needs confirmation**: the only match is loose, a short form ("Greg" / GREGORY) or a middle name ("Jack" / JOHN JACK). Check the FEC candidate page (`https://www.fec.gov/data/candidate/<ID>/`): same state and district, same party, a campaign for this election. If it is the same person, add an entry with the evidence to `apps/workers/src/enrich/fecConfirmedLinks.ts`, commit, rebuild the workers image, and update both jobs (below).
- **ambiguous**: several different FEC filers match, or two candidates claim one FEC ID. Check the listed IDs the same way and confirm the right one, or leave it unlinked.
- **unlinked (stale)**: a link was removed because the FEC no longer lists the ID for the race or the ballot name changed; that candidate's finance data was cleared. It re-links automatically if the name still matches exactly.

Every new link is logged as `[linkFec] <candidate> (<race>) → <FEC ID> (FEC: <FEC name>)`, so a wrong attribution can be traced. To undo one, delete its `external_refs` row (`source = 'fec'`) and fix the cause before the next run.

## When an alert fires

**Execution failed.** Read the logs (above). The common causes:

- **Mass-withdrawal guard.** The run would withdraw more than 10% (and more than 5) of the election's active candidates, which usually means NCSBE published a truncated file. Do nothing and let the next daily run retry. If the withdrawals are real (check the [NCSBE candidate list](https://s3.amazonaws.com/dl.ncsbe.gov/Elections/2026/Candidate%20Filing/Candidate_Listing_2026.csv)), run once with `--force`:

  ```bash
  gcloud run jobs execute ingest-races --region=us-east1 --wait \
    --args=apps/workers/dist/scripts/ingestRaces.js,ncsbe,2026-11-03,--force
  ```

- **Missing columns, malformed rows, or unterminated quote.** NCSBE changed the file format. The import refuses to load it; the code in `apps/workers/src/ingest/providers/ncsbe.ts` needs updating.
- **Database connection errors (`P1000`/`P1001`).** Check the `database-url` secret and the Cloud SQL instance.

**Enrichment execution failed.** Read the enrichment summary (above). `failed races` lists races where the FEC request failed after retries, or returned an empty or cut-off list; nothing was unlinked for those races. `failed` counts candidates whose finance fetch failed. Both are usually transient FEC outages, and the next daily run is the retry. If every request fails with `403`, the API key is invalid or revoked: add a new version to the `fec-api-key` secret.

**Trigger error.** Scheduler could not start the job. Check `gcloud scheduler jobs describe <schedule> --location=us-east1`: `PERMISSION_DENIED` means the service account lost `roles/run.invoker` on the job; `NOT_FOUND` means the job was renamed or deleted.

## After a new image is deployed

Both jobs use `workers:latest`, resolved when the job is updated, not at each run. After pushing a new workers image:

```bash
IMAGE=us-east1-docker.pkg.dev/candidate-research-app/candidate-research/workers:latest
gcloud run jobs update ingest-races --region=us-east1 --image=$IMAGE
gcloud run jobs update enrich-candidates --region=us-east1 --image=$IMAGE
```

If a job is created while a secret it references has no value, it stays in an error state and `execute` fails with `FAILED_PRECONDITION`. Add the secret's value, then re-run `gcloud run jobs update` with the job's full flags to clear it.

## Known limitations

- The election date `2026-11-03` is fixed in both jobs' arguments. For a later election, update both (`gcloud run jobs update ingest-races --region=us-east1 --args=apps/workers/dist/scripts/ingestRaces.js,ncsbe,<YYYY-MM-DD>` and `gcloud run jobs update enrich-candidates --region=us-east1 --args=apps/workers/dist/scripts/enrichCandidates.js,<YYYY-MM-DD>`), or add a "next upcoming election" mode to the CLIs.
- Enrichment covers federal candidates only (campaign finance and incumbency). Voting records, news sentiment, and ratings are not run in production.
- Enrichment is scheduled 30 minutes after the import, not triggered by its completion; if the import runs long or fails, enrichment works from the previous day's candidates.
- Primary elections are not imported (see ADR-008 Slice 1 safeguards).
- Failed runs are not retried automatically; the next daily run is the retry.
- Alerts are email only; there is no paging.
- The BullMQ scraper workers are not deployed; enrichment runs directly in the `enrich-candidates` job.
