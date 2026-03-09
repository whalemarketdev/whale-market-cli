# Plan: Contract Input Validation & Interaction Gaps

**Status:** Draft
**Priority:** High
**Source:** Analysis of `/ref/whales-market-frontend-v2/src/contracts` vs current CLI implementation

---

## Overview

This document identifies gaps and missing validations between the frontend contract interaction logic and the current CLI implementation. For each gap, the required API calls are listed so the CLI can replicate the frontend behavior.

API base URL: `https://api.whales.market` (configurable via `whales config set api-url`)

---

## EVM Gaps

### 1. `createOffer` / `fillOffer` — Minimum Collateral (USD)

**Frontend behavior:**
- Constant defined in `src/constants/global.ts`:
  ```typescript
  export const MIN_COLLATERAL = isDev ? 0.001 : 10; // USD
  ```
- **Create offer**: `collateralValueUsd = price × amount`. Submit blocked if `collateralValueUsd < MIN_COLLATERAL`.
- **Fill offer**: `collateralValueUsd = collateral × exTokenPriceUsd`. Fill blocked if the fill amount in USD is below `MIN_COLLATERAL` AND the remaining collateral on the offer is still above `MIN_COLLATERAL` (i.e. partial fills that are too small are rejected, but a final fill that clears the offer is allowed).
- User sees: `"Minimum deposit is $10"`

**CLI behavior:**
- No minimum collateral check; any amount is accepted.

**Gap:** The CLI lets users submit offers below the $10 minimum. The contract may accept the tx, but the marketplace API/UI treats it as invalid.

**API calls needed:**
To evaluate collateral in USD, the CLI needs the exToken price:
```
GET /network-chains/v2/price?chainId={chainId}&currency=usd

Response: [{ address: "0x...", price: 1.0001 }, ...]
```
Then: `collateralValueUsd = collateralInExToken × exTokenPrice`. Reject if `< 10`.

**Files:** `src/constants/global.ts`, `src/components/create-offer/tabs/StepReview.tsx:84`, `src/screens/token-detail/components/form-fill-offer/FormFillOffer.tsx:120`

---

### 2. `createOffer` — Collateral Computation

**Frontend behavior:**
- Fetches exToken USD price from API (same endpoint as above)
- Computes `collateral = amount × (pricePerTokenUsd / exTokenPrice)`
- Result scaled to exToken decimals

**CLI behavior:**
- Requires `--collateral` as a pre-computed raw value (exToken units)
- No API price fetch; no automatic computation

**Gap:** Users must manually compute the correct collateral. A wrong value leads to under/over-collateralizing.

**API calls needed:**
```
GET /network-chains/v2/price?chainId={chainId}&currency=usd

Response: [{ address: "0x...", price: number }, ...]
```
Find the entry matching `exTokenAddress`. Then: `collateral = parseUnits(amount × pricePerTokenUsd / exTokenPrice, exTokenDecimals)`.

---

### 3. `settleOrder` — Token Decimals

**Frontend behavior:**
- Calls `token.decimals()` on the settlement token contract dynamically before approval

**CLI behavior:**
- Accepts `--token-decimals` flag (defaults to 6); no on-chain lookup

**Gap:** If the settlement token has non-standard decimals (e.g. 18 for WETH), the CLI computes the wrong raw amount.

**API calls needed:** None — requires an on-chain RPC call (`contract.decimals()`). No external API involved.

---

### 4. `settleOrder` — Settlement Token Approval

**Status:** ✓ No gap — `EvmPreMarket.settleOrder()` calls `ensureApproval` correctly.

---

### 5. `closeOffer` — Referral Chain Params

**Status:** ✓ No gap — `EvmPreMarket.closeOffer()` checks `this.isReferral` and branches correctly.

---

### 6. USDT Double-Approval

**Status:** ✓ No gap — `ensureApproval()` resets to 0 for USDT before setting new allowance.

---

### 7. ETH vs ERC20 Path

**Status:** ✓ No gap — `createOffer()` and `fillOffer()` check `exTokenAddress === ETH_ADDRESS`.

---

## Solana Gaps

### 8. Missing Compute Unit Simulation

**Frontend behavior:**
1. Simulates the transaction to estimate compute units
2. Adds 25% buffer: `CU = Math.ceil(simulated × 1.25)`
3. Prepends `ComputeBudgetProgram.setComputeUnitLimit({ units: CU })` instruction

**CLI behavior:**
- Sends transactions without CU estimation or budget instructions

**Gap:** Without explicit CU limits, Solana defaults to 200,000 CU — insufficient for settle/OTC fill. Causes `exceeded compute budget` errors.

**API calls needed:** None — pure on-chain simulation via `connection.simulateTransaction(tx)`.

---

### 9. Missing Retry Logic

**Frontend behavior:**
- Retry loop: 10 attempts, 1500ms delay
- Retries on network timeouts, blockhash expiry, etc.

**CLI behavior:**
- Single attempt; no retry

**Gap:** Solana transactions fail transiently without retries.

**API calls needed:** None — pure client-side retry logic.

---

### 10. `settleOrder` with Discount — API Transaction Build

**Frontend behavior:**
- Calls API to get a pre-built, partially-signed serialized transaction
- Deserializes base64 → `VersionedTransaction`, signs, submits

**CLI behavior:**
- Implementation uncertain; may call SDK directly (incorrect)

**Gap:** Discount settle **must** use the API-built transaction (backend injects discount data server-side).

**API calls needed:**
```
POST /transactions/build-transaction-settle-with-discount
Body:  { "orderId": <order_index: number>, "feePayer": "<base58_wallet_address>" }

Response: { "data": "<base64_encoded_versioned_transaction>" }
```
Then: `VersionedTransaction.deserialize(Buffer.from(data, 'base64'))` → sign with keypair → `connection.sendRawTransaction`.

---

### 11. `cancelOrder` with Discount — API Transaction Build

**Frontend behavior:**
- Same pattern as settle with discount

**CLI behavior:**
- Same uncertainty as #10

**Gap:** Must use API-built transaction for the discount cancel path.

**API calls needed:**
```
POST /transactions/build-transaction-cancel-with-discount
Body:  { "orderId": <order_index: number>, "feePayer": "<base58_wallet_address>" }

Response: { "data": "<base64_encoded_versioned_transaction>" }
```

---

### 12. Native SOL Wrapping

**Frontend behavior:**
- Uses `buildWrapSolInstructions` to wrap native SOL → wSOL before creating/filling SOL-collateral offers

**CLI behavior:**
- Not confirmed if auto-wrapping is handled in SDK or CLI layer

**Gap (potential):** SOL offers will fail if user has native SOL but no wSOL balance.

**API calls needed:** None — on-chain instruction only (`createSyncNativeInstruction` from `@solana/spl-token`).

---

## Sui Gaps

### 13. `settleOrderWithDiscount` — Not Implemented

**Frontend behavior:**
- Calls API to get discount signature + data, builds a PTB with it

**CLI behavior:**
- Not implemented

**Gap:** Discount settle for Sui requires a specific API endpoint.

**API calls needed:**
```
POST /transactions/build-settle-discount-signature-sui
Body:  { "orderId": "<order_uuid>" }

Response: { "data": { "settleDiscount": { /* discount fields */ } } }
```
The response data is passed into the Sui PTB builder to construct the settlement transaction.

---

### 14. `cancelOrderWithDiscount` — Not Implemented

**Frontend behavior:**
- Calls API to get discount signature + `custom_index` for cancel, builds PTB

**CLI behavior:**
- Not implemented

**Gap:** Same pattern as #13.

**API calls needed:**
```
POST /transactions/build-cancel-discount-signature-sui
Body:  { "orderId": "<order_uuid>" }

Response: {
  "data": {
    "order": { "custom_index": "string" },
    "settleDiscount": { /* discount fields */ }
  }
}
```

---

### 15. `customIndex` (Sui Config Object ID)

**Frontend behavior:**
- Passes `customIndex` (Sui config object ID) as required param to all PTB calls

**CLI behavior:**
- `SuiPreMarket` constructor — verify it reads `customIndex` correctly from constants

**Gap (potential):** If `customIndex` is wrong or missing, all Sui transactions will fail.

**API calls needed:** None — must be verified against the live Sui contract deployment config and hardcoded in `src/blockchain/sui/constants.ts`.

---

## Aptos Gaps

### 16. Settle/Cancel with Discount — Acceptable Non-Implementation

**Status:** ✓ No gap — frontend throws `"Discount not supported on Aptos"`. CLI can do the same.

---

### 17. Coin vs Fungible Asset Entry Functions

**Frontend behavior:**
- `create_offer_with_coin` for Coin-based tokens (type starts with `0x1::`)
- `create_offer` for Fungible Asset tokens

**CLI behavior:**
- Unclear if the distinction is handled in `AptosPreMarket`

**Gap (potential):** Wrong entry function = contract error at runtime.

**API calls needed:** None — detection is based on the `exToken` type string format.

---

## OTC EVM Gaps

### 18. `createOffer` — Buyer Ownership Check

**Frontend behavior:**
- Reads `orderData` from contract; verifies `orderData.buyer === wallet.address`
- Throws if caller is not the buyer

**CLI behavior:**
- No ownership pre-check; proceeds directly to signing + contract call

**Gap:** User wastes gas attempting OTC on an order they don't own.

**API calls needed:** None — requires an on-chain read (`contract.orders(orderId)`).

---

### 19. `createOffer` — Message Signing (EIP-191)

**Frontend behavior:**
1. Computes `signatureDeadline = Math.floor(Date.now() / 1000) + 3600`
2. Signs: `ethers.solidityPackedKeccak256(['address','uint256','address','bool','uint256','uint256','address'], [preMarketAddr, orderId, otcAddr, true, signatureDeadline, chainId, otcAddr])`
3. Calls: `contract.createOffer(orderId, exToken, value, offerDeadline, signatureDeadline, signature)`

**CLI behavior:**
- No signing logic; no `signatureDeadline`
- `otc create` calls `otc.createOffer({ orderId, exToken, value, deadline })` — missing `signatureDeadline` and `signature`

**Gap:** OTC `createOffer` always reverts without the signed message. **Critical — blocks OTC entirely.**

**API calls needed:** None — pure client-side signing with `signer.signMessage(hash)`.

---

### 20. `fillOffer` — Pre-fetch Offer Data for Approval

**Frontend behavior:**
- Reads `offerData = await contract.offers(offerId)` from chain
- Extracts `exToken` and `value`
- Calls `ensureApproval(exToken, value)` before filling

**CLI behavior:**
- Passes `offerId` string directly; no pre-fetch, no approval

**Gap:** Fill reverts if ERC20 allowance is insufficient.

**API calls needed:** None — on-chain read only.

---

### 21. `fillOffer` with Discount (Referral Chains) — `encodeResellData`

**Frontend behavior:**
- Referral chains: fetches discount data from API, encodes with `encodeResellData(...)`, calls `fillOffer(offerId, encodedData, fundDistributor)`
- Non-referral: calls `fillOffer(offerId)` directly

**CLI behavior:**
- `otc fill --with-discount` calls `fillOfferWithDiscount({ offerId, offerUUID })` — unclear if referral encoding is handled

**Gap (potential):** Referral chain OTC fill discount may not encode data correctly.

**API calls needed:**
```
POST /transactions/build-txf-fill-resell-with-discount-evm
Body:  { "offerId": "<offer_uuid>", "sender": "<0x_wallet_address>" }

Response: {
  "data": {
    "buyerDiscount": number,
    "signature": "0x...",
    "buyerReferrer": "0x...",
    "buyerReferralPercent": number
  }
}
```
Response is passed to `encodeResellData(...)` then `fillOffer(offerId, encodedData, fundDistributor)`.

---

## OTC Solana Gaps

### 22. `fillOffer` — Accepts PDA PublicKey

**Status:** ✓ No gap — CLI uses `new PublicKey(otcOfferIdArg)` correctly.

---

## API Endpoints Reference

All endpoints relative to base URL (default: `https://api.whales.market`).

| Endpoint | Method | Used By | Purpose |
|----------|--------|---------|---------|
| `/network-chains/v2/price?chainId={id}&currency=usd` | GET | All chains, createOffer/fillOffer | Get exToken USD price for collateral computation and $10 minimum check |
| `/transactions/build-transaction-settle-with-discount` | POST | Solana, settleWithDiscount | Get pre-built base64 serialized tx with discount injected |
| `/transactions/build-transaction-cancel-with-discount` | POST | Solana, cancelWithDiscount | Get pre-built base64 serialized tx with discount injected |
| `/transactions/v2/build-transaction-settle-with-discount-evm` | POST | EVM referral, settleWithDiscount | Get discount+referral signature data |
| `/transactions/build-transaction-settle-with-discount-evm` | POST | EVM non-referral, settleWithDiscount | Get discount signature data |
| `/transactions/v2/build-transaction-cancel-with-discount-evm` | POST | EVM referral, cancelWithDiscount | Get discount+referral signature data |
| `/transactions/build-transaction-cancel-with-discount-evm` | POST | EVM non-referral, cancelWithDiscount | Get discount signature data |
| `/transactions/build-settle-discount-signature-sui` | POST | Sui, settleWithDiscount | Get discount signature + data for PTB |
| `/transactions/build-cancel-discount-signature-sui` | POST | Sui, cancelWithDiscount | Get discount signature + custom_index for PTB |
| `/transactions/build-txf-fill-resell-with-discount-evm` | POST | OTC EVM, fillWithDiscount | Get buyer discount + referral data for resell fill |

### Payload / Response Shapes

**`GET /network-chains/v2/price`**
```json
// Response
[{ "address": "0xTokenAddress", "price": 1.0001 }]
```

**`POST /transactions/build-transaction-settle-with-discount` (Solana)**
```json
// Request
{ "orderId": 42, "feePayer": "base58WalletAddress" }
// Response
{ "data": "base64EncodedVersionedTransaction" }
```

**`POST /transactions/build-transaction-cancel-with-discount` (Solana)**
```json
// Request
{ "orderId": 42, "feePayer": "base58WalletAddress" }
// Response
{ "data": "base64EncodedVersionedTransaction" }
```

**`POST /transactions/v2/build-transaction-settle-with-discount-evm` (EVM referral)**
```json
// Request
{ "orderId": "order-uuid", "sender": "0xWalletAddress" }
// Response
{ "data": { "sellerDiscount": 0, "buyerDiscount": 0, "sellerReferrer": "0x...", "buyerReferrer": "0x...", "sellerReferralPercent": 0, "buyerReferralPercent": 0, "signature": "0x..." } }
```

**`POST /transactions/build-settle-discount-signature-sui`**
```json
// Request
{ "orderId": "order-uuid" }
// Response
{ "data": { "settleDiscount": { /* discount fields */ } } }
```

**`POST /transactions/build-cancel-discount-signature-sui`**
```json
// Request
{ "orderId": "order-uuid" }
// Response
{ "data": { "order": { "custom_index": "string" }, "settleDiscount": { /* discount fields */ } } }
```

**`POST /transactions/build-txf-fill-resell-with-discount-evm`**
```json
// Request
{ "offerId": "offer-uuid", "sender": "0xWalletAddress" }
// Response
{ "data": { "buyerDiscount": 0, "signature": "0x...", "buyerReferrer": "0x...", "buyerReferralPercent": 0 } }
```

---

## Summary Table

| # | Chain | Function | Gap Severity | API Required |
|---|-------|----------|-------------|--------------|
| 1 | All | `createOffer`/`fillOffer` — min $10 USD | High | `GET /network-chains/v2/price` |
| 2 | EVM | `createOffer` collateral computation | Medium | `GET /network-chains/v2/price` |
| 3 | EVM | `settleOrder` token decimals | Medium | None (on-chain RPC) |
| 8 | Solana | All txs — compute unit simulation | High | None (on-chain simulate) |
| 9 | Solana | All txs — retry logic | High | None |
| 10 | Solana | `settleOrder` w/ discount | High | `POST /transactions/build-transaction-settle-with-discount` |
| 11 | Solana | `cancelOrder` w/ discount | High | `POST /transactions/build-transaction-cancel-with-discount` |
| 12 | Solana | Native SOL wrapping | Medium | None (on-chain instruction) |
| 13 | Sui | `settleOrder` w/ discount | Medium | `POST /transactions/build-settle-discount-signature-sui` |
| 14 | Sui | `cancelOrder` w/ discount | Medium | `POST /transactions/build-cancel-discount-signature-sui` |
| 15 | Sui | `customIndex` verification | High | None (constants audit) |
| 17 | Aptos | Coin vs FA entry function | High | None (type string check) |
| 18 | OTC EVM | `createOffer` buyer check | Low | None (on-chain RPC) |
| 19 | OTC EVM | `createOffer` message signing | **Critical** | None (client-side sign) |
| 20 | OTC EVM | `fillOffer` ERC20 pre-approval | High | None (on-chain RPC) |
| 21 | OTC EVM | `fillOffer` referral encoding | Medium | `POST /transactions/build-txf-fill-resell-with-discount-evm` |

---

## Implementation Priority

### Phase 1 — Critical (blocks correct operation)
1. **OTC EVM `createOffer` signing** (#19): Without the signed message, OTC create always reverts. No API needed — pure client-side `signMessage`.
2. **Solana compute units + retry** (#8, #9): Transactions fail intermittently without CU budget + retry.
3. **Solana discount settle/cancel via API tx** (#10, #11): Must use API-built base64 transactions.

### Phase 2 — High (correctness issues)
4. **Minimum $10 USD collateral check** (#1): Requires `GET /network-chains/v2/price` to compute USD value.
5. **OTC EVM `fillOffer` ERC20 pre-approval** (#20): On-chain offer read + `ensureApproval` before fill.
6. **Aptos Coin vs FA entry function** (#17): Type string detection, no API needed.
7. **Sui `customIndex` verification** (#15): Audit constants against live deployment.

### Phase 3 — Medium (UX / completeness)
8. **EVM `settleOrder` dynamic decimals** (#3): On-chain `token.decimals()` call.
9. **Solana SOL wrapping** (#12): Add `buildWrapSolInstructions` for native SOL.
10. **Sui discount settle/cancel** (#13, #14): Implement API-based PTB flow.
11. **OTC EVM referral fill discount encoding** (#21): Implement `encodeResellData` + API call.
12. **EVM `createOffer` collateral computation helper** (#2): Fetch `GET /network-chains/v2/price`, compute collateral automatically.

---

## Reference Files

- Frontend contracts: `/ref/whales-market-frontend-v2/src/contracts/`
  - `evm/PreMarket.ts` — EVM offer/order/settle logic
  - `evm/OtcPreMarket.ts` — OTC EVM with signing and `encodeResellData`
  - `solana/PreMarket.ts` — Solana with CU simulation + retry + base64 tx handling
  - `sui/PreMarket.ts` — Sui PTB construction with discount API
  - `aptos/PreMarket.ts` — Aptos Coin vs FA entry function detection
- Frontend constants: `/ref/whales-market-frontend-v2/src/constants/global.ts` — `MIN_COLLATERAL = 10` USD
- CLI contracts: `src/blockchain/*/contracts/` and `src/blockchain/*/programs/`
- CLI commands: `src/commands/trade.ts`, `src/commands/otc.ts`
