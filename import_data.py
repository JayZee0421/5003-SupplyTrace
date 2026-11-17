"""Load generated SupplyTrace CSVs with psql and validate before committing."""

import argparse
import csv
import json
import os
import subprocess
from pathlib import Path

from data_generator import COLUMNS, FORMAT_VERSION, PRESETS, sha256_file

HERE = Path(__file__).resolve().parent


def read_manifest(folder, verify_files):
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    if manifest["format_version"] != FORMAT_VERSION or manifest["event_count"] not in PRESETS:
        raise ValueError("Unsupported dataset format or event count")
    tables = manifest["tables"]
    if set(tables) != COLUMNS.keys():
        raise ValueError("Manifest tables do not match schema v1 export")
    for table, info in tables.items():
        if type(info["rows"]) is not int or info["rows"] < 0:
            raise ValueError(f"Invalid row count: {table}")
        if verify_files:
            file = folder / f"{table}.csv"
            if sha256_file(file) != info["sha256"]:
                raise ValueError(f"CSV checksum mismatch: {file}")
            with file.open(encoding="utf-8", newline="") as stream:
                if next(csv.reader(stream), None) != COLUMNS[table].split():
                    raise ValueError(f"Unexpected CSV header: {file}")
    if tables["supply_chain_events"]["rows"] != manifest["event_count"]:
        raise ValueError("Event count does not match manifest")
    return tables


def make_sql(tables, replace, validate_only):
    sql = [
        "BEGIN ISOLATION LEVEL REPEATABLE READ;" if validate_only else "BEGIN;",
        "SET LOCAL search_path = public, pg_temp;",
        "SET LOCAL TIME ZONE 'UTC';",
        "SET LOCAL supplytrace.actor = 'supplytrace-generator';",
        "CREATE TEMP TABLE expected_counts (table_name text PRIMARY KEY, rows bigint);",
    ]
    for table in COLUMNS:
        sql.append(f"INSERT INTO expected_counts VALUES ('{table}', {tables[table]['rows']});")

    cases_json = (HERE / "benchmark_cases.json").read_text(encoding="utf-8")
    sql.append(
        "CREATE TEMP TABLE expected_cases AS SELECT * FROM jsonb_to_recordset("
        "$cases$" + cases_json + "$cases$::jsonb) AS fixture("
        "scenario text, root_event_id bigint, root_event_type text, root_status event_status, "
        "trace_from_event_id bigint, primary_chain_event_ids bigint[], secondary_effect_event_id bigint, "
        "impacted_orders text[], impacted_delivery_event_ids bigint[]);"
    )

    if not validate_only:
        names = ", ".join((*COLUMNS, "audit_log"))
        if replace:
            sql.append(f"TRUNCATE TABLE {names} RESTART IDENTITY;")
        else:
            sql.append(f"LOCK TABLE {names} IN ACCESS EXCLUSIVE MODE;")
            nonempty = " OR ".join(
                f"EXISTS (SELECT FROM {table})" for table in (*COLUMNS, "audit_log")
            )
            sql.append(f"""DO $$ BEGIN
                IF {nonempty} THEN
                    RAISE EXCEPTION 'Target contains SupplyTrace rows. Use a fresh database or explicitly pass --replace.';
                END IF;
                END $$;""")
        for table, columns in COLUMNS.items():
            sql.append(
                fr"\copy {table} ({', '.join(columns.split())}) FROM '{table}.csv' WITH (FORMAT CSV, HEADER true)"
            )
        # Explicit IDs in COPY do not advance identities. ALTER ... RESTART is transactional.
        for table, columns in COLUMNS.items():
            if table in {"purchase_line_allocations", "event_types", "causal_links"}:
                continue
            identity = columns.split()[0]
            sql.extend([
                f"SELECT format('ALTER TABLE {table} ALTER COLUMN {identity} RESTART WITH %s', "
                f"coalesce(max({identity}), 0) + 1) FROM {table}",
                r"\gexec",
            ])

    sql.append((HERE / "validate_generated_data.sql").read_text(encoding="utf-8"))
    sql.append("COMMIT;")
    return "\n".join(sql) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="Directory written by data_generator.py")
    parser.add_argument("--dbname", required=True, help="PostgreSQL database name or libpq connection string")
    parser.add_argument("--psql", default="psql", help="Path to the psql executable")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--replace", action="store_true", help="Replace all SupplyTrace rows in this database")
    modes.add_argument("--validate-only", action="store_true", help="Validate an existing import against its manifest")
    args = parser.parse_args()

    try:
        folder = args.dataset.resolve()
        tables = read_manifest(folder, verify_files=not args.validate_only)
        sql = make_sql(tables, args.replace, args.validate_only)
        result = subprocess.run(
            [args.psql, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", f"--dbname={args.dbname}", "-f", "-"],
            input=sql.encode("utf-8"), cwd=folder, env={**os.environ, "PGCLIENTENCODING": "UTF8"},
        )
    except (KeyError, OSError, TypeError, ValueError) as error:
        parser.exit(1, f"{error}\n")
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
