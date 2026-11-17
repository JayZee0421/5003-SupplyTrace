import os
from pathlib import Path
import pytest
import psycopg
from psycopg.rows import dict_row
from fastapi.testclient import TestClient
from backend.main import create_app, get_conn
from backend.config import Settings
from scripts.setup_part3_db import initialize, validate_dataset

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope='session')
def database_url():
    url = os.getenv('TEST_DATABASE_URL')
    if not url:
        pytest.skip('Set TEST_DATABASE_URL to a disposable NEW database to run integration tests')
    with psycopg.connect(url, autocommit=True) as conn:
        # No truncate/drop: initialization refuses an existing schema.
        initialize(conn, ROOT / 'benchmark_data')
        report = validate_dataset(conn, ROOT / 'benchmark_data')
        assert report['checks_run'] == 24 and report['failed_checks'] == 0
    return url


@pytest.fixture
def db(database_url):
    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        conn.execute("SET LOCAL TIME ZONE 'UTC'")
        yield conn
        conn.rollback()  # all edge-case mutations are rolled back


@pytest.fixture
def api(db):
    app = create_app(Settings())
    app.dependency_overrides[get_conn] = lambda: db
    with TestClient(app) as client:
        yield client
