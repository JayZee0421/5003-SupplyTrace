-- SupplyTrace reproducible sample data
-- Load after supplytrace_schema_v1.sql in a development database.
-- The script resets all SupplyTrace tables before inserting the fixed scenario.

BEGIN;

TRUNCATE TABLE
    audit_log,
    causal_links,
    supply_chain_events,
    event_types,
    delivery_commitments,
    shipment_lines,
    shipments,
    production_orders,
    purchase_line_allocations,
    po_lines,
    purchase_orders,
    order_lines,
    orders,
    items,
    locations,
    entities
RESTART IDENTITY CASCADE;

INSERT INTO entities (
    entity_id, entity_code, entity_name, entity_type, country_code, attributes
) VALUES
    (1, 'FAC-SZ-01', 'Shenzhen Assembly Plant', 'FACTORY', 'CN',
     '{"capacity_units_per_day": 5000}'::JSONB),
    (2, 'SUP-CN-07', 'Jiangsu Alloy Components', 'SUPPLIER', 'CN',
     '{"lead_time_days": 7, "quality_score": 0.91}'::JSONB),
    (3, 'WH-HK-01', 'Hong Kong Distribution Warehouse', 'WAREHOUSE', 'HK',
     '{"dock_count": 12}'::JSONB),
    (4, 'CAR-HK-03', 'Pearl River Freight', 'CARRIER', 'HK',
     '{"service_level": "standard"}'::JSONB),
    (5, 'CUS-SG-01', 'Marina Equipment Pte Ltd', 'CUSTOMER', 'SG',
     '{"account_tier": "A"}'::JSONB),
    (6, 'CUS-HK-02', 'Harbour Systems Limited', 'CUSTOMER', 'HK',
     '{"account_tier": "A"}'::JSONB);

INSERT INTO locations (
    location_id, location_code, location_name, owner_entity_id,
    city, region, country_code
) VALUES
    (1, 'LOC-SZ-PLANT', 'Shenzhen Plant', 1, 'Shenzhen', 'Guangdong', 'CN'),
    (2, 'LOC-JS-SUPPLIER', 'Jiangsu Supplier Yard', 2, 'Suzhou', 'Jiangsu', 'CN'),
    (3, 'LOC-HK-WH', 'Hong Kong Warehouse', 3, 'Hong Kong', 'Hong Kong', 'HK'),
    (4, 'LOC-SG-CUSTOMER', 'Singapore Customer Site', 5, 'Singapore', 'Singapore', 'SG'),
    (5, 'LOC-HK-CUSTOMER', 'Hong Kong Customer Site', 6, 'Hong Kong', 'Hong Kong', 'HK');

INSERT INTO items (
    item_id, item_code, item_name, item_category,
    unit_of_measure, is_lot_tracked
) VALUES
    (1, 'RM-AL-6061', '6061 Aluminium Plate', 'RAW_MATERIAL', 'KG', TRUE),
    (2, 'FG-PUMP-24', 'Industrial Pump Housing Assembly', 'FINISHED_GOOD', 'EA', TRUE);

INSERT INTO orders (
    order_id, order_number, customer_id, ordered_at, required_date,
    currency_code, status
) VALUES
    (1, 'SO-2026-1101-A', 5, '2026-11-01 08:00:00+08', '2026-11-01',
     'USD', 'DELAYED'),
    (2, 'SO-2026-1101-B', 6, '2026-11-01 08:05:00+08', '2026-11-01',
     'HKD', 'DELAYED');

INSERT INTO order_lines (
    order_line_id, order_id, line_number, item_id,
    quantity, unit_price, required_date
) VALUES
    (1, 1, 1, 2, 30, 428.00, '2026-11-01'),
    (2, 2, 1, 2, 30, 419.50, '2026-11-01');

INSERT INTO purchase_orders (
    purchase_order_id, po_number, supplier_id, issued_at, promised_date, status
) VALUES
    (1, 'PO-2026-1101-01', 2, '2026-11-01 08:20:00+08', '2026-11-01', 'DELAYED');

INSERT INTO po_lines (
    po_line_id, purchase_order_id, line_number, item_id,
    quantity, quantity_received, unit_price
) VALUES
    (1, 1, 1, 1, 60, 60, 53.00);

INSERT INTO purchase_line_allocations (
    po_line_id, order_line_id, allocated_quantity
) VALUES
    (1, 1, 30),
    (1, 2, 30);

INSERT INTO production_orders (
    production_order_id, production_number, factory_id, source_order_line_id,
    output_item_id, quantity, planned_start, planned_end,
    actual_start, actual_end, status
) VALUES
    (1, 'MO-2026-1101-A', 1, 1, 2, 30,
     '2026-11-01 17:00:00+08', '2026-11-02 01:00:00+08',
     '2026-11-01 17:00:00+08', '2026-11-02 01:00:00+08', 'COMPLETED'),
    (2, 'MO-2026-1101-B', 1, 2, 2, 30,
     '2026-11-01 18:00:00+08', '2026-11-02 02:00:00+08',
     '2026-11-01 18:00:00+08', '2026-11-02 02:00:00+08', 'COMPLETED');

INSERT INTO shipments (
    shipment_id, shipment_number, carrier_id,
    origin_location_id, destination_location_id,
    planned_departure, planned_arrival,
    actual_departure, actual_arrival, status
) VALUES
    (1, 'SH-2026-1102-A', 4, 1, 4,
     '2026-11-02 04:00:00+08', '2026-11-02 14:00:00+08',
     '2026-11-02 04:00:00+08', '2026-11-02 10:00:00+08', 'DELIVERED'),
    (2, 'SH-2026-1102-B', 4, 1, 5,
     '2026-11-02 05:00:00+08', '2026-11-02 15:00:00+08',
     '2026-11-02 05:00:00+08', '2026-11-02 10:30:00+08', 'DELAYED');

INSERT INTO shipment_lines (
    shipment_line_id, shipment_id, order_line_id, po_line_id, quantity
) VALUES
    (1, 1, 1, NULL, 30),
    (2, 2, 2, NULL, 30);

INSERT INTO delivery_commitments (
    commitment_id, order_line_id, version, committed_date, changed_at,
    reason, status, supersedes_commitment_id
) VALUES
    (1, 1, 1, '2026-10-31', '2026-11-01 09:00:00+08',
     'Initial commitment', 'SUPERSEDED', NULL),
    (2, 1, 2, '2026-11-01', '2026-11-01 15:00:00+08',
     'Supplier material delay', 'ACTIVE', 1),
    (3, 2, 1, '2026-11-01', '2026-11-01 09:05:00+08',
     'Initial commitment', 'ACTIVE', NULL);

INSERT INTO event_types (
    event_type_code, event_name, category, default_status,
    is_exception, gs1_epcis_mapping, mapping_note, description
) VALUES
    ('ORDER_CONFIRMED', 'Order confirmed', 'ORDER', 'NORMAL',
     FALSE, NULL, 'Order lifecycle event',
     'A customer order has been accepted and frozen for fulfilment.'),
    ('PURCHASE_CREATED', 'Purchase order issued', 'PROCUREMENT', 'NORMAL',
     FALSE, NULL, 'Business transaction event',
     'A purchase order has been issued to an upstream supplier.'),
    ('SUPPLIER_CONFIRMED', 'Supplier confirmed', 'PROCUREMENT', 'NORMAL',
     FALSE, NULL, 'Supplier commitment event',
     'The supplier has accepted the requested quantity and date.'),
    ('SUPPLIER_DELAYED', 'Supplier delay reported', 'PROCUREMENT', 'WARNING',
     TRUE, NULL, 'Exception event',
     'The supplier has reported a delay that can affect downstream work.'),
    ('QUALITY_CHECK', 'Quality check completed', 'QUALITY', 'NORMAL',
     FALSE, 'ObjectEvent',
     'Status field distinguishes pass, warning and failure',
     'A material or finished-good lot has completed a quality inspection.'),
    ('PRODUCTION_STARTED', 'Production started', 'PRODUCTION', 'NORMAL',
     FALSE, 'TransformationEvent',
     'Inputs and output are described in payload when needed',
     'Manufacturing work has started for a production order.'),
    ('PRODUCTION_COMPLETED', 'Production completed', 'PRODUCTION', 'COMPLETED',
     FALSE, 'TransformationEvent',
     'Output lot may be recorded in payload',
     'Manufacturing work has completed and output is available.'),
    ('SHIPMENT_DISPATCHED', 'Shipment dispatched', 'LOGISTICS', 'NORMAL',
     FALSE, 'ShippingEvent', 'Carrier movement leaves the origin',
     'A shipment has left its origin location.'),
    ('TRANSPORT_DISRUPTION', 'Transport disruption', 'LOGISTICS', 'WARNING',
     TRUE, NULL, 'Exception event',
     'A transport exception has been reported or detected.'),
    ('SHIPMENT_ARRIVED', 'Shipment arrived', 'LOGISTICS', 'NORMAL',
     FALSE, 'ReceivingEvent', 'Arrival at the destination location',
     'A shipment has arrived at the destination location.'),
    ('DELIVERY_SIGNED', 'Delivery signed', 'DELIVERY', 'COMPLETED',
     FALSE, NULL, 'Proof-of-delivery event',
     'The customer has accepted the delivered goods.');

INSERT INTO supply_chain_events (
    event_id, event_type_code, event_time, entity_type, entity_id, location_id,
    order_id, order_line_id, purchase_order_id, po_line_id,
    production_order_id, shipment_id, delivery_commitment_id,
    quantity, status, message, caused_by_event_id, payload
) VALUES
    (201, 'ORDER_CONFIRMED', '2026-11-01 08:00:00+08', 'CUSTOMER', 5, 4,
     1, 1, NULL, NULL, NULL, NULL, NULL, 30, 'NORMAL',
     'Customer order accepted', NULL,
     '{"channel":"EDI","customer_po":"MEP-8842"}'::JSONB),

    (202, 'PURCHASE_CREATED', '2026-11-01 08:20:00+08', 'SUPPLIER', 2, 1,
     1, 1, 1, 1, NULL, NULL, NULL, 60, 'NORMAL',
     'Material purchase issued', 201,
     '{"requested_date":"2026-11-05"}'::JSONB),

    (203, 'SUPPLIER_CONFIRMED', '2026-11-01 09:00:00+08', 'SUPPLIER', 2, 2,
     1, 1, 1, 1, NULL, NULL, NULL, 60, 'NORMAL',
     'Supplier accepted delivery date', 202,
     '{"confirmed_date":"2026-11-05"}'::JSONB),

    (204, 'SUPPLIER_DELAYED', '2026-11-01 11:30:00+08', 'SUPPLIER', 2, 2,
     1, 1, 1, 1, NULL, NULL, NULL, 60, 'FAILED',
     'Raw material delivery delayed by six hours', 203,
     '{"delay_hours":6,"reason":"furnace maintenance"}'::JSONB),

    (205, 'QUALITY_CHECK', '2026-11-01 14:00:00+08', 'SUPPLIER', 2, 2,
     1, 1, 1, 1, NULL, NULL, NULL, 60, 'FAILED',
     'First inspection failed surface hardness tolerance', 204,
     '{"batch_no":"AL-B789","inspection":"surface_hardness","result":"FAILED"}'::JSONB),

    (206, 'QUALITY_CHECK', '2026-11-01 16:00:00+08', 'SUPPLIER', 2, 2,
     1, 1, 1, 1, NULL, NULL, NULL, 60, 'NORMAL',
     'Re-inspection passed after corrective sorting', 205,
     '{"batch_no":"AL-B789","inspection":"surface_hardness","result":"PASSED"}'::JSONB),

    (207, 'PRODUCTION_STARTED', '2026-11-01 17:00:00+08', 'FACTORY', 1, 1,
     1, 1, NULL, NULL, 1, NULL, NULL, 30, 'NORMAL',
     'Production started for order A', 206,
     '{"production_batch":"FG-A-1101"}'::JSONB),

    (208, 'PRODUCTION_STARTED', '2026-11-01 18:00:00+08', 'FACTORY', 1, 1,
     2, 2, NULL, NULL, 2, NULL, NULL, 30, 'NORMAL',
     'Production started for order B', 206,
     '{"production_batch":"FG-B-1101"}'::JSONB),

    (209, 'PRODUCTION_COMPLETED', '2026-11-02 01:00:00+08', 'FACTORY', 1, 1,
     1, 1, NULL, NULL, 1, NULL, NULL, 30, 'COMPLETED',
     'Production completed for order A', 207,
     '{"output_batch":"FG-A-1101"}'::JSONB),

    (210, 'PRODUCTION_COMPLETED', '2026-11-02 02:00:00+08', 'FACTORY', 1, 1,
     2, 2, NULL, NULL, 2, NULL, NULL, 30, 'COMPLETED',
     'Production completed for order B', 208,
     '{"output_batch":"FG-B-1101"}'::JSONB),

    (211, 'SHIPMENT_DISPATCHED', '2026-11-02 04:00:00+08', 'CARRIER', 4, 1,
     1, 1, NULL, NULL, NULL, 1, NULL, 30, 'NORMAL',
     'Shipment A left the plant', 209,
     '{"tracking_no":"PRF-6001"}'::JSONB),

    (212, 'SHIPMENT_DISPATCHED', '2026-11-02 05:00:00+08', 'CARRIER', 4, 1,
     2, 2, NULL, NULL, NULL, 2, NULL, 30, 'NORMAL',
     'Shipment B left the plant', 210,
     '{"tracking_no":"PRF-6002"}'::JSONB),

    (213, 'SHIPMENT_ARRIVED', '2026-11-02 10:00:00+08', 'CARRIER', 4, 4,
     1, 1, NULL, NULL, NULL, 1, NULL, 30, 'NORMAL',
     'Shipment A arrived at customer site', 211,
     '{"gate":"Dock 4"}'::JSONB),

    (214, 'SHIPMENT_ARRIVED', '2026-11-02 10:30:00+08', 'CARRIER', 4, 5,
     2, 2, NULL, NULL, NULL, 2, NULL, 30, 'NORMAL',
     'Shipment B arrived at customer site', 212,
     '{"gate":"Dock 2"}'::JSONB),

    (217, 'TRANSPORT_DISRUPTION', '2026-11-02 09:45:00+08', 'CARRIER', 4, 3,
     2, 2, NULL, NULL, NULL, 2, NULL, 30, 'WARNING',
     'Cross-harbour tunnel congestion added thirty minutes', 212,
     '{"delay_minutes":30,"route":"WH-to-HK-site"}'::JSONB),

    (215, 'DELIVERY_SIGNED', '2026-11-02 11:00:00+08', 'CUSTOMER', 5, 4,
     1, 1, NULL, NULL, NULL, 1, 2, 30, 'FAILED',
     'Delivery signed after committed time', 213,
     '{"accepted":true,"late":true}'::JSONB),

    (216, 'DELIVERY_SIGNED', '2026-11-02 12:00:00+08', 'CUSTOMER', 6, 5,
     2, 2, NULL, NULL, NULL, 2, 3, 30, 'WARNING',
     'Delivery signed after route disruption', 217,
     '{"accepted":true,"late":true}'::JSONB);

INSERT INTO causal_links (
    cause_event_id, effect_event_id, link_type, weight, note
) VALUES
    (204, 216, 'CONTRIBUTING', 0.650,
     'The shared raw-material delay raised the risk of the later Hong Kong delivery.');

SELECT setval(pg_get_serial_sequence('entities', 'entity_id'),
              (SELECT max(entity_id) FROM entities), TRUE);
SELECT setval(pg_get_serial_sequence('locations', 'location_id'),
              (SELECT max(location_id) FROM locations), TRUE);
SELECT setval(pg_get_serial_sequence('items', 'item_id'),
              (SELECT max(item_id) FROM items), TRUE);
SELECT setval(pg_get_serial_sequence('orders', 'order_id'),
              (SELECT max(order_id) FROM orders), TRUE);
SELECT setval(pg_get_serial_sequence('order_lines', 'order_line_id'),
              (SELECT max(order_line_id) FROM order_lines), TRUE);
SELECT setval(pg_get_serial_sequence('purchase_orders', 'purchase_order_id'),
              (SELECT max(purchase_order_id) FROM purchase_orders), TRUE);
SELECT setval(pg_get_serial_sequence('po_lines', 'po_line_id'),
              (SELECT max(po_line_id) FROM po_lines), TRUE);
SELECT setval(pg_get_serial_sequence('production_orders', 'production_order_id'),
              (SELECT max(production_order_id) FROM production_orders), TRUE);
SELECT setval(pg_get_serial_sequence('shipments', 'shipment_id'),
              (SELECT max(shipment_id) FROM shipments), TRUE);
SELECT setval(pg_get_serial_sequence('shipment_lines', 'shipment_line_id'),
              (SELECT max(shipment_line_id) FROM shipment_lines), TRUE);
SELECT setval(pg_get_serial_sequence('delivery_commitments', 'commitment_id'),
              (SELECT max(commitment_id) FROM delivery_commitments), TRUE);
SELECT setval(pg_get_serial_sequence('supply_chain_events', 'event_id'),
              (SELECT max(event_id) FROM supply_chain_events), TRUE);

COMMIT;
