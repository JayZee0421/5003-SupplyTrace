-- Used by import_data.py after COPY and by --validate-only.
-- Since both edge types must go from smaller to larger event IDs, their union is acyclic.
CREATE TEMP TABLE quality_checks (name text PRIMARY KEY, failures bigint);

DO $$
DECLARE
    expected record;
    actual bigint;
BEGIN
    FOR expected IN SELECT * FROM expected_counts LOOP
        EXECUTE format('SELECT count(*) FROM %I', expected.table_name) INTO actual;
        INSERT INTO quality_checks VALUES ('row_count:' || expected.table_name,
                                           abs(actual - expected.rows));
    END LOOP;
END
$$;

INSERT INTO quality_checks
SELECT 'invalid_primary_edge', count(*)
FROM supply_chain_events AS e
LEFT JOIN supply_chain_events AS parent ON parent.event_id = e.caused_by_event_id
WHERE e.caused_by_event_id IS NOT NULL
  AND (parent.event_id IS NULL OR parent.event_id >= e.event_id
       OR parent.event_time > e.event_time OR parent.causal_depth + 1 <> e.causal_depth
       OR parent.order_line_id IS DISTINCT FROM e.order_line_id)
UNION ALL
SELECT 'invalid_secondary_edge', count(*)
FROM causal_links AS edge
LEFT JOIN supply_chain_events AS cause ON cause.event_id = edge.cause_event_id
LEFT JOIN supply_chain_events AS effect ON effect.event_id = edge.effect_event_id
WHERE cause.event_id IS NULL OR effect.event_id IS NULL
   OR cause.event_id >= effect.event_id OR cause.event_time > effect.event_time
UNION ALL
SELECT 'invalid_root', count(*)
FROM supply_chain_events
WHERE (caused_by_event_id IS NULL) <> (event_type_code = 'ORDER_CONFIRMED')
   OR (caused_by_event_id IS NULL AND causal_depth <> 0)
UNION ALL
SELECT 'invalid_event_references', count(*)
FROM supply_chain_events AS e
LEFT JOIN entities AS actor ON actor.entity_id = e.entity_id
LEFT JOIN order_lines AS ol ON ol.order_line_id = e.order_line_id
LEFT JOIN po_lines AS pl ON pl.po_line_id = e.po_line_id
LEFT JOIN production_orders AS p ON p.production_order_id = e.production_order_id
LEFT JOIN delivery_commitments AS dc ON dc.commitment_id = e.delivery_commitment_id
WHERE actor.entity_type IS DISTINCT FROM e.entity_type
   OR ol.order_line_id IS NULL OR e.order_id IS DISTINCT FROM ol.order_id
   OR e.purchase_order_id IS DISTINCT FROM pl.purchase_order_id
   OR (e.production_order_id IS NOT NULL AND p.source_order_line_id IS DISTINCT FROM ol.order_line_id)
   OR (e.shipment_id IS NOT NULL AND NOT EXISTS (
       SELECT FROM shipment_lines AS sl
       WHERE sl.order_line_id = e.order_line_id AND sl.shipment_id = e.shipment_id
   ))
   OR (e.delivery_commitment_id IS NOT NULL AND dc.order_line_id IS DISTINCT FROM ol.order_line_id)
UNION ALL
SELECT 'orders_without_exactly_one_line', count(*)
FROM (
    SELECT o.order_id
    FROM orders AS o
    LEFT JOIN order_lines AS ol ON ol.order_id = o.order_id
    GROUP BY o.order_id
    HAVING count(ol.order_line_id) <> 1
) AS invalid
UNION ALL
SELECT 'invalid_order_line_event_counts', count(*)
FROM order_lines AS ol
LEFT JOIN (
    SELECT order_line_id, count(*) AS total,
           count(DISTINCT event_type_code) FILTER (WHERE is_core) AS core_types,
           count(*) FILTER (WHERE is_core) AS core_events
    FROM (
        SELECT order_line_id, event_type_code,
               event_type_code NOT IN ('SUPPLIER_DELAYED', 'TRANSPORT_DISRUPTION')
               AND (event_type_code <> 'QUALITY_CHECK' OR status = 'NORMAL') AS is_core
        FROM supply_chain_events
    ) AS events
    GROUP BY order_line_id
) AS per_line ON per_line.order_line_id = ol.order_line_id
WHERE per_line.order_line_id IS NULL OR core_types <> 9 OR core_events <> 9
   OR total NOT BETWEEN 9 AND 10;

WITH RECURSIVE
backward(scenario, event_id, parent_id, status) AS (
    SELECT c.scenario, e.event_id, e.caused_by_event_id, e.status
    FROM expected_cases AS c
    JOIN supply_chain_events AS e ON e.event_id = c.trace_from_event_id
    UNION
    SELECT b.scenario, e.event_id, e.caused_by_event_id, e.status
    FROM backward AS b
    JOIN supply_chain_events AS e ON e.event_id = b.parent_id
),
forward(scenario, event_id) AS (
    SELECT c.scenario, e.event_id
    FROM expected_cases AS c
    JOIN supply_chain_events AS e ON e.event_id = c.root_event_id
    UNION
    SELECT f.scenario, child.event_id
    FROM forward AS f
    CROSS JOIN LATERAL (
        SELECT event_id FROM supply_chain_events WHERE caused_by_event_id = f.event_id
        UNION ALL
        SELECT effect_event_id FROM causal_links WHERE cause_event_id = f.event_id
    ) AS child
),
chains AS (
    SELECT scenario, array_agg(event_id ORDER BY event_id) AS ids,
           min(event_id) FILTER (WHERE status IN ('WARNING', 'FAILED')) AS first_exception
    FROM backward GROUP BY scenario
),
impacts AS (
    SELECT f.scenario, array_agg(DISTINCT o.order_number ORDER BY o.order_number) AS orders,
           array_agg(e.event_id ORDER BY e.event_id)
               FILTER (WHERE e.event_type_code = 'DELIVERY_SIGNED') AS deliveries
    FROM forward AS f
    JOIN supply_chain_events AS e ON e.event_id = f.event_id
    JOIN orders AS o ON o.order_id = e.order_id
    GROUP BY f.scenario
)
INSERT INTO quality_checks
SELECT 'fixture:' || c.scenario,
       CASE WHEN root.event_type_code = c.root_event_type
                 AND root.status = c.root_status
                 AND cl.effect_event_id IS NOT NULL
                 AND b.ids = c.primary_chain_event_ids
                 AND b.first_exception = c.root_event_id
                 AND f.orders = c.impacted_orders
                 AND f.deliveries = c.impacted_delivery_event_ids
            THEN 0 ELSE 1 END
FROM expected_cases AS c
LEFT JOIN supply_chain_events AS root ON root.event_id = c.root_event_id
LEFT JOIN causal_links AS cl ON cl.cause_event_id = c.root_event_id
                           AND cl.effect_event_id = c.secondary_effect_event_id
LEFT JOIN chains AS b ON b.scenario = c.scenario
LEFT JOIN impacts AS f ON f.scenario = c.scenario;

DO $$
DECLARE
    failed jsonb;
BEGIN
    SELECT jsonb_object_agg(name, failures) INTO failed
    FROM quality_checks WHERE failures <> 0;
    IF failed IS NOT NULL THEN
        RAISE EXCEPTION 'Generated data checks failed: %', failed;
    END IF;
END
$$;

SELECT jsonb_build_object(
    'events', count(*),
    'orders', (SELECT count(*) FROM orders),
    'order_lines', (SELECT count(*) FROM order_lines),
    'secondary_links', (SELECT count(*) FROM causal_links),
    'root_events', count(*) FILTER (WHERE caused_by_event_id IS NULL),
    'max_causal_depth', max(causal_depth),
    'supplier_delays', count(*) FILTER (WHERE event_type_code = 'SUPPLIER_DELAYED'),
    'quality_failures', count(*) FILTER (WHERE event_type_code = 'QUALITY_CHECK' AND status = 'FAILED'),
    'transport_disruptions', count(*) FILTER (WHERE event_type_code = 'TRANSPORT_DISRUPTION'),
    'late_signatures', count(*) FILTER (WHERE event_type_code = 'DELIVERY_SIGNED' AND status = 'WARNING'),
    'checks_run', (SELECT count(*) FROM quality_checks),
    'failed_checks', (SELECT count(*) FROM quality_checks WHERE failures <> 0)
)
FROM supply_chain_events;
