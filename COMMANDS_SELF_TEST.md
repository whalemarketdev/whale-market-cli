# Whale Market CLI — Command List & Self Test Guide

This file lists **all available commands** with their purpose and manual testing steps.

---

## Setup

```bash
cd whale-market-cli
npm install && npm run build
npm link   # or use: node dist/index.js
```

---

## Phase 1: Read-Only (no wallet required)

### 1. `whales tokens list`

**Purpose:** List pre-market tokens, default sort by 24h volume.

| Option | Purpose |
|--------|---------|
| `--limit <n>` | Limit number of rows |
| `--status <active\|ended\|settling>` | Filter by status |
| `--chain <id>` | Filter by chain ID |
| `--sort <vol\|price\|created>` | Sort: vol, price, created |
| `--no-fdv` | Hide Implied FDV column |
| `--no-volume` | Hide 24h Vol column |
| `--format json\|plain` | Output JSON or plain text |

**How to test:**
```bash
whales tokens list --limit 5
whales tokens list --limit 3 --format json
```
- [ ] Columns: Name, Symbol, Price, Implied FDV, 24h Vol, Status
- [ ] `--format json` returns valid JSON array

---

### 2. `whales tokens search <query>`

**Purpose:** Search tokens by name or symbol.

| Option | Purpose |
|--------|---------|
| `--limit <n>` | Limit results |
| `--format json\|plain` | Output JSON or plain |

**How to test:**
```bash
whales tokens search MEGA --limit 5
whales tokens search PENGU --format json
```
- [ ] Results contain search keyword
- [ ] Valid JSON

---

### 3. `whales tokens get <token-id>`

**Purpose:** View details of one token by ID.

| Option | Purpose |
|--------|---------|
| `--format json\|plain` | Output JSON or plain |

**How to test:**
```bash
# Get ID from list
whales tokens list --limit 1 --format json | jq -r '.[0].id'
# Replace <ID> with the ID above
whales tokens get <ID>
whales tokens get <ID> --format json
```
- [ ] Displays: ID, Name, Symbol, Status, Price, Chain ID, Description
- [ ] JSON has all fields

---

### 4. `whales tokens highlight`

**Purpose:** Get highlighted/trending tokens list.

**How to test:**
```bash
whales tokens highlight
whales tokens highlight --format json
```
- [ ] Returns token list
- [ ] Correct format

---

### 5. `whales tokens stats`

**Purpose:** Prediction statistics (volume, count, etc.).

**How to test:**
```bash
whales tokens stats
whales tokens stats --format json
```
- [ ] Has statistics data
- [ ] Valid JSON

---

### 6. `whales book <symbol>`

**Purpose:** View order book for a token by symbol — SELL ORDERS (asks) and BUY ORDERS (bids).

| Option | Purpose |
|--------|---------|
| `--depth <n>` | Rows per side (default 10) |
| `--chain-id <id>` | Filter by chain |
| `--live` | WebSocket real-time (not yet implemented) |
| `--format json\|plain` | Output JSON or plain |

**How to test:**
```bash
whales book MEGA --depth 5
whales book PENGU --depth 3 --format json
```
- [ ] Has **SELL ORDERS** and **BUY ORDERS** sections
- [ ] Columns: Price, Size, Filled, Remaining, Fill (Open/Partial/Filled), Value
- [ ] Has **Spread**
- [ ] `--format json` has `sell_orders`, `buy_orders`, `spread`, `symbol`

---

### 7. `whales networks list`

**Purpose:** List supported networks (chain ID, RPC, etc.).

**How to test:**
```bash
whales networks list
whales networks list --format json
```
- [ ] Has chain info
- [ ] Valid JSON

---

### 8. `whales status`

**Purpose:** Check API connection and system status.

**How to test:**
```bash
whales status
whales status --format json
```
- [ ] Displays API URL and status
- [ ] Valid JSON

---

### 9. `whales orderbook snapshot`

**Purpose:** Order book aggregate stats (order count, volume, avg price).

**How to test:**
```bash
whales orderbook snapshot
whales orderbook snapshot --format json
```
- [ ] Has buy/sell data, volume, value
- [ ] Valid JSON

---

### 10. `whales orderbook positions` / `pairs` / `filled`

**Purpose:** Orderbook sub-commands (positions, pairs, filled order).

**How to test:**
```bash
whales orderbook positions
whales orderbook pairs
whales orderbook filled <id>
```
- [ ] Runs without error or shows clear error (may need params)

---

## Phase 2: Wallet required (setup first)

### Setup wallet (one-time)

```bash
whales setup
# or
whales wallet import <PRIVATE_KEY> --type solana
```

---

### 11. `whales wallet create` / `import` / `show` / `address` / `link`

**Purpose:** Wallet management — create, import, view info, get address, link.

| Command | Purpose |
|---------|---------|
| `wallet create --type solana\|evm` | Create new wallet |
| `wallet import <key> --type solana\|evm` | Import from private key |
| `wallet show` | Display wallet info |
| `wallet address` | Show address only |
| `wallet link <address>` | Link address |

**How to test:**
```bash
whales wallet show
whales wallet address --format json
```
- [ ] Displays address and type
- [ ] Valid JSON

---

### 12. `whales offers list` / `my` / `get` / `react`

**Purpose:** Offer management — list all, list mine, detail, react.

| Command | Purpose |
|---------|---------|
| `offers list` | List all offers |
| `offers my` | My wallet offers |
| `offers get <id>` | Offer detail |
| `offers react <id>` | React to offer |

**How to test:**
```bash
whales offers list --limit 5
whales offers my
whales offers get <OFFER_ID>
```
- [ ] `offers my` requires wallet setup
- [ ] Table/JSON correct format

---

### 13. `whales orders list` / `my` / `get` / `by-offer`

**Purpose:** Order management — list, mine, detail, by offer.

| Command | Purpose |
|---------|---------|
| `orders list` | List all orders |
| `orders my` | My wallet orders |
| `orders get <id>` | Order detail |
| `orders by-offer <address>` | Orders by offer address |

**How to test:**
```bash
whales orders list --limit 5
whales orders my
whales orders get <ORDER_ID>
```
- [ ] `orders my` requires wallet
- [ ] Output correct format

---

### 14. `whales portfolio show` / `positions` / `balance`

**Purpose:** View portfolio — summary, positions, balance.

**How to test:**
```bash
whales portfolio show
whales portfolio positions
whales portfolio balance
```
- [ ] Requires wallet
- [ ] Has data or clear message

---

### 15. `whales referral summary` / `campaigns` / `earnings` / `transactions`

**Purpose:** Referral info — summary, campaigns, earnings, transactions.

**How to test:**
```bash
whales referral summary
whales referral campaigns
whales referral earnings
whales referral transactions
```
- [ ] Has data or "no data" message

---

## Global options (all commands)

| Option | Purpose |
|--------|---------|
| `--format table\|json\|plain` | Output format |
| `--api-url <url>` | Override API URL |
| `--private-key <key>` | Override private key |
| `--chain-id <id>` | Override chain ID |

---

## Help

```bash
whales --help
whales tokens --help
whales book --help
whales wallet --help
# ... same for each command
```

---

## General testing flow

1. **Phase 1:** Run Phase 1 commands in order, no wallet needed.
2. **Phase 2:** Run `whales setup` or `wallet import`, then test Phase 2 commands.
3. **Format:** For important commands, try `--format json` and use `jq` to verify structure.
4. **Errors:** Try invalid commands (e.g. `whales tokens get invalid-id`) to check error messages.

---

## Example jq JSON validation

```bash
# Tokens list — check is array
whales tokens list --limit 2 --format json | jq 'type == "array"'

# Tokens list — check first element has id, name, symbol
whales tokens list --limit 1 --format json | jq '.[0] | has("id") and has("name") and has("symbol")'

# Book — check has sell_orders, buy_orders
whales book MEGA --format json | jq 'has("sell_orders") and has("buy_orders")'
```
