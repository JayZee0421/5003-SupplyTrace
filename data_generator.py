"""Write deterministic PostgreSQL COPY input for SupplyTrace schema v1."""

import argparse
import csv
import hashlib
import json
import random
import tempfile
from collections import Counter
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from pathlib import Path

COLUMNS = {
    "entities": "entity_id entity_code entity_name entity_type country_code created_at updated_at",
    "locations": "location_id location_code location_name owner_entity_id country_code created_at updated_at",
    "items": "item_id item_code item_name item_category unit_of_measure is_lot_tracked created_at updated_at",
    "orders": "order_id order_number customer_id ordered_at required_date status created_at updated_at",
    "order_lines": "order_line_id order_id line_number item_id quantity unit_price required_date created_at updated_at",
    "purchase_orders": "purchase_order_id po_number supplier_id issued_at promised_date status created_at updated_at",
    "po_lines": "po_line_id purchase_order_id line_number item_id quantity quantity_received unit_price created_at updated_at",
    "purchase_line_allocations": "po_line_id order_line_id allocated_quantity created_at",
    "production_orders": "production_order_id production_number factory_id source_order_line_id output_item_id quantity planned_start planned_end actual_start actual_end status created_at updated_at",
    "shipments": "shipment_id shipment_number carrier_id origin_location_id destination_location_id planned_departure planned_arrival actual_departure actual_arrival status created_at updated_at",
    "shipment_lines": "shipment_line_id shipment_id order_line_id quantity created_at",
    "delivery_commitments": "commitment_id order_line_id version committed_date changed_at reason status supersedes_commitment_id",
    "event_types": "event_type_code event_name category default_status is_exception gs1_epcis_mapping mapping_note description",
    "supply_chain_events": "event_id event_type_code event_time recorded_at entity_type entity_id location_id order_id order_line_id purchase_order_id po_line_id production_order_id shipment_id delivery_commitment_id quantity status message caused_by_event_id payload recorded_by",
    "causal_links": "cause_event_id effect_event_id link_type weight note created_at",
}

CATALOG = (
    ("ORDER_CONFIRMED", "Order confirmed", "ORDER", "NORMAL", False, None, "Order lifecycle event", "A customer order has been accepted and frozen for fulfilment."),
    ("PURCHASE_CREATED", "Purchase order issued", "PROCUREMENT", "NORMAL", False, None, "Business transaction event", "A purchase order has been issued to an upstream supplier."),
    ("SUPPLIER_CONFIRMED", "Supplier confirmed", "PROCUREMENT", "NORMAL", False, None, "Supplier commitment event", "The supplier has accepted the requested quantity and date."),
    ("SUPPLIER_DELAYED", "Supplier delay reported", "PROCUREMENT", "WARNING", True, None, "Exception event", "The supplier has reported a delay that can affect downstream work."),
    ("QUALITY_CHECK", "Quality check completed", "QUALITY", "NORMAL", False, "ObjectEvent", "Status field distinguishes pass, warning and failure", "A material or finished-good lot has completed a quality inspection."),
    ("PRODUCTION_STARTED", "Production started", "PRODUCTION", "NORMAL", False, "TransformationEvent", "Inputs and output are described in payload when needed", "Manufacturing work has started for a production order."),
    ("PRODUCTION_COMPLETED", "Production completed", "PRODUCTION", "COMPLETED", False, "TransformationEvent", "Output lot may be recorded in payload", "Manufacturing work has completed and output is available."),
    ("SHIPMENT_DISPATCHED", "Shipment dispatched", "LOGISTICS", "NORMAL", False, "ShippingEvent", "Carrier movement leaves the origin", "A shipment has left its origin location."),
    ("TRANSPORT_DISRUPTION", "Transport disruption", "LOGISTICS", "WARNING", True, None, "Exception event", "A transport exception has been reported or detected."),
    ("SHIPMENT_ARRIVED", "Shipment arrived", "LOGISTICS", "NORMAL", False, "ReceivingEvent", "Arrival at the destination location", "A shipment has arrived at the destination location."),
    ("DELIVERY_SIGNED", "Delivery signed", "DELIVERY", "COMPLETED", False, None, "Proof-of-delivery event", "The customer has accepted the delivered goods."),
)
STAGES = (
    ("ORDER_CONFIRMED", 5, "CUSTOMER", 4),
    ("PURCHASE_CREATED", 1, "FACTORY", 1),
    ("SUPPLIER_CONFIRMED", 2, "SUPPLIER", 2),
    ("QUALITY_CHECK", 1, "FACTORY", 1),
    ("PRODUCTION_STARTED", 1, "FACTORY", 1),
    ("PRODUCTION_COMPLETED", 1, "FACTORY", 1),
    ("SHIPMENT_DISPATCHED", 4, "CARRIER", 1),
    ("SHIPMENT_ARRIVED", 4, "CARRIER", 4),
    ("DELIVERY_SIGNED", 5, "CUSTOMER", 4),
)
STATUSES = {row[0]: row[3] for row in CATALOG}
# Exception occurs immediately before the named recovery stage.
SCENARIOS = {
    "supplier_delay": (2, "SUPPLIER_DELAYED", "WARNING", 2160),
    "quality_failure": (3, "QUALITY_CHECK", "FAILED", 2160),
    "transport_disruption": (7, "TRANSPORT_DISRUPTION", "WARNING", 2160),
}
BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)
FIXTURE_EVENTS = len(SCENARIOS) * (2 * len(STAGES) + 1)
PRESETS = (FIXTURE_EVENTS, 100_000, 500_000, 1_000_000)
DEFAULT_SEED = 5003
FORMAT_VERSION = 1


def sha256_file(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def order_number(order_id):
    return f"SO-SYN-{order_id:06d}"


def write_reference_data(emit):
    for entity_id, code, name, role in (
        (1, "FAC-SYN", "Synthetic assembly plant", "FACTORY"),
        (2, "SUP-SYN", "Synthetic component supplier", "SUPPLIER"),
        (3, "WH-SYN", "Synthetic receiving warehouse", "WAREHOUSE"),
        (4, "CAR-SYN", "Synthetic freight carrier", "CARRIER"),
        (5, "CUS-SYN-A", "Synthetic customer A", "CUSTOMER"),
        (6, "CUS-SYN-B", "Synthetic customer B", "CUSTOMER"),
    ):
        emit("entities", entity_id, code, name, role, "CN", BASE, BASE)

    for location_id, entity_id, name in (
        (1, 1, "Plant"), (2, 2, "Supplier yard"), (3, 3, "Warehouse"),
        (4, 5, "Customer A dock"), (5, 6, "Customer B dock"),
    ):
        emit("locations", location_id, f"LOC-SYN-{location_id}", name,
             entity_id, "CN", BASE, BASE)

    emit("items", 1, "RM-SYN", "Machined component", "RAW_MATERIAL", "EA", True, BASE, BASE)
    emit("items", 2, "FG-SYN", "Pump housing", "FINISHED_GOOD", "EA", True, BASE, BASE)
    for row in CATALOG:
        emit("event_types", *row)


def make_order(emit, rng, order_id, first_event, scenario=None, shared_cause=None):
    """Write one order and its event chain. Return the next ID and exception, if any."""
    start = BASE + timedelta(minutes=(order_id - 1) * 5)
    offsets = (0, 30, 60, 90, 45, 180, 60, 480, 30)
    planned = [start]
    for offset in offsets[1:]:
        planned.append(planned[-1] + timedelta(minutes=offset + rng.randint(0, offset)))
    actual = planned.copy()
    extra_stage = None
    if scenario:
        extra_stage, exception_type, exception_status, delay = SCENARIOS[scenario]
        exception_time = planned[extra_stage]
        hold = timedelta(minutes=delay)
        if shared_cause:
            _, cause_time = shared_cause
            hold += max(cause_time - planned[extra_stage], timedelta())
        actual[extra_stage:] = [time + hold for time in actual[extra_stage:]]

    customer_id = 5 + (order_id - 1) % 2
    destination = 4 + (order_id - 1) % 2
    quantity = rng.randint(5, 100)
    due = planned[-1].date()
    late = actual[-1].date() > due
    commitment_id = order_id * 2 - 1
    emit("orders", order_id, order_number(order_id), customer_id, start, due,
         "DELAYED" if late else "DELIVERED", start, start)
    emit("order_lines", order_id, order_id, 1, 2, quantity,
         rng.randint(180, 640), due, start, start)
    emit("purchase_orders", order_id, f"PO-SYN-{order_id:06d}", 2, actual[1],
         planned[2].date(), "DELAYED" if scenario == "supplier_delay" else "COMPLETED",
         actual[1], actual[1])
    emit("po_lines", order_id, order_id, 1, 1, quantity, quantity, 45, actual[1], actual[1])
    emit("purchase_line_allocations", order_id, order_id, quantity, actual[1])
    emit("production_orders", order_id, f"MO-SYN-{order_id:06d}", 1, order_id, 2,
         quantity, planned[4], planned[5], actual[4], actual[5], "COMPLETED", start, start)
    emit("shipments", order_id, f"SHP-SYN-{order_id:06d}", 4, 1, destination,
         planned[6], planned[7], actual[6], actual[7], "DELIVERED", start, start)
    emit("shipment_lines", order_id, order_id, order_id, quantity, start)
    emit("delivery_commitments", commitment_id, order_id, 1, due, start,
         "Initial promise", "SUPERSEDED" if late else "ACTIVE", None)
    if late:
        emit("delivery_commitments", commitment_id + 1, order_id, 2, actual[-1].date(),
             shared_cause[1] if shared_cause else exception_time,
             scenario, "ACTIVE", commitment_id)
        commitment_id += 1

    event_id = first_event
    parent = None
    exception = None

    def write_event(stage, code, status, time, is_exception=False):
        nonlocal event_id, parent
        _, actor, role, location = STAGES[stage]
        actor = customer_id if role == "CUSTOMER" else actor
        location = destination if location == 4 else location
        purchase = order_id if 1 <= stage <= 3 else None
        production = order_id if 4 <= stage <= 5 else None
        shipment = order_id if stage >= 6 else None
        payload = {"lot": f"LOT-SYN-{order_id:06d}"} if stage == 3 else {}
        if is_exception:
            payload.update(scenario=scenario, delay_minutes=delay)
        emit("supply_chain_events", event_id, code, time, time + timedelta(minutes=1),
             role, actor, location, order_id, order_id, purchase, purchase, production,
             shipment, commitment_id if stage == 8 else None, quantity, status,
             scenario.replace("_", " ").capitalize() if is_exception else None,
             parent, json.dumps(payload, sort_keys=True), "supplytrace-generator")
        parent = event_id
        event_id += 1

    for stage, (code, *_actor) in enumerate(STAGES):
        if stage == extra_stage and not shared_cause:
            exception = (event_id, exception_time)
            write_event(stage, exception_type, exception_status, exception_time, True)
        if stage == extra_stage and shared_cause:
            emit("causal_links", shared_cause[0], event_id, "CONTRIBUTING", "1.000",
                 scenario, actual[stage])
        status = "WARNING" if stage == 8 and late else STATUSES[code]
        write_event(stage, code, status, actual[stage])
    return event_id, exception


def generate(output, events, seed):
    if output.exists():
        raise ValueError(f"Output already exists: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as staging:
        folder = Path(staging)
        counts = Counter()
        with ExitStack() as stack:
            writers = {}
            for table, columns in COLUMNS.items():
                stream = stack.enter_context(
                    (folder / f"{table}.csv").open("w", encoding="utf-8", newline="")
                )
                writers[table] = csv.writer(stream, lineterminator="\n")
                writers[table].writerow(columns.split())

            def emit(table, *values):
                writers[table].writerow(values)
                counts[table] += 1

            write_reference_data(emit)
            fixed_rng = random.Random(DEFAULT_SEED)
            event_id = 1
            order_id = 1
            for scenario in SCENARIOS:
                event_id, root = make_order(emit, fixed_rng, order_id, event_id, scenario)
                event_id, _ = make_order(emit, fixed_rng, order_id + 1, event_id,
                                         scenario, shared_cause=root)
                order_id += 2

            rng = random.Random(seed)
            remaining = events - FIXTURE_EVENTS
            # Nine core events per order plus one for roughly 10% of these orders.
            bulk_orders = (remaining * 10 + 90) // 91
            extra_orders = remaining - len(STAGES) * bulk_orders
            anomaly_orders = set(rng.sample(range(bulk_orders), extra_orders))
            for index in range(bulk_orders):
                scenario = rng.choice(tuple(SCENARIOS)) if index in anomaly_orders else None
                event_id, _ = make_order(emit, rng, order_id + index, event_id, scenario)

        if counts["supply_chain_events"] != events:
            raise RuntimeError("Generated event count does not match requested size")
        manifest = {
            "format_version": FORMAT_VERSION,
            "seed": seed,
            "event_count": events,
            "tables": {
                table: {"rows": counts[table], "sha256": sha256_file(folder / f"{table}.csv")}
                for table in COLUMNS
            },
        }
        (folder / "manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
        )
        folder.rename(output)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--events", type=int, choices=PRESETS, default=100_000)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        manifest = generate(args.output, args.events, args.seed)
    except (OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")
    print(f"{manifest['event_count']:,} events written to {args.output}")


if __name__ == "__main__":
    main()
