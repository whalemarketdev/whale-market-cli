# Whale Market CLI

A command-line interface for the [Whales Market](https://whales.market) pre-market trading platform, supporting EVM chains, Solana, Sui, and Aptos.

## Installation

### npm (recommended)

```bash
npm install -g whale-market-cli
```

### Build from source

```bash
git clone https://github.com/whalemarketdev/whale-market-cli.git
cd whale-market-cli
npm install && npm run build && npm link
```

### Requirements

- Node.js 18.0.0 or higher

---

## Quick Start

```bash
# 1. Create or import a wallet
whales wallet create
whales wallet import "word1 word2 ... word12"

# 2. View tokens
whales tokens list

# 3. View order book
whales book MEGA

# 4. Place an offer — pass a token UUID to auto-resolve chain + on-chain ID
whales trade create-offer --token <token-uuid> --side buy --price 0.5 --amount 100 --ex-token <USDC_mint>

# 5. Check your positions
whales orders my
```

---

## Shell Completion (Tab Autocomplete)

Enable tab completion for commands and subcommands:

```bash
# Add to ~/.zshrc (zsh)
eval "$(whales completion)"

# Or for bash, add to ~/.bashrc
eval "$(whales completion --shell bash)"
```

Then `source ~/.zshrc` (or `~/.bashrc`). After that, typing `whales ` + Tab suggests commands; `whales wallet ` + Tab suggests subcommands.

---

## Global Options

All commands accept these flags:

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --format <fmt>` | Output format: `table`, `json`, `plain` | `table` |
| `--chain-id <id>` | Override chain ID for this command | config value |
| `--api-url <url>` | Override API base URL for this command | config value |
| `-y, --yes` | Skip confirmation prompts | false |

---

## Commands

### `whales setup`

Interactive first-time setup wizard. Guides you through wallet creation/import and API configuration.

```bash
whales setup
```

---

### `whales status`

Check API connectivity and display current wallet and config.

```bash
whales status
```

---

### `whales upgrade`

Self-update the CLI from the npm registry.

```bash
whales upgrade
```

---

## Wallet Management

Wallets are stored locally as BIP-39 mnemonic phrases. A single mnemonic derives addresses for all chains (EVM, Solana, Sui, Aptos).

### `whales wallet create`

Generate a new 12-word mnemonic wallet and save it to config.

```bash
whales wallet create
whales wallet create --name trading
```

Output includes: mnemonic phrase, EVM address, Solana address. **Save the mnemonic securely.**

---

### `whales wallet import <mnemonic>`

Import an existing wallet using a 12 or 24-word BIP-39 seed phrase.

```bash
whales wallet import "word1 word2 word3 ... word12"
whales wallet import "word1 word2 ... word12" --name myWallet
```

---

### `whales wallet list`

List all saved wallets.

```bash
whales wallet list
```

---

### `whales wallet use <name>`

Switch the active wallet.

```bash
whales wallet use trading
```

---

### `whales wallet show`

Display addresses on all chains for the active wallet (or a named one).

```bash
whales wallet show
whales wallet show --name trading
whales wallet show --format json
```

---

### `whales wallet address`

Print only the wallet address for the currently configured chain.

```bash
whales wallet address
```

---

### `whales wallet remove <name>`

Remove a saved wallet from config. Does not affect the blockchain.

```bash
whales wallet remove trading
```

---

## Configuration

### `whales config get [key]`

View current config. Omit `key` to print all values.

```bash
whales config get
whales config get api-url
whales config get chain-id
```

---

### `whales config set <key> <value>`

Set a config value. Supported keys: `api-url`, `chain-id`.

```bash
whales config set api-url https://api.whales.market
whales config set chain-id 666666
```

---

### `whales config path`

Show the path to the config file on disk.

```bash
whales config path
```

---

### Custom RPC per Chain

Override the default RPC URL for any chain. Useful for private nodes or faster endpoints.

```bash
# Set a custom RPC
whales config rpc set 666666 https://my-solana-rpc.example.com

# View resolved RPC for a chain (shows custom vs default)
whales config rpc get 666666

# Remove custom RPC (revert to default)
whales config rpc remove 666666

# List all custom RPC overrides
whales config rpc list

# List all supported chains with IDs and default RPCs
whales config rpc chains
```

**Config is stored at:**
- macOS: `~/Library/Preferences/whales-market-cli/config.json`
- Linux: `~/.config/whales-market-cli/config.json`
- Windows: `%APPDATA%\whales-market-cli\config.json`

---

## Chain IDs

Use `--chain-id` to target a specific network. Common values:

| Chain | Chain ID |
|-------|----------|
| Solana Mainnet | `666666` |
| Solana Devnet | `999999` |
| Ethereum | `1` |
| BNB Chain | `56` |
| Base | `8453` |
| Arbitrum | `42161` |
| Polygon | `137` |
| Sui Mainnet | `900000` |
| Aptos Mainnet | `900001` |

Run `whales config rpc chains` to see the full list.

---

## Token Commands

### `whales tokens list`

List pre-market tokens with price, implied FDV, and volume.

```bash
whales tokens list
whales tokens list --status active
whales tokens list --status settling
whales tokens list --chain 56 --limit 20
whales tokens list --sort vol
whales tokens list --sort price
whales tokens list --sort created
whales tokens list --show-address     # show token contract address
whales tokens list --no-fdv           # hide Implied FDV column
whales tokens list --no-volume        # hide 24h Vol column
whales tokens list --no-total-vol     # hide Total Vol column
```

Options:
- `--status <s>` — filter by status: `active`, `settling`, `ended`
- `--chain <id>` — filter by chain ID
- `--limit <n>` — max rows (default: 20)
- `--sort <by>` — sort by `vol`, `price`, or `created`
- `--show-address` — show token/contract addresses (hidden by default)
- `--no-fdv` — hide Implied FDV
- `--no-volume` — hide 24h Vol
- `--no-total-vol` — hide Total Vol

---

### `whales tokens get <token-id>`

Get full details for a token by its ID or symbol.

```bash
whales tokens get MEGA
whales tokens get <uuid>
```

---

### `whales tokens search <query>`

Search tokens by name or symbol.

```bash
whales tokens search MEGA
whales tokens search "Layer" --limit 5
```

---

### `whales tokens highlight`

Show highlighted / trending tokens.

```bash
whales tokens highlight
```

---

### `whales tokens stats`

Show prediction stats across tokens.

```bash
whales tokens stats
```

---

## Order Book

### `whales book <symbol>`

View the order book (buy/sell walls, spread, fill status) for a token.

```bash
whales book MEGA
whales book MEGA --depth 10
whales book MEGA --chain-id 56
whales book MEGA --format json
```

Options:
- `--depth <n>` — number of rows per side (default: 5)
- `--chain-id <id>` — chain to query
- `--format json|plain|table` — output format

---

## Offers

### `whales offers list`

List all open offers on the market.

```bash
whales offers list
whales offers list --type buy
whales offers list --type sell
whales offers list --token MEGA
```

---

### `whales offers my`

List offers created by your wallet address.

```bash
whales offers my
whales offers my --status open
whales offers my --status filled
```

---

### `whales offers get <offer-id>`

Get details for a specific offer.

```bash
whales offers get 456
whales offers get <uuid>
```

---

### `whales offers react <offer-id>`

React to an offer.

```bash
whales offers react 456
```

---

## Orders

### `whales orders list`

List all orders.

```bash
whales orders list
whales orders list --token MEGA
```

---

### `whales orders my`

List orders associated with your wallet.

```bash
whales orders my
whales orders my --side buy
whales orders my --side sell
```

---

### `whales orders get <order-id>`

Get details for a specific order.

```bash
whales orders get 123
whales orders get <uuid>
```

---

### `whales orders by-offer <offer-id>`

List orders created from a specific offer.

```bash
whales orders by-offer 456
```

---

## Portfolio

### `whales portfolio show`

Show portfolio summary for your wallet (or any address).

```bash
whales portfolio show
whales portfolio show --address 0xAbcDef...
```

---

### `whales portfolio positions`

List positions (open or filled orders).

```bash
whales portfolio positions
whales portfolio positions --type open
whales portfolio positions --type filled
```

---

### `whales portfolio balance`

Show token balances.

```bash
whales portfolio balance
whales portfolio balance --token MEGA
```

---

## Trading (On-chain)

These commands send transactions to the blockchain. A configured wallet is required.

### `whales trade create-offer`

Create a buy or sell pre-market offer on-chain.

```bash
whales trade create-offer \
  --token <token-uuid-or-id> \
  --side buy \
  --price 0.5 \
  --amount 100
```

Options:
| Option | Required | Description |
|--------|----------|-------------|
| `--token <id>` | Yes | Token UUID (auto-resolves chain + ID), numeric, or bytes32 hex |
| `--side <side>` | Yes | `buy` or `sell` |
| `--price <n>` | Yes | Price per token in exchange token units (e.g. `0.5` USDC) |
| `--amount <n>` | Yes | Token amount |
| `--ex-token <addr>` | No | Exchange token address (default: chain native token) |
| `--full-match` | No | Require full fill only (no partial fills) |
| `--token-config <addr>` | Sui/Aptos | Token config object address |
| `--coin-type <type>` | Sui | Coin type (overrides `--ex-token` for Sui) |

**Default exchange tokens when `--ex-token` is omitted:**

| Chain | Default |
|-------|---------|
| EVM | `0x0000000000000000000000000000000000000000` (native ETH/BNB/etc.) |
| Solana | `So11111111111111111111111111111111111111112` (native SOL) |
| Sui | `0x2::sui::SUI` |
| Aptos | `0x1::aptos_coin::AptosCoin` |

> Minimum collateral: **$10 USD**. Exchange token price is fetched from the API for all chains to convert to USD.

> Exchange token decimals are fetched on-chain automatically (18 for EVM native, 9 for SOL, otherwise `token.decimals()`).

**Token ID formats (when not using UUID):**
- EVM: numeric (e.g. `1`) or bytes32 hex (e.g. `0x313638...`) — requires `--chain-id`
- Solana: numeric (e.g. `5`) — requires `--chain-id`
- Sui/Aptos: config object address — use `--token-config` instead

**Examples:**

```bash
# Token UUID, omit --ex-token to use chain native token
whales trade create-offer \
  --token a2fb64a3-6bff-465c-bbee-d7fd7d1ca45d \
  --side buy \
  --price 0.25 \
  --amount 500

# Explicit USDC ex-token on Solana
whales trade create-offer \
  --token a2fb64a3-6bff-465c-bbee-d7fd7d1ca45d \
  --side buy \
  --price 0.25 \
  --amount 500 \
  --ex-token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# EVM (BSC, chain 56) sell offer with USDT — on-chain token ID requires --chain-id
whales trade create-offer \
  --chain-id 56 \
  --token 10 \
  --side sell \
  --price 1.5 \
  --amount 200 \
  --ex-token 0x55d398326f99059fF775485246999027B3197955

# Full match, native ex-token
whales trade create-offer \
  --token a2fb64a3-6bff-465c-bbee-d7fd7d1ca45d \
  --side buy --price 0.5 --amount 100 --full-match
```

---

### `whales trade fill-offer <offer-id>`

Fill an existing offer (become the counterparty).

```bash
# Fill fully using offer UUID — chain and on-chain ID auto-resolved
whales trade fill-offer <offer-uuid>

# Fill partially
whales trade fill-offer <offer-uuid> --amount 50

# On-chain ID — requires --chain-id
whales trade fill-offer 123 --chain-id 56
```

Options:
- `--amount <n>` — partial fill amount (default: fill the remaining amount)
- `--ex-token <addr>` — exchange token address for $10 check on non-EVM chains (default: chain native token; EVM: auto-fetched from offer)

> Minimum fill collateral: **$10 USD** on all chains. Only enforced when the remaining offer collateral is also ≥ $10. Skipped entirely when filling all remaining unfilled tokens.

---

### `whales trade close-offer <offer-id>`

Close an offer you created. Reclaims your collateral for any unfilled portion.

```bash
# Offer UUID — chain and on-chain ID auto-resolved
whales trade close-offer <offer-uuid>

# On-chain ID — requires --chain-id
whales trade close-offer 123 --chain-id 56
```

---

### `whales trade settle <order-id>`

Settle a filled order. The seller delivers the settlement token to finalize the trade.

```bash
# Order UUID — chain, on-chain ID, token address, and amount all auto-resolved from API
whales trade settle <order-uuid>

# With referral discount
whales trade settle <order-uuid> --with-discount

# On-chain ID (EVM) — requires --chain-id, --token-address, and --amount
whales trade settle 852 \
  --chain-id 97 \
  --token-address 0xTokenAddress \
  --amount 100

# Solana / Sui / Aptos — no token address needed
whales trade settle 42 --chain-id 666666
```

Options:
- `--token-address <addr>` — settlement token address (EVM; auto-fetched from API when passing UUID)
- `--amount <n>` — settlement token amount in human units (EVM; auto-fetched from API when passing UUID)
- `--token-decimals <n>` — settlement token decimals override (EVM; auto-detected on-chain if omitted)
- `--with-discount` — apply referral discount
- `--order-uuid <uuid>` — order UUID (required for `--with-discount` on EVM/Sui; not needed on Solana)

---

### `whales trade claim-collateral <order-id>`

Cancel an unfilled order and reclaim your collateral as a buyer.

```bash
# Order UUID — chain and on-chain ID auto-resolved
whales trade claim-collateral <order-uuid>

# With referral discount
whales trade claim-collateral <order-uuid> --with-discount

# On-chain ID — requires --chain-id
whales trade claim-collateral 42 --chain-id 666666
```

Options:
- `--with-discount` — apply referral discount
- `--order-uuid <uuid>` — order UUID (required for `--with-discount` on EVM/Sui; not needed on Solana)

---

## OTC (Resell Positions)

OTC lets a buyer resell their order position to a new buyer before settlement. Supported on EVM and Solana.

### `whales otc create <order-id>`

Create an OTC offer to resell your order position.

```bash
# Order UUID, native ex-token (e.g. SOL on Solana, ETH on EVM)
whales otc create <order-uuid> --price 0.001

# Explicit ex-token
whales otc create <order-uuid> --price 1.2 --ex-token 0xUSDCAddress

# On-chain ID — requires --chain-id
whales otc create 42 \
  --chain-id 56 \
  --price 1.2 \
  --ex-token 0xUSDCAddress \
  --deadline 1800000000
```

Options:
| Option | Required | Description |
|--------|----------|-------------|
| `--price <n>` | Yes | Resell price per token in exchange token units (e.g. `1.2` USDC) |
| `--ex-token <addr>` | No | Exchange token address (default: chain native token) |
| `--deadline <unix-ts>` | No | Offer expiry (default: 1 year from now) |

> Exchange token decimals are fetched on-chain automatically. Default ex-tokens are the same as for `create-offer` (see table above).

---

### `whales otc fill <otc-offer-id>`

Fill an OTC offer (buy someone else's order position).

```bash
# OTC offer UUID — chain and on-chain ID auto-resolved
whales otc fill <otc-offer-uuid>

# With referral discount (UUID doubles as --offer-uuid)
whales otc fill <otc-offer-uuid> --with-discount

# EVM on-chain ID — requires --chain-id
whales otc fill 7 --chain-id 56

# Solana on-chain PDA pubkey — requires --chain-id
whales otc fill <base58PubkeyOfOtcOffer> --chain-id 666666
```

Options:
- `--with-discount` — apply referral discount
- `--offer-uuid <uuid>` — OTC offer UUID (required for `--with-discount` when passing on-chain ID)

---

### `whales otc cancel <otc-offer-id>`

Cancel an OTC offer you created and reclaim your order position.

```bash
# OTC offer UUID — chain and on-chain ID auto-resolved
whales otc cancel <otc-offer-uuid>

# EVM on-chain ID — requires --chain-id
whales otc cancel 7 --chain-id 56

# Solana on-chain PDA pubkey — requires --chain-id
whales otc cancel <base58Pubkey> --chain-id 666666
```

---

## Orderbook V2

Aggregated orderbook statistics and positions.

```bash
# Snapshot statistics
whales orderbook snapshot

# Positions for a Telegram user
whales orderbook positions --telegram-id <id>

# Trading pairs for a Telegram user
whales orderbook pairs --telegram-id <id>

# Filled order details
whales orderbook filled <id>
```

---

## Referral

```bash
# Campaign summary
whales referral summary
whales referral summary --address 0xYourAddress

# List campaigns
whales referral campaigns
whales referral campaigns --address 0xYourAddress

# Earnings
whales referral earnings
whales referral earnings --address 0xYourAddress

# Transaction history
whales referral transactions
whales referral transactions --address 0xYourAddress
```

---

## Utilities

```bash
# List all supported networks with chain IDs
whales networks list

# Interactive REPL shell (run commands without re-typing whales)
whales shell
```

---

## Output Formats

All commands support `--format table` (default), `--format json`, and `--format plain`.

```bash
# Table output (default)
whales tokens list

# JSON output — pipe into jq or scripts
whales tokens list --format json | jq '.[0].symbol'

# Check wallet address in scripts
whales wallet address --format json | jq -r '.address'

# Export order book as JSON
whales book MEGA --format json | jq '.sell_orders'
```

---

## Scripting & Automation

Use `--yes` / `-y` to skip confirmation prompts and `--format json` for machine-readable output:

```bash
# Non-interactive fill
whales trade fill-offer 123 --yes --format json

# Watch tokens and pipe to a file
whales tokens list --format json > tokens.json
```

---

## Troubleshooting

**"No wallet configured"**

```bash
whales wallet create
# or
whales wallet import "your twelve word mnemonic phrase here"
```

**"API connection failed"**

```bash
whales status
whales config set api-url https://api.whales.market
```

**"Unsupported chain ID"**

Check available chains:
```bash
whales config rpc chains
```

Then set the correct chain:
```bash
whales config set chain-id 666666
# or pass per-command:
whales trade create-offer --chain-id 56 ...
```

**"ex-token 0x... is EVM format"**

You passed an EVM address on a Solana command. Add `--chain-id` for your EVM chain:
```bash
whales otc create 42 --price 1.2 --ex-token 0xUSDC --chain-id 8453
```

**Build / TypeScript errors**

```bash
npm run build
npx tsc --noEmit   # type-check only
```

---

## Development

```bash
# Type-check without building
npx tsc --noEmit

# Run without building (ts-node)
npm run dev -- tokens list

# Build and run
npm run build
node dist/index.js tokens list

# Link globally for testing
npm link
whales tokens list
```

See [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) for more detail.

---

## License

MIT
