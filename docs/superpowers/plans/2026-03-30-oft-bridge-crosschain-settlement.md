# OFT Bridge Cross-Chain Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LayerZero OFT bridge support so sellers can bridge origin tokens to OFT before settling, and buyers can bridge OFT tokens back to the origin chain.

**Architecture:** A single `OFTBridge` class (ethers v6) handles both bridge directions using two providers (origin chain + trading chain). The `settle` command gains a pre-flight OFT balance check with inline bridge prompt. A new `whales bridge` command group exposes standalone bridging for both directions. LayerZero delivery is polled via a shared helper.

**Tech Stack:** ethers v6, `@layerzerolabs/lz-v2-utilities`, axios (already installed), ora (already installed), Commander.js

---

## File Map

| File | Action |
|---|---|
| `src/blockchain/evm/oft-constants.ts` | New — LZ EID map + `getLzEid()` |
| `src/blockchain/evm/abis/MyOFTAbi.ts` | New — minimal OFT ABI (`quoteSend`, `send`, `balanceOf`, `decimals`) |
| `src/blockchain/evm/abis/MyOFTAdapterAbi.ts` | New — minimal OFTAdapter ABI (`quoteSend`, `send`) |
| `src/blockchain/evm/contracts/OFTBridge.ts` | New — `OFTBridge` class |
| `src/commands/helpers/layerzero.ts` | New — `waitForLayerZeroDelivery()`, `getLzStatus()` |
| `src/commands/bridge.ts` | New — `whales bridge to-oft / to-origin / status` |
| `src/commands/helpers/chain.ts` | Modify — add `getOFTBridge()` factory |
| `src/commands/helpers/resolve.ts` | Modify — extend `resolveOrder()` to return token TGE fields |
| `src/commands/trade.ts` | Modify — OFT pre-flight check in `settle` |
| `src/types.ts` | Modify — add `tge_*` fields to `Token` |
| `src/index.ts` | Modify — register `bridgeCommand` |
| `package.json` | Modify — add `@layerzerolabs/lz-v2-utilities` |
| `test/oft-constants.test.ts` | New |
| `test/OFTBridge.test.ts` | New |
| `test/layerzero.test.ts` | New |

---

## Task 1: Install dependency + update Token type

**Files:**
- Modify: `package.json`
- Modify: `src/types.ts`

- [ ] **Step 1: Install `@layerzerolabs/lz-v2-utilities`**

```bash
npm install @layerzerolabs/lz-v2-utilities
```

Expected: package added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Add TGE fields to Token interface**

In `src/types.ts`, replace the `Token` interface:

```typescript
export interface Token {
  id: number;
  name: string;
  symbol: string;
  status: string;
  price?: string | number;
  chain_id: number;
  tge_oft_address?: string;
  tge_network_id?: number;
  tge_adapter_address?: string;
  tge_native_adapter_address?: string;
  tge_token_address?: string;
  [key: string]: any;
}
```

- [ ] **Step 3: Build to verify no type errors**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts package.json package-lock.json
git commit -m "feat(oft): install lz-v2-utilities, add tge fields to Token type"
```

---

## Task 2: LayerZero constants + ABIs

**Files:**
- Create: `src/blockchain/evm/oft-constants.ts`
- Create: `src/blockchain/evm/abis/MyOFTAbi.ts`
- Create: `src/blockchain/evm/abis/MyOFTAdapterAbi.ts`
- Create: `test/oft-constants.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/oft-constants.test.ts`:

```typescript
import { getLzEid, LZ_EID } from '../src/blockchain/evm/oft-constants';

describe('getLzEid', () => {
  it('returns EID for Ethereum mainnet', () => {
    expect(getLzEid(1)).toBe(30101);
  });

  it('returns EID for BSC mainnet', () => {
    expect(getLzEid(56)).toBe(30102);
  });

  it('returns EID for Base mainnet', () => {
    expect(getLzEid(8453)).toBe(30184);
  });

  it('returns EID for Arbitrum mainnet', () => {
    expect(getLzEid(42161)).toBe(30110);
  });

  it('returns EID for Sepolia testnet', () => {
    expect(getLzEid(11155111)).toBe(40161);
  });

  it('returns EID for BSC testnet', () => {
    expect(getLzEid(97)).toBe(40102);
  });

  it('throws for unknown chain', () => {
    expect(() => getLzEid(999999)).toThrow('No LayerZero endpoint ID for chain 999999');
  });

  it('LZ_EID map contains all expected mainnet chains', () => {
    expect(Object.keys(LZ_EID).map(Number)).toEqual(
      expect.arrayContaining([1, 56, 8453, 42161])
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest test/oft-constants.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '../src/blockchain/evm/oft-constants'"

- [ ] **Step 3: Create `src/blockchain/evm/oft-constants.ts`**

```typescript
/** LayerZero Endpoint IDs by EVM chain ID. */
export const LZ_EID: Record<number, number> = {
  // Mainnet
  1: 30101,        // Ethereum
  56: 30102,       // BSC
  8453: 30184,     // Base
  42161: 30110,    // Arbitrum
  // Testnet
  11155111: 40161, // Sepolia
  97: 40102,       // BSC testnet
};

export function getLzEid(chainId: number): number {
  const eid = LZ_EID[chainId];
  if (eid == null) throw new Error(`No LayerZero endpoint ID for chain ${chainId}`);
  return eid;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest test/oft-constants.test.ts --no-coverage
```

Expected: PASS — 8 tests passing.

- [ ] **Step 5: Create `src/blockchain/evm/abis/MyOFTAbi.ts`**

MyOFT is the OFT token on the trading chain. It exposes `quoteSend`, `send`, `balanceOf`, and `decimals`.

```typescript
export const MyOFTAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'uint32', name: 'dstEid', type: 'uint32' },
          { internalType: 'bytes32', name: 'to', type: 'bytes32' },
          { internalType: 'uint256', name: 'amountLD', type: 'uint256' },
          { internalType: 'uint256', name: 'minAmountLD', type: 'uint256' },
          { internalType: 'bytes', name: 'extraOptions', type: 'bytes' },
          { internalType: 'bytes', name: 'composeMsg', type: 'bytes' },
          { internalType: 'bytes', name: 'oftCmd', type: 'bytes' },
        ],
        internalType: 'struct SendParam',
        name: '_sendParam',
        type: 'tuple',
      },
      { internalType: 'bool', name: '_payInLzToken', type: 'bool' },
    ],
    name: 'quoteSend',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'nativeFee', type: 'uint256' },
          { internalType: 'uint256', name: 'lzTokenFee', type: 'uint256' },
        ],
        internalType: 'struct MessagingFee',
        name: 'msgFee',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'uint32', name: 'dstEid', type: 'uint32' },
          { internalType: 'bytes32', name: 'to', type: 'bytes32' },
          { internalType: 'uint256', name: 'amountLD', type: 'uint256' },
          { internalType: 'uint256', name: 'minAmountLD', type: 'uint256' },
          { internalType: 'bytes', name: 'extraOptions', type: 'bytes' },
          { internalType: 'bytes', name: 'composeMsg', type: 'bytes' },
          { internalType: 'bytes', name: 'oftCmd', type: 'bytes' },
        ],
        internalType: 'struct SendParam',
        name: '_sendParam',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'uint256', name: 'nativeFee', type: 'uint256' },
          { internalType: 'uint256', name: 'lzTokenFee', type: 'uint256' },
        ],
        internalType: 'struct MessagingFee',
        name: '_fee',
        type: 'tuple',
      },
      { internalType: 'address', name: '_refundAddress', type: 'address' },
    ],
    name: 'send',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
```

- [ ] **Step 6: Create `src/blockchain/evm/abis/MyOFTAdapterAbi.ts`**

MyOFTAdapter is on the origin chain. It wraps an existing ERC-20 so it doesn't have its own `balanceOf` — use `ERC20_ABI` for origin token balance/allowance/approve.

```typescript
export const MyOFTAdapterAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'uint32', name: 'dstEid', type: 'uint32' },
          { internalType: 'bytes32', name: 'to', type: 'bytes32' },
          { internalType: 'uint256', name: 'amountLD', type: 'uint256' },
          { internalType: 'uint256', name: 'minAmountLD', type: 'uint256' },
          { internalType: 'bytes', name: 'extraOptions', type: 'bytes' },
          { internalType: 'bytes', name: 'composeMsg', type: 'bytes' },
          { internalType: 'bytes', name: 'oftCmd', type: 'bytes' },
        ],
        internalType: 'struct SendParam',
        name: '_sendParam',
        type: 'tuple',
      },
      { internalType: 'bool', name: '_payInLzToken', type: 'bool' },
    ],
    name: 'quoteSend',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'nativeFee', type: 'uint256' },
          { internalType: 'uint256', name: 'lzTokenFee', type: 'uint256' },
        ],
        internalType: 'struct MessagingFee',
        name: 'msgFee',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'uint32', name: 'dstEid', type: 'uint32' },
          { internalType: 'bytes32', name: 'to', type: 'bytes32' },
          { internalType: 'uint256', name: 'amountLD', type: 'uint256' },
          { internalType: 'uint256', name: 'minAmountLD', type: 'uint256' },
          { internalType: 'bytes', name: 'extraOptions', type: 'bytes' },
          { internalType: 'bytes', name: 'composeMsg', type: 'bytes' },
          { internalType: 'bytes', name: 'oftCmd', type: 'bytes' },
        ],
        internalType: 'struct SendParam',
        name: '_sendParam',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'uint256', name: 'nativeFee', type: 'uint256' },
          { internalType: 'uint256', name: 'lzTokenFee', type: 'uint256' },
        ],
        internalType: 'struct MessagingFee',
        name: '_fee',
        type: 'tuple',
      },
      { internalType: 'address', name: '_refundAddress', type: 'address' },
    ],
    name: 'send',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
```

- [ ] **Step 7: Build to verify no type errors**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 8: Commit**

```bash
git add src/blockchain/evm/oft-constants.ts src/blockchain/evm/abis/MyOFTAbi.ts src/blockchain/evm/abis/MyOFTAdapterAbi.ts test/oft-constants.test.ts
git commit -m "feat(oft): add LZ EID constants and minimal OFT ABIs"
```

---

## Task 3: `OFTBridge` class

**Files:**
- Create: `src/blockchain/evm/contracts/OFTBridge.ts`
- Create: `test/OFTBridge.test.ts`

- [ ] **Step 1: Write failing test for `buildExtraOptions`**

Create `test/OFTBridge.test.ts`:

```typescript
import { OFTBridge } from '../src/blockchain/evm/contracts/OFTBridge';

describe('OFTBridge.buildExtraOptions', () => {
  it('returns a hex string', () => {
    const result = OFTBridge.buildExtraOptions();
    expect(result).toMatch(/^0x[0-9a-f]+$/i);
  });

  it('returns a non-empty hex string for default gas limit', () => {
    const result = OFTBridge.buildExtraOptions(200_000);
    expect(result.length).toBeGreaterThan(2);
  });

  it('returns different values for different gas limits', () => {
    const a = OFTBridge.buildExtraOptions(100_000);
    const b = OFTBridge.buildExtraOptions(300_000);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest test/OFTBridge.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create `src/blockchain/evm/contracts/OFTBridge.ts`**

```typescript
import { ethers } from 'ethers';
import { Options } from '@layerzerolabs/lz-v2-utilities';
import { getLzEid } from '../oft-constants';
import { MyOFTAbi } from '../abis/MyOFTAbi';
import { MyOFTAdapterAbi } from '../abis/MyOFTAdapterAbi';
import { ERC20_ABI } from './abis/ERC20';

export interface OFTBridgeConfig {
  originProvider: ethers.JsonRpcProvider;
  tradingProvider: ethers.JsonRpcProvider;
  signer: ethers.HDNodeWallet;
  oftAdapterAddress: string;
  oftAddress: string;
  /** null when origin token is a native coin (ETH, BNB, etc.) */
  originTokenAddress: string | null;
  originChainId: number;
  tradingChainId: number;
  isNative: boolean;
}

export interface BridgeFee {
  nativeFee: bigint;
}

export interface BridgeTxResult {
  txHash: string;
}

export class OFTBridge {
  private cfg: OFTBridgeConfig;

  constructor(config: OFTBridgeConfig) {
    this.cfg = config;
  }

  /** Encode LayerZero executor options for a bridge send. */
  static buildExtraOptions(gasLimit: number = 200_000): string {
    return Options.newOptions().addExecutorLzReceiveOption(gasLimit, 0).toHex();
  }

  /** OFT token balance on the trading chain. */
  async getOFTBalance(address: string): Promise<bigint> {
    const oft = new ethers.Contract(this.cfg.oftAddress, MyOFTAbi, this.cfg.tradingProvider);
    return BigInt(await oft.balanceOf(address));
  }

  /** Origin token balance on the origin chain (native or ERC-20). */
  async getOriginTokenBalance(address: string): Promise<bigint> {
    if (this.cfg.isNative) {
      return this.cfg.originProvider.getBalance(address);
    }
    const token = new ethers.Contract(this.cfg.originTokenAddress!, ERC20_ABI, this.cfg.originProvider);
    return BigInt(await token.balanceOf(address));
  }

  /** Get OFT token decimals from the trading chain. */
  async getOFTDecimals(): Promise<number> {
    const oft = new ethers.Contract(this.cfg.oftAddress, MyOFTAbi, this.cfg.tradingProvider);
    return Number(await oft.decimals());
  }

  /** Get origin token decimals (native = 18). */
  async getOriginDecimals(): Promise<number> {
    if (this.cfg.isNative) return 18;
    const token = new ethers.Contract(this.cfg.originTokenAddress!, ERC20_ABI, this.cfg.originProvider);
    return Number(await token.decimals());
  }

  /** Quote the LayerZero fee to bridge origin → OFT. */
  async quoteBridgeToOFT(amountLD: bigint): Promise<BridgeFee> {
    const dstEid = getLzEid(this.cfg.tradingChainId);
    const sendParam = this.buildSendParam(dstEid, amountLD);
    const adapter = new ethers.Contract(this.cfg.oftAdapterAddress, MyOFTAdapterAbi, this.cfg.originProvider);
    const fee = await adapter.quoteSend(sendParam, false);
    return { nativeFee: BigInt(fee.nativeFee) };
  }

  /** Quote the LayerZero fee to bridge OFT → origin. */
  async quoteBridgeToOrigin(amountLD: bigint): Promise<BridgeFee> {
    const dstEid = getLzEid(this.cfg.originChainId);
    const sendParam = this.buildSendParam(dstEid, amountLD);
    const oft = new ethers.Contract(this.cfg.oftAddress, MyOFTAbi, this.cfg.tradingProvider);
    const fee = await oft.quoteSend(sendParam, false);
    return { nativeFee: BigInt(fee.nativeFee) };
  }

  /**
   * Bridge origin token → OFT on trading chain.
   * If amount is omitted, bridges the full origin token balance.
   */
  async bridgeToOFT(amount?: bigint): Promise<BridgeTxResult> {
    const originSigner = this.cfg.signer.connect(this.cfg.originProvider);
    const walletAddress = await originSigner.getAddress();

    const amountLD = amount ?? (await this.getOriginTokenBalance(walletAddress));
    if (amountLD === 0n) throw new Error('Origin token balance is zero.');

    const { nativeFee } = await this.quoteBridgeToOFT(amountLD);
    const nativeBalance = await this.cfg.originProvider.getBalance(walletAddress);

    if (this.cfg.isNative) {
      if (nativeBalance < amountLD + nativeFee) {
        throw new Error(
          `Insufficient balance. Need ${ethers.formatEther(amountLD + nativeFee)} ETH (amount + fee), have ${ethers.formatEther(nativeBalance)}.`
        );
      }
    } else {
      const tokenBalance = await this.getOriginTokenBalance(walletAddress);
      if (tokenBalance < amountLD) {
        throw new Error(`Insufficient origin token balance. Need ${amountLD}, have ${tokenBalance}.`);
      }
      if (nativeBalance < nativeFee) {
        throw new Error(
          `Insufficient native token for LayerZero fee. Need ${ethers.formatEther(nativeFee)} ETH, have ${ethers.formatEther(nativeBalance)}.`
        );
      }
      // Approve MyOFTAdapter to spend origin tokens if needed
      const tokenContract = new ethers.Contract(this.cfg.originTokenAddress!, ERC20_ABI, originSigner);
      const allowance = BigInt(await tokenContract.allowance(walletAddress, this.cfg.oftAdapterAddress));
      if (allowance < amountLD) {
        const approveTx = await tokenContract.approve(this.cfg.oftAdapterAddress, ethers.MaxUint256);
        await approveTx.wait();
      }
    }

    const dstEid = getLzEid(this.cfg.tradingChainId);
    const sendParam = {
      ...this.buildSendParam(dstEid, amountLD),
      to: ethers.zeroPadValue(walletAddress, 32),
    };
    const value = this.cfg.isNative ? amountLD + nativeFee : nativeFee;

    const adapter = new ethers.Contract(this.cfg.oftAdapterAddress, MyOFTAdapterAbi, originSigner);
    const tx = await adapter.send(sendParam, { nativeFee, lzTokenFee: 0n }, walletAddress, { value });
    return { txHash: tx.hash };
  }

  /**
   * Bridge OFT → origin token.
   * If amount is omitted, bridges the full OFT balance.
   */
  async bridgeToOrigin(amount?: bigint): Promise<BridgeTxResult> {
    const tradingSigner = this.cfg.signer.connect(this.cfg.tradingProvider);
    const walletAddress = await tradingSigner.getAddress();

    const amountLD = amount ?? (await this.getOFTBalance(walletAddress));
    if (amountLD === 0n) throw new Error('OFT token balance is zero.');

    const { nativeFee } = await this.quoteBridgeToOrigin(amountLD);
    const nativeBalance = await this.cfg.tradingProvider.getBalance(walletAddress);
    if (nativeBalance < nativeFee) {
      throw new Error(
        `Insufficient native token for LayerZero fee. Need ${ethers.formatEther(nativeFee)}, have ${ethers.formatEther(nativeBalance)}.`
      );
    }

    const dstEid = getLzEid(this.cfg.originChainId);
    const sendParam = {
      ...this.buildSendParam(dstEid, amountLD),
      to: ethers.zeroPadValue(walletAddress, 32),
    };

    const oft = new ethers.Contract(this.cfg.oftAddress, MyOFTAbi, tradingSigner);
    const tx = await oft.send(sendParam, { nativeFee, lzTokenFee: 0n }, walletAddress, { value: nativeFee });
    return { txHash: tx.hash };
  }

  private buildSendParam(dstEid: number, amountLD: bigint) {
    return {
      dstEid,
      to: ethers.zeroPadValue('0x0000000000000000000000000000000000000001', 32),
      amountLD,
      minAmountLD: amountLD,
      extraOptions: OFTBridge.buildExtraOptions(),
      composeMsg: '0x',
      oftCmd: '0x',
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest test/OFTBridge.test.ts --no-coverage
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Build to verify no type errors**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add src/blockchain/evm/contracts/OFTBridge.ts test/OFTBridge.test.ts
git commit -m "feat(oft): add OFTBridge class for bidirectional LayerZero bridging"
```

---

## Task 4: LayerZero polling helper

**Files:**
- Create: `src/commands/helpers/layerzero.ts`
- Create: `test/layerzero.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/layerzero.test.ts`:

```typescript
import axios from 'axios';
import { getLzStatus } from '../src/commands/helpers/layerzero';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('getLzStatus', () => {
  it('returns DELIVERED when API says so', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { data: [{ status: 'DELIVERED' }] },
    });
    const status = await getLzStatus('0xabc123');
    expect(status).toBe('DELIVERED');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://scan.layerzero-api.com/v1/messages/tx/0xabc123'
    );
  });

  it('returns INFLIGHT when bridge is in flight', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { data: [{ status: 'INFLIGHT' }] },
    });
    const status = await getLzStatus('0xdef456');
    expect(status).toBe('INFLIGHT');
  });

  it('returns UNKNOWN when data is empty', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { data: [] },
    });
    const status = await getLzStatus('0x000');
    expect(status).toBe('UNKNOWN');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest test/layerzero.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create `src/commands/helpers/layerzero.ts`**

```typescript
import axios from 'axios';
import ora from 'ora';

const LZ_SCAN_API = 'https://scan.layerzero-api.com/v1';

export function lzScanUrl(txHash: string): string {
  return `https://layerzeroscan.com/tx/${txHash}`;
}

/** Fetch the current LayerZero delivery status for a bridge tx. */
export async function getLzStatus(txHash: string): Promise<string> {
  const res = await axios.get(`${LZ_SCAN_API}/messages/tx/${txHash}`);
  const messages: any[] = res.data?.data ?? [];
  return messages[0]?.status ?? 'UNKNOWN';
}

/**
 * Block until LayerZero delivers the message or timeout.
 * Shows a spinner with current status. Prints the LayerZero scan URL.
 * Throws on timeout with a hint to use `whales bridge status <txHash>`.
 */
export async function waitForLayerZeroDelivery(
  txHash: string,
  opts: { timeoutMs?: number } = {}
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 20 * 60 * 1000;
  const pollMs = 4_000;
  const deadline = Date.now() + timeoutMs;

  console.log(`  LayerZero: ${lzScanUrl(txHash)}`);
  console.log('  Press Ctrl+C to stop waiting (bridge will continue on-chain)\n');

  const spinner = ora('LayerZero: checking...').start();

  while (Date.now() < deadline) {
    let status: string;
    try {
      status = await getLzStatus(txHash);
    } catch {
      status = 'UNKNOWN';
    }

    if (status === 'DELIVERED') {
      spinner.succeed('LayerZero: DELIVERED');
      return;
    }

    spinner.text = `LayerZero: ${status}...`;
    await new Promise(r => setTimeout(r, pollMs));
  }

  spinner.fail('LayerZero: timed out waiting for delivery');
  throw new Error(
    `Bridge not confirmed after ${timeoutMs / 60_000} minutes. ` +
    `Check status: whales bridge status ${txHash}`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest test/layerzero.test.ts --no-coverage
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add src/commands/helpers/layerzero.ts test/layerzero.test.ts
git commit -m "feat(oft): add LayerZero delivery polling helper"
```

---

## Task 5: `getOFTBridge` factory + extend `resolveOrder`

**Files:**
- Modify: `src/commands/helpers/chain.ts`
- Modify: `src/commands/helpers/resolve.ts`

- [ ] **Step 1: Add `getOFTBridge` to `src/commands/helpers/chain.ts`**

Add these imports at the top of the file (after existing imports):

```typescript
import { ethers } from 'ethers';
import { OFTBridge } from '../../blockchain/evm/contracts/OFTBridge';
import { deriveEvmWallet } from '../../blockchain';
```

Add this exported interface and function at the bottom of `src/commands/helpers/chain.ts`:

```typescript
export interface OFTBridgeTokenConfig {
  tge_oft_address: string;
  tge_network_id: number;
  tge_adapter_address?: string;
  tge_native_adapter_address?: string;
  tge_token_address?: string;
}

/**
 * Build an OFTBridge instance from token TGE fields.
 * tradingChainId is the chain where the pre-market contract lives (where OFT is deployed).
 */
export function getOFTBridge(
  token: OFTBridgeTokenConfig,
  tradingChainId: number,
  mnemonic: string
): OFTBridge {
  const { tge_oft_address, tge_network_id, tge_adapter_address, tge_native_adapter_address, tge_token_address } = token;
  const isNative = !tge_adapter_address && !!tge_native_adapter_address;
  const oftAdapterAddress = (tge_adapter_address ?? tge_native_adapter_address)!;
  if (!oftAdapterAddress) {
    throw new Error('Token missing tge_adapter_address or tge_native_adapter_address');
  }

  const originProvider = new ethers.JsonRpcProvider(resolveRpc(tge_network_id));
  const tradingProvider = new ethers.JsonRpcProvider(resolveRpc(tradingChainId));
  const signer = deriveEvmWallet(mnemonic.trim());

  return new OFTBridge({
    originProvider,
    tradingProvider,
    signer,
    oftAdapterAddress,
    oftAddress: tge_oft_address,
    originTokenAddress: tge_token_address ?? null,
    originChainId: tge_network_id,
    tradingChainId,
    isNative,
  });
}
```

- [ ] **Step 2: Extend `resolveOrder` in `src/commands/helpers/resolve.ts`**

Replace the `resolveOrder` function return type and body to include token TGE fields:

```typescript
/** Resolves chainId + on-chain order ID from GET /v2/detail-order/{uuid}.
 *  Also returns tokenAddress, tokenAmount, and token TGE fields for OFT bridge support.
 */
export async function resolveOrder(uuid: string): Promise<{
  chainId: number;
  orderIndex: string;
  customIndex: string | null;
  tokenAddress?: string;
  tokenAmount?: number;
  token?: {
    tge_oft_address?: string;
    tge_network_id?: number;
    tge_adapter_address?: string;
    tge_native_adapter_address?: string;
    tge_token_address?: string;
  };
}> {
  const res = await apiClient.getOrder(uuid);
  const o = (res as any)?.data ?? res;
  const chainId = o?.chain_id ?? o?.network?.chain_id;
  const orderIndex = o?.order_index;
  const customIndex = o?.custom_index ?? null;
  const tokenAddress: string | undefined = o?.offer?.token?.address ?? undefined;
  const tokenAmount: number | undefined = o?.amount != null ? Number(o.amount) : undefined;
  const rawToken = o?.offer?.token ?? o?.token;
  const token = rawToken ? {
    tge_oft_address: rawToken.tge_oft_address,
    tge_network_id: rawToken.tge_network_id,
    tge_adapter_address: rawToken.tge_adapter_address,
    tge_native_adapter_address: rawToken.tge_native_adapter_address,
    tge_token_address: rawToken.tge_token_address,
  } : undefined;
  if (!chainId) throw new Error(`Order ${uuid}: missing chain_id in API response`);
  if (orderIndex == null) throw new Error(`Order ${uuid}: missing order_index in API response`);
  return { chainId, orderIndex: String(orderIndex), customIndex, tokenAddress, tokenAmount, token };
}
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add src/commands/helpers/chain.ts src/commands/helpers/resolve.ts
git commit -m "feat(oft): add getOFTBridge factory and extend resolveOrder with TGE fields"
```

---

## Task 6: `whales bridge` command

**Files:**
- Create: `src/commands/bridge.ts`

- [ ] **Step 1: Create `src/commands/bridge.ts`**

```typescript
import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { config } from '../config';
import { apiClient } from '../api';
import { handleError } from '../output';
import { getOFTBridge, OFTBridgeTokenConfig, resolveRpc } from './helpers/chain';
import { waitForLayerZeroDelivery, getLzStatus, lzScanUrl } from './helpers/layerzero';
import { confirmTx } from './helpers/confirm';

function getMnemonic(): string {
  const wallet = config.getActiveWallet();
  if (!wallet?.mnemonic) throw new Error('No wallet configured. Run: whales wallet create');
  return wallet.mnemonic;
}

/** Fetch full token data (including TGE fields) by UUID from API */
async function resolveOFTToken(tokenUuid: string): Promise<{
  tradingChainId: number;
  tokenConfig: OFTBridgeTokenConfig;
  symbol: string;
}> {
  const res = await apiClient.getTokensV2({
    ids: tokenUuid,
    type: 'pre_market',
    category: 'pre_market',
    statuses: ['active', 'settling', 'ended'],
    take: 1,
    page: 1,
  });
  const list = (res as any)?.data?.list ?? (res as any)?.data ?? [];
  const token = list[0];
  if (!token) throw new Error(`Token ${tokenUuid} not found`);
  const tradingChainId = Array.isArray(token.chain_id) ? token.chain_id[0] : token.chain_id;
  if (!tradingChainId) throw new Error(`Token ${tokenUuid}: missing chain_id`);
  if (!token.tge_oft_address) throw new Error('This token does not require OFT bridging.');
  return {
    tradingChainId,
    tokenConfig: {
      tge_oft_address: token.tge_oft_address,
      tge_network_id: token.tge_network_id,
      tge_adapter_address: token.tge_adapter_address,
      tge_native_adapter_address: token.tge_native_adapter_address,
      tge_token_address: token.tge_token_address,
    },
    symbol: token.symbol ?? 'TOKEN',
  };
}

export const bridgeCommand = new Command('bridge')
  .description('Bridge tokens between chains via LayerZero OFT');

// ─── bridge to-oft ────────────────────────────────────────────────────────────
bridgeCommand
  .command('to-oft')
  .description('Bridge origin token → OFT on trading chain (seller flow)')
  .option('--token-uuid <uuid>', 'Token UUID (auto-resolves all chain/contract details)')
  .option('--oft-address <addr>', 'OFT token address on trading chain (explicit mode)')
  .option('--adapter-address <addr>', 'MyOFTAdapter address on origin chain (explicit mode)')
  .option('--origin-chain-id <id>', 'Origin chain ID (explicit mode)')
  .option('--dest-chain-id <id>', 'Trading/destination chain ID (explicit mode)')
  .option('--amount <n>', 'Amount to bridge in human units (omit to bridge full balance)')
  .option('--quote', 'Show fee estimate and exit without bridging')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    try {
      const mnemonic = getMnemonic();

      // Resolve token config
      let tradingChainId: number;
      let tokenConfig: OFTBridgeTokenConfig;
      let symbol = 'TOKEN';

      if (options.tokenUuid) {
        ({ tradingChainId, tokenConfig, symbol } = await resolveOFTToken(options.tokenUuid));
      } else if (options.oftAddress && options.adapterAddress && options.originChainId && options.destChainId) {
        tradingChainId = parseInt(options.destChainId, 10);
        tokenConfig = {
          tge_oft_address: options.oftAddress,
          tge_network_id: parseInt(options.originChainId, 10),
          tge_adapter_address: options.adapterAddress,
        };
      } else {
        throw new Error(
          'Provide --token-uuid, or all of: --oft-address --adapter-address --origin-chain-id --dest-chain-id'
        );
      }

      const bridge = getOFTBridge(tokenConfig, tradingChainId, mnemonic);
      const { signer } = (bridge as any).cfg;
      const walletAddress = signer.address;

      const spinner = ora('Fetching balances...').start();
      const [oftBalance, originBalance, decimals] = await Promise.all([
        bridge.getOFTBalance(walletAddress),
        bridge.getOriginTokenBalance(walletAddress),
        bridge.getOriginDecimals(),
      ]);
      spinner.stop();

      // Determine amount
      let amountLD: bigint;
      if (options.amount) {
        amountLD = ethers.parseUnits(options.amount, decimals);
      } else {
        // Warn: bridging full balance
        console.log(`\nNo amount specified. This will bridge your full balance:`);
        console.log(`  ${ethers.formatUnits(originBalance, decimals)} ${symbol} (origin chain)\n`);
        const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: 'Bridge entire balance?',
          default: false,
        }]);
        if (!confirmed) { console.log('Cancelled.'); return; }
        amountLD = originBalance;
      }

      // Show quote
      const { nativeFee } = await bridge.quoteBridgeToOFT(amountLD);
      console.log(`\n  OFT balance (trading chain): ${ethers.formatUnits(oftBalance, decimals)} ${symbol}`);
      console.log(`  Amount to bridge:            ${ethers.formatUnits(amountLD, decimals)} ${symbol}`);
      console.log(`  LayerZero fee:               ~${ethers.formatEther(nativeFee)} ETH\n`);

      if (options.quote) return;

      const ok = await confirmTx('Bridge tokens now?', command);
      if (!ok) return;

      const bridgeSpinner = ora('Submitting bridge transaction...').start();
      const { txHash } = await bridge.bridgeToOFT(amountLD);
      bridgeSpinner.succeed(`Bridge submitted: ${txHash}`);
      console.log(`  ${lzScanUrl(txHash)}\n`);

      await waitForLayerZeroDelivery(txHash);
      console.log('\nBridge complete. OFT tokens are now available on the trading chain.');
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });

// ─── bridge to-origin ─────────────────────────────────────────────────────────
bridgeCommand
  .command('to-origin')
  .description('Bridge OFT tokens → origin token (buyer flow)')
  .option('--token-uuid <uuid>', 'Token UUID (auto-resolves all chain/contract details)')
  .option('--oft-address <addr>', 'OFT token address on trading chain (explicit mode)')
  .option('--origin-chain-id <id>', 'Origin chain ID (explicit mode)')
  .option('--dest-chain-id <id>', 'Trading chain ID where OFT lives (explicit mode)')
  .option('--amount <n>', 'Amount to bridge in human units (omit to bridge full OFT balance)')
  .option('--quote', 'Show fee estimate and exit without bridging')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    try {
      const mnemonic = getMnemonic();

      let tradingChainId: number;
      let tokenConfig: OFTBridgeTokenConfig;
      let symbol = 'TOKEN';

      if (options.tokenUuid) {
        ({ tradingChainId, tokenConfig, symbol } = await resolveOFTToken(options.tokenUuid));
      } else if (options.oftAddress && options.originChainId && options.destChainId) {
        tradingChainId = parseInt(options.destChainId, 10);
        tokenConfig = {
          tge_oft_address: options.oftAddress,
          tge_network_id: parseInt(options.originChainId, 10),
        };
      } else {
        throw new Error(
          'Provide --token-uuid, or all of: --oft-address --origin-chain-id --dest-chain-id'
        );
      }

      const bridge = getOFTBridge(tokenConfig, tradingChainId, mnemonic);
      const { signer } = (bridge as any).cfg;
      const walletAddress = signer.address;

      const spinner = ora('Fetching OFT balance...').start();
      const [oftBalance, decimals] = await Promise.all([
        bridge.getOFTBalance(walletAddress),
        bridge.getOFTDecimals(),
      ]);
      spinner.stop();

      let amountLD: bigint;
      if (options.amount) {
        amountLD = ethers.parseUnits(options.amount, decimals);
      } else {
        console.log(`\nNo amount specified. This will bridge your full OFT balance:`);
        console.log(`  ${ethers.formatUnits(oftBalance, decimals)} ${symbol} OFT (trading chain)\n`);
        const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: 'Bridge entire balance?',
          default: false,
        }]);
        if (!confirmed) { console.log('Cancelled.'); return; }
        amountLD = oftBalance;
      }

      const { nativeFee } = await bridge.quoteBridgeToOrigin(amountLD);
      console.log(`\n  OFT balance:     ${ethers.formatUnits(oftBalance, decimals)} ${symbol}`);
      console.log(`  Amount to bridge: ${ethers.formatUnits(amountLD, decimals)} ${symbol}`);
      console.log(`  LayerZero fee:   ~${ethers.formatEther(nativeFee)} native token\n`);

      if (options.quote) return;

      const ok = await confirmTx('Bridge OFT tokens back to origin chain?', command);
      if (!ok) return;

      const bridgeSpinner = ora('Submitting bridge transaction...').start();
      const { txHash } = await bridge.bridgeToOrigin(amountLD);
      bridgeSpinner.succeed(`Bridge submitted: ${txHash}`);
      console.log(`  ${lzScanUrl(txHash)}\n`);

      await waitForLayerZeroDelivery(txHash);
      console.log(`\nBridge complete. ${symbol} tokens are now available on the origin chain.`);
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });

// ─── bridge status ────────────────────────────────────────────────────────────
bridgeCommand
  .command('status <tx-hash>')
  .description('Check LayerZero delivery status of a bridge transaction')
  .action(async (txHash, _options, command) => {
    const globalOpts = command.optsWithGlobals();
    try {
      const spinner = ora('Checking LayerZero status...').start();
      const status = await getLzStatus(txHash);
      spinner.stop();
      console.log(`\nStatus: ${status}`);
      console.log(`  ${lzScanUrl(txHash)}`);
      if (status !== 'DELIVERED') {
        console.log('\nBridge still in progress. Run again to check later.');
      }
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/commands/bridge.ts
git commit -m "feat(oft): add whales bridge to-oft / to-origin / status commands"
```

---

## Task 7: Register `bridge` command in `src/index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Import and register `bridgeCommand`**

In `src/index.ts`, find the block where other commands are imported and add:

```typescript
import { bridgeCommand } from './commands/bridge';
```

Then in the section where commands are registered with `program.addCommand(...)`, add:

```typescript
program.addCommand(bridgeCommand);
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Smoke test CLI registration**

```bash
node dist/index.js bridge --help
```

Expected output contains:
```
Usage: whales bridge [options] [command]
Bridge tokens between chains via LayerZero OFT
Commands:
  to-oft       Bridge origin token → OFT on trading chain (seller flow)
  to-origin    Bridge OFT tokens → origin token (buyer flow)
  status       Check LayerZero delivery status of a bridge transaction
```

- [ ] **Step 4: Add help test to existing test suite**

In `test/commands.test.ts`, add:

```typescript
test('whales bridge --help', async () => {
  const { stdout } = await execAsync(`${CLI_PATH} bridge --help`);
  expect(stdout).toContain('Bridge tokens between chains');
});

test('whales bridge to-oft --help', async () => {
  const { stdout } = await execAsync(`${CLI_PATH} bridge to-oft --help`);
  expect(stdout).toContain('--token-uuid');
  expect(stdout).toContain('--quote');
});

test('whales bridge to-origin --help', async () => {
  const { stdout } = await execAsync(`${CLI_PATH} bridge to-origin --help`);
  expect(stdout).toContain('--token-uuid');
  expect(stdout).toContain('--quote');
});
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass including the 3 new bridge help tests.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts test/commands.test.ts
git commit -m "feat(oft): register bridge command and add CLI smoke tests"
```

---

## Task 8: OFT pre-flight check in `settle` command

**Files:**
- Modify: `src/commands/trade.ts`

- [ ] **Step 1: Add imports to `src/commands/trade.ts`**

Add these imports at the top of the file alongside existing imports:

```typescript
import { getOFTBridge } from './helpers/chain';
import { waitForLayerZeroDelivery, lzScanUrl } from './helpers/layerzero';
import { ethers as _ethers } from 'ethers';
```

- [ ] **Step 2: Add OFT pre-flight check in the settle action**

Locate the EVM settle block in the `settle` command action (currently around line 491). It starts with:

```typescript
if (isEvmChain(chainId)) {
  const pm = preMarket as EvmPreMarket;
  const tokenAddress = options.tokenAddress ?? tokenAddressFromApi;
```

Replace the entire `if (isEvmChain(chainId))` block with:

```typescript
if (isEvmChain(chainId)) {
  const pm = preMarket as EvmPreMarket;

  // OFT pre-flight: if token launched on another chain, check OFT balance first
  const resolvedToken = (await resolveOrder(orderIdArg).catch(() => null))?.token
    ?? { tge_oft_address: undefined };
  // Re-use already-resolved token data if we did UUID resolution above
  const tgeToken = UUID_REGEX.test(orderIdArg.trim())
    ? (await (async () => {
        const res = await apiClient.getOrder(orderIdArg);
        const o = (res as any)?.data ?? res;
        return o?.offer?.token ?? o?.token;
      })())
    : undefined;

  const tgeOftAddress: string | undefined = tgeToken?.tge_oft_address;

  let tokenAddress = options.tokenAddress ?? tokenAddressFromApi;
  const amountNum = options.amount != null ? parseFloat(options.amount) : tokenAmountFromApi;

  if (tgeOftAddress && isEvmChain(chainId)) {
    // Use OFT token address for settlement instead of origin token
    tokenAddress = tgeOftAddress;

    // Check OFT balance
    const oftBridge = getOFTBridge(tgeToken, chainId, mnemonic);
    const walletAddress = deriveEvmWallet(mnemonic).address;

    spinner.text = 'Checking OFT balance...';
    const [oftBalance, decimals] = await Promise.all([
      oftBridge.getOFTBalance(walletAddress),
      oftBridge.getOFTDecimals(),
    ]);

    const requiredRaw = amountNum != null
      ? _ethers.parseUnits(amountNum.toString(), decimals)
      : 0n;

    if (requiredRaw > 0n && oftBalance < requiredRaw) {
      spinner.stop();
      const originBalance = await oftBridge.getOriginTokenBalance(walletAddress);
      const originDecimals = await oftBridge.getOriginDecimals();
      const symbol = tgeToken?.symbol ?? 'TOKEN';

      console.log('\n  Insufficient OFT tokens for settlement:');
      console.log(`    OFT balance (trading chain): ${_ethers.formatUnits(oftBalance, decimals)} ${symbol}`);
      console.log(`    Required for settlement:     ${_ethers.formatUnits(requiredRaw, decimals)} ${symbol}`);
      console.log(`    Origin token balance:        ${_ethers.formatUnits(originBalance, originDecimals)} ${symbol}\n`);

      const { doBridge } = await inquirer.prompt([{
        type: 'confirm',
        name: 'doBridge',
        message: `Bridge ${_ethers.formatUnits(requiredRaw, decimals)} ${symbol} from origin chain now?`,
        default: true,
      }]);

      if (!doBridge) {
        console.log(`\nRun manually: whales bridge to-oft --token-uuid <token-uuid>`);
        return;
      }

      spinner.start('Submitting bridge transaction...');
      const { txHash } = await oftBridge.bridgeToOFT(requiredRaw);
      spinner.succeed(`Bridge submitted: ${txHash}`);
      console.log(`  ${lzScanUrl(txHash)}\n`);

      await waitForLayerZeroDelivery(txHash);
      spinner.start('Settling order...');
    }
  }

  if (!tokenAddress || amountNum == null) {
    throw new Error('EVM settle requires --token-address and --amount (or pass an order UUID to auto-fetch from API)');
  }
  const decimals = options.tokenDecimals !== undefined
    ? parseInt(options.tokenDecimals, 10)
    : await pm.getTokenDecimals(tokenAddress);
  const rawAmount = parseUnits(amountNum.toString(), decimals);
  if (options.withDiscount && orderUUID) {
    tx = await pm.settleOrderWithDiscount({
      orderId: orderId as number,
      orderUUID,
      tokenAddress,
      amount: rawAmount,
    });
  } else {
    tx = await pm.settleOrder({
      orderId: orderId as number,
      tokenAddress,
      amount: rawAmount,
    });
  }
```

Also add the `inquirer` import at the top of `trade.ts` if not already present:

```typescript
import inquirer from 'inquirer';
```

And add `deriveEvmWallet` to the blockchain imports:

```typescript
import { deriveEvmWallet, ... } from '../blockchain';
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: compiles without errors. Fix any TypeScript errors before proceeding.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/trade.ts
git commit -m "feat(oft): add OFT pre-flight check in settle with inline bridge prompt"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `npm run build` passes with no errors
- [ ] `npm test` passes all tests
- [ ] `node dist/index.js bridge --help` shows all three subcommands
- [ ] `node dist/index.js bridge to-oft --help` shows `--token-uuid`, `--adapter-address`, `--quote`
- [ ] `node dist/index.js trade settle --help` is unchanged (no new flags added)
- [ ] `node dist/index.js bridge status <fake-hash>` runs without crashing (will get an axios error, which is expected)
