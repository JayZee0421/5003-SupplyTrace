# Frontend demo storyboard

Shot list for the course project video. The course slides require an **8-10 minute** video; the internal division plan says 5-8 minutes. Record to the longer course requirement. Allocate about 3-4 minutes to the frontend segment and leave the rest for schema, query execution, backend operations and performance.

Every action is repeatable against the real API. Before recording, confirm the header shows `API live`, set browser zoom to 100%, and use a 1920x1080 window.

## Shot 1: Overview and latest exceptions (about 30 seconds)

- Screen: hero title, empty order search, dynamic `Latest exception: event #57` link, supplier-delay demo preview (a worked example, not the latest exception), `Latest exceptions` panel, demo scenario table and guide.
- Action: open `/` with an empty search; point to the hero link, which is computed from the newest seeded exception; in the panel, read one row (event, order, status, time) and open its root cause or impact; return and move to the scenario table and walkthrough.
- Voice-over: opening the app shows the newest WARNING or FAILED events across the six seeded demo orders, not a fixed first order; the API has no global event-list endpoint, so the panel is explicitly scoped to the seed set; the preview stays on `SO-SYN-000001` as the supplier-delay walkthrough example, while the hero link and panel follow the newest exception.
- Screenshot: `home-1920.png`

## Shot 2: Order timeline (about 30 seconds)

- URL: `/orders/SO-SYN-000001`
- Action: read the header context (counts, customer, commitment); the newest event `#10 DELIVERY_SIGNED` is at the top with the `Latest` tag, so point out its Warning status first, then scroll down to `#3 SUPPLIER_DELAYED` with its amber Exception tag and continue to `#1 ORDER_CONFIRMED`.
- Voice-over: the timeline is newest first, like a tracking feed, while the cause-chain view runs the other way; exceptions carry color, icon and text; every event links to its root cause and impact.
- Screenshot: `timeline-1920.png`

## Shot 3: Root-cause trace (about 40 seconds)

- URL: `/events/10/root-cause`
- Action: show the metric strip (10 nodes, earliest exception `#3`, chain start `#1`); note that Event context shows `SO-SYN-000001` rather than only an internal id; scroll the chain from `#1` down to `#10`; point out the Chain start and Earliest exception tags; click "View impact of event #3".
- Voice-over: root cause follows `caused_by_event_id` only; the earliest exception is the first WARNING or FAILED event by time and id in the returned chain.
- Screenshot: `rootcause-1920.png`

## Shot 4: Impact propagation (about 40 seconds)

- URL: `/events/3/impact`
- Action: show the affected-orders metrics and the columns by hop count with the PRIMARY / CONTRIBUTING edge styles; point out the lane labels above the first card of each row (`SO-SYN-000001`, `SO-SYN-000002`) and the matching subtitle, then point to the affected-orders table (order, customer, line, commitment, latest event `#10`) and click an order number to open its timeline.
- Voice-over: impact walks every causal edge forward; orders attached to the source event are included and orders are deduplicated.
- Screenshot: `impact-1920.png`

## Shot 5: Stage durations (about 30 seconds)

- URL: `/durations`
- Action: with the 57-event benchmark dataset loaded, show the metric strip (8/8 stages, 6 lines sampled, slowest P90 50.88 h for "Dispatch to arrival" with average 24.15 h); hover "Dispatch to arrival" for the sample count; enter `SO-SYN-000001` in Order number and click Apply to show the URL filter; click Reset.
- Note: the 100k dataset keeps the same scenario event ids and impact/root results, but its duration aggregates differ (10,989 samples; P90 15.43 h / average 13.06 h at seed 5003). State the dataset in the voice-over and use the values shown on screen; do not read the 57-event numbers over a 100k-dataset recording.
- Voice-over: P90 uses `percentile_cont(0.9)` with linear interpolation; filters live in the URL and can be deep-linked.
- Screenshot: `durations-1920.png`

## Shot 6: Error and narrow states (optional, about 20 seconds)

- Action: open `/orders/DOES-NOT-EXIST` to show the 404 explanation and retry; switch to 1280 width to show horizontal scrolling in the impact graph; switch to 768/512/375 width to show the stacked scenario table, the card layout of the latest-exceptions rows and single-column metrics.
- Voice-over: loading, empty, 404/422/503/504 all have explicit states; 1920x1080 has no clipped text, and narrow layouts stack or scroll.
- Screenshots: `notfound-1280.png`, `impact-1280.png`, `timeline-768.png`, `home-512.png`, `home-512-recent.png`, `home-375.png`

## Course video coverage checklist

The course slides ask the video to demonstrate the user interface, query execution, data flow and backend operations. This frontend segment covers the UI and the data flow; the group video must also include the remaining items:

| Requirement | Where it is covered |
| --- | --- |
| User interface | This storyboard, all four views |
| Query execution | Timeline, root cause, impact and duration views exercise the Part 3 API; show `/docs` or the SQL/CTE files in the backend segment |
| Data flow | Timeline event -> root-cause chain -> impacted orders -> stage durations (shots 2-5) |
| Backend operations | Member 3/5 segment: FastAPI startup, PostgreSQL, `EXPLAIN ANALYZE`, Docker Compose, smoke test |

## Recording notes

- Do not use mock mode; the header must show `API live`, not `Mock data`.
- Use the 57-event `benchmark_data` set or the seed-5003 100k dataset; scenario event ids and root/impact results are identical, but duration aggregates differ, so read the values shown for the loaded dataset.
- Hold each final frame for one second for easier editing.
- The course report requires a working video link; give the uploaded link to Member 5 for report section 9.
