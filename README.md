# SupplyTrace

## Part 5 Docker Quick Start

SupplyTrace is a supply chain event causal tracing system based on PostgreSQL, FastAPI, and React. This section introduces how to launch the complete application locally using Docker Compose, including the database, backend API, and frontend visualization interface.

### 1. Requirements

- Docker Desktop (including Docker Compose)
- Available ports: 55433, 8002, 5174
- An internet connection is required for the initial build to download Docker images and project dependencies

All commands below should be executed from the project root directory.

### 2. Start Services

```bash
docker compose up -d --build
```

This command builds and starts three services:

| Service | Technology | Local Address |
|---|---|---|
| Frontend | React + Vite | http://127.0.0.1:5174 |
| Backend | FastAPI | http://127.0.0.1:8002 |
| API Documentation | Swagger UI | http://127.0.0.1:8002/docs |
| PostgreSQL | PostgreSQL 16 | 127.0.0.1:55433 |

Check the container status:

```bash
docker compose ps
```

PostgreSQL uses the Docker named volume `part3_pgdata` for data persistence. Stopping or rebuilding containers does not automatically delete this volume.

### 3. Initialize Demo Database

**Execute the following command only when initializing a new database for the first time.**

```bash
docker compose exec -T backend python -m scripts.setup_part3_db --database-url postgresql://supplytrace:supplytrace@postgres:5432/supplytrace_part3
```

The initialization script will:

1. Check whether the schema, validation SQL, and data files exist.
2. Verify the SHA256 checksums, headers, and expected row counts of the CSV files.
3. Create the 16 relational tables of SupplyTrace.
4. Import the 57 fixed demo events and associated data provided in the repository.
5. Perform data validation.

The script refuses to initialize a database that already contains the SupplyTrace schema and does not automatically clear or replace existing data.

**Note:** If `PART3_DB_PASSWORD` is set, the database password in the initialization command must be adjusted accordingly.

If an error occurs during initialization, check the logs and database status first. Do not directly delete the Docker volume or repeatedly initialize an existing database.

### 4. Open the Application

After initialization, open the following address in a browser:

**Frontend:** http://127.0.0.1:5174

The demo features include:

- Overview: View orders and their latest abnormal events.
- Order Timeline: View the event timeline of an order.
- Root Cause: Recursively trace the upstream causal chain of an abnormal event.
- Impact Analysis: Analyze downstream events and orders affected by an abnormal event.
- Stage Durations: View the average and P90 durations of each business stage.

The demo dataset contains 57 fixed events and is independent of the 100k, 500k, and 1m performance benchmark datasets in Part 2.

### 5. Health Check

Check the backend health status:

```bash
curl http://127.0.0.1:8002/health
```

View container logs:

```bash
docker compose logs --tail=100 backend
```

The frontend accesses the Backend through the Docker network and uses the Vite development proxy to forward API requests.

The current Docker configuration is intended for local development and course demonstrations. The frontend runs on the Vite Development Server rather than a production static file server.

### 6. Tests and Benchmarks

The following tests and benchmarks have been completed:

| Category | Result |
|---|---|
| Backend automated tests | 40 passed |
| Frontend automated tests | 53 passed |
| API smoke tests | 10 passed |
| HTTP integration checks | 9 passed |
| Data quality checks | 24/24 at each dataset scale |
| Benchmark scales | 100k / 500k / 1m events |

Detailed results:

- [Backend Test Records](docs/part3/TEST_RESULTS.txt)
- [Test Summary](docs/part3/TEST_SUMMARY.md)
- [Benchmark Summary](docs/part3/BENCHMARK_SUMMARY.md)
- [Query Plan and Index Analysis](docs/part3/PERFORMANCE.md)
- [Frontend Testing and Usage Guide](frontend/README.md)

Frontend automated tests can be executed from the `frontend` directory:

```bash
npm ci
npm test
```

Performance benchmarks use separate PostgreSQL databases. Data replacement or clearing operations should not be performed directly on the demo database.

### 7. Stop Services Safely

Stop the services while preserving the database:

```bash
docker compose down
```

Restart the services:

```bash
docker compose up -d
```

**Do not use `docker compose down -v` to clean up the demo environment.** The `-v` option removes the database named volume managed by Compose, which may result in the loss of existing data.

---

## Part 4 Frontend and Visualization

The React + TypeScript frontend includes four views: order timeline, root cause tracing, impact propagation, and stage durations. The homepage summarizes the latest abnormal events of the seed orders upon loading, and all views retrieve data from the actual Part 3 APIs. For startup instructions, environment variables, routing, and demo paths, see the [Frontend Guide](frontend/README.md).

```bash
cd frontend
npm install
npm run dev
```

By default, the development server proxies `/api` and `/health` to `http://127.0.0.1:8001`. When the backend is not running, `VITE_USE_MOCK=true` can be set to use fixed responses for the supplier delay scenario. For the demo storyboard, see [docs/part4/VIDEO_STORYBOARD.md](docs/part4/VIDEO_STORYBOARD.md).

## Part 3 Backend and Core Queries

Four categories of FastAPI APIs, recursive graph queries, response models, error handling, and tests have been completed. See the [Member 3 Deliverables](docs/part3/README.md), [Setup Guide](docs/part3/DATABASE_SETUP.md), [API Contract](docs/part3/API_CONTRACT.md), and [Query Plan Comparison](docs/part3/PERFORMANCE.md).

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
# Configure .env and initialize a separate PostgreSQL development database according to the setup guide first
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Swagger: `http://127.0.0.1:8001/docs`. Full regression testing: `.venv/bin/python -m scripts.verify_part3` (requires a local PostgreSQL instance that allows the creation of a separate test database). All 40 tests passed; all 24 data checks passed for the 100k-event dataset.

## Part 2 Synthetic Data

Python 3.11+, PostgreSQL 16+, and `psql` are required. Execute the following commands from the repository root directory using a separate development database.

```bash
python data_generator.py --seed 5003 --events 100000 --output generated/events-100000
createdb supplytrace_generated
psql -d supplytrace_generated -v ON_ERROR_STOP=1 -f supplytrace_schema_v1.sql
python import_data.py generated/events-100000 --dbname supplytrace_generated
```

The generator supports the following dataset scales. It is recommended to consistently use `--seed 5003` for acceptance testing. The output directory must be a new directory. Large files in `generated/` can be regenerated using the generation commands.

| `--events` | Purpose | Recommended Output Directory |
|---:|---|---|
| `100000` | Part 2 milestone dataset | `generated/events-100000` |
| `500000` | 500k-event dataset | `generated/events-500000` |
| `1000000` | 1m-event dataset | `generated/events-1000000` |
| `57` | Regenerate the fixed benchmark dataset separately | `generated/benchmark-57` |

The repository includes a [fixed benchmark dataset of 57 events](benchmark_data/manifest.json). In an empty test database with an initialized schema, directly execute `python import_data.py benchmark_data --dbname supplytrace_generated` to import the dataset.

With the same Python version, the same seed and dataset scale produce identical CSV files and manifests. The import process uses the foreign keys and triggers defined in the schema and commits the database transaction only after validation passes. By default, only empty databases are accepted. When rerunning the import on the same separate development database, `--replace` can be explicitly specified to clear and replace the SupplyTrace tables. To run checks only on previously imported data, specify `--validate-only`. Connection parameters can be configured through standard `PG*` environment variables or a `--dbname` connection string. If `psql` is not in PATH, specify `--psql`.

See the [Synthetic Data Dictionary](data_dictionary.md), [Fixed Benchmark Scenarios](benchmark_cases.json), and [Data Quality Report](data_quality_report.md).

## Part 1 Database Design

Part 1 files cover the requirements, architecture, ERD, schema, constraints, indexes, data dictionary, fixed sample data, and queries for Track 1.

## Files

| File | Purpose |
|---|---|
| `SupplyTrace_Part1_数据库设计.md` | Requirements description, architecture description, index description, and initial draft of Sections 3–5 of the report |
| `SupplyTrace_Part1_验证记录.md` | Execution and negative test records |
| `supplytrace_schema_v1.sql` | Complete schema |
| `migrations/001_initial_schema.sql` | Initial migration |
| `supplytrace_sample_data.sql` | Fixed abnormal event scenario |
| `supplytrace_sample_queries.sql` | Four categories of queries |
| `supplytrace_validation_queries.sql` | Integrity checks |
| `supplytrace_data_dictionary.csv` | Data dictionary covering 16 tables and 151 fields |
| `assets/` | Architecture diagram, ERD, and scenario diagrams |

## Data Loading

Execute the following commands in a PostgreSQL 16 development database:

```bash
createdb supplytrace
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_schema_v1.sql
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_sample_data.sql
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_validation_queries.sql
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_sample_queries.sql
```

`supplytrace_sample_data.sql` clears the SupplyTrace tables and must only be used in a development database. `supplytrace_schema_v1.sql` and `migrations/001_initial_schema.sql` have identical contents. Execute only one of them during initialization.

## Expected Validation Results

| Check | Result |
|---|---|
| Timeline of order `SO-2026-1101-A` | 11 events |
| Root cause chain of event 215 | 11 nodes, with event 204 as the earliest abnormal event |
| Impact scope of event 204 | Order A and Order B |
| Fixed scenario | 17 events, 1 root event, and 5 abnormal events |
| Maximum causal depth | 10 |

Future schema changes should use new migrations, with corresponding updates to the ERD, data dictionary, and API models.