-- Filter the cohort by ORDER_CONFIRMED time [start, end), then retain all
-- lifecycle events of each selected line so windows do not cut stage pairs.
WITH cohort AS (
    SELECT ol.order_line_id FROM order_lines ol JOIN orders o USING (order_id)
    WHERE (%(order_number)s::text IS NULL OR o.order_number = %(order_number)s)
      AND (%(order_line_id)s::bigint IS NULL OR ol.order_line_id = %(order_line_id)s)
      AND ((%(start_time)s::timestamptz IS NULL AND %(end_time)s::timestamptz IS NULL)
           OR EXISTS (SELECT FROM supply_chain_events e
                      WHERE e.order_line_id = ol.order_line_id AND e.event_type_code = 'ORDER_CONFIRMED'
                        AND (%(start_time)s::timestamptz IS NULL OR e.event_time >= %(start_time)s)
                        AND (%(end_time)s::timestamptz IS NULL OR e.event_time < %(end_time)s)))
), times AS (
    SELECT e.order_line_id,
      min(event_time) FILTER (WHERE event_type_code = 'ORDER_CONFIRMED') AS t1,
      min(event_time) FILTER (WHERE event_type_code = 'PURCHASE_CREATED') AS t2,
      min(event_time) FILTER (WHERE event_type_code = 'SUPPLIER_CONFIRMED') AS t3,
      min(event_time) FILTER (WHERE event_type_code = 'QUALITY_CHECK' AND status = 'NORMAL') AS t4,
      min(event_time) FILTER (WHERE event_type_code = 'PRODUCTION_STARTED') AS t5,
      min(event_time) FILTER (WHERE event_type_code = 'PRODUCTION_COMPLETED') AS t6,
      min(event_time) FILTER (WHERE event_type_code = 'SHIPMENT_DISPATCHED') AS t7,
      min(event_time) FILTER (WHERE event_type_code = 'SHIPMENT_ARRIVED') AS t8,
      min(event_time) FILTER (WHERE event_type_code = 'DELIVERY_SIGNED') AS t9
    FROM supply_chain_events e JOIN cohort c USING (order_line_id) GROUP BY e.order_line_id
), samples AS (
    SELECT v.stage_order, extract(epoch FROM v.elapsed) / 3600 AS hours FROM times
    CROSS JOIN LATERAL (VALUES (1,t2-t1),(2,t3-t2),(3,t4-t3),(4,t5-t4),
       (5,t6-t5),(6,t7-t6),(7,t8-t7),(8,t9-t8)) v(stage_order, elapsed)
    WHERE v.elapsed IS NOT NULL AND v.elapsed >= interval '0'
), stages(stage_order, stage) AS (VALUES
    (1,'Order to purchase'), (2,'Purchase to supplier confirmation'),
    (3,'Supplier confirmation to quality pass'), (4,'Quality pass to production start'),
    (5,'Production start to completion'), (6,'Production completion to dispatch'),
    (7,'Dispatch to arrival'), (8,'Arrival to delivery signature'))
SELECT st.stage_order, st.stage, count(s.hours) AS sample_lines,
       round(avg(s.hours),2)::float8 AS average_hours,
       round((percentile_cont(0.9) WITHIN GROUP (ORDER BY s.hours))::numeric,2)::float8 AS p90_hours
FROM stages st LEFT JOIN samples s USING (stage_order)
GROUP BY st.stage_order, st.stage ORDER BY st.stage_order
