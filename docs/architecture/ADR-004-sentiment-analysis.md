# ADR-004: Sentiment Analysis Engine

**Date:** 2026-06-27
**Status:** Accepted

## Context

One of the core features of the candidateResearchApp is a Media Sentiment Rating that shows how candidates are covered across conservative, liberal, and neutral news outlets. The rating classifies coverage for each candidate per outlet category as positive, neutral, or negative — but only when at least 50 articles are available for that candidate/category pair.

This sentiment rating is a central part of the product's value proposition. The methodology must be:
- **Transparent and citable:** Users, journalists, and researchers need to understand exactly how sentiment is determined. A black-box external service makes this impossible.
- **Reproducible:** Running the same articles through the same model at a later date should produce the same result. A third-party model that is silently updated breaks this property.
- **Cost-controlled:** The pipeline processes 50+ articles per candidate per outlet category, across potentially thousands of candidates, on a daily basis. Per-call API pricing at this volume is a significant operational cost.
- **Politically calibrated:** Standard sentiment models trained on product reviews or general news perform poorly on political text. The chosen approach must either use a model fine-tuned for political news or provide a path to validation and fine-tuning.

The sentiment analysis runs in a batch after the daily article collection completes — it is not a real-time inference path. Latency tolerance is high; throughput and cost matter more than response time.

## Decision

A local Hugging Face Transformers model is served from a Python microservice (FastAPI). The microservice is called via HTTP from BullMQ scraping workers on localhost. It is never publicly exposed. The model name and version are logged with every analysis run to enable methodology citation and model-change detection.

Recommended starting models for evaluation: `cardiffnlp/twitter-roberta-base-sentiment-latest` (fine-tuned for news/political text) or `ProsusAI/finbert` adapted for political text. Final model selection is gated on validation against a hand-labeled sample of at least 200 political news articles before production use.

## Options Considered

### Option A: Local Hugging Face model (Python microservice) — Chosen

Running inference locally on a self-hosted model eliminates per-call cost, maintains full control over model versioning, and makes the methodology fully auditable. The model name, version, and inference parameters are fixed at deployment time and recorded with each analysis batch. The methodology page can cite the specific model version used for any given analysis run.

Python is required because the NLP ecosystem in Python (Hugging Face Transformers, PyTorch, ONNX Runtime) is significantly more mature than the equivalent in Node.js. Rather than forcing NLP into the Node.js runtime, it is isolated as a small internal Python microservice. FastAPI provides a lightweight HTTP interface that the Node.js scraping workers call after article collection completes.

For CPU-only inference at MVP scale (hundreds of articles per day, not millions), throughput is sufficient without a GPU. If coverage expands to tens of thousands of candidates, ONNX Runtime provides a lighter inference backend than PyTorch for production use without a GPU.

The key risk is that off-the-shelf models trained on product reviews or general news do not perform well on political text. This is a documented risk (Risk 2 in the technical design) and a hard gate before the sentiment feature launches: the model must be evaluated against a hand-labeled sample of political news articles. If off-the-shelf accuracy is insufficient, fine-tuning on a labeled political news dataset must be considered. The feature cannot go live with an unevaluated model.

### Option B: OpenAI API (GPT-4o or similar) — Not chosen

OpenAI models handle nuanced political text well and require no model hosting infrastructure. For a quick prototype or low-volume validation, the OpenAI API is an attractive option.

It was not chosen as the production sentiment engine for three reasons:

1. **Cost:** 50+ articles per candidate per outlet category × thousands of candidates = very high per-call volume on a daily basis. GPT-4o pricing at this volume is prohibitive for a personal project without a revenue model.
2. **Reproducibility:** OpenAI updates models without notice. The same article processed six months later may produce a different result with a different model version. For a civic research tool where users expect consistent, comparable scores over time, this is unacceptable.
3. **Methodology transparency:** The methodology page must document exactly how sentiment is measured. "We send the article to OpenAI's GPT-4o API and use its output" is not a citable, reproducible methodology. A named, versioned Hugging Face model is.

OpenAI API calls remain a valid option for small-scale validation and exploratory testing before the local model is deployed.

### Option C: Google Cloud Natural Language API / AWS Comprehend — Not chosen

Google's NLP API and AWS Comprehend are managed NLP services that handle sentiment analysis without model hosting. They are reliable and do not require infrastructure management.

They were ruled out for the same reasons as the OpenAI API: per-call cost at volume, reproducibility concerns (managed APIs are updated by the provider without versioning guarantees), and methodology transparency. Additionally, neither service is fine-tuned for political text, and neither allows the level of control over what "positive" and "negative" mean in a political context that a locally hosted, documented model provides.

A civic research product whose value proposition includes transparent, neutral, and citable methodology cannot rely on a managed NLP API that the project does not control.

## Consequences

- A Python 3.x runtime environment must be deployed alongside the Node.js application. On the target PaaS platforms (Railway, Render, DigitalOcean), this typically means a separate service or a multi-runtime Docker container.
- The Python microservice runs on localhost and listens on a private port. It is not exposed to the public internet. The Node.js BullMQ workers call it via HTTP after article collection completes each day.
- The microservice must handle batch requests (processing a list of articles in one call) rather than single-article requests. This avoids HTTP overhead per article and is necessary for acceptable throughput on CPU inference.
- Model files (several hundred MB to a few GB depending on the model) must be stored on the deployment host or pulled from the Hugging Face Hub at startup. Storage and startup time implications must be accounted for in the deployment configuration.
- The model name and version are included in the microservice's response metadata and logged in the `SentimentAnalysis` record. This enables the methodology page to cite the exact model used for any given run and allows re-processing when the model is updated.
- Before the sentiment feature goes live, a validation gate must be completed: hand-label a minimum of 200 political news articles across outlet categories and sentiment classes, run the chosen model, and measure accuracy. If accuracy is insufficient, investigate fine-tuned alternatives before launch.
- `torch` is the development inference backend; `onnxruntime` is the preferred production backend for CPU-only inference (lighter memory footprint, faster startup).

## Tradeoffs

**Gained:**
- No per-call API cost — inference runs locally on already-paid compute
- Full control over model versioning — the exact model used for every analysis run is documented and reproducible
- Methodology transparency — the methodology page can cite a specific, publicly available model that researchers can inspect and evaluate
- Runs offline — no external API dependency for daily inference
- Political text calibration is possible — the chosen model family (`cardiffnlp/twitter-roberta-base-sentiment-latest`) is fine-tuned for news and political text, unlike general-purpose managed NLP APIs

**Given up:**
- Zero infrastructure simplicity of a managed API — a Python runtime must be deployed and maintained
- Nuanced understanding of long-form text that large language models (GPT-4o) provide — a transformer model specialized for sentiment is more constrained in reasoning ability
- Speed of prototyping — using the OpenAI API for initial testing is faster than setting up local model inference; OpenAI API remains valid for validation and exploratory work before the local model is finalized

## Related ADRs

- ADR-003: Scraping Architecture — The Python sentiment microservice is called from BullMQ Node.js workers via HTTP after article collection completes each day.
- ADR-005: Deployment Platform — The PaaS must support running a Python microservice alongside the Node.js application, either as a separate service or via a multi-runtime container.
