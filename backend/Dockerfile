FROM python:3.11.9-slim-bookworm

WORKDIR /app

# Install system dependencies for psycopg2 and other packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt

COPY . .

# Ensure data directory exists
RUN mkdir -p data

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
