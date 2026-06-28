from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .model import SentimentModel

app = FastAPI(title="Candidate Research Sentiment API", version="0.1.0")
model = SentimentModel()


class ArticleRequest(BaseModel):
    text: str
    article_id: str


class SentimentResult(BaseModel):
    article_id: str
    label: str          # positive, negative, neutral
    score: float        # confidence 0.0–1.0
    positive: float
    negative: float
    neutral: float


@app.get("/health")
def health():
    return {"status": "ok", "model": model.model_name}


@app.post("/analyze", response_model=SentimentResult)
def analyze(request: ArticleRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")

    result = model.analyze(request.text)
    return SentimentResult(article_id=request.article_id, **result)


@app.post("/analyze/batch", response_model=list[SentimentResult])
def analyze_batch(requests: list[ArticleRequest]):
    if len(requests) > 100:
        raise HTTPException(status_code=400, detail="batch size limit is 100")

    results = []
    for req in requests:
        result = model.analyze(req.text)
        results.append(SentimentResult(article_id=req.article_id, **result))
    return results
