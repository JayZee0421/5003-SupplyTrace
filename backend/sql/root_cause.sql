WITH RECURSIVE trace AS (
    SELECT event_id, caused_by_event_id, 0 AS steps, ARRAY[event_id] AS path
    FROM supply_chain_events WHERE event_id = %(event_id)s
    UNION ALL
    SELECT p.event_id, p.caused_by_event_id, t.steps + 1, t.path || p.event_id
    FROM trace t JOIN supply_chain_events p ON p.event_id = t.caused_by_event_id
    WHERE t.steps < %(max_depth)s AND NOT p.event_id = ANY(t.path)
)
SELECT event_id, caused_by_event_id, steps, path FROM trace ORDER BY steps, event_id
