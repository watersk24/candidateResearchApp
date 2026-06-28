from transformers import pipeline

MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"
LABEL_MAP = {"LABEL_0": "negative", "LABEL_1": "neutral", "LABEL_2": "positive"}


class SentimentModel:
    model_name = MODEL_NAME

    def __init__(self):
        self._pipe = pipeline(
            "sentiment-analysis",
            model=MODEL_NAME,
            top_k=None,
            truncation=True,
            max_length=512,
        )

    def analyze(self, text: str) -> dict:
        outputs = self._pipe(text)[0]
        scores = {LABEL_MAP[o["label"]]: round(o["score"], 4) for o in outputs}

        best = max(outputs, key=lambda o: o["score"])
        return {
            "label": LABEL_MAP[best["label"]],
            "score": round(best["score"], 4),
            "positive": scores.get("positive", 0.0),
            "negative": scores.get("negative", 0.0),
            "neutral": scores.get("neutral", 0.0),
        }
