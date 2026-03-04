# Changelog

All notable changes to Whale Market CLI will be documented in this file.

## [Unreleased] - 2026-03-04

### Added - Phase 1 Enhancements

#### New Commands
- **`whales book <symbol>`** - Display order book with buy/sell orders
  - `--depth <n>` - Limit order book depth (default: 10)
  - `--live` - Stream order book in real-time (placeholder, WebSocket not yet implemented)
  - `--chain-id <id>` - Filter by chain ID
  - Supports `--format json|table|plain`
  - Shows: Price, Size, Filled, Remaining, Fill Status (Open/Partial/Filled), Value
  - Displays spread between best bid and best ask
  - Color-coded fill status: Open (green), Partial (yellow), Filled (gray)

#### Enhanced Commands
- **`whales tokens list`**
  - Added `--show-fdv` - Display Implied FDV column (total_supply × last_price)
  - Added `--show-volume` - Display 24h Volume column
  - Dynamic table columns based on options
  - Graceful handling when data is unavailable (shows "-")

### Technical Details
- API endpoint: `GET /transactions/offers?symbol=<SYMBOL>&status=open`
- Maximum API limit: 200 records per request
- Handles multiple API response formats: `{data: []}`, `{list: []}`, `[]`
- Price calculation for sell offers: `collateral / total_amount`
- Fill status logic: Open (0% filled), Partial (1-99% filled), Filled (100%)

### Files Changed
- **Created:** `src/commands/book.ts` (267 lines)
- **Modified:** `src/index.ts` - Register book command
- **Modified:** `src/commands/tokens.ts` - Add --show-fdv and --show-volume options
- **Modified:** `src/output/table.ts` - Dynamic column support for tokens table

### Testing
- ✅ Build successful with no TypeScript errors
- ✅ `whales book <symbol>` displays order book correctly
- ✅ `--depth N` limits levels properly
- ✅ `--format json` produces valid JSON
- ✅ `--show-fdv` and `--show-volume` display new columns
- ⚠️ `--live` shows "coming soon" message (WebSocket not implemented)

### Known Limitations
1. Many tokens have no open offers → empty order book (expected behavior)
2. API limit of 200 records may not show all orders for very liquid tokens
3. WebSocket live streaming not yet implemented
4. Implied FDV and 24h Vol show "-" when data unavailable from API

### Documentation
- Added `TESTING.md` - Comprehensive self-testing guide
- Added `PHASE1_UPDATES.md` - Detailed summary of Phase 1 updates
- Updated plan file with implementation checklist

---

## [0.1.0] - Initial Release

### Features
- Interactive setup wizard
- Wallet management (create, import, show)
- Token operations (list, search, get details)
- Offer management (list, my offers, get details)
- Order management (list, my orders, get details)
- Portfolio tracking (summary, positions)
- Order book v2 operations (snapshot, positions, pairs)
- Referral system (summary, campaigns, earnings, transactions)
- Network information
- Status checking
- Multiple output formats (table, JSON, plain)
- Global options (--format, --api-url, --private-key, --chain-id)
- Environment variable support
- Configuration file management
- Comprehensive help system

### Supported Chains
- Solana (666666)
- Ethereum (1)
- BSC (56)
- Polygon (137)
- Arbitrum (42161)
- Optimism (10)
- Base (8453)
- zkSync Era (324)
- Linea (59144)
- Mantle (5000)
- Manta Pacific (169)

---

## Roadmap

### Phase 2 - Trading (Planned)
- [ ] `whales buy <symbol> --amount N --price P` - Create buy orders
- [ ] `whales sell <symbol> --amount N --price P` - Create sell orders
- [ ] `whales fill <order-id> [--amount N]` - Fill orders (full/partial)
- [ ] `whales cancel <order-id>` - Cancel orders
- [ ] `whales cancel-all` - Cancel all orders
- [ ] Transaction preview and confirmation
- [ ] Balance checking before transactions
- [ ] Wallet encryption at rest
- [ ] `--yes` flag for agent mode (skip confirmations)
- [ ] Comprehensive error handling with actionable messages

### Future Enhancements
- [ ] WebSocket support for `book --live`
- [ ] Historical data and charts
- [ ] Price alerts
- [ ] Trade history export
- [ ] Multi-wallet support
- [ ] Advanced order types (stop-loss, take-profit)
- [ ] Portfolio analytics
- [ ] Gas optimization suggestions

---

## Contributing

Please read [TESTING.md](TESTING.md) for testing guidelines before submitting pull requests.

## Support

- Documentation: [README.md](README.md)
- Quick Start: [QUICK_START.md](QUICK_START.md)
- Testing Guide: [TESTING.md](TESTING.md)
- Phase 1 Updates: [PHASE1_UPDATES.md](PHASE1_UPDATES.md)
