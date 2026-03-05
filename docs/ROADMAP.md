# Whale Market CLI - Roadmap & Architecture

## Next Goals

Add commands that interact directly with Whales Market smart contracts across multiple chains.

---

## 1. Multi-chain Wallet Management via Seed Phrase

### Requirements
- Store wallets as **12-word BIP39 mnemonics** instead of raw private keys
- Support **multiple wallets** (multi-seed) with the ability to switch between them
- When interacting with a chain, **derive keys using the correct derivation path** for that chain
- `wallet show` displays **full addresses on all chains** from a single seed

### Standard Derivation Paths
| Chain | Derivation Path | Library |
|-------|----------------|---------|
| EVM (ETH/BSC/Polygon/...) | `m/44'/60'/0'/0/0` | ethers.js |
| Solana | `m/44'/501'/0'/0'` | @solana/web3.js + ed25519-hd-key |
| Sui | `m/44'/784'/0'/0'/0'` | @mysten/sui |
| Aptos | `m/44'/637'/0'/0'/0'` | @aptos-labs/ts-sdk |

### New Config Schema
```typescript
interface WalletEntry {
  name: string;        // wallet label, e.g. "main", "trading"
  mnemonic: string;    // 12-word seed phrase (encrypted?)
  createdAt: string;
}

interface ConfigSchema {
  wallets: WalletEntry[];
  activeWallet: string;  // name of the currently active wallet
  chainId?: number;
  apiUrl?: string;
  jwtToken?: string;
  jwtExpiresAt?: string;
}
```

### Commands to Add/Update
```
wallet create [--name <label>]      # generate new seed, save to config
wallet import <mnemonic> [--name]   # import 12-word seed
wallet list                         # list all saved wallets
wallet use <name>                   # switch active wallet
wallet show [--name <label>]        # show addresses for all chains from seed
wallet remove <name>                # remove a wallet
```

---

## 2. Folder Structure: `src/blockchain/`

Designed to support multi-chain contract interaction.

```
src/blockchain/
├── index.ts                  # export unified ChainManager
├── types.ts                  # shared interfaces: ChainAdapter, TxResult, etc.
│
├── evm/
│   ├── index.ts              # EVMAdapter implements ChainAdapter
│   ├── signer.ts             # derive EVM wallet from mnemonic
│   ├── contracts/
│   │   ├── abis/             # raw ABI JSON files
│   │   │   ├── WhalesOTC.json
│   │   │   └── ERC20.json
│   │   └── WhalesOTC.ts      # typed contract wrapper (ethers.js ContractFactory)
│   └── utils.ts              # helpers: gasEstimate, parseUnits, etc.
│
├── solana/
│   ├── index.ts              # SolanaAdapter implements ChainAdapter
│   ├── signer.ts             # derive Solana keypair from mnemonic
│   ├── programs/
│   │   ├── idl/              # Anchor IDL JSON files
│   │   │   └── whales_otc.json
│   │   └── WhalesOTC.ts      # Anchor program client wrapper
│   └── utils.ts              # helpers: lamports, SPL token, etc.
│
├── sui/
│   ├── index.ts              # SuiAdapter implements ChainAdapter
│   ├── signer.ts             # derive Sui keypair from mnemonic
│   ├── contracts/
│   │   └── WhalesOTC.ts      # Sui Move call wrapper
│   └── utils.ts
│
└── aptos/
    ├── index.ts              # AptosAdapter implements ChainAdapter
    ├── signer.ts             # derive Aptos account from mnemonic
    ├── contracts/
    │   └── WhalesOTC.ts      # Aptos Move entry function wrapper
    └── utils.ts
```

### ChainAdapter Interface (common)
```typescript
interface ChainAdapter {
  chainId: string;
  getAddress(mnemonic: string): Promise<string>;
  getBalance(address: string): Promise<string>;
  signAndSend(mnemonic: string, tx: UnsignedTx): Promise<TxResult>;
}
```

---

## 3. Contract Interaction Commands (planned)

```
# Pre-market OTC
whales trade create-offer --token <id> --side buy|sell --price <n> --amount <n>
whales trade cancel-offer <offer-id>
whales trade fill-offer <offer-id> --amount <n>

# Settle
whales trade settle <order-id>

# On-chain balance
whales portfolio balance [--chain evm|solana|sui|aptos]
```

---

## 4. Implementation Order

1. **Refactor wallet**: migrate privateKey → mnemonic, add multi-wallet support
2. **`src/blockchain/evm/signer.ts`**: derive EVM wallet from mnemonic
3. **`src/blockchain/solana/signer.ts`**: derive Solana keypair from mnemonic
4. **`wallet show`**: display addresses across all chains
5. **Fetch ABI/IDL** from live contracts, place in `abis/` and `idl/`
6. **Implement contract wrappers** per chain
7. **Trade commands**: create-offer, cancel, fill, settle
8. Add Sui and Aptos adapters
