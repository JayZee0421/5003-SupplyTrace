-- UNION deduplicates (event_id, steps) during recursion. With a finite depth
-- bound this also protects cycles without enumerating exponentially many paths.
-- The service reconstructs one shortest path from the returned adjacency list.
WITH RECURSIVE reached(event_id, steps) AS (
    SELECT event_id, 0 FROM supply_chain_events WHERE event_id = %(event_id)s
    UNION
    SELECT edge.effect_event_id, r.steps + 1
    FROM reached r
    CROSS JOIN LATERAL (
        SELECT e.event_id AS effect_event_id
        FROM supply_chain_events e WHERE e.caused_by_event_id = r.event_id
        UNION
        SELECT cl.effect_event_id FROM causal_links cl WHERE cl.cause_event_id = r.event_id
    ) edge
    WHERE r.steps < %(max_depth)s
), shortest AS (
    SELECT event_id, min(steps) AS steps FROM reached GROUP BY event_id
)
SELECT event_id,steps FROM shortest ORDER BY event_id;
