# Branch Update: feat/wallet-mnemonic-multi-chain

Documentation of changes in this branch.

---

## Overview

Refactor the wallet management system from **single-wallet + raw private key** to **multi-wallet + mnemonic-based** with multi-chain support (EVM + Solana) from a single seed phrase.

---

## 1. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `ed25519-hd-key` | ^1.3.0 | Derive Solana keypair from mnemonic using standard path `m/44'/501'/0'/0'` |

---

## 2. Config Schema (`src/config.ts`)

### Before
```typescript
{
  privateKey?: string;
  walletType?: 'solana' | 'evm';
  chainId?: number;
  apiUrl?: string;
  ...
}
```

### After
```typescript
{
  wallets?: WalletEntry[];   // [{ name, mnemonic, createdAt }, ...]
  activeWallet?: string;     // name of the active wallet
  chainId?: number;
  apiUrl?: string;
  ...
}
```

### New API
- `getWallets()` — get list of wallets
- `getActiveWallet()` — get active wallet
- `addWallet(entry)` — add wallet
- `removeWallet(name)` — remove wallet
- `setActiveWallet(name)` — switch active wallet
- `hasLegacyPrivateKey()` — check for legacy config

---

## 3. Wallet Utils (`src/utils/wallet.ts`)

### Bug Fix
- **Solana derivation**: Previously used `seed.slice(0, 32)` (incorrect). Now uses `ed25519-hd-key` with path `m/44'/501'/0'/0'` (standard, compatible with Phantom/Solflare).

### New Functions
| Function | Description |
|----------|-------------|
| `generateMnemonic()` | Generate new BIP39 mnemonic |
| `validateMnemonic(mnemonic)` | Validate mnemonic phrase |
| `deriveEvmAddress(mnemonic)` | EVM address from path `m/44'/60'/0'/0/0` |
| `deriveSolanaAddress(mnemonic)` | Solana address from path `m/44'/501'/0'/0'` |
| `deriveSolanaKeypair(mnemonic)` | Solana keypair (for signing) |
| `deriveEvmWallet(mnemonic)` | EVM HDNodeWallet (for signing) |
| `deriveAllAddresses(mnemonic)` | `{ evm, solana }` |
| `createWallet()` | Generate mnemonic + derive addresses |

---

## 4. Auth (`src/auth.ts`)

- Read mnemonic from `config.getActiveWallet()` instead of `privateKey`
- Derive address/keypair based on `chainId` (666666 = Solana, else = EVM)
- Clear error when legacy config (`privateKey`) is detected → instruct user to run `wallet import`

---

## 5. Wallet Commands (`src/commands/wallet.ts`)

| Command | Changes |
|---------|---------|
| `wallet create [--name]` | Generate new mnemonic, save to config, show EVM + Solana addresses |
| `wallet import <mnemonic> [--name]` | Import by mnemonic (instead of private key) |
| `wallet list` | **New** — list all saved wallets |
| `wallet use <name>` | **New** — switch active wallet |
| `wallet show [--name]` | Show EVM + Solana addresses from same seed |
| `wallet remove <name>` | **New** — remove wallet from config |
| `wallet address` | Address for current chain |
| `wallet link` | Placeholder (unchanged) |

---

## 6. Setup Wizard (`src/commands/setup.ts`)

- **Create new**: One mnemonic → derive EVM + Solana addresses
- **Import**: Enter mnemonic (12/24 words) instead of private key
- Choose primary chain (Solana / Ethereum)
- Save mnemonic to `wallets[]` with name `default`

---

## 7. Other Updates

| File | Changes |
|------|---------|
| `src/commands/status.ts` | Display `activeWallet` + `chainId` instead of `walletType` |
| `src/commands/help.ts` | Update wallet command descriptions, remove WHALES_PRIVATE_KEY |
| `docs/ROADMAP.md` | Migration note, mnemonic 12/24 words, wallet link placeholder |

---

## 8. Migration for Existing Users

If config still has `privateKey`:

1. Run: `whales wallet import "<your-12-or-24-word-mnemonic>" --name default`
2. Auto-migration is not possible since mnemonic cannot be recovered from private key

---

## 9. Files Changed

```
docs/ROADMAP.md
docs/BRANCH_UPDATE_feat-wallet-mnemonic-multi-chain.md  (new)
package.json
src/auth.ts
src/config.ts
src/commands/help.ts
src/commands/setup.ts
src/commands/status.ts
src/commands/wallet.ts
src/utils/wallet.ts
```
