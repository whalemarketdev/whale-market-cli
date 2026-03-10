# Plan: Contract Input Validation & Interaction Gaps

**Status:** Phase 1 ✅ Complete · Phase 2 ✅ Complete · Phase 3 ✅ Complete
**Priority:** High
**Source:** Analysis of `/ref/whales-market-frontend-v2/src/contracts` vs current CLI implementation

---

## Progress Summary

| Status | Count | Items |
|--------|-------|-------|
| ✅ Done | 18 | All except #2 (optional), #16 (N/A) |
| ⏳ Skipped | 1 | #2 (optional — covered by #1 check) |
| N/A | 1 | #16 (Aptos discount — frontend also unsupported) |

---

## Overview

This document identifies gaps and missing validations between the frontend contract interaction logic and the current CLI. For each gap, the required API calls are listed.

API base URL: `https://api.whales.market` (configurable via `whales config set api-url`)

---

## EVM Gaps

### 1. `createOffer` / `fillOffer` — Minimum Collateral (USD) ✅ Done

**Frontend behavior:**
```typescript
// src/constants/global.ts
export const MIN_COLLATERAL = isDev ? 0.001 : 10; // USD
```
- **Create**: blocks submit if `price × amount < $10`
- **Fill**: blocks if fill amount in USD `< $10` AND remaining offer collateral `>= $10`

**CLI behavior (implemented):**
- **Create**: For EVM, fetches exToken price from API → `collateralUsd = amount × price × exTokenPriceUsd`. For Solana/Sui/Aptos, `price` is already in USD so `collateralUsd = amount × price`. Rejects if `collateralUsd < 10`.
- **Fill (EVM)**: Fetches exToken price, computes fill collateral USD from `offerData.collateral.uiAmount × (fillAmount/totalAmount) × exTokenPrice`, rejects if `< $10` while remaining collateral `>= $10`.

**Why EVM needs the API call:** For EVM, `--price` is in exToken units (e.g. WETH/PM-token). A price of `0.005 WETH` with WETH at $3000 = $15 USD — which is above the minimum but would incorrectly fail a simple `amount × price < 10` check.

**API used:**
```
GET /network-chains/v2/price?chainId={chainId}&currency=usd
Response: [{ "address": "0x...", "price": 1.0001 }]
```

---

### 2. `createOffer` — Collateral Auto-Computation ⏳ Pending (optional UX)

**Frontend behavior:**
- Fetches exToken price from API, computes `collateral = amount × (pricePerTokenUsd / exTokenPrice)` scaled to exToken decimals

**CLI behavior:**
- User passes `--price` (USD per token) and `--amount`; CLI computes `collateral = amount × price` directly in the trade command (no exToken price lookup needed for basic collateral calculation — already done)

**Remaining gap:** Covered by #1 — the $10 minimum check prevents under-collateralized offers.

**API needed:**
```
GET /network-chains/v2/price?chainId={chainId}&currency=usd
Response: [{ "address": "0x...", "price": number }]
```

---

### 3. `settleOrder` — Token Decimals ✅ Done

**Frontend behavior:**
- Fetches `token.decimals()` on-chain dynamically before approval/settlement

**CLI behavior:**
- `getTokenDecimals(tokenAddress)` is now public on `EvmPreMarket` and called automatically in settle
- `--token-decimals` flag retained as an explicit override (omit for auto-detection)
- ETH returns 18 directly; all ERC20s call `token.decimals()` on-chain

**API needed:** None — on-chain RPC call `contract.decimals()` only.

---

### 4. `settleOrder` — Settlement Token Approval ✅ Done

`EvmPreMarket.settleOrder()` calls `ensureApproval(tokenAddress, amount)` before `settleFilled`.

---

### 5. `closeOffer` — Referral Chain Params ✅ Done

`EvmPreMarket.closeOffer()` checks `this.isReferral` and calls `cancelOffer(offerId, '0x', fundDistributor)` for referral chains.

---

### 6. USDT Double-Approval ✅ Done

`ensureApproval()` detects USDT address and resets allowance to 0 before setting new value.

---

### 7. ETH vs ERC20 Path ✅ Done

`createOffer()` and `fillOffer()` check `exTokenAddress === ETH_ADDRESS` and use `newOfferETH`/`fillOfferETH` with `{ value }` accordingly.

---

## Solana Gaps

### 8. Compute Unit Simulation ✅ Done

**Implemented in:** `SolanaPreMarket.send()` and `SolanaOtcPreMarket.sendTransaction()`

- Simulates tx with `connection.simulateTransaction(tx)`
- Reads `unitsConsumed`, applies 25% buffer: `cuLimit = Math.ceil(units × 1.25)`
- Prepends `ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit })` to tx
- Falls back to 200,000 CU if simulation fails

---

### 9. Retry Logic ✅ Done

**Implemented in:** both Solana send methods

- Retries up to 10 attempts with 1500ms delay between each
- Refreshes blockhash on every attempt

---

### 10. `settleOrder` with Discount ✅ Done

**Implemented in:** `SolanaPreMarket.settleOrderWithDiscount({ orderId })`

- POSTs to API, deserializes base64 `VersionedTransaction`, signs, sends
- `trade.ts` Solana settle: `--with-discount` triggers this path (uses numeric `orderId` — no `--order-uuid` needed for Solana)

**API:**
```
POST /transactions/build-transaction-settle-with-discount
Body:     { "orderId": <number>, "feePayer": "<base58>" }
Response: { "data": "<base64_versioned_tx>" }
```

---

### 11. `cancelOrder` with Discount ✅ Done

**Implemented in:** `SolanaPreMarket.cancelOrderWithDiscount({ orderId })`

- Same pattern as #10
- `trade.ts` claim-collateral: `--with-discount` triggers this path

**API:**
```
POST /transactions/build-transaction-cancel-with-discount
Body:     { "orderId": <number>, "feePayer": "<base58>" }
Response: { "data": "<base64_versioned_tx>" }
```

---

### 12. Native SOL Wrapping ✅ Done

`SolanaPreMarket.createOffer()` and `fillOffer()` call `buildWrapSolInstructions(connection, payer, lamports)` when `exToken === NATIVE_MINT`, prepending the wrap instructions to the transaction.

---

## Sui Gaps

### 13. `settleOrderWithDiscount` ✅ Done

**Frontend behavior:**
- Calls API for discount signature + data, builds PTB

**CLI behavior:**
- Calls `POST /transactions/build-settle-discount-signature-sui` with `{ orderId: orderUUID }`
- Extracts `settleDiscount.{ sellerDiscount, buyerDiscount, signature }` from response
- Handles signature as either `number[]` (JSON array) or hex string
- Calls `SuiPreMarket.settleOrderWithDiscount()` with on-chain orderId + discount params

**API:**
```
POST /transactions/build-settle-discount-signature-sui
Body:     { "orderId": "<order_uuid>" }
Response: { "data": { "settleDiscount": { "orderId": "...", "sellerDiscount": n, "buyerDiscount": n, "signature": [n,...] } } }
```

---

### 14. `cancelOrderWithDiscount` ✅ Done

**Frontend behavior:**
- Calls API for discount signature + `custom_index` (on-chain order object ID), builds PTB

**CLI behavior:**
- Added `cancelOrderWithDiscount()` to `SuiPreMarket` calling `settle_cancelled_with_discount`
- In `trade.ts`, `claim-collateral --with-discount` calls `POST /transactions/build-cancel-discount-signature-sui`
- Uses `response.data.order.custom_index` as the on-chain orderId (falls back to CLI argument)

**API:**
```
POST /transactions/build-cancel-discount-signature-sui
Body:     { "orderId": "<order_uuid>" }
Response: { "data": { "order": { "custom_index": "<on-chain-object-id>" }, "settleDiscount": { ... } } }
```

---

### 15. `customIndex` / Config Object ID ✅ Done

`SuiPreMarket` uses `this.net.configId` (from `src/blockchain/sui/constants.ts`) as the config object in all PTB calls. Verified against deployment: mainnet `0x43265...`, testnet `0x95926...`.

---

## Aptos Gaps

### 16. Settle/Cancel with Discount — N/A

Frontend throws `"Discount not supported on Aptos"`. No implementation needed in CLI either.

---

### 17. Coin vs Fungible Asset Entry Functions ✅ Done

`AptosPreMarket.createOffer()` and `fillOffer()` call `checkCoinToFa(aptos, sender, exToken)` to detect token type and select `create_offer_with_coin` (with `typeArguments`) vs `create_offer` accordingly.

---

## OTC EVM Gaps

### 18. `createOffer` — Buyer Ownership Check ✅ Done

`EvmOtcPreMarket.createOffer()` fetches the pre-market order and throws if `order.buyer.toLowerCase() !== signer.address.toLowerCase()`.

---

### 19. `createOffer` — Message Signing (EIP-191) ✅ Done

`EvmOtcPreMarket.createOffer()`:
1. Computes `signatureDeadline = Math.floor(Date.now() / 1000) + 3600`
2. Signs `solidityPackedKeccak256([preMarketAddr, orderId, otcAddr, true, signatureDeadline, chainId, otcAddr])`
3. Passes `signature` + `signatureDeadline` to `contract.createOffer(...)`

---

### 20. `fillOffer` — ERC20 Pre-approval ✅ Done

`EvmOtcPreMarket.fillOffer()` fetches `contract.otcOffers(offerId)`, extracts `exToken` + `value`, calls `ensureApproval(exToken, value)` before filling. Handles ETH/ERC20 and referral/non-referral paths.

---

### 21. `fillOffer` with Discount — `encodeResellData` ✅ Done

`EvmOtcPreMarket.fillOfferWithDiscount()`:
- Calls `POST /transactions/build-txf-fill-resell-with-discount-evm`
- Encodes response with `encodeOtcResellData(...)`
- Calls `fillOffer(offerId, encodedData, fundDistributor)` for referral chains

**API:**
```
POST /transactions/build-txf-fill-resell-with-discount-evm
Body:     { "offerId": "<offer_uuid>", "sender": "<0x_addr>" }
Response: { "data": { "buyerDiscount": number, "signature": "0x...", "buyerReferrer": "0x...", "buyerReferralPercent": number } }
```

---

## OTC Solana Gaps

### 22. `fillOffer` — PDA PublicKey ✅ Done

`otc fill <otc-offer-id>` on Solana uses `new PublicKey(otcOfferIdArg)` — correctly handles the on-chain PDA address format.

---

### 23. `otc create` — Ex-token Decimals Auto-fetch ✅ Done

**Before:** `--ex-token-decimals <n>` flag required (default: 6), prone to misconfiguration.

**After:** Removed the flag. Decimals are fetched on-chain:
- **EVM:** `EvmPreMarket.getTokenDecimals(exTokenAddress)` — calls `token.decimals()` on the ERC20 contract; returns 18 for ETH
- **Solana:** `SolanaPreMarket.getTokenDecimals(mintAddress)` — calls `getMint(connection, mint)` from `@solana/spl-token`; returns 9 for native SOL (`NATIVE_MINT`)

**API needed:** None — on-chain RPC only.

---

### 24. `trade create-offer` — EVM Ex-token Decimals On-chain Fetch ✅ Done

**Before:** `--ex-token-decimals` option with default fallback to 6 for ERC20.

**After:** Removed `--ex-token-decimals` option from `trade create-offer`. Decimals are fetched on-chain:
- `ETH_ADDRESS` → 18 (no RPC call)
- All other ERC20s → `pm.getTokenDecimals(exTokenAddress)` (calls `token.decimals()` on-chain)

**API needed:** None — on-chain RPC only.

---

## Summary Table

| # | Chain | Function | Status |
|---|-------|----------|--------|
| 1 | All | Min $10 USD collateral on create/fill | ✅ Done |
| 2 | EVM | Collateral auto-computation from price API | ⏳ Skipped (covered by #1) |
| 3 | EVM | `settleOrder` — dynamic token decimals | ✅ Done |
| 4 | EVM | `settleOrder` — token approval | ✅ Done |
| 5 | EVM | `closeOffer` — referral chain params | ✅ Done |
| 6 | EVM | USDT double-approval | ✅ Done |
| 7 | EVM | ETH vs ERC20 path | ✅ Done |
| 8 | Solana | CU simulation + 25% buffer | ✅ Done |
| 9 | Solana | Retry logic (10×, 1500ms) | ✅ Done |
| 10 | Solana | `settleOrder` w/ discount (API tx) | ✅ Done |
| 11 | Solana | `cancelOrder` w/ discount (API tx) | ✅ Done |
| 12 | Solana | Native SOL wrapping | ✅ Done |
| 13 | Sui | `settleOrderWithDiscount` | ✅ Done |
| 14 | Sui | `cancelOrderWithDiscount` | ✅ Done |
| 15 | Sui | Config object ID (`customIndex`) | ✅ Done |
| 16 | Aptos | Settle/cancel w/ discount | N/A |
| 17 | Aptos | Coin vs Fungible Asset entry function | ✅ Done |
| 18 | OTC EVM | `createOffer` buyer ownership check | ✅ Done |
| 19 | OTC EVM | `createOffer` EIP-191 message signing | ✅ Done |
| 20 | OTC EVM | `fillOffer` ERC20 pre-approval | ✅ Done |
| 21 | OTC EVM | `fillOffer` referral discount encoding | ✅ Done |
| 22 | OTC Solana | `fillOffer` PDA PublicKey format | ✅ Done |
| 23 | OTC EVM+Solana | `createOffer` — ex-token decimals auto-fetch | ✅ Done |
| 24 | EVM | `trade create-offer` — ex-token decimals on-chain fetch (no default 6) | ✅ Done |

---

## Pending Work

All items complete. No remaining gaps identified.

---

## API Endpoints Reference

| Endpoint | Method | Used By |
|----------|--------|---------|
| `/network-chains/v2/price?chainId={id}&currency=usd` | GET | All — collateral USD check (#1, #2) |
| `/transactions/build-transaction-settle-with-discount` | POST | Solana settle w/ discount (#10) |
| `/transactions/build-transaction-cancel-with-discount` | POST | Solana cancel w/ discount (#11) |
| `/transactions/v2/build-transaction-settle-with-discount-evm` | POST | EVM referral settle w/ discount |
| `/transactions/build-transaction-settle-with-discount-evm` | POST | EVM non-referral settle w/ discount |
| `/transactions/v2/build-transaction-cancel-with-discount-evm` | POST | EVM referral cancel w/ discount |
| `/transactions/build-transaction-cancel-with-discount-evm` | POST | EVM non-referral cancel w/ discount |
| `/transactions/build-settle-discount-signature-sui` | POST | Sui settle w/ discount (#13) |
| `/transactions/build-cancel-discount-signature-sui` | POST | Sui cancel w/ discount (#14) |
| `/transactions/build-txf-fill-resell-with-discount-evm` | POST | OTC EVM fill w/ discount (#21) |

---

## Reference Files

- Frontend: `/ref/whales-market-frontend-v2/src/contracts/`
  - `evm/PreMarket.ts`, `evm/OtcPreMarket.ts`
  - `solana/PreMarket.ts`
  - `sui/PreMarket.ts`
  - `aptos/PreMarket.ts`
- Frontend constants: `src/constants/global.ts` — `MIN_COLLATERAL = 10` USD
- CLI: `src/blockchain/*/contracts/`, `src/blockchain/*/programs/`
- CLI commands: `src/commands/trade.ts`, `src/commands/otc.ts`
