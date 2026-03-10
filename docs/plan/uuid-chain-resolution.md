# Plan: UUID-Based Chain + On-chain ID Resolution

**Status:** ✅ Complete
**Priority:** High
**Files:** `src/commands/trade.ts`, `src/commands/otc.ts`, `src/api.ts`

---

## Problem

Currently every command requires an explicit `--chain-id` flag. When a UUID is passed as argument (offer ID, order ID, OTC offer ID, token ID), the CLI should auto-resolve both the chain ID **and** the on-chain ID from the API — no `--chain-id` needed.

Current issues per command:

| Command | Arg type | Problem |
|---------|---------|---------|
| `trade fill-offer` | offer UUID | `resolveOfferId` needs `chainId` as input |
| `trade close-offer` | offer UUID | same |
| `trade settle` | order UUID | no UUID→onChainId resolution at all; `--order-uuid` is a separate flag |
| `trade claim-collateral` | order UUID | same |
| `trade create-offer --token` | token UUID | still works but `--chain-id` required |
| `otc create` | order UUID | no UUID→onChainId resolution; chainId defaulted |
| `otc fill` | OTC offer UUID | no resolution; chainId defaulted; `--offer-uuid` separate flag |
| `otc cancel` | OTC offer UUID | no resolution |

---

## API Endpoints & Response Fields

### `GET /transactions/offers/{uuid}` — for offers and OTC offers

```
Response.data:
{
  offer_index:          number        // pre-market on-chain index (EVM/Solana)
  exit_position_index:  string        // OTC offer on-chain index (EVM numeric / Solana base58 PDA)
  custom_index:         string | null // Sui on-chain offer ID
  network: {
    chain_id:           number        // e.g. 1, 8453, 666666, 900000
  }
}
```

### `GET /transactions/orders/{uuid}` — for orders

```
Response.data:
{
  order_index:          number        // on-chain order index (EVM/Solana)
  custom_index:         string | null // Sui on-chain order ID
  chain_id:             number        // top-level field (also in network.chain_id)
}
```

### `GET /v2/tokens?ids={uuid}&chain_id={n}` — for tokens

```
Response.data.list[0]:
{
  token_id:   string     // on-chain token ID
  chain_id:   number[]   // array — token exists on multiple chains
}
```
Token is multi-chain → `--chain-id` still required. `resolveTokenId` unchanged.

---

## New Helper Functions (add to `trade.ts`)

### 1. `getOptionalChainIdFromOpts(command)`

```typescript
// Returns undefined if --chain-id was not explicitly set
function getOptionalChainIdFromOpts(command: Command): number | undefined {
  const chainId = command.optsWithGlobals().chainId;
  if (chainId == null) return undefined;
  return typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
}
```

### 2. `resolveOffer(uuid)` — replaces `resolveOfferId`

```typescript
// Returns chainId + on-chain offer ID from GET /transactions/offers/{uuid}
async function resolveOffer(uuid: string): Promise<{
  chainId: number;
  offerIndex: string;  // offer_index as string (EVM/Solana numeric)
  customIndex: string | null;  // Sui on-chain ID
}> {
  const res = await apiClient.getOffer(uuid);
  const o = (res as any)?.data ?? res;
  const chainId = o?.network?.chain_id;
  const offerIndex = o?.offer_index;
  const customIndex = o?.custom_index ?? null;
  if (!chainId) throw new Error(`Offer ${uuid}: missing network.chain_id in API response`);
  if (offerIndex == null) throw new Error(`Offer ${uuid}: missing offer_index in API response`);
  return { chainId, offerIndex: String(offerIndex), customIndex };
}
```

### 3. `resolveOtcOffer(uuid)` — for `otc fill` / `otc cancel`

```typescript
// Returns chainId + on-chain OTC offer ID (exit_position_index)
async function resolveOtcOffer(uuid: string): Promise<{
  chainId: number;
  exitPositionIndex: string;  // numeric string (EVM) or base58 PDA (Solana)
}> {
  const res = await apiClient.getOffer(uuid);
  const o = (res as any)?.data ?? res;
  const chainId = o?.network?.chain_id;
  const exitPositionIndex = o?.exit_position_index;
  if (!chainId) throw new Error(`OTC offer ${uuid}: missing network.chain_id in API response`);
  if (!exitPositionIndex) throw new Error(`OTC offer ${uuid}: missing exit_position_index in API response`);
  return { chainId, exitPositionIndex: String(exitPositionIndex) };
}
```

### 4. `resolveOrder(uuid)` — for `settle`, `claim-collateral`, `otc create`

```typescript
// Returns chainId + on-chain order ID from GET /transactions/orders/{uuid}
async function resolveOrder(uuid: string): Promise<{
  chainId: number;
  orderIndex: string;          // numeric string (EVM/Solana)
  customIndex: string | null;  // Sui on-chain ID
}> {
  const res = await apiClient.getOrder(uuid);
  const o = (res as any)?.data ?? res;
  const chainId = o?.chain_id ?? o?.network?.chain_id;
  const orderIndex = o?.order_index;
  const customIndex = o?.custom_index ?? null;
  if (!chainId) throw new Error(`Order ${uuid}: missing chain_id in API response`);
  if (orderIndex == null) throw new Error(`Order ${uuid}: missing order_index in API response`);
  return { chainId, orderIndex: String(orderIndex), customIndex };
}
```

---

## Changes to `trade.ts`

### Remove `resolveOfferId` — replaced by `resolveOffer`

**Delete lines 48–60** (current `resolveOfferId` function).

---

### `trade fill-offer <offer-id>`

**Current (lines 239–252):**
```typescript
const chainId = getChainIdFromOpts(command);          // requires --chain-id
// ...
const resolvedId = await resolveOfferId(chainId, offerIdArg, apiUrlOverride); // needs chainId as input
const preMarket = getPreMarket(chainId, mnemonic, apiUrl);
const offerId = parseOfferId(chainId, resolvedId);
```

**New:**
```typescript
let chainId = getOptionalChainIdFromOpts(command);
let offerOnChainId: string;
let offerCustomIndex: string | null = null;

if (UUID_REGEX.test(offerIdArg.trim())) {
  const resolved = await resolveOffer(offerIdArg);
  chainId = chainId ?? resolved.chainId;     // --chain-id overrides if provided
  offerOnChainId = resolved.offerIndex;
  offerCustomIndex = resolved.customIndex;
} else {
  chainId = chainId ?? 666666;
  offerOnChainId = offerIdArg;
}

const preMarket = getPreMarket(chainId, mnemonic, apiUrl);

// On-chain ID: customIndex for Sui/Aptos, numeric for EVM/Solana
const offerId = isSuiChain(chainId) || isAptosChain(chainId)
  ? (offerCustomIndex ?? offerOnChainId)
  : parseOfferId(chainId, offerOnChainId);
```

**Also remove** the unused `apiUrlOverride` variable and the second `getOffer` call that was fallback for exToken (already fetched from on-chain offer).

---

### `trade close-offer <offer-id>`

Same pattern as fill-offer — same 4-line replacement in `closeOfferAction`.

**Current:**
```typescript
const chainId = getChainIdFromOpts(command);
// ...
const resolvedId = await resolveOfferId(chainId, offerIdArg, apiUrlOverride);
const preMarket = getPreMarket(chainId, mnemonic, apiUrl);
const offerId = parseOfferId(chainId, resolvedId);
```

**New:** Same as fill-offer pattern above.

---

### `trade settle <order-id>`

**Current:**
```typescript
const chainId = getChainIdFromOpts(command);       // requires --chain-id
// ...
const orderId = parseOrderId(chainId, orderIdArg); // parseInt on UUID → NaN for EVM/Solana!
// ...
if (options.withDiscount && options.orderUuid) {   // --order-uuid must be separate flag
  // uses options.orderUuid for discount API call
}
```

**New:**
```typescript
let chainId = getOptionalChainIdFromOpts(command);
let orderOnChainId: string;
let orderCustomIndex: string | null = null;
let orderUUID: string | undefined = options.orderUuid;

if (UUID_REGEX.test(orderIdArg.trim())) {
  const resolved = await resolveOrder(orderIdArg);
  chainId = chainId ?? resolved.chainId;
  orderOnChainId = resolved.orderIndex;
  orderCustomIndex = resolved.customIndex;
  orderUUID = orderUUID ?? orderIdArg;  // UUID arg IS the order UUID for discount
} else {
  chainId = chainId ?? 666666;
  orderOnChainId = orderIdArg;
}

const preMarket = getPreMarket(chainId, mnemonic, apiUrl);

// On-chain ID per chain type
const orderId = isSuiChain(chainId) || isAptosChain(chainId)
  ? (orderCustomIndex ?? orderOnChainId)
  : parseOrderId(chainId, orderOnChainId);
```

**Then replace all `options.orderUuid` references with `orderUUID`** (which is auto-populated from arg when UUID).

Result: `--order-uuid` flag becomes optional — if `<order-id>` is a UUID, it's auto-used.

---

### `trade claim-collateral <order-id>`

**Same pattern as `settle`** — same 4-variable block + replace `options.orderUuid` with `orderUUID`.

---

## Changes to `otc.ts`

Must add to imports:
```typescript
import { apiClient } from '../api';
```

And add UUID_REGEX + the resolver functions (or import from a shared helper file).

---

### `otc create <order-id>`

**Current:**
```typescript
const chainId = getChainIdFromOpts(command);
// ...
const orderId = parseOrderId(chainId, orderIdArg) as number;
```

**New:**
```typescript
let chainId = getOptionalChainIdFromOpts(command);
let orderOnChainId: string;

if (UUID_REGEX.test(orderIdArg.trim())) {
  const resolved = await resolveOrder(orderIdArg);
  chainId = chainId ?? resolved.chainId;
  orderOnChainId = resolved.orderIndex;
} else {
  chainId = chainId ?? 666666;
  orderOnChainId = orderIdArg;
}

const orderId = parseInt(orderOnChainId, 10);
if (isNaN(orderId)) throw new Error(`Invalid order ID: ${orderOnChainId}`);
```

Remove the validation at line 73 that checks for EVM format ex-token — since chainId is now auto-resolved, the check makes no sense.

---

### `otc fill <otc-offer-id>`

**Current:**
```typescript
const chainId = getChainIdFromOpts(command);
// ...
if (isEvmChain(chainId)) {
  const offerId = otcOfferIdArg;   // used directly — no UUID resolution!
  if (options.withDiscount && options.offerUuid) {
    tx = await (otc as any).fillOfferWithDiscount({
      offerId,
      offerUUID: options.offerUuid,   // separate flag required
    });
  } else {
    tx = await (otc as any).fillOffer(offerId);
  }
} else if (isSolanaChain(chainId)) {
  const otcOfferPubkey = new PublicKey(otcOfferIdArg);  // used directly — no UUID resolution!
```

**New:**
```typescript
let chainId = getOptionalChainIdFromOpts(command);
let otcOnChainId: string;
let offerUUID: string | undefined = options.offerUuid;

if (UUID_REGEX.test(otcOfferIdArg.trim())) {
  const resolved = await resolveOtcOffer(otcOfferIdArg);
  chainId = chainId ?? resolved.chainId;
  otcOnChainId = resolved.exitPositionIndex;
  offerUUID = offerUUID ?? otcOfferIdArg;  // UUID arg IS the offer UUID for discount
} else {
  chainId = chainId ?? 666666;
  otcOnChainId = otcOfferIdArg;
}

const otc = getOtcPreMarket(chainId, mnemonic, apiUrl);

if (isEvmChain(chainId)) {
  const offerId = otcOnChainId;   // resolved exit_position_index
  if (options.withDiscount && offerUUID) {
    tx = await (otc as any).fillOfferWithDiscount({ offerId, offerUUID });
  } else {
    tx = await (otc as any).fillOffer(offerId);
  }
} else if (isSolanaChain(chainId)) {
  const otcOfferPubkey = new PublicKey(otcOnChainId);   // resolved PDA address
```

Result: `--offer-uuid` flag is optional — if `<otc-offer-id>` is a UUID, it's auto-used.

---

### `otc cancel <otc-offer-id>`

**Current:**
```typescript
const chainId = getChainIdFromOpts(command);
// ...
if (isEvmChain(chainId)) {
  const tx = await (otc as any).cancelOffer(otcOfferIdArg);   // no resolution
} else if (isSolanaChain(chainId)) {
  const otcOfferPubkey = new PublicKey(otcOfferIdArg);        // no resolution
```

**New:**
```typescript
let chainId = getOptionalChainIdFromOpts(command);
let otcOnChainId: string;

if (UUID_REGEX.test(otcOfferIdArg.trim())) {
  const resolved = await resolveOtcOffer(otcOfferIdArg);
  chainId = chainId ?? resolved.chainId;
  otcOnChainId = resolved.exitPositionIndex;
} else {
  chainId = chainId ?? 666666;
  otcOnChainId = otcOfferIdArg;
}

const otc = getOtcPreMarket(chainId, mnemonic, apiUrl);

if (isEvmChain(chainId)) {
  tx = await (otc as any).cancelOffer(otcOnChainId);
} else if (isSolanaChain(chainId)) {
  const otcOfferPubkey = new PublicKey(otcOnChainId);
```

---

## Shared Code Location

All resolver functions live in `src/commands/helpers/resolve.ts`:
- `UUID_REGEX`
- `getOptionalChainIdFromOpts`
- `resolveOffer`
- `resolveOtcOffer`
- `resolveOrder`
- `resolveToken`

---

## Flag Changes Summary

| Flag | Before | After |
|------|--------|-------|
| `--chain-id` | Required for all commands | Optional when UUID provided |
| `trade settle --order-uuid` | Required for `--with-discount` | Optional — auto from `<order-id>` if UUID |
| `trade claim-collateral --order-uuid` | Required for `--with-discount` | Optional — auto from `<order-id>` if UUID |
| `otc fill --offer-uuid` | Required for `--with-discount` | Optional — auto from `<otc-offer-id>` if UUID |

Flags are kept for backwards compatibility — explicit values still override auto-resolution.

---

## `create-offer` Token Resolution

`resolveToken(uuid)` — replaces `resolveTokenId(chainId, tokenArg)`:

```typescript
// Returns chainId (first from chain_id[]) + on-chain token ID from GET /v2/tokens?ids={uuid}
async function resolveToken(uuid: string): Promise<{
  chainId: number;
  tokenId: string;
}>
```

- No `chainId` input needed — chainId comes from `token.chain_id[0]` in the API response
- `--chain-id` flag still overrides the auto-resolved value (for multi-chain tokens where user wants a specific chain)
- Resolution happens **before** the `$10 check` and confirm prompt (since `chainId` is needed there)

| Flag | Before | After |
|------|--------|-------|
| `--token <uuid>` + `--chain-id` | Both required | `--chain-id` optional; auto-resolved from token's first chain |

---

## Implementation Order (completed ✅)

1. ✅ Create `src/commands/helpers/resolve.ts` with `UUID_REGEX`, `getOptionalChainIdFromOpts`, `resolveOffer`, `resolveOtcOffer`, `resolveOrder`, `resolveToken`
2. ✅ Update `trade.ts`: remove `resolveOfferId` + `resolveTokenId` + `getChainIdFromOpts`; update `create-offer`, `fill-offer`, `close-offer`, `settle`, `claim-collateral`
3. ✅ Update `otc.ts`: import from `helpers/resolve.ts`; remove `getChainIdFromOpts`; update `create`, `fill`, `cancel`
4. ✅ `npx tsc --noEmit` — clean

---

## Before / After Usage Examples

```bash
# BEFORE (chain-id required)
whales trade fill-offer 1234 --chain-id 8453
whales trade settle 5678 --chain-id 666666 --with-discount --order-uuid abc-def-...
whales otc fill abc-def-... --chain-id 1 --offer-uuid abc-def-...
whales otc cancel abc-def-... --chain-id 1

# AFTER (UUID auto-resolves everything)
whales trade fill-offer 655a45ba-2688-425c-9f85-4ff5ae45a83a
whales trade settle a4a9976c-3ada-4000-bde7-669c17528447 --with-discount
whales otc fill 7f3a1bc2-dead-beef-cafe-000000000001
whales otc cancel 7f3a1bc2-dead-beef-cafe-000000000001

# Non-UUID: --chain-id REQUIRED — error thrown if missing
whales trade fill-offer 1234 --chain-id 8453
whales trade fill-offer 1234
# → Error: --chain-id is required when passing an on-chain ID (use a UUID to auto-resolve chain and ID)
```
