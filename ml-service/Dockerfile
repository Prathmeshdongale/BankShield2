# ──────────────────────────────────────────────────────────────────────────────
# BankShield ML Service — FastAPI + XGBoost Dockerfile (Production)
# Target: Render.com
# ──────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS builder
WORKDIR /app

# Install build dependencies for scipy/scikit-learn
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ && rm -rf /var/lib/apt/lists/*

COPY ml-service/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Production image ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS production
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-cache curl && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONPATH=/app

# Copy application code
COPY ml-service/app/ ./app/

# Create saved_models directory — model file added at runtime
# If no model file present, ML service uses heuristic fallback (still functional)
RUN mkdir -p /app/saved_models

# Environment defaults
ENV MODEL_DIR=/app/saved_models \
    MODEL_FILE=/app/saved_models/xgboost_fraud_model.joblib \
    FASTAPI_WORKERS=2 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
