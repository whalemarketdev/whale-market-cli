# Whale Market CLI

A command-line interface for the Whales Market trading platform, built with Node.js and TypeScript.

**Repository:** [https://github.com/whalemarketdev/whale-market-cli](https://github.com/whalemarketdev/whale-market-cli)

## Features

- 🐋 **Multi-chain Support**: Solana and EVM chains (Ethereum, BSC, Polygon, etc.)
- 💼 **Wallet Management**: Create, import, and manage wallets
- 📊 **Token Operations**: Browse, search, and view token details
- 💰 **Trading**: View and manage offers and orders
- 📈 **Portfolio Tracking**: Monitor your positions and portfolio
- 📚 **Order Book**: Access order book v2 operations
- 🎁 **Referral System**: Track campaigns and earnings
- 🎨 **Beautiful Output**: Table and JSON output formats
- ⚡ **Fast & Reliable**: Built with TypeScript for type safety

## Installation

### NPM (Recommended)

```bash
npm install -g whale-market-cli
```

### Shell Script

```bash
curl -fsSL https://raw.githubusercontent.com/whalemarketdev/whale-market-cli/main/install.sh | bash
```

### Requirements

- Node.js 18.0.0 or higher
- npm or yarn

## Quick Start

### 1. Setup

Run the interactive setup wizard:

```bash
whales setup
```

This will guide you through:
- Creating a new wallet or importing an existing one
- Configuring the API endpoint
- Saving your configuration

### 2. First Commands

```bash
# List tokens
whales tokens list

# View your offers
whales offers my

# Check your portfolio
whales portfolio show

# Get help
whales --help
```

## Commands

### Setup & Configuration

- `whales setup` - Interactive first-time setup wizard
- `whales status` - Check API connectivity and wallet status
- `whales upgrade` - Self-update from npm registry

### Wallet Management

- `whales wallet create [--type solana|evm]` - Generate new wallet
- `whales wallet import <private-key>` - Import existing wallet
- `whales wallet show` - Display wallet details
- `whales wallet address` - Show wallet address
- `whales wallet link <target-address>` - Link multiple wallets

### Token Operations

- `whales tokens list [--status active|ended] [--chain <id>]` - List tokens
- `whales tokens get <token-id>` - Get token details
- `whales tokens search <query> [--limit <n>]` - Search tokens
- `whales tokens highlight` - Get highlighted/trending tokens
- `whales tokens stats` - Get prediction stats

### Offer Management

- `whales offers list [--type buy|sell] [--token <symbol>]` - List all offers
- `whales offers my [--status open|filled]` - List my offers
- `whales offers get <offer-id>` - Get offer details
- `whales offers react <offer-id>` - React to an offer

### Order Management

- `whales orders list [--token <symbol>]` - List all orders
- `whales orders my [--side buy|sell]` - List my orders
- `whales orders get <order-id>` - Get order details
- `whales orders by-offer <address>` - Orders for my offers

### Portfolio & Positions

- `whales portfolio show [--address <addr>]` - Show portfolio summary
- `whales portfolio positions [--type open|filled]` - List positions
- `whales portfolio balance [--token <symbol>]` - Show token balances

### Order Book V2

- `whales orderbook snapshot` - Order book snapshot statistics
- `whales orderbook positions --telegram-id <id>` - Get positions
- `whales orderbook pairs --telegram-id <id>` - List trading pairs
- `whales orderbook filled <id>` - Get filled order details

### Referral System

- `whales referral summary [--address <addr>]` - Campaign summary
- `whales referral campaigns [--address <addr>]` - List campaigns
- `whales referral earnings [--address <addr>]` - Show earnings
- `whales referral transactions [--address <addr>]` - Get transactions

### Utilities

- `whales networks list` - List supported blockchain networks
- `whales shell` - Interactive REPL mode

## Output Formats

### Table Format (Default)

```bash
whales tokens list
```

```
┌────────┬─────────────────────────────┬──────────┬────────┬───────────┬─────────────┐
│ ID     │ Name                        │ Symbol   │ Status │ Price     │ Chain       │
├────────┼─────────────────────────────┼──────────┼────────┼───────────┼─────────────┤
│ 123    │ Example Token               │ EXMP     │ active │ $0.45     │ Solana      │
└────────┴─────────────────────────────┴──────────┴────────┴───────────┴─────────────┘
```

### JSON Format

```bash
whales tokens list --output json
```

```json
{
  "data": [
    {
      "id": 123,
      "name": "Example Token",
      "symbol": "EXMP",
      "status": "active",
      "price": "0.45",
      "chain_id": 666666
    }
  ]
}
```

## Configuration

Configuration is stored in platform-specific locations:

- **macOS**: `~/Library/Preferences/whales-market-cli/config.json`
- **Linux**: `~/.config/whales-market-cli/config.json`
- **Windows**: `%APPDATA%\whales-market-cli\config.json`

### Environment Variables

You can override config values with environment variables:

```bash
export WHALES_API_URL="https://api.whales.market"
export WHALES_PRIVATE_KEY="your-private-key"
export WHALES_WALLET_TYPE="solana"
export WHALES_CHAIN_ID="666666"
```

### Global Options

All commands support these global options:

- `-o, --output <format>` - Output format (table|json), default: table
- `-k, --private-key <key>` - Private key (overrides config)
- `--api-url <url>` - API endpoint URL
- `--chain-id <id>` - Chain ID

## Examples

### Browse Tokens

```bash
# List active tokens
whales tokens list --status active --limit 10

# Search for a token
whales tokens search "example"

# Get token details
whales tokens get 123
```

### Manage Offers

```bash
# View all buy offers
whales offers list --type buy

# View my open offers
whales offers my --status open

# Get offer details
whales offers get 456
```

### Check Portfolio

```bash
# Show portfolio summary
whales portfolio show

# List open positions
whales portfolio positions --type open
```

### Use JSON Output for Scripting

```bash
# Get tokens as JSON
whales tokens list --output json | jq '.data[0].name'

# Check if wallet is configured
whales wallet address --output json | jq -r '.address'
```

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/whalemarketdev/whale-market-cli.git
cd whale-market-cli

# Install dependencies
npm install

# Build
npm run build

# Link for local testing
npm link

# Use CLI
whales --help
```

### Running Tests

```bash
npm test
```

### Development Mode

```bash
# Run with ts-node (no build needed)
npm run dev -- tokens list
```

## Troubleshooting

### "No wallet configured"

Run the setup wizard:

```bash
whales setup
```

### "API connection failed"

Check your API URL:

```bash
whales status
```

Or set it explicitly:

```bash
whales --api-url https://api.whales.market tokens list
```

### "Invalid private key format"

Make sure you're using the correct format:
- **Solana**: Base58 encoded private key
- **EVM**: Hex-encoded private key (with or without 0x prefix)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and questions:
- GitHub Issues: https://github.com/whalemarketdev/whale-market-cli/issues
- Documentation: https://docs.whales.market
