"""Initialize only a new, explicitly selected database; never overwrite data."""

import argparse
from pathlib import Path

import psycopg
from psycopg import sql

from data_generator import COLUMNS
from import_data import read_manifest, make_sql


ROOT = Path(__file__).resolve().parents[1]


def preflight(dataset):
    """Check required files and prepare validation SQL before touching the database."""

    required_files = [
        ROOT / "supplytrace_schema_v1.sql",
        ROOT / "benchmark_cases.json",
        ROOT / "validate_generated_data.sql",
    ]

    for file in required_files:
        if not file.is_file():
            raise FileNotFoundError(
                f"Required initialization file is missing: {file}"
            )

    # Verify manifest, CSV checksums, headers, and expected row counts.
    tables = read_manifest(dataset, verify_files=True)

    # Ensure validation SQL can be generated before modifying the database.
    make_sql(tables, replace=False, validate_only=True)

    return tables


def initialize(conn, dataset, tables):
    """Create schema and import data into a new database only."""

    if conn.execute(
        "SELECT to_regclass('public.supply_chain_events')"
    ).fetchone()[0]:
        raise RuntimeError(
            "Target already contains SupplyTrace schema; use a NEW database"
        )

    conn.execute(
        (ROOT / "supplytrace_schema_v1.sql").read_text(encoding="utf-8")
    )

    with conn.transaction():
        for table, columns in COLUMNS.items():
            with conn.cursor().copy(
                f"COPY {table} ({', '.join(columns.split())}) "
                "FROM STDIN WITH (FORMAT CSV, HEADER true)"
            ) as copy:
                with (dataset / f"{table}.csv").open("rb") as stream:
                    while block := stream.read(1024 * 1024):
                        copy.write(block)

            actual = conn.execute(
                f"SELECT count(*) FROM {table}"
            ).fetchone()[0]

            if actual != tables[table]["rows"]:
                raise RuntimeError(
                    f"Count mismatch for {table}: "
                    f"expected {tables[table]['rows']}, got {actual}"
                )

        # Explicit IDs in COPY do not advance identity sequences.
        for table, columns in COLUMNS.items():
            if table in {
                "purchase_line_allocations",
                "event_types",
                "causal_links",
            }:
                continue

            identity = columns.split()[0]

            next_id = conn.execute(
                sql.SQL(
                    "SELECT coalesce(max({}), 0) + 1 FROM {}"
                ).format(
                    sql.Identifier(identity),
                    sql.Identifier(table),
                )
            ).fetchone()[0]

            conn.execute(
                sql.SQL(
                    "ALTER TABLE {} ALTER COLUMN {} RESTART WITH {}"
                ).format(
                    sql.Identifier(table),
                    sql.Identifier(identity),
                    sql.Literal(next_id),
                )
            )

        conn.execute("ANALYZE")


def validate_dataset(conn, dataset):
    """Run the existing SupplyTrace dataset validation SQL."""

    tables = read_manifest(dataset, verify_files=True)

    cursor = conn.execute(
        make_sql(tables, replace=False, validate_only=True),
        prepare=False,
    )

    report = None

    while True:
        if cursor.description:
            report = cursor.fetchone()[0]

        if not cursor.nextset():
            break

    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)

    parser.add_argument(
        "--database-url",
        required=True,
        help="Connection URL for a new SupplyTrace PostgreSQL database",
    )

    parser.add_argument(
        "--dataset",
        type=Path,
        default=ROOT / "benchmark_data",
        help="Directory containing the generated demo dataset",
    )

    args = parser.parse_args()
    dataset = args.dataset.resolve()

    # Perform all file checks before connecting to the database.
    tables = preflight(dataset)

    with psycopg.connect(args.database_url, autocommit=True) as conn:
        initialize(conn, dataset, tables)
        print(validate_dataset(conn, dataset))

    print(
        "Schema and checksum-verified dataset loaded; "
        "existing databases are never overwritten."
    )


if __name__ == "__main__":
    main()