# SupplyTrace Benchmark Summary

## 1. Benchmark Environment

- Database: PostgreSQL 16.16
- Dataset: Synthetic supply chain events
- Random seed: 5003
- Dataset sizes: 100k, 500k, 1m events
- Query measurement: PostgreSQL EXPLAIN ANALYZE
- Query repetitions: 5 per query
- p50: Median execution time
- p95: Linear-interpolated 95th percentile of five executions

## 2. Dataset Scale and Initialization

| Metric | 100k | 500k | 1m |
|---|---:|---:|---:|
| Events | 100,000 | 500,000 | 1,000,000 |
| Orders | 10,989 | 54,945 | 109,890 |
| Initialization Time (s) | 9.925 | 53.888 | 103.365 |
| Database Size (MB) | 109 | 513 | 1,018 |
| Data Quality Checks Passed | 24/24 | 24/24 | 24/24 |

Initialization time includes schema creation, dataset checksum verification, CSV loading, row-count validation, and ANALYZE. It excludes temporary database creation and deletion.

Database size includes PostgreSQL tables, indexes, and associated storage overhead.

## 3. Core Query Performance

All execution times are in milliseconds (ms).

| Query | 100k p50 | 100k p95 | 500k p50 | 500k p95 | 1m p50 | 1m p95 |
|---|---:|---:|---:|---:|---:|---:|
| Timeline | 0.008 | 0.012 | 0.011 | 0.011 | 0.010 | 0.014 |
| Root Cause | 0.042 | 0.047 | 0.088 | 0.136 | 0.041 | 0.052 |
| Impact | 0.187 | 0.204 | 0.191 | 0.271 | 0.201 | 0.207 |
| Stage Durations | 211.728 | 215.010 | 1103.459 | 1180.730 | 2077.113 | 2166.337 |

### Observations

- Timeline, Root Cause, and Impact queries maintained low execution times as the dataset increased from 100k to 1m events.
- Stage Durations showed substantially higher execution times and increased with dataset size.
- Stage Durations is a potential target for further optimization.

## 4. Recursive Traversal Optimization

| Dataset | Before Part 1 (ms) | After Part 3 (ms) | Speedup |
|---|---:|---:|---:|
| 100k | 141.777 | 0.090 | 1,575x |
| 500k | 2191.035 | 0.100 | 21,910x |
| 1m | 4183.871 | 0.102 | 41,018x |

The optimized traversal uses indexed causal relationships to avoid repeated expensive scans.

All before/after comparisons returned equivalent results.

Speedup values refer to the measured SQL execution plans for the selected benchmark scenario, not end-to-end API response times.

## 5. Index Performance

Median execution times in milliseconds.

| Index Test | 100k Indexed | 100k Without | 500k Indexed | 500k Without | 1m Indexed | 1m Without |
|---|---:|---:|---:|---:|---:|---:|
| caused_by | 0.007 | 11.347 | 0.010 | 46.098 | 0.007 | 57.551 |
| entity_time | 0.032 | 9.938 | 0.045 | 32.703 | 0.029 | 54.529 |
| type_time | 0.036 | 7.375 | 0.037 | 28.621 | 0.037 | 46.770 |

All indexed/unindexed comparisons returned equivalent query results.

## 6. Data Quality and Scenario Validation

Each dataset passed all 24 data-quality checks.

Three representative scenarios were validated:

1. Supplier delay
2. Quality failure
3. Transport disruption

Each scenario contains a ten-node causal chain and expected impacted orders.

## 7. Methodology and Limitations

- Query performance was measured using PostgreSQL EXPLAIN ANALYZE.
- Each query was executed five times.
- p50 is the median of the five execution times.
- p95 was calculated using linear interpolation.
- Because each query has only five measurements, p95 should be interpreted as an exploratory estimate rather than a statistically robust tail-latency measurement.
- Database execution time does not include HTTP transport, API serialization, or frontend rendering.
- Results are based on synthetic data and selected benchmark queries.
- Initialization times were measured once per dataset size and may vary with system load and filesystem performance.

## 8. Reproducibility and Evidence

Benchmark script:

- `scripts/benchmark_part3.py`

Raw benchmark results:

- `docs/part3/plans_100k_local/`
- `docs/part3/plans_500k_local/`
- `docs/part3/plans_1m_local/`

Each directory contains the benchmark summary and corresponding SQL execution plans.

Dataset generation uses random seed 5003.
