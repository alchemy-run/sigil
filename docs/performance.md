# Terminal-core performance

Run `vpr bench:terminal` to measure the React renderer and structured terminal core. The command exits unsuccessfully when its p95 latency, approximate heap allocation, or emitted-byte budgets are exceeded.

Baseline captured on 2026-08-24 on the development machine:

| Workload                   |     p50 |     p95 |      Output |
| -------------------------- | ------: | ------: | ----------: |
| 50-row React table         | 3.85 ms | 5.68 ms | 5,549 bytes |
| One changed cell in 120×40 | 0.73 ms | 0.78 ms |     9 bytes |
| 40 changed cells in 120×40 | 0.74 ms | 0.80 ms |   202 bytes |
| One changed wide grapheme  | 0.73 ms | 0.78 ms |    12 bytes |
| Full 120×40 serialization  | 0.57 ms | 0.65 ms | 4,839 bytes |

Budgets live beside the workloads in `benchmark/terminal-core.tsx`: 25 ms for the large React render, 1.5 ms for sparse/wide diffs, 2 ms for changed-line diffs, and 4 ms for full serialization. Byte budgets are 6,000, 16, 256, 16, and 5,000 respectively. Allocation checks are deliberately broad because `heapUsed` is a process-level approximation; use a heap profiler before treating a regression as an individual allocation-site diagnosis.
