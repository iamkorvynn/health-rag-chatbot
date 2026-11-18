FROM python:3.12-slim
WORKDIR /app
# Build context is the repo root (Render Blueprint uses the repo root).
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/main.py .
COPY data ./data
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
