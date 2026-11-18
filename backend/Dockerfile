FROM python:3.12-slim
WORKDIR /app
# OCR + PDF rendering tools (tesseract for scanned PDFs, poppler for pdf2image).
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr poppler-utils \
    && rm -rf /var/lib/apt/lists/*
# Build context is the repo root (Render Blueprint uses the repo root).
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/main.py .
COPY data ./data
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
