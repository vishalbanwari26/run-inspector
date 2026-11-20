# Chaos test

300 runs per seed. Faults: model rate limits (25% of runs), ERP timeout after the booking was saved (25%), requester mailbox missing once (15%), mail server timeout after the message was sent (20%), a worker crash right after a step's work finished and before its result was saved (30%). A simulated operator approves, rejects, fixes the purchase order and retries until nothing moves.

| Seed | Crashes | Booked | Rejected | Stopped (bad totals) | Unknown outcomes checked by a person | Duplicate bookings | Duplicate messages | Baseline duplicate bookings | Baseline duplicate messages |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 46 | 249 | 23 | 28 | 45 | **0** | **0** | 75 | 45 |
| 2 | 78 | 253 | 20 | 27 | 52 | **0** | **0** | 86 | 52 |
| 3 | 72 | 235 | 36 | 29 | 46 | **0** | **0** | 73 | 46 |
| 4 | 60 | 254 | 20 | 26 | 56 | **0** | **0** | 72 | 56 |
| 5 | 57 | 259 | 22 | 19 | 60 | **0** | **0** | 92 | 60 |

## Seed 1

### With the rules
- worker crashes injected: 46 (match_po 10, post_invoice 11, check_totals 9, extract 5, approve 8, notify 3), automatic retries: 232, operator actions: 202
- end states: done (booked): 249, done (rejected): 23, failed at check_totals: 28
- bookings: 249, duplicate bookings: **0**
- messages: 249, duplicate messages: **0**
- model calls: 305 for 300 runs (5 repeated; crashes during extract: 5)
- unknown outcomes stopped for a person: 45 (had gone out: 45, had not: 0)

### Naive baseline (books and messages without asking first)
- worker crashes injected: 46 (match_po 10, post_invoice 11, check_totals 9, extract 5, approve 8, notify 3), automatic retries: 274, operator actions: 157
- end states: done (booked): 249, done (rejected): 23, failed at check_totals: 28
- bookings: 324, duplicate bookings: **75**
- messages: 294, duplicate messages: **45**
- model calls: 305 for 300 runs (5 repeated; crashes during extract: 5)
- unknown outcomes stopped for a person: 0 (had gone out: 0, had not: 0)

## Seed 2

### With the rules
- worker crashes injected: 78 (post_invoice 12, extract 10, match_po 7, check_totals 16, approve 19, notify 14), automatic retries: 228, operator actions: 216
- end states: done (booked): 253, done (rejected): 20, failed at check_totals: 27
- bookings: 253, duplicate bookings: **0**
- messages: 253, duplicate messages: **0**
- model calls: 310 for 300 runs (10 repeated; crashes during extract: 10)
- unknown outcomes stopped for a person: 52 (had gone out: 52, had not: 0)

### Naive baseline (books and messages without asking first)
- worker crashes injected: 78 (post_invoice 12, extract 10, match_po 7, check_totals 16, approve 19, notify 14), automatic retries: 266, operator actions: 164
- end states: done (booked): 253, done (rejected): 20, failed at check_totals: 27
- bookings: 339, duplicate bookings: **86**
- messages: 305, duplicate messages: **52**
- model calls: 310 for 300 runs (10 repeated; crashes during extract: 10)
- unknown outcomes stopped for a person: 0 (had gone out: 0, had not: 0)

## Seed 3

### With the rules
- worker crashes injected: 72 (post_invoice 7, extract 14, match_po 18, check_totals 12, approve 10, notify 11), automatic retries: 185, operator actions: 218
- end states: done (booked): 235, done (rejected): 36, failed at check_totals: 29
- bookings: 235, duplicate bookings: **0**
- messages: 235, duplicate messages: **0**
- model calls: 314 for 300 runs (14 repeated; crashes during extract: 14)
- unknown outcomes stopped for a person: 46 (had gone out: 46, had not: 0)

### Naive baseline (books and messages without asking first)
- worker crashes injected: 72 (post_invoice 7, extract 14, match_po 18, check_totals 12, approve 10, notify 11), automatic retries: 220, operator actions: 172
- end states: done (booked): 235, done (rejected): 36, failed at check_totals: 29
- bookings: 308, duplicate bookings: **73**
- messages: 281, duplicate messages: **46**
- model calls: 314 for 300 runs (14 repeated; crashes during extract: 14)
- unknown outcomes stopped for a person: 0 (had gone out: 0, had not: 0)

## Seed 4

### With the rules
- worker crashes injected: 60 (extract 14, match_po 11, check_totals 7, approve 9, post_invoice 13, notify 6), automatic retries: 207, operator actions: 204
- end states: done (booked): 254, done (rejected): 20, failed at check_totals: 26
- bookings: 254, duplicate bookings: **0**
- messages: 254, duplicate messages: **0**
- model calls: 314 for 300 runs (14 repeated; crashes during extract: 14)
- unknown outcomes stopped for a person: 56 (had gone out: 56, had not: 0)

### Naive baseline (books and messages without asking first)
- worker crashes injected: 60 (extract 14, match_po 11, check_totals 7, approve 9, post_invoice 13, notify 6), automatic retries: 257, operator actions: 148
- end states: done (booked): 254, done (rejected): 20, failed at check_totals: 26
- bookings: 326, duplicate bookings: **72**
- messages: 310, duplicate messages: **56**
- model calls: 314 for 300 runs (14 repeated; crashes during extract: 14)
- unknown outcomes stopped for a person: 0 (had gone out: 0, had not: 0)

## Seed 5

### With the rules
- worker crashes injected: 57 (post_invoice 17, extract 9, check_totals 9, match_po 7, notify 11, approve 4), automatic retries: 211, operator actions: 245
- end states: done (booked): 259, done (rejected): 22, failed at check_totals: 19
- bookings: 259, duplicate bookings: **0**
- messages: 259, duplicate messages: **0**
- model calls: 309 for 300 runs (9 repeated; crashes during extract: 9)
- unknown outcomes stopped for a person: 60 (had gone out: 60, had not: 0)

### Naive baseline (books and messages without asking first)
- worker crashes injected: 57 (post_invoice 17, extract 9, check_totals 9, match_po 7, notify 11, approve 4), automatic retries: 260, operator actions: 185
- end states: done (booked): 259, done (rejected): 22, failed at check_totals: 19
- bookings: 351, duplicate bookings: **92**
- messages: 319, duplicate messages: **60**
- model calls: 309 for 300 runs (9 repeated; crashes during extract: 9)
- unknown outcomes stopped for a person: 0 (had gone out: 0, had not: 0)
