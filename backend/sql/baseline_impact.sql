-- Part 1 traversal retained for comparable performance evidence.
WITH RECURSIVE affected_events AS (
    SELECT
        e.event_id,
        ARRAY[e.event_id] AS path,
        0 AS traversal_depth
    FROM supply_chain_events AS e
    WHERE e.event_id = %(event_id)s

    UNION

    SELECT
        downstream.event_id,
        ancestor.path || downstream.event_id,
        ancestor.traversal_depth + 1
    FROM affected_events AS ancestor
    CROSS JOIN LATERAL (
        SELECT
            e.event_id,
            e.caused_by_event_id AS parent_event_id
        FROM supply_chain_events AS e
        WHERE e.caused_by_event_id IS NOT NULL

        UNION

        SELECT
            cl.effect_event_id AS event_id,
            cl.cause_event_id AS parent_event_id
        FROM causal_links AS cl
    ) AS edge
    JOIN supply_chain_events AS downstream
      ON downstream.event_id = edge.event_id
    WHERE edge.parent_event_id = ancestor.event_id
      AND NOT downstream.event_id = ANY(ancestor.path)
      AND ancestor.traversal_depth < 64
),
shortest_affected AS (
    SELECT
        event_id,
        min(traversal_depth) AS traversal_depth
    FROM affected_events
    GROUP BY event_id
)
SELECT event_id, traversal_depth AS steps FROM shortest_affected ORDER BY event_id;
