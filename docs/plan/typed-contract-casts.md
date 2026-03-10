# Plan: Replace `as any` Contract Casts with Typed Classes

**Status:** ✅ Complete

---

## Problem

`trade.ts` and `otc.ts` used `(preMarket as any).method()` and `(otc as any).method()` throughout all chain branches. This suppresses TypeScript type-checking and hides interface mismatches.

---

## Solution

Import concrete contract classes and cast to them within each chain branch.

### Imports added

**`trade.ts`:**
```typescript
import { EvmPreMarket, SolanaPreMarket, SuiPreMarket, AptosPreMarket } from '../blockchain';
```

**`otc.ts`:**
```typescript
import { EvmPreMarket, SolanaPreMarket, EvmOtcPreMarket, SolanaOtcPreMarket } from '../blockchain';
```

### Pattern

Each `if (isEvmChain)` / `isSolanaChain` / `isSuiChain` / `isAptosChain` block introduces a typed local variable:

```typescript
if (isEvmChain(chainId)) {
  const pm = preMarket as EvmPreMarket;
  // pm.createOffer(...), pm.fillOffer(...), etc.
} else if (isSolanaChain(chainId)) {
  const pm = preMarket as SolanaPreMarket;
  // ...
} else if (isSuiChain(chainId)) {
  const pm = preMarket as SuiPreMarket;
  // ...
} else if (isAptosChain(chainId)) {
  const pm = preMarket as AptosPreMarket;
  // ...
}
```

For single-line branches (`close-offer`), inline cast is used:
```typescript
tx = await (preMarket as EvmPreMarket).closeOffer(offerId as number);
```

For `otc.ts`, both `preMarket` and `otc` are typed per branch:
```typescript
const pm = preMarket as EvmPreMarket;     // for getOrder, getTokenDecimals
const evmOtc = otc as EvmOtcPreMarket;   // for createOffer, fillOffer, cancelOffer
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/commands/trade.ts` | Added imports; typed all 5 commands × 4 chains |
| `src/commands/otc.ts` | Added imports; typed all 3 commands × 2 chains |

Also fixed 2 missed `chainId = chainId ?? 666666` instances (create-offer else branch, close-offer else branch) → now throw an error like the others.

---

## Result

- `(preMarket as any)` occurrences: **0** (was 30+)
- `(otc as any)` occurrences: **0** (was 10+)
- `npx tsc --noEmit`: **clean**
