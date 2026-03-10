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
  SOLANA_MAINNET_CHAIN_ID,
  SOLANA_DEVNET_CHAIN_ID,
} from './helpers/chain';
import { handleError, printTxResultTable } from '../output';
import { ETH_ADDRESS, parseUnits } from '../blockchain/evm/utils';
import { EVM_CHAINS } from '../blockchain/evm/constants';
import { apiClient } from '../api';

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
  .requiredOption('--ex-token <addr>', 'Exchange token address (USDC, ETH, etc.)')
  .option('--full-match', 'Require full match only')
  .option('--token-config <addr>', 'Token config address (required for Sui/Aptos)')
  .option('--coin-type <type>', 'Coin type for Sui (e.g. 0x2::sui::SUI)')
  .option('--ex-token-decimals <n>', 'Exchange token decimals (default: 6 for ERC20, 18 for ETH)', '6')
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
      chainId = chainId ?? 666666;
    }

    const collateral = amount * price; // exToken units for EVM, USD for Solana/Sui/Aptos

    // $10 minimum check — EVM price is in exToken units, need API price to convert to USD
    let collateralUsd = collateral; // default: price is in USD (Solana/Sui/Aptos)
    if (isEvmChain(chainId) && options.exToken) {
      try {
        const prices = await apiClient.getExTokenPrices(chainId);
        const exTokenLower = (options.exToken as string).toLowerCase();
        const tokenPrice = prices.find((p: any) => p.address?.toLowerCase() === exTokenLower)?.price;
        if (tokenPrice) collateralUsd = collateral * tokenPrice;
      } catch {
        // API unavailable — fall through with collateral as-is
      }
    }

    if (collateralUsd < 10) {
      handleError(
        new Error(`Minimum collateral is $10. Got $${collateralUsd.toFixed(2)}.`),
        globalOpts.format
      );
      return;
    }
    const ok = await confirmTx(
      `Create ${options.side} offer: ${amount} tokens @ ${isEvmChain(chainId) ? price + ' exToken' : '$' + price} = $${collateralUsd.toFixed(2)} collateral. Proceed?`,
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
        // EVM contract uses bytes32 for tokenId - accept hex string (0x...) or numeric
        const tokenId =
          tokenOnChainId.startsWith('0x') && tokenOnChainId.length === 66
            ? tokenOnChainId
            : (() => {
                const n = parseInt(tokenOnChainId, 10);
                if (isNaN(n)) throw new Error('--token must be numeric, bytes32 hex (0x + 64 chars), or token UUID for EVM');
                return n;
              })();
        const exTokenAddress = options.exToken;
        const exDecimals = parseInt(options.exTokenDecimals, 10) || (exTokenAddress === ETH_ADDRESS ? 18 : 6);
        const collateral = parseUnits((amount * price).toString(), exDecimals);

        const tx = await (preMarket as any).createOffer({
          tokenId,
          side: options.side,
          amount,
          collateral,
          exTokenAddress,
          isFullMatch,
        });
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'create-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSolanaChain(chainId)) {
        const tokenId = parseInt(tokenOnChainId, 10);
        if (isNaN(tokenId)) throw new Error('--token must be numeric or token UUID for Solana');
        const exToken = new PublicKey(options.exToken);
        const rawPrice = Math.round(price * WEI6);

        const tx = await (preMarket as any).createOffer({
          tokenId,
          side: options.side,
          exToken,
          amount,
          price: rawPrice,
          isFullMatch,
        });
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'create-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSuiChain(chainId)) {
        const tokenConfig = options.tokenConfig || tokenOnChainId;
        if (!tokenConfig) throw new Error('--token-config is required for Sui');
        const coinType = options.coinType || '0x2::sui::SUI';
        const rawAmount = BigInt(Math.round(amount * WEI6));
        const rawValue = BigInt(Math.round(amount * price * WEI6));

        const tx = await (preMarket as any).createOffer({
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
        const tokenConfig = options.tokenConfig || tokenOnChainId;
        if (!tokenConfig) throw new Error('--token-config is required for Aptos');
        const rawValue = Math.round(amount * price * WEI6);

        const tx = await (preMarket as any).createOffer({
          tokenConfig,
          exToken: options.exToken,
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
        const offerData = await (preMarket as any).getOffer(offerId as number);
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

        // $10 minimum collateral check
        try {
          const prices = await apiClient.getExTokenPrices(chainId);
          const tokenPrice = prices.find((p: any) =>
            p.address.toLowerCase() === exTokenAddress.toLowerCase()
          )?.price;
          if (tokenPrice) {
            const totalCollateralUi = parseFloat(offerData.collateral.uiAmount);
            const fillCollateralUi = totalCollateralUi * (amount / offerData.totalAmount);
            const fillCollateralUsd = fillCollateralUi * tokenPrice;
            const remainingAmount = offerData.totalAmount - offerData.filledAmount - amount;
            const remainingUsd = totalCollateralUi * Math.max(0, remainingAmount) / offerData.totalAmount * tokenPrice;
            if (fillCollateralUsd < 10 && remainingUsd >= 10) {
              throw new Error(`Fill amount too small: $${fillCollateralUsd.toFixed(2)} collateral is below the $10 minimum.`);
            }
          }
        } catch (err: any) {
          if (err.message?.includes('$10')) throw err;
        }

        const tx = await (preMarket as any).fillOffer({
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
        const amount = options.amount ? parseFloat(options.amount) : (await (preMarket as any).getOffer(offerId as number)).totalAmount - (await (preMarket as any).getOffer(offerId as number)).filledAmount;

        const tx = await (preMarket as any).fillOffer({
          offerId: offerId as number,
          amount: amount || (await (preMarket as any).getOffer(offerId as number)).totalAmount,
        });
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'fill-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSuiChain(chainId)) {
        const offerData = await (preMarket as any).getOffer(offerId as string);
        const amount = options.amount ? parseFloat(options.amount) : offerData.totalAmount - offerData.filledAmount;
        const rawAmount = BigInt(Math.round(amount * WEI6));

        const tx = await (preMarket as any).fillOffer({
          offerId: offerId as string,
          amount: rawAmount,
        });
        spinner.stop();
        printTxResultTable(tx, { action: 'fill-offer' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isAptosChain(chainId)) {
        const offerData = await (preMarket as any).getOffer(offerId as string);
        const amount = options.amount ? parseFloat(options.amount) : offerData.totalAmount - offerData.filledAmount;

        const tx = await (preMarket as any).fillOffer({
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
      chainId = chainId ?? 666666;
      offerOnChainId = offerIdArg;
    }

    const preMarket = getPreMarket(chainId, mnemonic, apiUrl);

    const offerId = isSuiChain(chainId) || isAptosChain(chainId)
      ? (offerCustomIndex ?? offerOnChainId)
      : parseOfferId(chainId, offerOnChainId);

    let tx: any;
    if (isEvmChain(chainId)) {
      tx = await (preMarket as any).closeOffer(offerId as number);
    } else if (isSolanaChain(chainId)) {
      tx = await (preMarket as any).closeOffer(offerId as number);
    } else if (isSuiChain(chainId)) {
      tx = await (preMarket as any).cancelOffer(offerId as string);
    } else if (isAptosChain(chainId)) {
      tx = await (preMarket as any).closeOffer(offerId as string);
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
  .option('--token-address <addr>', 'Settlement token address (EVM: required)')
  .option('--amount <n>', 'Settlement token amount in human units (EVM: required)')
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
        const tokenAddress = options.tokenAddress;
        const amount = options.amount;
        if (!tokenAddress || amount === undefined || amount === null) {
          throw new Error('EVM settle requires --token-address and --amount');
        }
        const decimals = options.tokenDecimals !== undefined
          ? parseInt(options.tokenDecimals, 10)
          : await (preMarket as any).getTokenDecimals(tokenAddress);
        const rawAmount = parseUnits(amount.toString(), decimals);
        if (options.withDiscount && orderUUID) {
          tx = await (preMarket as any).settleOrderWithDiscount({
            orderId: orderId as number,
            orderUUID,
            tokenAddress,
            amount: rawAmount,
          });
        } else {
          tx = await (preMarket as any).settleOrder({
            orderId: orderId as number,
            tokenAddress,
            amount: rawAmount,
          });
        }
      } else if (isSolanaChain(chainId)) {
        if (options.withDiscount) {
          tx = await (preMarket as any).settleOrderWithDiscount({ orderId: orderId as number });
        } else {
          tx = await (preMarket as any).settleOrder(orderId as number);
        }
      } else if (isSuiChain(chainId)) {
        if (options.withDiscount && orderUUID) {
          const sd = await apiClient.buildSuiSettleDiscount(orderUUID);
          if (!sd) throw new Error('Settle discount data not available from API');
          const sig = Array.isArray(sd.signature)
            ? new Uint8Array(sd.signature)
            : new Uint8Array(Buffer.from(sd.signature, 'hex'));
          tx = await (preMarket as any).settleOrderWithDiscount({
            orderId: orderId as string,
            sellerDiscount: Number(sd.sellerDiscount),
            buyerDiscount: Number(sd.buyerDiscount),
            signature: sig,
          });
        } else {
          tx = await (preMarket as any).settleOrder(orderId as string);
        }
      } else if (isAptosChain(chainId)) {
        if (options.withDiscount && orderUUID) {
          const orderRes = await apiClient.getOrder(orderIdArg);
          const order = (orderRes as any).data || orderRes;
          if (!order?.seller_discount || !order?.buyer_discount || !order?.signature) {
            throw new Error('Discount data not available. Fetch order from API first.');
          }
          tx = await (preMarket as any).settleOrderWithDiscount({
            orderAddress: orderId as string,
            sellerDiscount: order.seller_discount,
            buyerDiscount: order.buyer_discount,
            signature: order.signature,
          });
        } else {
          tx = await (preMarket as any).settleOrder(orderId as string);
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
        if (options.withDiscount && orderUUID) {
          tx = await (preMarket as any).cancelOrderWithDiscount({
            orderId: orderId as number,
            orderUUID,
          });
        } else {
          tx = await (preMarket as any).cancelOrder(orderId as number);
        }
      } else if (isSolanaChain(chainId)) {
        if (options.withDiscount) {
          tx = await (preMarket as any).cancelOrderWithDiscount({ orderId: orderId as number });
        } else {
          tx = await (preMarket as any).cancelOrder(orderId as number);
        }
      } else if (isSuiChain(chainId)) {
        if (options.withDiscount && orderUUID) {
          const discountData = await apiClient.buildSuiCancelDiscount(orderUUID);
          const sd = discountData?.settleDiscount;
          if (!sd) throw new Error('Cancel discount data not available from API');
          const onChainOrderId = discountData?.order?.custom_index || (orderId as string);
          const sig = Array.isArray(sd.signature)
            ? new Uint8Array(sd.signature)
            : new Uint8Array(Buffer.from(sd.signature, 'hex'));
          tx = await (preMarket as any).cancelOrderWithDiscount({
            orderId: onChainOrderId,
            sellerDiscount: Number(sd.sellerDiscount),
            buyerDiscount: Number(sd.buyerDiscount),
            signature: sig,
          });
        } else {
          tx = await (preMarket as any).cancelOrder(orderId as string);
        }
      } else if (isAptosChain(chainId)) {
        if (options.withDiscount && orderUUID) {
          const orderRes = await apiClient.getOrder(orderIdArg);
          const order = (orderRes as any).data || orderRes;
          if (!order?.seller_discount || !order?.buyer_discount || !order?.signature) {
            throw new Error('Discount data not available. Fetch order from API first.');
          }
          tx = await (preMarket as any).cancelOrderWithDiscount({
            orderAddress: orderId as string,
            sellerDiscount: order.seller_discount,
            buyerDiscount: order.buyer_discount,
            signature: order.signature,
          });
        } else {
          tx = await (preMarket as any).cancelOrder(orderId as string);
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
