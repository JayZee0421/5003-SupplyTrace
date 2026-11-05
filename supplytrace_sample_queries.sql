-- SupplyTrace Part 1 sample queries
-- Run with psql after loading the schema and sample data.

-- 1. Order timeline
\set order_number 'SO-2026-1101-A'

SELECT
    e.event_id,
    e.event_time,
    e.event_type_code,
    et.event_name,
    e.status,
    ent.entity_name AS subject_entity,
    loc.location_name,
    e.caused_by_event_id,
    e.causal_depth,
    e.message,
    dc.committed_date AS current_commitment
FROM supply_chain_events AS e
JOIN event_types AS et
  ON et.event_type_code = e.event_type_code
JOIN entities AS ent
  ON ent.entity_id = e.entity_id
LEFT JOIN locations AS loc
  ON loc.location_id = e.location_id
JOIN orders AS o
  ON o.order_id = e.order_id
LEFT JOIN delivery_commitments AS dc
  ON dc.order_line_id = e.order_line_id
 AND dc.status = 'ACTIVE'
WHERE o.order_number = :'order_number'
ORDER BY e.event_time, e.event_id;

-- 2. Backward recursive root-cause trace
-- Start with an anomalous downstream event, for example signed event 215.
\set anomaly_event_id 215

WITH RECURSIVE root_trace AS (
    SELECT
        e.event_id,
        e.event_type_code,
        e.event_time,
        e.status,
        e.message,
        e.caused_by_event_id,
        e.causal_depth,
        ARRAY[e.event_id] AS path,
        0 AS traversal_depth
    FROM supply_chain_events AS e
    WHERE e.event_id = :anomaly_event_id

    UNION ALL

    SELECT
        parent.event_id,
        parent.event_type_code,
        parent.event_time,
        parent.status,
        parent.message,
        parent.caused_by_event_id,
        parent.causal_depth,
        child.path || parent.event_id,
        child.traversal_depth + 1
    FROM root_trace AS child
    JOIN supply_chain_events AS parent
      ON parent.event_id = child.caused_by_event_id
    WHERE NOT parent.event_id = ANY(child.path)
      AND child.traversal_depth < 64
)
SELECT
    event_id,
    event_type_code,
    event_time,
    status,
    status IN ('WARNING', 'FAILED') AS is_exception,
    message,
    traversal_depth AS steps_from_selected_event
FROM root_trace
ORDER BY event_time, event_id;

-- The first WARNING or FAILED row in chronological order is the earliest
-- observable exception on this primary causal chain.

-- 3. Forward impact analysis from a known problem event
-- Event 204 is the supplier delay in the supplied sample scenario.
\set problem_event_id 204

WITH RECURSIVE affected_events AS (
    SELECT
        e.event_id,
        ARRAY[e.event_id] AS path,
        0 AS traversal_depth
    FROM supply_chain_events AS e
    WHERE e.event_id = :problem_event_id

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
),
affected_order_events AS (
    SELECT
        sa.event_id,
        sa.traversal_depth,
        e.order_id,
        e.order_line_id,
        e.event_time,
        ROW_NUMBER() OVER (
            PARTITION BY e.order_line_id
            ORDER BY e.event_time DESC, e.event_id DESC
        ) AS line_event_rank
    FROM shortest_affected AS sa
    JOIN supply_chain_events AS e
      ON e.event_id = sa.event_id
    WHERE e.order_line_id IS NOT NULL
)
SELECT
    o.order_number,
    c.entity_name AS customer_name,
    ol.line_number,
    dc.committed_date,
    latest.event_time AS latest_affected_event_time,
    latest.traversal_depth AS causal_hops_from_problem
FROM affected_order_events AS latest
JOIN order_lines AS ol
  ON ol.order_line_id = latest.order_line_id
JOIN orders AS o
  ON o.order_id = ol.order_id
JOIN entities AS c
  ON c.entity_id = o.customer_id
LEFT JOIN delivery_commitments AS dc
  ON dc.order_line_id = ol.order_line_id
 AND dc.status = 'ACTIVE'
WHERE latest.line_event_rank = 1
ORDER BY o.order_number, ol.line_number;

-- 4. Average and P90 duration by process stage
WITH line_stage_times AS (
    SELECT
        order_line_id,
        min(event_time) FILTER (
            WHERE event_type_code = 'ORDER_CONFIRMED'
        ) AS order_confirmed_at,
        min(event_time) FILTER (
            WHERE event_type_code = 'PURCHASE_CREATED'
        ) AS purchase_created_at,
        min(event_time) FILTER (
            WHERE event_type_code = 'SUPPLIER_CONFIRMED'
        ) AS supplier_confirmed_at,
        min(event_time) FILTER (
            WHERE event_type_code = 'QUALITY_CHECK'
              AND status = 'NORMAL'
        ) AS quality_passed_at,
        min(event_time) FILTER (
            WHERE event_type_code = 'PRODUCTION_STARTED'
        ) AS production_started_at,
        min(event_time) FILTER (
            WHERE event_type_code = 'PRODUCTION_COMPLETED'
        ) AS production_completed_at,
        min(event_time) FILTER (
            WHERE event_type_code = 'SHIPMENT_DISPATCHED'
        ) AS shipment_dispatched_at,
        min(event_time) FILTER (
            WHERE event_type_code = 'SHIPMENT_ARRIVED'
        ) AS shipment_arrived_at,
        min(event_time) FILTER (
            WHERE event_type_code = 'DELIVERY_SIGNED'
        ) AS delivery_signed_at
    FROM supply_chain_events
    WHERE order_line_id IS NOT NULL
    GROUP BY order_line_id
),
stage_hours AS (
    SELECT stage, elapsed_hours
    FROM line_stage_times AS s
    CROSS JOIN LATERAL (
        VALUES
            ('Order to purchase',
             EXTRACT(EPOCH FROM (s.purchase_created_at - s.order_confirmed_at)) / 3600),
            ('Purchase to supplier confirmation',
             EXTRACT(EPOCH FROM (s.supplier_confirmed_at - s.purchase_created_at)) / 3600),
            ('Supplier confirmation to quality pass',
             EXTRACT(EPOCH FROM (s.quality_passed_at - s.supplier_confirmed_at)) / 3600),
            ('Quality pass to production start',
             EXTRACT(EPOCH FROM (s.production_started_at - s.quality_passed_at)) / 3600),
            ('Production start to completion',
             EXTRACT(EPOCH FROM (s.production_completed_at - s.production_started_at)) / 3600),
            ('Production completion to dispatch',
             EXTRACT(EPOCH FROM (s.shipment_dispatched_at - s.production_completed_at)) / 3600),
            ('Dispatch to arrival',
             EXTRACT(EPOCH FROM (s.shipment_arrived_at - s.shipment_dispatched_at)) / 3600),
            ('Arrival to delivery signature',
             EXTRACT(EPOCH FROM (s.delivery_signed_at - s.shipment_arrived_at)) / 3600)
    ) AS duration(stage, elapsed_hours)
    WHERE elapsed_hours IS NOT NULL
      AND elapsed_hours >= 0
)
SELECT
    stage,
    count(*) AS sample_lines,
    round(avg(elapsed_hours)::NUMERIC, 2) AS average_hours,
    round(
        percentile_cont(0.9) WITHIN GROUP (ORDER BY elapsed_hours)::NUMERIC,
        2
    ) AS p90_hours
FROM stage_hours
GROUP BY stage
ORDER BY
    CASE stage
        WHEN 'Order to purchase' THEN 1
        WHEN 'Purchase to supplier confirmation' THEN 2
        WHEN 'Supplier confirmation to quality pass' THEN 3
        WHEN 'Quality pass to production start' THEN 4
        WHEN 'Production start to completion' THEN 5
        WHEN 'Production completion to dispatch' THEN 6
        WHEN 'Dispatch to arrival' THEN 7
        WHEN 'Arrival to delivery signature' THEN 8
    END;
