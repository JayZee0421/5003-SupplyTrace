SELECT o.order_id, o.order_number, c.entity_name AS customer_name,
       ol.order_line_id, ol.line_number, dc.committed_date AS current_commitment
FROM orders o JOIN entities c ON c.entity_id = o.customer_id
LEFT JOIN order_lines ol ON ol.order_id = o.order_id
                       AND ol.order_line_id = ANY(%(line_ids)s::bigint[])
LEFT JOIN delivery_commitments dc ON dc.order_line_id = ol.order_line_id AND dc.status = 'ACTIVE'
WHERE o.order_id = ANY(%(order_ids)s::bigint[])
ORDER BY o.order_number, o.order_id, ol.line_number, ol.order_line_id
