SELECT event_id,event_time FROM supply_chain_events WHERE event_type_code='SUPPLIER_DELAYED' AND event_time >= '2026-01-01T00:00:00Z' ORDER BY event_time DESC,event_id DESC LIMIT 50;
