# Chaos test

300 runs per seed. Faults: model rate limits (25% of runs), ERP timeout after the booking was saved (25%), requester mailbox missing once (15%), a worker crash right after a step's work finished and before its result was saved (30%). A simulated operator approves, rejects, fixes the purchase order and retries until nothing moves.

| Seed | Crashes | Booked | Rejected | Stopped (bad totals) | Duplicate bookings | Duplicate messages | Baseline duplicate bookings | Baseline duplicate messages |
|---|---|---|---|---|---|---|---|---|
| 1 | 63 | 246 | 18 | 36 | **0** | **0** | 69 | 9 |
| 2 | 49 | 239 | 24 | 37 | **0** | **0** | 68 | 9 |
| 3 | 59 | 235 | 33 | 32 | **0** | **0** | 66 | 15 |
| 4 | 69 | 236 | 36 | 28 | **0** | **0** | 68 | 4 |
| 5 | 65 | 248 | 24 | 28 | **0** | **0** | 73 | 8 |

## Seed 1

### With the rules
- worker crashes injected: 63 (notify 9, extract 13, check_totals 12, match_po 8, post_invoice 7, approve 14), automatic retries: 225, operator actions: 177
- end states: done (booked): 246, done (rejected): 18, failed at check_totals: 36
- bookings: 246, duplicate bookings: **0**
- messages: 246, duplicate messages: **0**
- model calls: 313 for 300 runs (13 repeated; crashes during extract: 13)

### Naive baseline (books and messages without asking first)
- worker crashes injected: 63 (notify 9, extract 13, check_totals 12, match_po 8, post_invoice 7, approve 14), automatic retries: 225, operator actions: 177
- end states: done (booked): 246, done (rejected): 18, failed at check_totals: 36
- bookings: 315, duplicate bookings: **69**
- messages: 255, duplicate messages: **9**
- model calls: 313 for 300 runs (13 repeated; crashes during extract: 13)

## Seed 2

### With the rules
- worker crashes injected: 49 (check_totals 7, extract 11, match_po 8, notify 9, post_invoice 8, approve 6), automatic retries: 203, operator actions: 182
- end states: done (booked): 239, done (rejected): 24, failed at check_totals: 37
- bookings: 239, duplicate bookings: **0**
- messages: 239, duplicate messages: **0**
- model calls: 311 for 300 runs (11 repeated; crashes during extract: 11)

### Naive baseline (books and messages without asking first)
- worker crashes injected: 49 (check_totals 7, extract 11, match_po 8, notify 9, post_invoice 8, approve 6), automatic retries: 203, operator actions: 182
- end states: done (booked): 239, done (rejected): 24, failed at check_totals: 37
- bookings: 307, duplicate bookings: **68**
- messages: 248, duplicate messages: **9**
- model calls: 311 for 300 runs (11 repeated; crashes during extract: 11)

## Seed 3

### With the rules
- worker crashes injected: 59 (check_totals 9, notify 15, extract 12, approve 8, post_invoice 12, match_po 3), automatic retries: 183, operator actions: 191
- end states: done (booked): 235, done (rejected): 33, failed at check_totals: 32
- bookings: 235, duplicate bookings: **0**
- messages: 235, duplicate messages: **0**
- model calls: 312 for 300 runs (12 repeated; crashes during extract: 12)

### Naive baseline (books and messages without asking first)
- worker crashes injected: 59 (check_totals 9, notify 15, extract 12, approve 8, post_invoice 12, match_po 3), automatic retries: 183, operator actions: 191
- end states: done (booked): 235, done (rejected): 33, failed at check_totals: 32
- bookings: 301, duplicate bookings: **66**
- messages: 250, duplicate messages: **15**
- model calls: 312 for 300 runs (12 repeated; crashes during extract: 12)

## Seed 4

### With the rules
- worker crashes injected: 69 (post_invoice 15, extract 12, check_totals 11, match_po 14, notify 4, approve 13), automatic retries: 230, operator actions: 197
- end states: done (booked): 236, done (rejected): 36, failed at check_totals: 28
- bookings: 236, duplicate bookings: **0**
- messages: 236, duplicate messages: **0**
- model calls: 312 for 300 runs (12 repeated; crashes during extract: 12)

### Naive baseline (books and messages without asking first)
- worker crashes injected: 69 (post_invoice 15, extract 12, check_totals 11, match_po 14, notify 4, approve 13), automatic retries: 230, operator actions: 197
- end states: done (booked): 236, done (rejected): 36, failed at check_totals: 28
- bookings: 304, duplicate bookings: **68**
- messages: 240, duplicate messages: **4**
- model calls: 312 for 300 runs (12 repeated; crashes during extract: 12)

## Seed 5

### With the rules
- worker crashes injected: 65 (approve 9, extract 12, check_totals 10, post_invoice 11, match_po 15, notify 8), automatic retries: 214, operator actions: 199
- end states: done (booked): 248, done (rejected): 24, failed at check_totals: 28
- bookings: 248, duplicate bookings: **0**
- messages: 248, duplicate messages: **0**
- model calls: 312 for 300 runs (12 repeated; crashes during extract: 12)

### Naive baseline (books and messages without asking first)
- worker crashes injected: 65 (approve 9, extract 12, check_totals 10, post_invoice 11, match_po 15, notify 8), automatic retries: 214, operator actions: 199
- end states: done (booked): 248, done (rejected): 24, failed at check_totals: 28
- bookings: 321, duplicate bookings: **73**
- messages: 256, duplicate messages: **8**
- model calls: 312 for 300 runs (12 repeated; crashes during extract: 12)
