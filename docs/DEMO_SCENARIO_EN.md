# Demo Scenario - Whale Market CLI

A guide for demonstrating the full feature set of the `whales` CLI, based on real-world workflows.

---

## Setup

```bash
cd whale-market-cli
npm install && npm run build
npm link
whales --help
```

---

## Scenario 1: Dev Environment (BSC Testnet - chain-id 97)

```bash
# Configure dev API
whales config set api-url https://api-dev.whales-market.site

# Check status
whales status
whales wallet show
```

---

## Scenario 2: Wallet Management

```bash
# List wallets
whales wallet list

# Import wallet (12 words)
whales wallet import "connect talk curve viable satoshi fatigue arrive despair food adult lend tooth" --name dev1
whales wallet import "soup history chronic pelican rain smoke bridge theory receive around tomorrow obvious" --name dev2

# Create new wallet
whales wallet create --name dev3

# Switch active wallet
whales wallet use dev1
whales wallet use dev2

# View wallet info
whales wallet show

# Remove wallet (no blockchain impact)
whales wallet remove default
```

---

## Scenario 3: View Market (Read-Only)

```bash
# List tokens
whales tokens list --chain-id 97 --limit 10

# Token order book (symbol or UUID)
whales book chalee_admin2 --chain-id 97
whales book MEGA
whales book a2fb64a3-6bff-465c-bbee-d7fd7d1ca45d --chain-id 97

# Get token details
whales tokens get a2fb64a3-6bff-465c-bbee-d7fd7d1ca45d
```

---

## Scenario 4: Create Offers (Buy/Sell)

```bash
# Select wallet
whales wallet use dev1

# Create BUY offer
whales trade create-offer \
  --token a2fb64a3-6bff-465c-bbee-d7fd7d1ca45d \
  --side buy \
  --price 0.25 \
  --amount 100 \
  --ex-token 0x05025199bbCd0361EbF2D322e4A004F55C9eA7B1 \
  --chain-id 97

# Create SELL offer
whales trade create-offer \
  --token a2fb64a3-6bff-465c-bbee-d7fd7d1ca45d \
  --side sell \
  --price 0.25 \
  --amount 100 \
  --ex-token 0x05025199bbCd0361EbF2D322e4A004F55C9eA7B1 \
  --chain-id 97
```

---

## Scenario 5: Fill Offer (Accept Someone Else's Offer)

```bash
# Switch to buyer wallet (dev2)
whales wallet use dev2

# Fill offer (full or partial)
whales trade fill-offer 1312 --amount 50 --chain-id 97
whales trade fill-offer d427d72d-a811-447e-b133-6da2868d504a --amount 50 --chain-id 97
```

---

## Scenario 6: Manage Offers & Orders

```bash
# View my offers
whales offers my --chain-id 97

# View my orders
whales orders my --chain-id 97

# Close offer (offer creator)
whales trade close-offer 1312 --chain-id 97
```

---

## Scenario 7: OTC (Resell Position)

```bash
# Create OTC from filled order
whales otc create 849 \
  --price 0.3 \
  --ex-token 0x05025199bbCd0361EbF2D322e4A004F55C9eA7B1 \
  --chain-id 97

# With custom ex-token decimals
whales otc create 848 \
  --price 1.5 \
  --ex-token 0x4ae58bfc16b20bd67755ffd5560e85779d962415 \
  --chain-id 97 \
  --ex-token-decimals 18

# Cancel OTC
whales otc cancel 364 --chain-id 97
```

---

## Scenario 8: Shell Completion

```bash
# Enable tab completion (zsh)
eval "$(whales completion)"
source ~/.zshrc

# Then: whales <Tab>, whales wallet <Tab>, ...
```

---

## Run Demo Script

```bash
./demo.sh
```

The `demo.sh` script runs read-only commands (tokens, book, offers, orders) and prints examples for trading commands.

---

## Variables to Replace for Live Demo

| Variable | Description | Example |
|----------|-------------|---------|
| `OFFER_ID` | Offer ID from API | `1312`, `d427d72d-a811-447e-b133-6da2868d504a` |
| `ORDER_ID` | Order ID after fill | `847`, `848`, `849` |
| `OTC_OFFER_ID` | OTC offer ID | `364` |
| `TOKEN_UUID` | Token UUID | `a2fb64a3-6bff-465c-bbee-d7fd7d1ca45d` |
| `EX_TOKEN` | Payment token address (USDC, USDT...) | `0x05025199bbCd0361EbF2D322e4A004F55C9eA7B1` |

---

## Common Chain IDs

| Chain | Chain ID |
|-------|----------|
| Solana Mainnet | `666666` |
| BSC (BNB Chain) | `56` |
| BSC Testnet | `97` |
| Ethereum | `1` |
| Base | `8453` |
