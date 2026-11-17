import json
from pathlib import Path
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
import pytest
from backend.db import load_sql
from backend import service

pytestmark = pytest.mark.integration
CASES = json.loads((Path(__file__).resolve().parents[1] / 'benchmark_cases.json').read_text())
CODES = ['ORDER_CONFIRMED','PURCHASE_CREATED','SUPPLIER_CONFIRMED','QUALITY_CHECK',
         'PRODUCTION_STARTED','PRODUCTION_COMPLETED','SHIPMENT_DISPATCHED','SHIPMENT_ARRIVED','DELIVERY_SIGNED']


@pytest.mark.parametrize('case', CASES, ids=lambda c: c['scenario'])
def test_member2_scenarios(api, case):
    r = api.get(f"/api/events/{case['trace_from_event_id']}/root-cause")
    assert r.status_code == 200
    graph = r.json()
    assert [n['event_id'] for n in graph['nodes']] == case['primary_chain_event_ids']
    assert graph['earliest_exception_event_id'] == case['root_event_id']
    assert not graph['truncated'] and not graph['cycle_detected']
    r = api.get(f"/api/events/{case['root_event_id']}/impact")
    assert r.status_code == 200
    impact = r.json()
    assert [o['order_number'] for o in impact['orders']] == case['impacted_orders']
    assert {n['event_id'] for n in impact['nodes']} >= set(case['impacted_delivery_event_ids'])
    assert len({n['event_id'] for n in impact['nodes']}) == impact['count']
    for order in impact['orders']:
        timeline = api.get(f"/api/orders/{order['order_number']}/timeline").json()
        assert timeline['count'] in (9,10)
        assert [(n['event_time'],n['event_id']) for n in timeline['events']] == sorted((n['event_time'],n['event_id']) for n in timeline['events'])
        assert order['lines'][0]['current_commitment'] is not None


@pytest.mark.parametrize('url', ['/api/events/999999/root-cause','/api/events/999999/impact',
    '/api/orders/missing/timeline','/api/analytics/stage-durations?order_number=missing',
    '/api/analytics/stage-durations?order_line_id=999999'])
def test_not_found(api, url):
    assert api.get(url).status_code == 404


def test_empty_timeline_and_stats(api, db):
    db.execute("INSERT INTO orders(order_number,customer_id,ordered_at,required_date) SELECT 'EMPTY',customer_id,ordered_at,required_date FROM orders LIMIT 1")
    assert api.get('/api/orders/EMPTY/timeline').json()['events'] == []
    result = api.get('/api/analytics/stage-durations?order_number=EMPTY').json()
    assert len(result['stages']) == 8
    assert all(s['sample_lines'] == 0 and s['average_hours'] is None and s['p90_hours'] is None for s in result['stages'])


def test_depth_limits_and_leaf(api):
    root = api.get('/api/events/10/root-cause?max_depth=0').json()
    assert root['count'] == 1 and root['truncated'] and root['chain_start_event_id'] is None
    assert api.get('/api/events/1/root-cause?max_depth=0').json()['truncated'] is False
    graph = api.get('/api/events/3/impact?max_depth=0').json()
    assert graph['count'] == 1 and graph['truncated']
    leaf = api.get('/api/events/10/impact').json()
    assert leaf['count'] == 1 and leaf['edges'] == [] and not leaf['truncated']
    assert api.get('/api/events/10/root-cause?max_depth=9').json()['truncated'] is False


def test_diamond_duplicate_edges_and_shortest_path(api, db):
    # Valid additional edges create both a duplicate primary pair and a diamond.
    db.execute("INSERT INTO causal_links(cause_event_id,effect_event_id) VALUES(3,4),(3,5),(4,6)")
    graph = api.get('/api/events/3/impact').json()
    by_id = {n['event_id']: n for n in graph['nodes']}
    assert by_id[6]['steps'] == 2
    assert by_id[6]['path'] == [3,4,6]
    assert len(by_id) == graph['count']
    assert graph['affected_order_count'] == 2
    assert len([e for e in graph['edges'] if e['cause_event_id']==3 and e['effect_event_id']==4]) == 2
    assert not graph['cycle_detected']


def test_cycle_protection_in_isolated_rollback(api, db):
    # The production schema rejects cycles; bypass ONLY user triggers in this
    # uncommitted fixture, retaining constraints, then exercise real SQL.
    db.execute('ALTER TABLE supply_chain_events DISABLE TRIGGER USER')
    db.execute('UPDATE supply_chain_events SET caused_by_event_id=10 WHERE event_id=1')
    root = api.get('/api/events/10/root-cause').json()
    assert root['count'] == 10 and root['cycle_detected'] and not root['truncated']
    assert root['chain_start_event_id'] is None
    impact = api.get('/api/events/3/impact').json()
    assert impact['cycle_detected'] and not impact['truncated']
    assert impact['count'] == len({n['event_id'] for n in impact['nodes']})
    db.execute('ALTER TABLE supply_chain_events ENABLE TRIGGER USER')


def test_equal_timestamp_ordering(api, db):
    db.execute('ALTER TABLE supply_chain_events DISABLE TRIGGER USER')
    db.execute('UPDATE supply_chain_events SET event_time=(SELECT event_time FROM supply_chain_events WHERE event_id=1) WHERE event_id=2')
    timeline = api.get('/api/orders/SO-SYN-000001/timeline').json()['events']
    assert [e['event_id'] for e in timeline[:2]] == [1,2]


def independent_durations(db, line_id=None):
    times = {}
    for e in db.execute('SELECT order_line_id,event_type_code,event_time,status::text FROM supply_chain_events ORDER BY event_time'):
        if line_id is not None and e['order_line_id'] != line_id:
            continue
        if e['event_type_code']=='QUALITY_CHECK' and e['status']!='NORMAL':
            continue
        times.setdefault(e['order_line_id'], {}).setdefault(e['event_type_code'],e['event_time'])
    samples = [[] for _ in range(8)]
    for line in times.values():
        for i,(a,b) in enumerate(zip(CODES,CODES[1:])):
            if a in line and b in line:
                hours = (line[b]-line[a]).total_seconds()/3600
                if hours >= 0:
                    samples[i].append(hours)
    def rounded(n):
        return float(Decimal(str(n)).quantize(Decimal('.01'),rounding=ROUND_HALF_UP))
    result = []
    for values in samples:
        values.sort()
        if not values:
            result.append((0,None,None))
            continue
        rank = (len(values)-1)*.9
        lo = int(rank)
        p90 = values[lo] + (values[min(lo+1,len(values)-1)]-values[lo])*(rank-lo)
        result.append((len(values),rounded(sum(values)/len(values)),rounded(p90)))
    return result


@pytest.mark.parametrize('line_id',[None,1,3,5])
def test_stats_independent_oracle(api, db, line_id):
    url = '/api/analytics/stage-durations' + (f'?order_line_id={line_id}' if line_id else '')
    result = api.get(url).json()['stages']
    assert [(s['sample_lines'],s['average_hours'],s['p90_hours']) for s in result] == independent_durations(db,line_id)


def test_missing_negative_zero_and_incomplete(api, db):
    db.execute('ALTER TABLE supply_chain_events DISABLE TRIGGER USER')
    # Missing delivery stage, a zero first stage, and an inverted production pair.
    db.execute("UPDATE supply_chain_events SET event_type_code='SHIPMENT_ARRIVED' WHERE event_id=10")
    db.execute('UPDATE supply_chain_events SET event_time=(SELECT event_time FROM supply_chain_events WHERE event_id=1) WHERE event_id=2')
    db.execute("UPDATE supply_chain_events SET event_time='2025-01-01T00:00:00Z' WHERE event_id=7")
    stages = api.get('/api/analytics/stage-durations?order_line_id=1').json()['stages']
    assert stages[0]['average_hours'] == 0
    assert stages[4]['sample_lines'] == 0 and stages[7]['sample_lines'] == 0
    assert [(s['sample_lines'],s['average_hours'],s['p90_hours']) for s in stages] == independent_durations(db,1)


def test_cohort_window_keeps_later_events(api, db):
    t = db.execute("SELECT event_time FROM supply_chain_events WHERE event_id=1").fetchone()['event_time']
    all_stats = api.get('/api/analytics/stage-durations?order_line_id=1').json()['stages']
    filtered = api.get('/api/analytics/stage-durations',params={'order_line_id':1,'start_time':t.isoformat(),'end_time':(t+timedelta(seconds=1)).isoformat()})
    assert filtered.json()['stages'] == all_stats
    empty = api.get('/api/analytics/stage-durations', params={'start_time':'2099-01-01T00:00:00Z'}).json()
    assert all(s['sample_lines']==0 for s in empty['stages'])


def test_read_only_snapshot(database_url):
    import psycopg
    from backend.db import Database
    from backend.config import Settings
    db = Database(Settings(database_url=database_url))
    db.pool.open()
    try:
        with pytest.raises(psycopg.errors.ReadOnlySqlTransaction):
            with db.snapshot() as conn:
                assert conn.execute('SHOW transaction_isolation').fetchone()['transaction_isolation']=='repeatable read'
                conn.execute("UPDATE orders SET order_number='FORBIDDEN'")
    finally:
        db.pool.close()


def test_no_exception_root_and_long_chain_limit(api, db):
    graph = api.get('/api/events/1/root-cause').json()
    assert graph['earliest_exception_event_id'] is None and graph['chain_start_event_id'] == 1
    db.execute('ALTER TABLE supply_chain_events DISABLE TRIGGER USER')
    db.execute('''INSERT INTO supply_chain_events(event_id,event_type_code,event_time,entity_type,entity_id,caused_by_event_id)
        SELECT g,'ORDER_CONFIRMED','2026-01-01T00:00:00Z',entity_type,entity_id,
               CASE WHEN g=1001 THEN NULL ELSE g-1 END
        FROM generate_series(1001,1071) g CROSS JOIN (SELECT entity_type,entity_id FROM supply_chain_events WHERE event_id=1) e''')
    root = api.get('/api/events/1071/root-cause').json()
    assert root['count']==65 and root['truncated'] and not root['cycle_detected']
    impact = api.get('/api/events/1001/impact').json()
    assert impact['count']==65 and impact['truncated'] and not impact['cycle_detected']
    assert impact['orders']==[]


def test_supplemental_cycle_and_exact_frontier(api, db):
    db.execute('ALTER TABLE causal_links DISABLE TRIGGER USER')
    db.execute('INSERT INTO causal_links(cause_event_id,effect_event_id) VALUES(10,3)')
    graph = api.get('/api/events/3/impact').json()
    assert graph['cycle_detected'] and not graph['truncated']
    assert graph['count']==len({n['event_id'] for n in graph['nodes']})
    assert api.get('/api/events/3/impact?max_depth=7').json()['truncated'] is False


def test_query_statement_timeout(database_url):
    import psycopg
    from backend.db import Database
    from backend.config import Settings
    database = Database(Settings(database_url=database_url, statement_timeout_ms=100))
    database.pool.open()
    try:
        with pytest.raises(psycopg.errors.QueryCanceled):
            with database.snapshot() as conn:
                conn.execute('SELECT pg_sleep(1)')
    finally:
        database.pool.close()


def test_member1_original_fixture(database_url):
    import uuid
    import psycopg
    from psycopg import sql
    from psycopg.rows import dict_row
    from psycopg.conninfo import make_conninfo
    name = 'supplytrace_part1_' + uuid.uuid4().hex[:12]
    root_path = Path(__file__).resolve().parents[1]
    with psycopg.connect(database_url,autocommit=True) as admin:
        admin.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
        try:
            with psycopg.connect(make_conninfo(database_url,dbname=name),autocommit=True,row_factory=dict_row) as conn:
                conn.execute((root_path/'supplytrace_schema_v1.sql').read_text())
                conn.execute((root_path/'supplytrace_sample_data.sql').read_text())
                timeline = service.timeline(conn,'SO-2026-1101-A')
                root = service.root_cause(conn,215,64)
                impact = service.impact(conn,204,64)
                assert timeline['count']==11
                assert root['count']==11 and root['earliest_exception_event_id']==204
                assert [o['order_number'] for o in impact['orders']]==['SO-2026-1101-A','SO-2026-1101-B']
                counts = conn.execute('SELECT count(*) AS events, count(*) FILTER (WHERE caused_by_event_id IS NULL) AS roots, count(*) FILTER (WHERE status IN (\'WARNING\',\'FAILED\')) AS exceptions,max(causal_depth) AS max_depth FROM supply_chain_events').fetchone()
                assert counts==dict(events=17,roots=1,exceptions=5,max_depth=10)
                report=dict(timeline_count=timeline['count'],root_chain_count=root['count'], earliest_exception_event_id=204,
                            impacted_orders=[o['order_number'] for o in impact['orders']],**counts)
                (root_path/'docs/part3/part1_baseline.json').write_text(json.dumps(report,indent=2)+'\n')
        finally:
            admin.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(name)))
