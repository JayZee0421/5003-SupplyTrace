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
SELECT s.event_id, s.steps, COALESCE(edges.outgoing, '[]'::jsonb) AS outgoing
FROM shortest s
CROSS JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('cause_event_id', s.event_id,
           'effect_event_id', x.effect_event_id, 'kind', x.kind)
           ORDER BY x.effect_event_id, x.kind) AS outgoing
    FROM (
        SELECT e.event_id AS effect_event_id, 'PRIMARY'::text AS kind
        FROM supply_chain_events e WHERE e.caused_by_event_id = s.event_id
        UNION ALL
        SELECT cl.effect_event_id, cl.link_type::text FROM causal_links cl
        WHERE cl.cause_event_id = s.event_id
    ) x
) edges
ORDER BY s.steps, s.event_id
