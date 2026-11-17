"""Initialize only a new, explicitly selected database; never overwrite data."""
import argparse
from pathlib import Path
import psycopg
from data_generator import COLUMNS
from import_data import read_manifest, make_sql

ROOT = Path(__file__).resolve().parents[1]


def initialize(conn, dataset):
    if conn.execute("SELECT to_regclass('public.supply_chain_events')").fetchone()[0]:
        raise RuntimeError('Target already contains SupplyTrace schema; use a NEW database')
    tables = read_manifest(dataset, verify_files=True)
    conn.execute((ROOT / 'supplytrace_schema_v1.sql').read_text())
    with conn.transaction():
        for table, columns in COLUMNS.items():
            with conn.cursor().copy(f"COPY {table} ({', '.join(columns.split())}) FROM STDIN WITH (FORMAT CSV, HEADER true)") as copy:
                with (dataset / f'{table}.csv').open('rb') as stream:
                    while block := stream.read(1024*1024):
                        copy.write(block)
            actual = conn.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
            if actual != tables[table]['rows']:
                raise RuntimeError(f'Count mismatch for {table}')
        for table, columns in COLUMNS.items():
            if table in {'purchase_line_allocations', 'event_types', 'causal_links'}:
                continue
            identity = columns.split()[0]
            from psycopg import sql
            next_id = conn.execute(sql.SQL('SELECT coalesce(max({}),0)+1 FROM {}').format(
                sql.Identifier(identity), sql.Identifier(table))).fetchone()[0]
            conn.execute(sql.SQL('ALTER TABLE {} ALTER COLUMN {} RESTART WITH {}').format(
                sql.Identifier(table), sql.Identifier(identity), sql.Literal(next_id)))
        conn.execute('ANALYZE')


def validate_dataset(conn, dataset):
    tables = read_manifest(dataset, verify_files=True)
    cursor = conn.execute(make_sql(tables, replace=False, validate_only=True), prepare=False)
    report = None
    while True:
        if cursor.description:
            report = cursor.fetchone()[0]
        if not cursor.nextset():
            break
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-url', required=True)
    parser.add_argument('--dataset', type=Path, default=ROOT / 'benchmark_data')
    args = parser.parse_args()
    with psycopg.connect(args.database_url, autocommit=True) as conn:
        initialize(conn, args.dataset.resolve())
        print(validate_dataset(conn, args.dataset.resolve()))
    print('Schema and checksum-verified dataset loaded; existing databases are never overwritten.')


if __name__ == '__main__':
    main()
