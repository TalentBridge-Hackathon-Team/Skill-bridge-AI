# SkillBridge AI — Django Backend Dockerfile (production)
FROM python:3.12-slim

# Prevent .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies (libpq for psycopg2, gcc for pgvector build)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (cached layer)
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project source
COPY . /app/

# Collect static files for whitenoise to serve
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Run migrations then start gunicorn with 4 sync workers.
# Increase --workers for more CPU cores: recommended formula = (2 * CPUs) + 1
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn skillbridge_backend.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 120 --access-logfile - --error-logfile -"]
