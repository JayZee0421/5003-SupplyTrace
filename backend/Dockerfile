FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

# Database initialization tools and reproducible demo dataset
COPY scripts/ ./scripts/
COPY data_generator.py import_data.py supplytrace_schema_v1.sql benchmark_cases.json validate_generated_data.sql ./
COPY benchmark_data/ ./benchmark_data/

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]