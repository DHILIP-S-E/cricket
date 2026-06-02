FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run provides $PORT (default 8080). Shell form so the variable expands.
ENV PORT=8080
EXPOSE 8080
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
