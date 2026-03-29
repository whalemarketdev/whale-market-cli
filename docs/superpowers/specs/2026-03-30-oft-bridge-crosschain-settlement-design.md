# OFT Bridge for Cross-Chain Pre-Market Settlement — Design Spec

**Date:** 2026-03-30
**Status:** Approved

---

## Background

Some tokens trade pre-market on one EVM chain (e.g. BSC) but officially launch on another (e.g. Ethereum). At settlement, the seller must deliver the token. Because the pre-market contract on BSC only accepts tokens on BSC, the seller must first bridge their origin token to its OFT-wrapped equivalent on BSC using LayerZero OFT before settling.

After settlement, the buyer automatically receives OFT tokens on the trading chain. They can bridge them back to the origin chain whenever they choose — no automatic prompting.

This feature is **EVM-only**. Solana, Sui, Aptos are out of scope.

---

## Token API Fields

The API returns these fields on a token when OFT bridging applies:

| Field | Meaning |
|---|---|
| `tge_oft_address` | OFT token address on the trading chain (e.g. BSC) |
| `tge_network_id` | Chain ID of the origin token (e.g. 1 for Ethereum) |
| `tge_adapter_address` | `MyOFTAdapter` address on origin chain (ERC-20 tokens) |
| `tge_native_adapter_address` | `MyOFTAdapter` address on origin chain (native tokens) |
| `tge_token_address` | Original ERC-20 token address on origin chain |

A token requires bridging when `tge_oft_address` is non-empty.
`isNative = !tge_adapter_address && !!tge_native_adapter_address`

---

## User Flows

### Seller — settle with OFT bridge

1. Seller runs `whales trade settle <order-uuid>`
2. CLI detects `tge_oft_address` on the token
3. CLI checks seller's OFT balance on trading chain
4. **If balance is sufficient:** proceed to settle using `tge_oft_address` as the token address
5. **If balance is insufficient:**
   - Print a table showing OFT balance, required amount, and origin token balance
   - Prompt: "Insufficient OFT tokens. Bridge from [origin chain] now?"
   - If **no**: print hint `whales bridge to-oft --token-uuid <uuid>` and exit
   - If **yes**: execute bridge, wait for LayerZero delivery, then continue to settle

### Buyer — bridge OFT back to origin (manual)

1. Buyer runs `whales bridge to-origin --token-uuid <uuid>` (or explicit flags)
2. No automatic prompting — purely on-demand

---

## Architecture

### `OFTBridge` class

**File:** `src/blockchain/evm/contracts/OFTBridge.ts`

Single class that encapsulates all bridge operations. Takes two providers because two chains are involved simultaneously.

```typescript
new OFTBridge({
  originProvider,         // JsonRpcProvider for tge_network_id chain
  tradingProvider,        // JsonRpcProvider for trading chain
  signer,                 // HD wallet derived from mnemonic
  oftAdapterAddress,      // tge_adapter_address or tge_native_adapter_address
  oftAddress,             // tge_oft_address
  originTokenAddress,     // tge_token_address (null if native)
  originChainId,          // tge_network_id
  tradingChainId,         // pre-market contract chain
  isNative,               // true if origin token is a native coin
})
```

**Public methods:**

| Method | Description |
|---|---|
| `bridgeToOFT(amount?: bigint)` | Lock origin token via MyOFTAdapter → mint OFT on trading chain |
| `bridgeToOrigin(amount?: bigint)` | Burn OFT via MyOFT → unlock origin token |
| `quoteBridgeToOFT(amount: bigint)` | Fee estimate (nativeFee) without executing |
| `quoteBridgeToOrigin(amount: bigint)` | Fee estimate without executing |
| `getOFTBalance(address)` | OFT token balance on trading chain |
| `getOriginTokenBalance(address)` | Origin token balance on origin chain |

**Internal flow for `bridgeToOFT`:**
1. Get token decimals
2. Check origin token balance ≥ amount
3. Check native balance ≥ LayerZero fee (+ amount if native token)
4. If ERC-20: approve MyOFTAdapter if allowance insufficient
5. Build `SendParam`: `{ dstEid, to: zeroPad(recipient, 32), amountLD, minAmountLD, extraOptions, composeMsg: "0x", oftCmd: "0x" }`
6. Call `quoteSend` on MyOFTAdapter → get `nativeFee`
7. Call `MyOFTAdapter.send(sendParam, { nativeFee, lzTokenFee: 0 }, refundAddress, { value })`
8. Return `{ txHash }`

`bridgeToOrigin` is the same but uses `MyOFT` directly (no approval needed).

**Factory function** in `src/commands/helpers/chain.ts`:

```typescript
getOFTBridge(token: Token, mnemonic: string): OFTBridge
```

Follows the same pattern as existing `getPreMarket()`.

---

### `settle` command changes

**File:** `src/commands/trade.ts`

Insert OFT pre-flight check after order resolution, EVM-only:

```
if isEvmChain AND token.tge_oft_address:
  1. Build OFTBridge via getOFTBridge(token, mnemonic)
  2. Fetch OFT balance on trading chain
  3. If balance >= required amount:
       → use tge_oft_address as tokenAddress, proceed normally
  4. If balance < required amount:
       → print balance table (OFT balance, required, origin token balance)
       → prompt "Insufficient OFT tokens. Bridge from [origin chain] now?"
       → if no: print hint and exit
       → if yes: call bridgeToOFT(requiredAmount)
                 show txHash + layerzeroscan.com link
                 call waitForLayerZeroDelivery(txHash)
                 continue to settle
```

Settlement tx uses `tge_oft_address` as `tokenAddress` — no other changes to the settlement logic.

---

### `whales bridge` command

**File:** `src/commands/bridge.ts`

**`whales bridge to-oft`**

```
Identity (one of):
  --token-uuid <uuid>          resolves all details from API
  --oft-address <addr>         \
  --adapter-address <addr>      MyOFTAdapter contract on origin chain
  --origin-chain-id <id>        explicit mode
  --dest-chain-id <id>         /

Options:
  --amount <n>                 amount to bridge (omit = full origin balance)
  --quote                      show fee estimate and exit
  -y, --yes                    skip confirmation prompts
```

**`whales bridge to-origin`**

```
Identity (one of):
  --token-uuid <uuid>
  --oft-address <addr> + --origin-chain-id <id> + --dest-chain-id <id>

Options:
  --amount <n>                 amount to bridge (omit = full OFT balance)
  --quote                      show fee estimate and exit
  -y, --yes                    skip confirmation prompts
```

**`whales bridge status <tx-hash>`**

Polls and prints LayerZero delivery status. Useful if user exited the wait early.

**Amount warning:** When `--amount` is omitted, always show a prompt before bridging:

```
No amount specified. This will bridge your full balance:
  X TOKEN (Ethereum)     ← for to-oft
  X TOKEN_OFT (BSC)      ← for to-origin

Bridge entire balance? (y/N)
```

If user selects no → exit. Skipped when `--yes` is set.

**Shared bridge execution flow:**
1. Resolve token details (UUID lookup or explicit flags)
2. Show balances + fee quote
3. Warning prompt if no amount specified (y/N, default N)
4. Confirm prompt (respects `--yes`)
5. Execute bridge → print `txHash` + `https://layerzeroscan.com/tx/<txHash>`
6. Block with spinner, hint: "Press Ctrl+C to stop waiting (bridge will continue on-chain)"
7. Poll LayerZero until DELIVERED
8. Print success

---

### LayerZero polling helper

**File:** `src/commands/helpers/layerzero.ts`

```typescript
waitForLayerZeroDelivery(txHash: string, opts?: { timeoutMs?: number }): Promise<void>
```

- Polls `https://scan.layerzero-api.com/v1/messages/tx/{txHash}` every 4 seconds
- Spinner text updates with current status: `INFLIGHT` → `CONFIRMING` → `DELIVERED`
- Default timeout: 20 minutes — throws with hint to run `whales bridge status <txHash>`
- Ctrl+C exits process; bridge continues on-chain

---

### Supporting files

| File | Purpose |
|---|---|
| `src/blockchain/evm/oft-constants.ts` | LayerZero EID map (chain ID → endpoint ID), mainnet + testnet |
| `src/blockchain/evm/abis/MyOFTAbi.ts` | Minimal ABI: `send`, `quoteSend`, `balanceOf`, `allowance`, `approve` |
| `src/blockchain/evm/abis/MyOFTAdapterAbi.ts` | Same functions for the adapter contract |

**LayerZero EID map (mainnet):**

| Chain | Chain ID | LZ Endpoint ID |
|---|---|---|
| Ethereum | 1 | 30101 |
| BSC | 56 | 30102 |
| Base | 8453 | 30184 |
| Arbitrum | 42161 | 30110 |

**New npm dependency:** `@layerzerolabs/lz-v2-utilities` — for encoding `extraOptions` (executor gas limit) in `SendParam`.

---

## Files Changed

| File | Change |
|---|---|
| `src/blockchain/evm/contracts/OFTBridge.ts` | New |
| `src/blockchain/evm/oft-constants.ts` | New |
| `src/blockchain/evm/abis/MyOFTAbi.ts` | New |
| `src/blockchain/evm/abis/MyOFTAdapterAbi.ts` | New |
| `src/commands/bridge.ts` | New |
| `src/commands/helpers/layerzero.ts` | New |
| `src/commands/trade.ts` | Modify — OFT pre-flight check in `settle` |
| `src/commands/helpers/chain.ts` | Modify — add `getOFTBridge()` factory |
| `src/types.ts` | Modify — add `tge_*` fields to `Token` interface |
| `src/index.ts` | Modify — register `bridgeCommand` |
| `package.json` | Modify — add `@layerzerolabs/lz-v2-utilities` |

---

## Error Cases

| Situation | Message |
|---|---|
| Token has no `tge_oft_address` | "This token does not require OFT bridging." |
| Insufficient origin token balance | "Insufficient [TOKEN] on [chain]. Need X, have Y." |
| Insufficient native gas for LZ fee | "Insufficient ETH for LayerZero fee (~X ETH). Top up your wallet on [origin chain]." |
| Chain not in LZ EID map | "Chain [ID] has no LayerZero endpoint configured." |
| LayerZero polling timeout | "Bridge not confirmed after 20 minutes. Check: whales bridge status <txHash>" |
| User cancels full-balance warning | Exit cleanly, no tx submitted |

---

## Out of Scope

- Solana, Sui, Aptos bridge
- Partial bridge with auto top-up
- Persisting pending bridge state across CLI sessions
- Gas estimation for the settlement tx (existing logic unchanged)
