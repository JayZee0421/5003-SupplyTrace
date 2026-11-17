from collections import deque
from fastapi import HTTPException
from backend.db import load_sql


def rows(conn, name, params):
    return conn.execute(load_sql(name), params).fetchall()


def exists(conn, table, key, value):
    # table/key are internal constants, never request values.
    if not conn.execute(f'SELECT 1 FROM {table} WHERE {key} = %s', [value]).fetchone():
        raise HTTPException(404, 'Requested resource does not exist')


def events(conn, ids):
    return rows(conn, 'events', {'event_ids': ids})


def timeline(conn, order_number):
    order = conn.execute('SELECT order_id FROM orders WHERE order_number = %s', [order_number]).fetchone()
    if not order:
        raise HTTPException(404, 'Order does not exist')
    ids = [r['event_id'] for r in rows(conn, 'timeline', order)]
    result = events(conn, ids)
    return {'order_number': order_number, 'count': len(result), 'events': result}


def has_cycle(ids, edges):
    # Kahn's algorithm is iterative and handles graphs larger than Python's recursion limit.
    adjacency = {i: set() for i in ids}
    for e in edges:
        adjacency[e['cause_event_id']].add(e['effect_event_id'])
    indegree = dict.fromkeys(ids, 0)
    for children in adjacency.values():
        for child in children:
            indegree[child] += 1
    queue = deque(i for i, degree in indegree.items() if degree == 0)
    seen = 0
    while queue:
        seen += 1
        for child in adjacency[queue.popleft()]:
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)
    return seen != len(ids)


def shortest_paths(source, ids, edges):
    adjacency = {i: set() for i in ids}
    for e in edges:
        adjacency[e['cause_event_id']].add(e['effect_event_id'])
    paths = {source: [source]}
    queue = deque([source])
    while queue:
        parent = queue.popleft()
        for child in sorted(adjacency[parent]):
            if child not in paths:
                paths[child] = paths[parent] + [child]
                queue.append(child)
    return paths


def root_cause(conn, event_id, max_depth):
    trace = rows(conn, 'root_cause', {'event_id': event_id, 'max_depth': max_depth})
    if not trace:
        raise HTTPException(404, 'Event does not exist')
    by_id = {r['event_id']: r for r in trace}
    nodes = [dict(e, steps=by_id[e['event_id']]['steps'], path=by_id[e['event_id']]['path'])
             for e in events(conn, list(by_id))]
    edges = [dict(cause_event_id=r['caused_by_event_id'], effect_event_id=r['event_id'], kind='PRIMARY')
             for r in trace if r['caused_by_event_id'] in by_id]
    edges.sort(key=lambda e: (e['cause_event_id'], e['effect_event_id'], e['kind']))
    return dict(selected_event_id=event_id, max_depth=max_depth, count=len(nodes), nodes=nodes, edges=edges,
                truncated=any(r['caused_by_event_id'] is not None and r['caused_by_event_id'] not in by_id for r in trace),
                cycle_detected=has_cycle(by_id, edges),
                earliest_exception_event_id=next((e['event_id'] for e in nodes if e['is_exception']), None),
                chain_start_event_id=next((r['event_id'] for r in trace if r['caused_by_event_id'] is None), None))


def impact(conn, event_id, max_depth):
    reached = rows(conn, 'impact', {'event_id': event_id, 'max_depth': max_depth})
    if not reached:
        raise HTTPException(404, 'Event does not exist')
    ids = {r['event_id'] for r in reached}
    outgoing = [edge for r in reached for edge in r['outgoing']]
    edges = sorted((e for e in outgoing if e['effect_event_id'] in ids),
                   key=lambda e: (e['cause_event_id'], e['effect_event_id'], e['kind']))
    paths = shortest_paths(event_id, ids, edges)
    nodes = [dict(e, steps=len(paths[e['event_id']])-1, path=paths[e['event_id']]) for e in events(conn, list(ids))]
    latest = {}
    for node in nodes:  # chronological, ID-stable: last value is latest per line
        if node['order_line_id'] is not None:
            latest[node['order_line_id']] = node
    order_ids = {e['order_id'] for e in nodes if e['order_id'] is not None}
    # Also resolve order via a referenced order line when an event has no order_id.
    if latest:
        order_ids.update(r['order_id'] for r in conn.execute(
            'SELECT DISTINCT order_id FROM order_lines WHERE order_line_id = ANY(%s::bigint[])', [list(latest)]))
    order_rows = rows(conn, 'impact_orders', {'order_ids': list(order_ids), 'line_ids': list(latest)})
    orders = {}
    for r in order_rows:
        order = orders.setdefault(r['order_id'], {k: r[k] for k in ('order_id', 'order_number', 'customer_name')} | {'lines': []})
        if r['order_line_id'] is not None:
            node = latest[r['order_line_id']]
            order['lines'].append(dict(order_line_id=r['order_line_id'], line_number=r['line_number'],
                current_commitment=r['current_commitment'], latest_affected_event_id=node['event_id'],
                latest_affected_event_time=node['event_time'], causal_hops=node['steps']))
    return dict(selected_event_id=event_id, max_depth=max_depth, count=len(nodes), nodes=nodes, edges=edges,
                truncated=any(e['effect_event_id'] not in ids for e in outgoing), cycle_detected=has_cycle(ids, edges),
                affected_order_count=len(orders), orders=list(orders.values()))


def stage_durations(conn, params):
    if params['order_number'] is not None:
        exists(conn, 'orders', 'order_number', params['order_number'])
    if params['order_line_id'] is not None:
        exists(conn, 'order_lines', 'order_line_id', params['order_line_id'])
    return dict(**params, stages=rows(conn, 'stage_durations', params))
