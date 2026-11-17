"""Run all tests in a newly created isolated database, preserving existing data."""
import os
import subprocess
import sys
import uuid
from pathlib import Path
import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo

ROOT = Path(__file__).resolve().parents[1]


def main():
    admin_url = os.getenv('DATABASE_URL', 'postgresql://supplytrace:supplytrace@127.0.0.1:55433/supplytrace_part3')
    name = 'supplytrace_test_' + uuid.uuid4().hex[:12]
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
        try:
            test_url = make_conninfo(admin_url, dbname=name)
            result = subprocess.run([sys.executable, '-m', 'pytest', '-q', *sys.argv[1:]], cwd=ROOT,
                env={**os.environ, 'TEST_DATABASE_URL': test_url}, capture_output=True, text=True)
            print(result.stdout, end='')
            print(result.stderr, end='', file=sys.stderr)
            report = ROOT / 'docs/part3/TEST_RESULTS.txt'
            report.write_text('Command: python -m scripts.verify_part3\nDatabase: NEW disposable PostgreSQL DB per run\n'
                              + result.stdout + result.stderr, encoding='utf-8')
            return result.returncode
        finally:
            # Only the database created by this invocation is removed.
            admin.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(name)))


if __name__ == '__main__':
    raise SystemExit(main())
