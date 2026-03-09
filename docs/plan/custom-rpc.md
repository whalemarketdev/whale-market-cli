# Plan: Custom RPC per Chain

Allow users to override the default RPC URL for any chain. The custom URL is saved in the local config store and used automatically whenever the CLI connects to that chain.

---

## Motivation

Default RPC URLs in `src/blockchain/*/constants.ts` are public nodes — they may be rate-limited or slow. Power users want to plug in their own QuikNode, Alchemy, Helius, or other private RPC without modifying source code.

---

## Affected Files

| File | Change |
|------|--------|
| `src/config.ts` | Add `customRpcs` field to `ConfigSchema`; add `getRpc`, `setRpc`, `removeRpc`, `getCustomRpcs` methods |
| `src/commands/config.ts` | Add `config rpc` subcommand group with `set`, `get`, `remove`, `list` |
| `src/commands/helpers/chain.ts` | Add `resolveRpc(chainId)` helper; update `getChainAdapter`, `getPreMarket`, `getOtcPreMarket` to use it |

---

## 1. Config Schema Change

```typescript
// src/config.ts

interface ConfigSchema {
  wallets?: WalletEntry[];
  activeWallet?: string;
  chainId?: number;
  apiUrl?: string;
  jwtToken?: string;
  jwtExpiresAt?: string;
  customRpcs?: Record<string, string>;  // key = chainId.toString(), value = RPC URL
}
```

`customRpcs` is a plain object keyed by chain ID string (e.g. `"666666"`, `"1"`, `"8453"`).

---

## 2. Config Class Methods

Add to `class Config` in `src/config.ts`:

```typescript
getCustomRpcs(): Record<string, string> {
  return this.store.get('customRpcs') ?? {};
}

getCustomRpc(chainId: number): string | undefined {
  return this.getCustomRpcs()[chainId.toString()];
}

setCustomRpc(chainId: number, url: string): void {
  const rpcs = this.getCustomRpcs();
  rpcs[chainId.toString()] = url;
  this.store.set('customRpcs', rpcs);
}

removeCustomRpc(chainId: number): void {
  const rpcs = this.getCustomRpcs();
  delete rpcs[chainId.toString()];
  this.store.set('customRpcs', rpcs);
}
```

---

## 3. CLI Commands

Add a `rpc` subcommand group under `config`:

```
whales config rpc set <chain-id> <url>     # save custom RPC for a chain
whales config rpc get <chain-id>           # show resolved RPC (custom or default)
whales config rpc remove <chain-id>        # delete custom RPC, revert to default
whales config rpc list                     # list all custom RPCs
```

### Examples

```bash
# Set a private Helius RPC for Solana mainnet (chain ID 666666)
whales config rpc set 666666 https://rpc.helius.xyz/?api-key=YOUR_KEY

# Set a QuikNode RPC for Ethereum mainnet
whales config rpc set 1 https://your-node.quiknode.pro/YOUR_KEY/

# View the resolved RPC for a chain (shows custom if set, otherwise default)
whales config rpc get 666666

# Remove custom override for Base mainnet
whales config rpc remove 8453

# List all stored custom RPCs
whales config rpc list
```

### `config rpc list` output example

```
Chain ID   Name              Custom RPC
─────────────────────────────────────────────────────────────────────
666666     Solana            https://rpc.helius.xyz/?api-key=xxx
1          Ethereum          https://your-node.quiknode.pro/xxx/
```

### `config rpc get <chain-id>` output example

```
Chain:    Solana (666666)
RPC:      https://rpc.helius.xyz/?api-key=xxx  [custom]
Default:  https://api.mainnet-beta.solana.com
```

If no custom RPC is set:
```
Chain:    Ethereum (1)
RPC:      https://eth.llamarpc.com  [default]
```

---

## 4. `resolveRpc` Helper

Add to `src/commands/helpers/chain.ts`:

```typescript
import { config } from '../../config';
import { getEvmRpcUrl } from '../../blockchain/evm/constants';
import { SOLANA_RPC } from '../../blockchain/solana/constants';
import { SUI_RPC } from '../../blockchain/sui/constants';
import { APTOS_RPC } from '../../blockchain/aptos/constants';

/**
 * Returns the RPC URL for a chain.
 * Priority: user custom RPC (from config) > default constant.
 */
export function resolveRpc(chainId: number): string {
  // 1. Check user override
  const custom = config.getCustomRpc(chainId);
  if (custom) return custom;

  // 2. Fall back to default constants
  if (chainId === SOLANA_DEVNET_CHAIN_ID) return SOLANA_RPC.DEVNET;
  if (chainId === SOLANA_MAINNET_CHAIN_ID) return SOLANA_RPC.MAINNET;
  if (chainId === SUI_TESTNET_CHAIN_ID)    return SUI_RPC.TESTNET;
  if (chainId === SUI_MAINNET_CHAIN_ID)    return SUI_RPC.MAINNET;
  if (chainId === APTOS_TESTNET_CHAIN_ID)  return APTOS_RPC.TESTNET;
  if (chainId === APTOS_MAINNET_CHAIN_ID)  return APTOS_RPC.MAINNET;
  return getEvmRpcUrl(chainId);
}
```

---

## 5. Update `getChainAdapter`, `getPreMarket`, `getOtcPreMarket`

Replace all hardcoded RPC lookups in `chain.ts` with `resolveRpc(chainId)`.

Before:
```typescript
// getPreMarket — EVM
const rpcUrl = getEvmRpcUrl(chainId);

// getPreMarket — Solana
const rpcUrl = chainId === SOLANA_DEVNET_CHAIN_ID ? SOLANA_RPC.DEVNET : SOLANA_RPC.MAINNET;
```

After:
```typescript
const rpcUrl = resolveRpc(chainId);
```

All three factory functions (`getChainAdapter`, `getPreMarket`, `getOtcPreMarket`) follow the same pattern — replace every per-chain RPC resolution block with a single `resolveRpc(chainId)` call.

---

## 6. Update `config get` output

Include custom RPCs in the general config display:

```
Config:
  apiUrl:        https://api.whales.market
  chainId:       666666
  activeWallet:  main
  customRpcs:
    666666  →  https://rpc.helius.xyz/?api-key=xxx
    1       →  https://your-node.quiknode.pro/xxx/
  Path: /Users/...
```

---

## 7. `config rpc chains` — List All Supported Chains

Add a subcommand to print all chain IDs and names the CLI supports, so users know what to pass to `config rpc set`.

```bash
whales config rpc chains
```

### Output example

```
Supported Chains
────────────────────────────────────────────────────────────────────
Chain ID   Name                 Type     Default RPC
────────────────────────────────────────────────────────────────────
1          Ethereum             EVM      https://eth.llamarpc.com
10         Optimism             EVM      https://optimism-mainnet.public.blastapi.io
42161      Arbitrum             EVM      https://arbitrum.public.blockpi.network/...
8453       Base                 EVM      https://mainnet.base.org
56         BSC                  EVM      https://bsc-rpc.publicnode.com
59144      Linea                EVM      https://linea-rpc.publicnode.com
169        Manta Pacific        EVM      https://manta.nirvanalabs.xyz/mantapublic
4200       Merlin               EVM      https://rpc.merlinchain.io
34443      Mode                 EVM      https://mainnet.mode.network
2818       Morph                EVM      https://rpc-quicknode.morphl2.io
534352     Scroll               EVM      https://rpc.scroll.io
146        Sonic                EVM      https://sonic-json-rpc.stakely.io
80094      Berachain            EVM      https://rpc.berachain-apis.com
81457      Blast                EVM      https://rpc.blast.io
999        Hyperliquid          EVM      https://rpc.hyperliquid.xyz/evm
167000     Taiko                EVM      https://rpc.mainnet.taiko.xyz
2741       Abstract             EVM      https://api.mainnet.abs.xyz
324        zkSync Era           EVM      https://mainnet.era.zksync.io
43114      Avalanche            EVM      https://endpoints.omniatech.io/...
143        Monad                EVM      https://rpc-mainnet.monadinfra.com
11155111   Sepolia              EVM      https://ethereum-sepolia-rpc.publicnode.com
421614     Arbitrum Sepolia     EVM      https://arbitrum-sepolia.therpc.io
84532      Base Sepolia         EVM      https://sepolia.base.org
97         BSC Testnet          EVM      https://bsc-testnet-rpc.publicnode.com
(+ more testnets...)
────────────────────────────────────────────────────────────────────
666666     Solana               Solana   https://api.mainnet-beta.solana.com
999999     Solana Devnet        Solana   https://api.devnet.solana.com
────────────────────────────────────────────────────────────────────
900000     Sui                  Sui      https://fullnode.mainnet.sui.io
900002     Sui Testnet          Sui      https://fullnode.testnet.sui.io
────────────────────────────────────────────────────────────────────
900001     Aptos                Aptos    https://fullnode.mainnet.aptoslabs.com/v1
900003     Aptos Testnet        Aptos    https://fullnode.testnet.aptoslabs.com/v1

Use: whales config rpc set <chain-id> <url>
```

Chains with a `*` in the RPC column have a custom override saved in config.

### Data source

Pull chain names and default RPCs from existing constants — no hardcoding needed:
- **EVM**: `EVM_CHAINS` in `src/blockchain/evm/constants.ts` (already has `name`, `rpcUrl`)
- **Solana**: `SOLANA_RPC` + hardcoded names/IDs from `src/commands/helpers/chain.ts`
- **Sui**: `SUI_RPC` + hardcoded names/IDs
- **Aptos**: `APTOS_RPC` + hardcoded names/IDs

---

## Chain ID Reference

| Chain | Chain ID used by CLI |
|-------|---------------------|
| Solana Mainnet | `666666` |
| Solana Devnet | `999999` |
| Sui Mainnet | `900000` |
| Sui Testnet | `900002` |
| Aptos Mainnet | `900001` |
| Aptos Testnet | `900003` |
| Ethereum | `1` |
| Base | `8453` |
| Arbitrum | `42161` |
| BSC | `56` |
| (all other EVM chains) | standard chain ID |

---

## Implementation Order

1. `src/config.ts` — add `customRpcs` to schema + 4 methods
2. `src/commands/helpers/chain.ts` — add `resolveRpc()`, replace all hardcoded RPC lookups
3. `src/commands/config.ts` — add `config rpc` subcommand group:
   - `set <chain-id> <url>`
   - `get <chain-id>`
   - `remove <chain-id>`
   - `list`
   - `chains` — list all supported chains with their IDs and default RPCs
4. Update `config get` output to display custom RPCs
