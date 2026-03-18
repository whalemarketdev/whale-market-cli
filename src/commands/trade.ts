import { Command } from 'commander';
import { PublicKey } from '@solana/web3.js';
import ora from 'ora';
import { config } from '../config';
import { confirmTx } from './helpers/confirm';
import {
  UUID_REGEX,
  getOptionalChainIdFromOpts,
  resolveOffer,
  resolveOrder,
  resolveToken,
} from './helpers/resolve';
import {
  getPreMarket,
  parseOfferId,
  parseOrderId,
  isEvmChain,
  isSolanaChain,
  isSuiChain,
  isAptosChain,
  getNativeExToken,
  SOLANA_MAINNET_CHAIN_ID,
  SOLANA_DEVNET_CHAIN_ID,
} from './helpers/chain';
import { handleError, printTxResultTable } from '../output';
import { ETH_ADDRESS, parseUnits } from '../blockchain/evm/utils';
import { EVM_CHAINS } from '../blockchain/evm/constants';
import { apiClient } from '../api';
import {
  EvmPreMarket,
  SolanaPreMarket,
  SuiPreMarket,
  AptosPreMarket,
} from '../blockchain';

const WEI6 = 1_000_000;

function getMnemonic(): string {
  const wallet = config.getActiveWallet();
  if (!wallet?.mnemonic) {
    throw new Error('No wallet configured. Run: whales setup or whales wallet import');
  }
  return wallet.mnemonic;
}


function getExplorerUrl(chainId: number): string | undefined {
  if (chainId in EVM_CHAINS) {
    return EVM_CHAINS[chainId].explorerUrl;
  }
  if (chainId === SOLANA_MAINNET_CHAIN_ID) return 'https://explorer.solana.com';
  if (chainId === SOLANA_DEVNET_CHAIN_ID) return 'https://explorer.solana.com?cluster=devnet';
  return undefined;
}


/** $10 minimum fill collateral check — applies to all chains. */
async function checkFillCollateral(
  chainId: number,
  exTokenAddress: string,
  offerData: { totalAmount: number; filledAmount: number; collateral: { uiAmount: string } },
  fillAmount: number
): Promise<void> {
  // Skip check when filling all remaining unfilled tokens
  const unfilledAmount = offerData.totalAmount - offerData.filledAmount;
  if (fillAmount >= unfilledAmount) return;

  try {
    const prices = await apiClient.getExTokenPrices(chainId);
    const tokenPrice = prices.find((p: any) =>
      p.address.toLowerCase() === exTokenAddress.toLowerCase()
    )?.price;
    if (tokenPrice) {
      const totalCollateralUi = parseFloat(offerData.collateral.uiAmount);
      const fillCollateralUi = totalCollateralUi * (fillAmount / offerData.totalAmount);
      const fillCollateralUsd = fillCollateralUi * tokenPrice;
      const remainingAmount = offerData.totalAmount - offerData.filledAmount - fillAmount;
      const remainingUsd = totalCollateralUi * Math.max(0, remainingAmount) / offerData.totalAmount * tokenPrice;
      if (fillCollateralUsd < 10 && remainingUsd >= 10) {
        throw new Error(`Fill amount too small: $${fillCollateralUsd.toFixed(2)} collateral is below the $10 minimum.`);
      }
    }
  } catch (err: any) {
    if (err.message?.includes('$10')) throw err;
  }
}

export const tradeCommand = new Command('trade')
  .description('Pre-market trading (create, fill, close offers; settle, claim-collateral orders)');

// ─── create-offer ────────────────────────────────────────────────────────────
tradeCommand
  .command('create-offer')
  .description('Create a buy or sell offer')
  .requiredOption('--token <id>', 'Token ID (numeric, bytes32 hex, or UUID for EVM/Solana; token config for Sui/Aptos)')
  .requiredOption('--side <side>', 'Offer side: buy | sell')
  .requiredOption('--price <n>', 'Price per token (USD, 6-decimal precision e.g. 0.5)')
  .requiredOption('--amount <n>', 'Token amount')
  .option('--ex-token <addr>', 'Exchange token address (default: native token for the chain)')
  .option('--full-match', 'Require full match only')
  .option('--token-config <addr>', 'Token config address (required for Sui/Aptos)')
  .option('--coin-type <type>', 'Coin type for Sui (e.g. 0x2::sui::SUI)')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();

    const amount = parseFloat(options.amount);
    const price = parseFloat(options.price);

    // Resolve chainId + on-chain token ID from UUID (must happen before $10 check)
    let chainId = getOptionalChainIdFromOpts(command);
    let tokenOnChainId: string = options.token;
    if (UUID_REGEX.test((options.token as string).trim())) {
      try {
        const resolved = await resolveToken(options.token);
        chainId = chainId ?? resolved.chainId;
        tokenOnChainId = resolved.tokenId;
      } catch (err: any) {
        handleError(err, globalOpts.format);
        return;
      }
    } else {
      if (chainId == null) throw new Error('--chain-id is required when passing an on-chain ID (use a UUID to auto-resolve chain and ID)');
    }

    const exToken = (options.exToken as string | undefined) ?? getNativeExToken(chainId!);
    const collateral = amount * price; // in exToken units (EVM) or USD (Solana/Sui/Aptos)

    // $10 minimum check — fetch ex-token price from API for all chains
    let collateralUsd = collateral; // fallback: treat as USD
    try {
      const prices = await apiClient.getExTokenPrices(chainId!);
      const tokenPrice = prices.find((p: any) => p.address?.toLowerCase() === exToken.toLowerCase())?.price;
      if (tokenPrice) collateralUsd = collateral * tokenPrice;
    } catch {
      // API unavailable — fall through with collateral as-is
    }

    if (collateralUsd < 10) {
      handleError(
        new Error(`Minimum collateral is $10. Got $${collateralUsd.toFixed(2)}.`),
        globalOpts.format
      );
      return;
    }
    const ok = await confirmTx(
      `Create ${options.side} offer: ${amount} tokens @ ${price} (exToken: ${exToken}) = $${collateralUsd.toFixed(2)} collateral. Proceed?`,
      command
    );
    if (!ok) return;

    const spinner = ora('Creating offer...').start();

    try {
      const mnemonic = getMnemonic();
      const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';
      const preMarket = getPreMarket(chainId, mnemonic, apiUrl);

      const isFullMatch = Boolean(options.fullMatch);

      if (isEvmChain(chainId)) {
        const pm = preMarket as EvmPreMarket;
        // EVM contract uses bytes32 for tokenId - accept hex string (0x...) or numeric
        const tokenId =
          tokenOnChainId.startsWith('0x') && tokenOnChainId.length === 66
            ? tokenOnChainId
            : (() => {
                const n = parseInt(tokenOnChainId, 10);
                if (isNaN(n)) throw new Error('--token must be numeric, bytes32 hex (0x + 64 chars), or token UUID for EVM');
                return n;
              })();
        const exDecimals = exToken === ETH_ADDRESS ? 18 : await pm.getTokenDecimals(exToken);
        const collateral = parseUnits((amount * price).toString(), exDecimals);

        const tx = await pm.createOffer({
          tokenId,
          side: options.side,
          amount,
          collateral,
          exTokenAddress: exToken,
          isFullMatch,
        });
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'create-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSolanaChain(chainId)) {
        const pm = preMarket as SolanaPreMarket;
        const tokenId = parseInt(tokenOnChainId, 10);
        if (isNaN(tokenId)) throw new Error('--token must be numeric or token UUID for Solana');
        const exTokenPubkey = new PublicKey(exToken);
        const rawPrice = Math.round(price * WEI6);

        const tx = await pm.createOffer({
          tokenId,
          side: options.side,
          exToken: exTokenPubkey,
          amount,
          price: rawPrice,
          isFullMatch,
        });
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'create-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSuiChain(chainId)) {
        const pm = preMarket as SuiPreMarket;
        const tokenConfig = options.tokenConfig || tokenOnChainId;
        if (!tokenConfig) throw new Error('--token-config is required for Sui');
        const coinType = options.coinType || exToken;
        const rawAmount = BigInt(Math.round(amount * WEI6));
        const rawValue = BigInt(Math.round(amount * price * WEI6));

        const tx = await pm.createOffer({
          tokenConfig,
          offerType: options.side === 'buy' ? 'Buy' : 'Sell',
          amount: rawAmount,
          value: rawValue,
          fullMatch: isFullMatch,
          coinType,
        });
        spinner.stop();
        printTxResultTable(tx, { action: 'create-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isAptosChain(chainId)) {
        const pm = preMarket as AptosPreMarket;
        const tokenConfig = options.tokenConfig || tokenOnChainId;
        if (!tokenConfig) throw new Error('--token-config is required for Aptos');
        const rawValue = Math.round(amount * price * WEI6);

        const tx = await pm.createOffer({
          tokenConfig,
          exToken,
          side: options.side,
          amount,
          value: rawValue,
          isFullMatch,
        });
        spinner.stop();
        printTxResultTable(tx, { action: 'create-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else {
        throw new Error(`Unsupported chain: ${chainId}`);
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// ─── fill-offer ──────────────────────────────────────────────────────────────
tradeCommand
  .command('fill-offer <offer-id>')
  .description('Fill (partially or fully) an existing offer')
  .option('--amount <n>', 'Amount to fill (default: full offer)')
  .option('--ex-token <addr>', 'Exchange token address (EVM: fetched from offer if omitted)')
  .action(async (offerIdArg, options, command) => {
    const globalOpts = command.optsWithGlobals();

    const ok = await confirmTx(`Fill offer ${offerIdArg}. Proceed?`, command);
    if (!ok) return;

    const spinner = ora('Filling offer...').start();

    try {
      const mnemonic = getMnemonic();
      const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';

      let chainId = getOptionalChainIdFromOpts(command);
      let offerOnChainId: string;
      let offerCustomIndex: string | null = null;

      if (UUID_REGEX.test(offerIdArg.trim())) {
        const resolved = await resolveOffer(offerIdArg);
        chainId = chainId ?? resolved.chainId;
        offerOnChainId = resolved.offerIndex;
        offerCustomIndex = resolved.customIndex;
      } else {
        if (chainId == null) throw new Error('--chain-id is required when passing an on-chain ID (use a UUID to auto-resolve chain and ID)');
        offerOnChainId = offerIdArg;
      }

      const preMarket = getPreMarket(chainId, mnemonic, apiUrl);

      const offerId = isSuiChain(chainId) || isAptosChain(chainId)
        ? (offerCustomIndex ?? offerOnChainId)
        : parseOfferId(chainId, offerOnChainId);

      if (isEvmChain(chainId)) {
        const pm = preMarket as EvmPreMarket;
        const offerData = await pm.getOffer(offerId as number);
        let exTokenAddress = options.exToken;
        if (!exTokenAddress) {
          exTokenAddress = offerData.exTokenAddress;
        }
        if (!exTokenAddress) {
          try {
            const apiOffer = await apiClient.getOffer(offerIdArg);
            const o = (apiOffer as any).data || apiOffer;
            const exToken = o?.ex_token ?? o?.exchange_token_address ?? o?.exToken;
            exTokenAddress = typeof exToken === 'string' ? exToken : exToken?.address ?? exToken?.contract_address;
          } catch {}
          if (!exTokenAddress) exTokenAddress = ETH_ADDRESS;
        }
        const amount = options.amount ? parseFloat(options.amount) : offerData.totalAmount - offerData.filledAmount;
        const totalRaw = BigInt(Math.round(offerData.totalAmount * WEI6));
        const amountRaw = BigInt(Math.round(amount * WEI6));
        const collateral = totalRaw > 0n
          ? (BigInt(offerData.collateral.amount) * amountRaw) / totalRaw
          : BigInt(offerData.collateral.amount);

        await checkFillCollateral(chainId, exTokenAddress, offerData, amount);

        const tx = await pm.fillOffer({
          offerId: offerId as number,
          amount,
          collateral,
          exTokenAddress,
        });
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'fill-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSolanaChain(chainId)) {
        const pm = preMarket as SolanaPreMarket;
        const offerData = await pm.getOffer(offerId as number);
        const amount = options.amount
          ? parseFloat(options.amount)
          : offerData.totalAmount - offerData.filledAmount;

        await checkFillCollateral(chainId, (options.exToken as string | undefined) ?? getNativeExToken(chainId), offerData, amount);

        const tx = await pm.fillOffer({
          offerId: offerId as number,
          amount: amount || offerData.totalAmount,
        });
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'fill-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSuiChain(chainId)) {
        const pm = preMarket as SuiPreMarket;
        const offerData = await pm.getOffer(offerId as string);
        const amount = options.amount ? parseFloat(options.amount) : offerData.totalAmount - offerData.filledAmount;
        const rawAmount = BigInt(Math.round(amount * WEI6));

        await checkFillCollateral(chainId, (options.exToken as string | undefined) ?? getNativeExToken(chainId), offerData, amount);

        const tx = await pm.fillOffer({
          offerId: offerId as string,
          amount: rawAmount,
        });
        spinner.stop();
        printTxResultTable(tx, { action: 'fill-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isAptosChain(chainId)) {
        const pm = preMarket as AptosPreMarket;
        const offerData = await pm.getOffer(offerId as string);
        const amount = options.amount ? parseFloat(options.amount) : offerData.totalAmount - offerData.filledAmount;

        await checkFillCollateral(chainId, (options.exToken as string | undefined) ?? getNativeExToken(chainId), offerData, amount);

        const tx = await pm.fillOffer({
          offerAddress: offerId as string,
          amount: amount || offerData.totalAmount,
        });
        spinner.stop();
        printTxResultTable(tx, { action: 'fill-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else {
        throw new Error(`Unsupported chain: ${chainId}`);
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// ─── close-offer ──────────────────────────────────────────────────────────────
const closeOfferAction = async (offerIdArg: string, _options: any, command: Command) => {
  const globalOpts = command.optsWithGlobals();

  const ok = await confirmTx(`Close offer ${offerIdArg}. Proceed?`, command);
  if (!ok) return;

  const spinner = ora('Closing offer...').start();

  try {
    const mnemonic = getMnemonic();
    const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';

    let chainId = getOptionalChainIdFromOpts(command);
    let offerOnChainId: string;
    let offerCustomIndex: string | null = null;

    if (UUID_REGEX.test(offerIdArg.trim())) {
      const resolved = await resolveOffer(offerIdArg);
      chainId = chainId ?? resolved.chainId;
      offerOnChainId = resolved.offerIndex;
      offerCustomIndex = resolved.customIndex;
    } else {
      if (chainId == null) throw new Error('--chain-id is required when passing an on-chain ID (use a UUID to auto-resolve chain and ID)');
      offerOnChainId = offerIdArg;
    }

    const preMarket = getPreMarket(chainId, mnemonic, apiUrl);

    const offerId = isSuiChain(chainId) || isAptosChain(chainId)
      ? (offerCustomIndex ?? offerOnChainId)
      : parseOfferId(chainId, offerOnChainId);

    let tx: any;
    if (isEvmChain(chainId)) {
      tx = await (preMarket as EvmPreMarket).closeOffer(offerId as number);
    } else if (isSolanaChain(chainId)) {
      tx = await (preMarket as SolanaPreMarket).closeOffer(offerId as number);
    } else if (isSuiChain(chainId)) {
      tx = await (preMarket as SuiPreMarket).cancelOffer(offerId as string);
    } else if (isAptosChain(chainId)) {
      tx = await (preMarket as AptosPreMarket).closeOffer(offerId as string);
    } else {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    spinner.stop();
    printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: command.name() });
    await tx.wait();
    if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
  } catch (error: any) {
    spinner.stop();
    handleError(error, globalOpts.format);
  }
};

tradeCommand
  .command('close-offer <offer-id>')
  .description('Close an unfilled or partially filled offer')
  .action(closeOfferAction);

// ─── settle ───────────────────────────────────────────────────────────────────
tradeCommand
  .command('settle <order-id>')
  .description('Settle a filled order (seller delivers settlement token)')
  .option('--token-address <addr>', 'Settlement token address (EVM; auto-fetched from API when passing UUID)')
  .option('--amount <n>', 'Settlement token amount in human units (EVM; auto-fetched from API when passing UUID)')
  .option('--token-decimals <n>', 'Settlement token decimals override for EVM (auto-detected if omitted)')
  .option('--with-discount', 'Use discount API for referral-enabled chains')
  .option('--order-uuid <uuid>', 'Order UUID from API (required for --with-discount)')
  .action(async (orderIdArg, options, command) => {
    const globalOpts = command.optsWithGlobals();

    const ok = await confirmTx(`Settle order ${orderIdArg}. Proceed?`, command);
    if (!ok) return;

    const spinner = ora('Settling order...').start();

    try {
      const mnemonic = getMnemonic();
      const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';

      let chainId = getOptionalChainIdFromOpts(command);
      let orderOnChainId: string;
      let orderCustomIndex: string | null = null;
      let orderUUID: string | undefined = options.orderUuid;
      let tokenAddressFromApi: string | undefined;
      let tokenAmountFromApi: number | undefined;

      if (UUID_REGEX.test(orderIdArg.trim())) {
        const resolved = await resolveOrder(orderIdArg);
        chainId = chainId ?? resolved.chainId;
        orderOnChainId = resolved.orderIndex;
        orderCustomIndex = resolved.customIndex;
        orderUUID = orderUUID ?? orderIdArg;
        tokenAddressFromApi = resolved.tokenAddress;
        tokenAmountFromApi = resolved.tokenAmount;
      } else {
        if (chainId == null) throw new Error('--chain-id is required when passing an on-chain ID (use a UUID to auto-resolve chain and ID)');
        orderOnChainId = orderIdArg;
      }

      const preMarket = getPreMarket(chainId, mnemonic, apiUrl);

      const orderId = isSuiChain(chainId) || isAptosChain(chainId)
        ? (orderCustomIndex ?? orderOnChainId)
        : parseOrderId(chainId, orderOnChainId);

      let tx: any;
      if (isEvmChain(chainId)) {
        const pm = preMarket as EvmPreMarket;
        const tokenAddress = options.tokenAddress ?? tokenAddressFromApi;
        const amountNum = options.amount != null ? parseFloat(options.amount) : tokenAmountFromApi;
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
      } else if (isSolanaChain(chainId)) {
        const pm = preMarket as SolanaPreMarket;
        if (options.withDiscount) {
          tx = await pm.settleOrderWithDiscount({ orderId: orderId as number });
        } else {
          tx = await pm.settleOrder(orderId as number);
        }
      } else if (isSuiChain(chainId)) {
        const pm = preMarket as SuiPreMarket;
        if (options.withDiscount && orderUUID) {
          const sd = await apiClient.buildSuiSettleDiscount(orderUUID);
          if (!sd) throw new Error('Settle discount data not available from API');
          const sig = Array.isArray(sd.signature)
            ? new Uint8Array(sd.signature)
            : new Uint8Array(Buffer.from(sd.signature, 'hex'));
          tx = await pm.settleOrderWithDiscount({
            orderId: orderId as string,
            sellerDiscount: Number(sd.sellerDiscount),
            buyerDiscount: Number(sd.buyerDiscount),
            signature: sig,
          });
        } else {
          tx = await pm.settleOrder(orderId as string);
        }
      } else if (isAptosChain(chainId)) {
        const pm = preMarket as AptosPreMarket;
        if (options.withDiscount && orderUUID) {
          const orderRes = await apiClient.getOrder(orderIdArg);
          const order = (orderRes as any).data || orderRes;
          if (!order?.seller_discount || !order?.buyer_discount || !order?.signature) {
            throw new Error('Discount data not available. Fetch order from API first.');
          }
          tx = await pm.settleOrderWithDiscount({
            orderAddress: orderId as string,
            sellerDiscount: order.seller_discount,
            buyerDiscount: order.buyer_discount,
            signature: order.signature,
          });
        } else {
          tx = await pm.settleOrder(orderId as string);
        }
      } else {
        throw new Error(`Unsupported chain: ${chainId}`);
      }

      spinner.stop();
      printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'settle' });
      await tx.wait();
      if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// ─── claim-collateral ─────────────────────────────────────────────────────────
tradeCommand
  .command('claim-collateral <order-id>')
  .description('Cancel an unfilled order and reclaim collateral (buyer only)')
  .option('--with-discount', 'Use discount API for referral-enabled chains')
  .option('--order-uuid <uuid>', 'Order UUID from API (required for --with-discount)')
  .action(async (orderIdArg, options, command) => {
    const globalOpts = command.optsWithGlobals();

    const ok = await confirmTx(`Claim collateral for order ${orderIdArg}. Proceed?`, command);
    if (!ok) return;

    const spinner = ora('Claiming collateral...').start();

    try {
      const mnemonic = getMnemonic();
      const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';

      let chainId = getOptionalChainIdFromOpts(command);
      let orderOnChainId: string;
      let orderCustomIndex: string | null = null;
      let orderUUID: string | undefined = options.orderUuid;

      if (UUID_REGEX.test(orderIdArg.trim())) {
        const resolved = await resolveOrder(orderIdArg);
        chainId = chainId ?? resolved.chainId;
        orderOnChainId = resolved.orderIndex;
        orderCustomIndex = resolved.customIndex;
        orderUUID = orderUUID ?? orderIdArg;
      } else {
        if (chainId == null) throw new Error('--chain-id is required when passing an on-chain ID (use a UUID to auto-resolve chain and ID)');
        orderOnChainId = orderIdArg;
      }

      const preMarket = getPreMarket(chainId, mnemonic, apiUrl);

      const orderId = isSuiChain(chainId) || isAptosChain(chainId)
        ? (orderCustomIndex ?? orderOnChainId)
        : parseOrderId(chainId, orderOnChainId);

      let tx: any;
      if (isEvmChain(chainId)) {
        const pm = preMarket as EvmPreMarket;
        if (options.withDiscount && orderUUID) {
          tx = await pm.cancelOrderWithDiscount({
            orderId: orderId as number,
            orderUUID,
          });
        } else {
          tx = await pm.cancelOrder(orderId as number);
        }
      } else if (isSolanaChain(chainId)) {
        const pm = preMarket as SolanaPreMarket;
        if (options.withDiscount) {
          tx = await pm.cancelOrderWithDiscount({ orderId: orderId as number });
        } else {
          tx = await pm.cancelOrder(orderId as number);
        }
      } else if (isSuiChain(chainId)) {
        const pm = preMarket as SuiPreMarket;
        if (options.withDiscount && orderUUID) {
          const discountData = await apiClient.buildSuiCancelDiscount(orderUUID);
          const sd = discountData?.settleDiscount;
          if (!sd) throw new Error('Cancel discount data not available from API');
          const onChainOrderId = discountData?.order?.custom_index || (orderId as string);
          const sig = Array.isArray(sd.signature)
            ? new Uint8Array(sd.signature)
            : new Uint8Array(Buffer.from(sd.signature, 'hex'));
          tx = await pm.cancelOrderWithDiscount({
            orderId: onChainOrderId,
            sellerDiscount: Number(sd.sellerDiscount),
            buyerDiscount: Number(sd.buyerDiscount),
            signature: sig,
          });
        } else {
          tx = await pm.cancelOrder(orderId as string);
        }
      } else if (isAptosChain(chainId)) {
        const pm = preMarket as AptosPreMarket;
        if (options.withDiscount && orderUUID) {
          const orderRes = await apiClient.getOrder(orderIdArg);
          const order = (orderRes as any).data || orderRes;
          if (!order?.seller_discount || !order?.buyer_discount || !order?.signature) {
            throw new Error('Discount data not available. Fetch order from API first.');
          }
          tx = await pm.cancelOrderWithDiscount({
            orderAddress: orderId as string,
            sellerDiscount: order.seller_discount,
            buyerDiscount: order.buyer_discount,
            signature: order.signature,
          });
        } else {
          tx = await pm.cancelOrder(orderId as string);
        }
      } else {
        throw new Error(`Unsupported chain: ${chainId}`);
      }

      spinner.stop();
      printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'claim-collateral' });
      await tx.wait();
      if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });
