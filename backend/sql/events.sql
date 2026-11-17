SELECT e.event_id, e.event_type_code, et.event_name, e.event_time,
       e.status::text, e.status IN ('WARNING', 'FAILED') AS is_exception,
       e.entity_type::text, e.entity_id, ent.entity_name AS subject_entity,
       e.location_id, loc.location_name, e.order_id, e.order_line_id,
       e.caused_by_event_id, e.causal_depth, e.message,
       dc.committed_date AS current_commitment
FROM supply_chain_events e
JOIN event_types et USING (event_type_code)
JOIN entities ent ON ent.entity_id = e.entity_id
LEFT JOIN locations loc ON loc.location_id = e.location_id
LEFT JOIN delivery_commitments dc ON dc.order_line_id = e.order_line_id AND dc.status = 'ACTIVE'
WHERE e.event_id = ANY(%(event_ids)s::bigint[])
ORDER BY e.event_time, e.event_id
