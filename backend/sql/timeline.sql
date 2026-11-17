SELECT event_id FROM supply_chain_events
WHERE order_id = %(order_id)s
ORDER BY event_time, event_id
