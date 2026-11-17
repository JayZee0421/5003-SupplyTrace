"""Initialize a new benchmark database, verify known cases, and save real plans.

Index comparison drops one index inside a transaction and ALWAYS rolls back.
Use a disposable database only; table locks are taken during this experiment.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import statistics
import time
import psycopg
from psycopg.rows import dict_row
from psycopg.conninfo import make_conninfo
from backend.db import load_sql
from backend import service
from scripts.setup_part3_db import initialize, validate_dataset

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/part3/plans'


def plan_indexes(node):
    result = {node['Index Name']} if 'Index Name' in node else set()
    for child in node.get('Plans', []):
        result.update(plan_indexes(child))
    return result


def measure(conn, name, sql, params, runs=5):
    conn.execute(sql, params).fetchall()  # warm-up, actual results
    results = []
    for _ in range(runs):
        plan = conn.execute('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+sql, params).fetchone()['QUERY PLAN'][0]
        results.append(plan)
    median = statistics.median(p['Execution Time'] for p in results)
    representative = min(results, key=lambda p: abs(p['Execution Time']-median))
    (OUT / f'{name}.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    return {'query_parameters': params, 'median_ms': median, 'runs_ms': [p['Execution Time'] for p in results],
            'shared_hit_blocks': representative['Plan'].get('Shared Hit Blocks',0),
            'shared_read_blocks': representative['Plan'].get('Shared Read Blocks',0),
            'indexes': sorted(plan_indexes(representative['Plan']))}


def verify(conn):
    cases = json.loads((ROOT/'benchmark_cases.json').read_text())
    result = []
    for case in cases:
        root = service.root_cause(conn, case['trace_from_event_id'],64)
        impact = service.impact(conn,case['root_event_id'],64)
        assert [n['event_id'] for n in root['nodes']] == case['primary_chain_event_ids']
        assert root['earliest_exception_event_id']==case['root_event_id']
        assert [o['order_number'] for o in impact['orders']]==case['impacted_orders']
        result.append({'scenario':case['scenario'], 'root_event_id':root['earliest_exception_event_id'],
                       'chain_nodes':root['count'], 'impacted_orders':[o['order_number'] for o in impact['orders']]})
    return result


def run(url, dataset):
    OUT.mkdir(parents=True, exist_ok=True)
    with psycopg.connect(url, autocommit=True) as raw:
        if not raw.execute("SELECT to_regclass('public.supply_chain_events')").fetchone()[0]:
            initialize(raw, dataset)
        quality_report = validate_dataset(raw, dataset)
    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as conn:
        conn.execute("SET TIME ZONE 'UTC'")
        conn.execute("SET statement_timeout = '120s'")
        event_count = conn.execute('SELECT count(*) AS n FROM supply_chain_events').fetchone()['n']
        manifest = json.loads((dataset/'manifest.json').read_text())
        assert event_count==manifest['event_count']
        summary = {'timestamp':datetime.now(timezone.utc).isoformat(),
                   'postgres': conn.execute('SELECT version() AS v').fetchone()['v'],
                   'event_count':event_count, 'manifest_sha256':hashlib.sha256((dataset/'manifest.json').read_bytes()).hexdigest(),
                   'seed':manifest['seed'], 'quality_checks':quality_report, 'scenarios':verify(conn), 'core':{},'index_comparisons':{},'traversal_comparison':{}}
        summary['index_definitions'] = [r['indexdef'] for r in conn.execute(
            "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_events_caused_by','idx_events_entity_time','idx_events_type_time') ORDER BY indexname")]
        assert len(summary['index_definitions'])==3
        params = {'event_id':3,'max_depth':64,'order_id':1,'order_number':None,'order_line_id':None,'start_time':None,'end_time':None}
        for name in ('timeline','root_cause','impact','stage_durations'):
            p = dict(params, event_id=10) if name=='root_cause' else params
            summary['core'][name]=measure(conn,name,load_sql(name),p)
        comparisons = {
            'caused_by':('idx_events_caused_by','SELECT event_id FROM supply_chain_events WHERE caused_by_event_id = %(event_id)s', {'event_id':3}),
            'entity_time':('idx_events_entity_time',"SELECT event_id,event_time FROM supply_chain_events WHERE entity_type='SUPPLIER' AND entity_id=2 AND event_time >= '2026-01-01T00:00:00Z' ORDER BY event_time DESC,event_id DESC LIMIT 50",{}),
            'type_time':('idx_events_type_time',"SELECT event_id,event_time FROM supply_chain_events WHERE event_type_code='SUPPLIER_DELAYED' AND event_time >= '2026-01-01T00:00:00Z' ORDER BY event_time DESC,event_id DESC LIMIT 50",{})}
        for label,(index,query,values) in comparisons.items():
            (OUT/f'{label}.sql').write_text(query+';\n')
            expected=conn.execute(query,values).fetchall()
            assert expected, f'Index probe {label} must return actual data'
            indexed=measure(conn,label+'_indexed',query,values)
            with conn.transaction(force_rollback=True):
                from psycopg import sql
                conn.execute(sql.SQL('DROP INDEX {}').format(sql.Identifier(index)))
                assert conn.execute(query,values).fetchall()==expected
                unindexed=measure(conn,label+'_without_index',query,values)
            summary['index_comparisons'][label]={'index':index,'with_index':indexed,'without_index':unindexed,'results_equal':True,'result_rows':len(expected)}
        optimized=load_sql('impact').split('SELECT s.event_id, s.steps,')[0]+'SELECT event_id,steps FROM shortest ORDER BY event_id'
        original=load_sql('baseline_impact')
        assert conn.execute(original,params).fetchall()==conn.execute(optimized,params).fetchall()
        summary['traversal_comparison']={'results_equal':True,
            'before_part1':measure(conn,'traversal_before',original,params),
            'after_part3':measure(conn,'traversal_after',optimized,params)}
        (OUT/'traversal_after.sql').write_text(optimized+';\n')
        (OUT/'summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
        print(json.dumps(summary,indent=2,ensure_ascii=False))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset',type=Path,default=ROOT/'generated/events-100000')
    parser.add_argument('--database-url',default=os.getenv('BENCHMARK_DATABASE_URL'))
    args=parser.parse_args()
    url=args.database_url
    if not url:
        parser.error('Set BENCHMARK_DATABASE_URL to a new disposable database')
    run(url,args.dataset.resolve())


if __name__=='__main__':
    main()
