# Whale Market CLI - Self Testing Guide

Guide for testing **existing** CLI features.

---

## Setup

### 1. Build CLI
```bash
cd whale-market-cli
npm install
npm run build
npm link  # or use npm run dev
```

### 2. Verify CLI works
```bash
whales --version
whales --help
```

---

## Test Phase 1: Read-Only Commands (No wallet required)

### Test 1: Tokens List
```bash
# Basic list
whales tokens list

# With filters
whales tokens list --status active
whales tokens list --limit 5
whales tokens list --page 2

# With chain filter
whales tokens list --chain 666666

# JSON output
whales tokens list --format json

# Plain output
whales tokens list --format plain
```

**Verify:**
- [ ] Table displays with columns: ID, Name, Symbol, Status, Price, Last Price, Chain, Token ID/Address, Type
- [ ] `--status` filter works (active/ended)
- [ ] `--limit` limits rows correctly
- [ ] `--format json` returns valid JSON
- [ ] `--format plain` returns plain text

**Verify JSON structure:**
```bash
whales tokens list --format json | jq '.data[0] | keys'
# Expect: id, name, symbol, status, price, chain_id, etc.
```

### Test 2: Tokens Search
```bash
# Search by name/symbol
whales tokens search "PENGU"
whales tokens search "BTC"

# With limit
whales tokens search "ETH" --limit 5

# JSON output
whales tokens search "SOL" --format json
```

**Verify:**
- [ ] Search returns relevant results
- [ ] `--limit` works
- [ ] Valid JSON format

### Test 3: Token Detail
```bash
# Get token by ID (get ID from tokens list)
whales tokens list --limit 1 --format json | jq -r '.data[0].id'
# Copy ID and use:
whales tokens get <TOKEN_ID>

# JSON output
whales tokens get <TOKEN_ID> --format json
```

**Verify:**
- [ ] Displays detail table with: ID, Name, Symbol, Status, Price, Chain ID, Description
- [ ] JSON has all fields

### Test 4: Tokens Highlight
```bash
whales tokens highlight
whales tokens highlight --format json
```

**Verify:**
- [ ] Returns highlighted/trending tokens list
- [ ] Correct format

### Test 5: Tokens Stats
```bash
whales tokens stats
whales tokens stats --format json
```

**Verify:**
- [ ] Returns prediction stats
- [ ] Correct format

### Test 6: Networks List
```bash
whales networks list
whales networks list --format json
```

**Verify:**
- [ ] Displays networks list: ID, Name, Chain ID, RPC URL
- [ ] Valid JSON

### Test 7: Status Check
```bash
whales status
whales status --format json
```

**Verify:**
- [ ] Displays API URL
- [ ] Displays connection status
- [ ] Can check API health

### Test 8: Order Book Snapshot
```bash
# Get snapshot statistics
whales orderbook snapshot
whales orderbook snapshot --format json
```

**Verify:**
- [ ] Returns aggregated stats (buy/sell orders count, volume, value, avg prices)
- [ ] Correct JSON structure

---

## Test Phase 2: Commands Requiring Wallet

### Setup Wallet (One-time only)

#### Option 1: Create new wallet
```bash
whales setup
# Select: Create new Solana wallet
# SAVE mnemonic to a secure file!
```

#### Option 2: Import existing wallet
```bash
whales wallet import <YOUR_PRIVATE_KEY> --type solana
# or
whales wallet import <YOUR_PRIVATE_KEY> --type evm
```

### Test 9: Wallet Commands
```bash
# Show wallet info
whales wallet show
whales wallet show --format json

# Get address only
whales wallet address
whales wallet address --format json

# Create new wallet (test only, don't save)
whales wallet create --type solana
whales wallet create --type evm
```

**Verify:**
- [ ] `wallet show` displays address and type
- [ ] `wallet address` shows address only
- [ ] `wallet create` creates new wallet with mnemonic

### Test 10: My Offers
```bash
# List my offers
whales offers my
whales offers my --format json

# Filter by status
whales offers my --status open
whales offers my --status filled
```

**Verify:**
- [ ] Only shows offers for configured wallet
- [ ] Status filter works
- [ ] Table format: ID, Type, Token ID, Amount, Price, Status, Address

### Test 11: Offers List (All)
```bash
# List all offers
whales offers list
whales offers list --limit 10

# Filter by type
whales offers list --type buy
whales offers list --type sell

# Filter by token
whales offers list --token <TOKEN_ID>
```

**Verify:**
- [ ] Displays all offers (not just mine)
- [ ] Filters work

### Test 12: Offer Detail
```bash
# Get offer by ID
whales offers get <OFFER_ID>
whales offers get <OFFER_ID> --format json
```

**Verify:**
- [ ] Displays offer detail
- [ ] JSON has all fields

### Test 13: My Orders
```bash
# List my orders
whales orders my
whales orders my --format json

# Filter by side (if API supports)
whales orders my --side buy
whales orders my --side sell
```

**Verify:**
- [ ] Displays wallet orders
- [ ] Table format: ID, Offer ID, Buyer, Seller, Amount, Status

### Test 14: Orders List (All)
```bash
# List all orders
whales orders list
whales orders list --limit 10

# Filter by token
whales orders list --token <TOKEN_ID>

# Filter by status
whales orders list --status filled
```

**Verify:**
- [ ] Displays all orders
- [ ] Filters work

### Test 15: Order Detail
```bash
# Get order by ID
whales orders get <ORDER_ID>
whales orders get <ORDER_ID> --format json
```

**Verify:**
- [ ] Displays order detail
- [ ] JSON has all fields

### Test 16: Orders by Offer
```bash
# Get orders for a specific offer address
whales orders by-offer <OFFER_ADDRESS>
```

**Verify:**
- [ ] Displays orders related to offer address

### Test 17: Portfolio
```bash
# Show portfolio summary
whales portfolio show
whales portfolio show --format json

# Show positions
whales portfolio positions
whales portfolio positions --type open
whales portfolio positions --type filled
```

**Verify:**
- [ ] Portfolio summary shows: Total Offers, Total Orders, Open Offers, Filled Orders
- [ ] Positions list displays correctly
- [ ] Type filter works

### Test 18: Referral (if address has referral data)
```bash
# Summary
whales referral summary
whales referral summary --format json

# Campaigns
whales referral campaigns

# Earnings
whales referral earnings

# Transactions
whales referral transactions
```

**Verify:**
- [ ] Displays referral data if available
- [ ] Or shows "no data" message if none

---

## Test Cross-Cutting Features

### Test 19: Output Formats
```bash
# Table (default)
whales tokens list

# JSON
whales tokens list --format json

# Plain
whales tokens list --format plain
```

**Verify:**
- [ ] Table: has colors, alignment, readable
- [ ] JSON: valid, parseable with jq
- [ ] Plain: no colors, plain text

### Test 20: Global Options
```bash
# Override API URL
whales --api-url https://api.whales.market tokens list

# Override private key (not recommended, test only)
whales --private-key <KEY> wallet show

# Override chain ID
whales --chain-id 1 tokens list
```

**Verify:**
- [ ] `--api-url` overrides config
- [ ] `--private-key` overrides config
- [ ] `--chain-id` overrides config

### Test 21: Environment Variables
```bash
# Set env vars
export WHALES_API_URL="https://api.whales.market"
export WHALES_CHAIN_ID="666666"

# Run command
whales tokens list

# Unset
unset WHALES_API_URL
unset WHALES_CHAIN_ID
```

**Verify:**
- [ ] Env vars override config file
- [ ] Priority: CLI flag > Env var > Config file

### Test 22: Config File
```bash
# Check config path
whales wallet show
# See line "Config saved to: ..."

# View config (macOS)
cat ~/Library/Preferences/whales-market-cli-nodejs/config.json

# View config (Linux)
cat ~/.config/whales-market-cli-nodejs/config.json
```

**Verify:**
- [ ] Config file exists
- [ ] Has privateKey, walletType, apiUrl, chainId

### Test 23: Help Text
```bash
# Main help
whales --help
whales -h

# Command help
whales tokens --help
whales wallet --help
whales offers --help
whales orders --help
whales portfolio --help
whales orderbook --help
whales referral --help
whales networks --help

# Subcommand help
whales tokens list --help
whales wallet create --help
```

**Verify:**
- [ ] Help text displays complete
- [ ] Has description for each command
- [ ] Has options list

### Test 24: Error Handling
```bash
# Invalid command
whales invalid-command

# Invalid token ID
whales tokens get invalid-id

# No wallet configured (if not setup)
whales offers my
# Expect: "No wallet configured. Run: whales setup"

# Invalid format
whales tokens list --format invalid
```

**Verify:**
- [ ] Clear error messages
- [ ] CLI does not crash
- [ ] Exit code != 0 on error

---

## Test with jq (JSON parsing)

```bash
# Count tokens
whales tokens list --format json | jq '.data | length'

# Get first token name
whales tokens list --format json | jq -r '.data[0].name'

# Filter active tokens
whales tokens list --format json | jq '.data[] | select(.status == "active") | .symbol'

# Get all symbols
whales tokens list --format json | jq -r '.data[].symbol'

# Check if wallet is configured
whales wallet address --format json | jq -r '.address'
```

**Verify:**
- [ ] jq parses successfully
- [ ] Data structure correct

---

## Test Performance

```bash
# Measure response time
time whales tokens list

# Large limit
time whales tokens list --limit 100

# Multiple requests
for i in {1..5}; do
  echo "Request $i"
  time whales tokens list --limit 10
done
```

**Verify:**
- [ ] Response time < 5s for list
- [ ] No timeout
- [ ] Consistent performance

---

## Overall Checklist

### Phase 1 (Read-only) - Available
- [ ] `whales tokens list` - OK
- [ ] `whales tokens search` - OK
- [ ] `whales tokens get` - OK
- [ ] `whales tokens highlight` - OK
- [ ] `whales tokens stats` - OK
- [ ] `whales networks list` - OK
- [ ] `whales status` - OK
- [ ] `whales orderbook snapshot` - OK (aggregated stats)
- [ ] `--format json|table|plain` - OK

### Phase 2 (Wallet required) - Available
- [ ] `whales setup` - OK
- [ ] `whales wallet create/import/show/address` - OK
- [ ] `whales offers list/my/get` - OK
- [ ] `whales orders list/my/get/by-offer` - OK
- [ ] `whales portfolio show/positions` - OK
- [ ] `whales referral summary/campaigns/earnings/transactions` - OK

### Not yet (to implement)
- [ ] `whales book <symbol>` - Order book with levels
- [ ] `whales book --depth N` - Limit depth
- [ ] `whales book --live` - WebSocket stream
- [ ] `whales buy/sell` - Create orders
- [ ] `whales fill` - Fill orders
- [ ] `whales cancel` - Cancel orders
- [ ] `whales cancel-all` - Cancel all orders
- [ ] `--yes` flag - Skip confirmation

---

## Troubleshooting

### "No wallet configured"
```bash
whales setup
# or
whales wallet import <PRIVATE_KEY> --type solana
```

### "API connection failed"
```bash
# Check status
whales status

# Try with different API URL
whales --api-url https://api.whales.market tokens list
```

### "Invalid private key format"
- Solana: Requires Base58 encoded private key
- EVM: Requires hex private key (with or without 0x prefix)

### Config file not found
```bash
# macOS
ls ~/Library/Preferences/whales-market-cli-nodejs/

# Linux
ls ~/.config/whales-market-cli-nodejs/

# If not found, run setup
whales setup
```

---

## Next Steps

After testing existing features, you can:

1. **Implement `whales book <symbol>`** - Highest priority for Phase 1
2. **Improve output** - Add Implied FDV, 24h Vol to tokens list
3. **Implement trading commands** - buy, sell, fill, cancel for Phase 2
4. **Add WebSocket support** - For `book --live`
5. **Improve error handling** - Actionable error messages
6. **Add `--yes` flag** - For agent mode

---

## Report Issues

If you encounter bugs or issues, record:
- Command executed
- Expected output
- Actual output
- Error message (if any)
- Environment (OS, Node version)

Example:
```
Command: whales tokens list --format json
Expected: Valid JSON
Actual: SyntaxError: Unexpected token
Error: ...
OS: macOS 14.1
Node: v18.0.0
```
