# Whale Market CLI — Roadmap & Architecture

## Overview

A multi-chain CLI that interacts directly with Whales Market smart contracts.
Two primary contracts are supported:

- **pre-market** — place buy/sell offers and settle orders for pre-launch tokens
- **otc-pre-market** — resell an open pre-market order position to a new buyer

Future additions (not yet implemented):
- **OFT / OFT Adapter** — bridge tokens cross-chain via LayerZero OFT standard
- **Token Bridge** — deliver settlement tokens for pre-market orders across chains

---

## 1. Multi-chain Wallet Management via Seed Phrase ✅

Wallets are stored as **BIP39 mnemonics** (12 or 24 words). Keys for each chain are
derived on-the-fly using the standard derivation path for that chain.

### Derivation Paths
| Chain | Path | Library |
|-------|------|---------|
| EVM (ETH / BSC / Base / …) | `m/44'/60'/0'/0/0` | ethers.js |
| Solana | `m/44'/501'/0'/0'` | @solana/web3.js + ed25519-hd-key |
| Sui | `m/44'/784'/0'/0'/0'` | @mysten/sui |
| Aptos | `m/44'/637'/0'/0'/0'` | @aptos-labs/ts-sdk |

### Config Schema
```typescript
interface WalletEntry {
  name: string;      // label, e.g. "main", "trading"
  mnemonic: string;  // 12/24-word seed phrase
  createdAt: string;
}

interface ConfigSchema {
  wallets: WalletEntry[];
  activeWallet: string; // name of the currently active wallet
  chainId?: number;
  apiUrl?: string;
  jwtToken?: string;
  jwtExpiresAt?: string;
}
```

### Wallet Commands
```
wallet create [--name <label>]     # generate new seed, save to config
wallet import <mnemonic> [--name]  # import 12/24-word seed
wallet list                        # list all saved wallets
wallet use <name>                  # switch active wallet
wallet show [--name <label>]       # show addresses on all chains from seed
wallet remove <name>               # remove a wallet
```

---

## 2. `src/blockchain/` — Multi-chain Contract Layer ✅

All blockchain interaction code lives under `src/blockchain/`.
Each chain has its own sub-folder with a `ChainAdapter`, signers, constants, and contract wrappers.

### Folder Structure

```
src/blockchain/
├── index.ts                        # unified barrel export for all adapters and contracts
├── types.ts                        # shared interfaces and enums
│
├── evm/
│   ├── index.ts                    # EvmAdapter implements ChainAdapter
│   ├── signer.ts                   # deriveEvmWallet / deriveEvmAddress (ethers.js)
│   ├── constants.ts                # EVM_CHAINS (RPC + explorer per chainId)
│   │                               # PRE_MARKET_ADDRESS, OTC_PRE_MARKET_ADDRESS
│   │                               # FUND_DISTRIBUTOR_ADDRESS, getEvmRpcUrl()
│   ├── utils.ts                    # REFERRAL_CHAIN_IDS, isReferralNetwork()
│   │                               # parseUnits, formatUnits
│   │                               # encodeSettleData, encodeOtcResellData
│   └── contracts/
│       ├── abis/
│       │   ├── PreMarket.ts        # standard pre-market ABI
│       │   ├── PreMarketRef.ts     # referral-variant ABI (extra fundDistributor param)
│       │   ├── OtcPreMarket.ts     # standard OTC ABI
│       │   ├── OtcPreMarketRef.ts  # referral-variant OTC ABI
│       │   └── ERC20.ts            # standard ERC-20 ABI (approve / allowance)
│       ├── PreMarket.ts            # EvmPreMarket class
│       └── OtcPreMarket.ts         # EvmOtcPreMarket class
│
├── solana/
│   ├── index.ts                    # SolanaAdapter implements ChainAdapter
│   ├── signer.ts                   # deriveSolanaKeypair / deriveSolanaAddress
│   ├── constants.ts                # SOLANA_RPC (mainnet/devnet)
│   │                               # PRE_MARKET program IDs + config accounts
│   │                               # OTC_PRE_MARKET program IDs + config index
│   ├── utils.ts                    # buildWrapSolInstructions, ataExists
│   └── programs/
│       ├── idl/
│       │   ├── pre_market.ts       # Anchor IDL for pre-market program
│       │   └── otc_pre_market.ts   # Anchor IDL for OTC program
│       ├── PreMarket.ts            # SolanaPreMarket class (Anchor)
│       └── OtcPreMarket.ts         # SolanaOtcPreMarket class (Anchor)
│
├── sui/
│   ├── index.ts                    # SuiAdapter implements ChainAdapter
│   ├── signer.ts                   # deriveSuiKeypair / deriveSuiAddress
│   ├── constants.ts                # SUI_RPC (mainnet/testnet)
│   │                               # MAINNET / TESTNET package IDs, configId, ownerCap
│   ├── utils.ts                    # extractPhantomType, checkAndSplitCoin
│   └── contracts/
│       ├── PreMarket.ts            # SuiPreMarket class
│       └── OtcPreMarket.ts         # SuiOtcPreMarket (stub — not yet implemented)
│
└── aptos/
    ├── index.ts                    # AptosAdapter implements ChainAdapter
    ├── signer.ts                   # deriveAptosAccount / deriveAptosAddress
    ├── constants.ts                # APTOS_RPC (mainnet/testnet)
    │                               # MAINNET / TESTNET package IDs
    ├── utils.ts                    # checkCoinToFa (Coin vs Fungible Asset detection)
    └── contracts/
        ├── PreMarket.ts            # AptosPreMarket class
        └── OtcPreMarket.ts         # AptosOtcPreMarket (stub — not yet implemented)
```

### Shared Types (`types.ts`)
```typescript
export type ChainName = 'evm' | 'solana' | 'sui' | 'aptos';

export interface TxResult { txHash: string; wait(): Promise<void>; }

export enum OfferSide   { Buy = 'buy', Sell = 'sell' }
export enum OfferStatus { Open = 'open', Filled = 'filled', Cancelled = 'cancelled' }
export enum OrderStatus { Open = 'open', SettleFilled = 'settle_filled',
                          SettleCancelled = 'settle_cancelled', Cancelled = 'cancelled' }

export interface OfferData  { totalAmount: number; filledAmount: number;
                              collateral: { amount: string; uiAmount: string };
                              isFullMatch: boolean; status: OfferStatus; }
export interface OrderData  { amount: number; buyer: string; seller: string;
                              offerId: number | string; status: OrderStatus; }
export interface DiscountData { orderId: string; sellerDiscount: number; buyerDiscount: number;
                                signature: string; /* + referrer fields */ }

export interface ChainAdapter {
  readonly chain: ChainName;
  getAddress(mnemonic: string): Promise<string>;
  getBalance(address: string, tokenAddress?: string): Promise<string>;
}
```

---

## 3. Chain & Contract Configuration ✅

All RPC endpoints and deployed contract addresses are stored as static constants,
sourced from `/ref/contracts-fe-integration/config/`.

### EVM (`src/blockchain/evm/constants.ts`)

- **`EVM_CHAINS`** — `Record<chainId, { name, rpcUrl, explorerUrl, nativeCurrency }>`
  Covers ~30 mainnet and testnet chains (Ethereum, Arbitrum, Base, BSC, Linea, Sonic, …)

- **`PRE_MARKET_ADDRESS`** — pre-market contract address per EVM chain ID
- **`OTC_PRE_MARKET_ADDRESS`** — OTC contract address per EVM chain ID
- **`FUND_DISTRIBUTOR_ADDRESS`** — fund distributor address (referral-enabled chains only)
- **`getEvmRpcUrl(chainId)`** — returns the default public RPC URL for a given chain

**Referral-enabled chains** (use `*Ref` ABI variant with `fundDistributor` param):
`Ethereum(1)`, `Base(8453)`, `Arbitrum(42161)`, `BSC(56)`, `Linea(59144)`,
`Manta(169)`, `Merlin(4200)`, `Sonic(146)`, `HyperEVM(999)`, `Sepolia(11155111)`, …

### Solana (`src/blockchain/solana/constants.ts`)

| Key | Mainnet | Devnet |
|-----|---------|--------|
| RPC | `https://api.mainnet-beta.solana.com` | `https://api.devnet.solana.com` |
| Pre-market program | `stPdYNaJ…` | `F8iCXCQD…` |
| Pre-market config account | `GDsMbTq8…` | `7e3Frd6t…` |
| OTC program | `5BA233jR…` | `G36EWnoE…` |
| OTC config index | 1 | 1 |

### Sui (`src/blockchain/sui/constants.ts`)

| Key | Mainnet | Testnet |
|-----|---------|---------|
| RPC | `https://fullnode.mainnet.sui.io` | `https://fullnode.testnet.sui.io` |
| Package ID | `0x5aa83bf5…` | `0xa4feb152…` |
| Config object | `0x432656a3…` | `0x959266a1…` |

### Aptos (`src/blockchain/aptos/constants.ts`)

| Key | Mainnet | Testnet |
|-----|---------|---------|
| Fullnode | `https://fullnode.mainnet.aptoslabs.com/v1` | `https://fullnode.testnet.aptoslabs.com/v1` |
| Package ID | `0x7152d921…` | `0xc508d777…` |

---

## 4. Contract Functions

Only functions exposed on the frontend (`/ref/contracts-fe-integration`) are implemented.
Admin / operator-only functions (`initialize`, `setRole`, `updateConfig`, etc.) are excluded.

### 4.1 Pre-market Contract

| Operation | EVM | Solana | Sui | Aptos |
|-----------|-----|--------|-----|-------|
| `createOffer` | ✅ | ✅ | ✅ | ✅ |
| `fillOffer` | ✅ | ✅ | ✅ | ✅ |
| `closeOffer` | ✅ | ✅ | ✅ | ✅ |
| `settleOrder` | ✅ | ✅ | ✅ | ✅ |
| `settleOrder` (with discount) | ✅ | — | ✅ | ✅ |
| `cancelOrder` | ✅ | ✅ | ✅ | ✅ |
| `cancelOrder` (with discount) | ✅ | — | — | ✅ |

**Chain-specific notes:**
- **EVM**: Referral-enabled chains use a `*Ref` ABI variant with `data` + `fundDistributor` args.
  USDT requires resetting allowance to 0 before approving a new amount.
- **Solana**: Anchor PDA derivation via seeds from IDL constants. Instruction names must match IDL exactly:
  `closeUnFullFilledOffer`, `cancelUnFilledOrder`. Settle signer is `seller`, cancel signer is `buyer`.
- **Sui**: Offers and orders are generic over `CoinType`. Requires `Clock` shared object.
  `checkAndSplitCoin` merges and splits owned coins to the exact required amount.
- **Aptos**: Supports both old Coin model (`*_with_coin` entry functions) and new Fungible Asset model.
  `checkCoinToFa()` detects which variant to use at runtime.

### 4.2 OTC Pre-market Contract

| Operation | EVM | Solana | Sui | Aptos |
|-----------|-----|--------|-----|-------|
| `createOffer` | ✅ | ✅ | stub | stub |
| `fillOffer` | ✅ | ✅ | stub | stub |
| `fillOffer` (with discount) | ✅ | — | — | — |
| `cancelOffer` | ✅ | ✅ | stub | stub |

**Chain-specific notes:**
- **EVM**: Transfer hash signed by the seller: `keccak256(preMarketAddr, orderId, otcAddr, isBuyer, deadline, chainId, sender)`
- **Solana**: OTC offer account stores `order` (pre-market order PDA pubkey). Fill requires chaining:
  `otcOffer.order` → `orderAccount.offer` → `offerAccount.tokenConfig`.
  New OTC offer keypair is generated per-call and co-signed.

### 4.3 OFT Bridge (future)

Bridge tokens cross-chain via LayerZero OFT / OFT Adapter contracts.
Intended for delivering settlement tokens to satisfy pre-market orders on another chain.

---

## 5. CLI Commands (planned)

```
# Pre-market trading
whales trade create-offer --token <id> --side buy|sell --price <n> --amount <n> --ex-token <addr>
whales trade fill-offer <offer-id> [--amount <n>]
whales trade close-offer <offer-id>
whales trade settle <order-id>
whales trade cancel-order <order-id>

# OTC resell
whales otc create <order-id> --price <n> --deadline <unix-ts> --ex-token <addr>
whales otc fill <otc-offer-id>
whales otc cancel <otc-offer-id>

# On-chain balance
whales portfolio balance [--chain evm|solana|sui|aptos] [--token <addr>]
```

---

## 6. Implementation Progress

| Step | Task | Status |
|------|------|--------|
| 1 | Wallet refactor: mnemonic-based multi-wallet support | ✅ Done |
| 2 | `src/blockchain/types.ts` — shared interfaces | ✅ Done |
| 3 | EVM: signer, ABIs, `PreMarket.ts`, `OtcPreMarket.ts`, `EvmAdapter` | ✅ Done |
| 4 | EVM: `constants.ts` — chain configs, contract addresses for all EVM chains | ✅ Done |
| 5 | Solana: signer, IDLs, `PreMarket.ts`, `OtcPreMarket.ts`, `SolanaAdapter` | ✅ Done |
| 6 | Solana: `constants.ts` — program IDs, config accounts, RPC URLs | ✅ Done |
| 7 | Sui: signer, `PreMarket.ts`, `SuiAdapter`, `constants.ts` with RPC | ✅ Done |
| 8 | Aptos: signer, `PreMarket.ts`, `AptosAdapter`, `constants.ts` with RPC | ✅ Done |
| 9 | `src/blockchain/index.ts` — unified barrel export | ✅ Done |
| 10 | `trade` commands — create-offer, fill-offer, close-offer, settle, cancel | ⬜ Next |
| 11 | `otc` commands — create, fill, cancel | ⬜ Next |
| 12 | Sui/Aptos OTC wrappers (currently stubs) | ⬜ Planned |
| 13 | OFT bridge — quote + send commands | ⬜ Future |
