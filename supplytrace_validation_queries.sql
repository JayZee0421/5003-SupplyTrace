-- SupplyTrace Part 1 validation checks
-- Every result should contain zero rows except the final summary.

-- V1. Broken references through the primary causal chain.
SELECT e.event_id, e.caused_by_event_id
FROM supply_chain_events AS e
LEFT JOIN supply_chain_events AS parent
  ON parent.event_id = e.caused_by_event_id
WHERE e.caused_by_event_id IS NOT NULL
  AND parent.event_id IS NULL;

-- V2. Causal time inversions on the primary chain.
SELECT e.event_id, e.event_time, parent.event_id, parent.event_time
FROM supply_chain_events AS e
JOIN supply_chain_events AS parent
  ON parent.event_id = e.caused_by_event_id
WHERE parent.event_time > e.event_time;

-- V3. Self-links and secondary causal time inversions.
SELECT cl.*
FROM causal_links AS cl
JOIN supply_chain_events AS cause
  ON cause.event_id = cl.cause_event_id
JOIN supply_chain_events AS effect
  ON effect.event_id = cl.effect_event_id
WHERE cl.cause_event_id = cl.effect_event_id
   OR cause.event_time > effect.event_time;

-- V4. Cross-order event references.
SELECT e.event_id, e.order_id, e.order_line_id
FROM supply_chain_events AS e
JOIN order_lines AS ol
  ON ol.order_line_id = e.order_line_id
WHERE e.order_id IS NOT NULL
  AND e.order_id <> ol.order_id;

-- V5. Cross-purchase-order event references.
SELECT e.event_id, e.purchase_order_id, e.po_line_id
FROM supply_chain_events AS e
JOIN po_lines AS pl
  ON pl.po_line_id = e.po_line_id
WHERE e.purchase_order_id IS NOT NULL
  AND e.purchase_order_id <> pl.purchase_order_id;

-- V6. Event counts and causal roots for the fixed scenario.
SELECT
    count(*) AS event_count,
    count(*) FILTER (WHERE caused_by_event_id IS NULL) AS root_event_count,
    count(*) FILTER (WHERE status IN ('WARNING', 'FAILED')) AS exception_event_count,
    max(causal_depth) AS maximum_causal_depth
FROM supply_chain_events;
