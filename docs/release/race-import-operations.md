# Race Import Operations (Production)

How North Carolina races and candidates are kept current in production ([ADR-008](../architecture/ADR-008-open-data-sources.md)). Run all commands in Cloud Shell under project `candidate-research-app`.

## How it runs

| Resource | Name | Purpose |
|---|---|---|
| Cloud Scheduler job | `ingest-races-daily` (us-east1) | Daily at 06:00 America/New_York, POSTs to the Cloud Run Jobs API to run `ingest-races` |
| Service account | `ingest-scheduler@candidate-research-app.iam.gserviceaccount.com` | Used by the Scheduler job; only role is `roles/run.invoker` on `ingest-races` |
| Cloud Run Job | `ingest-races` (us-east1) | Workers image; runs `node apps/workers/dist/scripts/ingestRaces.js ncsbe 2026-11-03`. No retries, 15-minute timeout, `DATABASE_URL` from Secret Manager, VPC connector `cra-connector` |
| Alert policy | `ingest-races execution failed` | Emails when an execution fails |
| Alert policy | `ingest-races-daily trigger error` | Emails when Scheduler cannot start the job |

The import is idempotent; running it again with an unchanged source file creates and withdraws nothing.

## Common tasks

Check recent runs (`RUN BY` shows `ingest-scheduler@…` for scheduled runs):

```bash
gcloud run jobs executions list --job=ingest-races --region=us-east1 --limit=5
```

Read the last run's output (counts, unmatched contests, errors):

```bash
gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="ingest-races"' \
  --freshness=1d --limit=60 --format='value(textPayload)'
```

Run the import now:

```bash
gcloud scheduler jobs run ingest-races-daily --location=us-east1
```

Pause or resume the daily schedule:

```bash
gcloud scheduler jobs pause ingest-races-daily --location=us-east1
gcloud scheduler jobs resume ingest-races-daily --location=us-east1
```

## When an alert fires

**Execution failed.** Read the logs (above). The common causes:

- **Mass-withdrawal guard.** The run would withdraw more than 10% (and more than 5) of the election's active candidates, which usually means NCSBE published a truncated file. Do nothing and let the next daily run retry. If the withdrawals are real (check the [NCSBE candidate list](https://s3.amazonaws.com/dl.ncsbe.gov/Elections/2026/Candidate%20Filing/Candidate_Listing_2026.csv)), run once with `--force`:

  ```bash
  gcloud run jobs execute ingest-races --region=us-east1 --wait \
    --args=apps/workers/dist/scripts/ingestRaces.js,ncsbe,2026-11-03,--force
  ```

- **Missing columns, malformed rows, or unterminated quote.** NCSBE changed the file format. The import refuses to load it; the code in `apps/workers/src/ingest/providers/ncsbe.ts` needs updating.
- **Database connection errors (`P1000`/`P1001`).** Check the `database-url` secret and the Cloud SQL instance.

**Trigger error.** Scheduler could not start the job. Check `gcloud scheduler jobs describe ingest-races-daily --location=us-east1`: `PERMISSION_DENIED` means the service account lost `roles/run.invoker` on the job; `NOT_FOUND` means the job was renamed or deleted.

## After a new image is deployed

The job uses `workers:latest`, resolved when the job is updated, not at each run. After pushing a new workers image:

```bash
gcloud run jobs update ingest-races --region=us-east1 \
  --image=us-east1-docker.pkg.dev/candidate-research-app/candidate-research/workers:latest
```

## Known limitations

- The election date `2026-11-03` is fixed in the job's arguments. For a later election, update the job (`gcloud run jobs update ingest-races --region=us-east1 --args=apps/workers/dist/scripts/ingestRaces.js,ncsbe,<YYYY-MM-DD>`), or add a "next upcoming election" mode to the CLI.
- Primary elections are not imported (see ADR-008 Slice 1 safeguards).
- Failed runs are not retried automatically; the next daily run is the retry.
- Alerts are email only; there is no paging.
- New candidates are not enqueued for the enrichment scrapers; those workers are not deployed in production yet.
