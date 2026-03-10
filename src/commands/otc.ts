import { Command } from 'commander';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import ora from 'ora';
import { config } from '../config';
import { confirmTx } from './helpers/confirm';
import {
  UUID_REGEX,
  getOptionalChainIdFromOpts,
  resolveOtcOffer,
  resolveOrder,
} from './helpers/resolve';
import {
  getOtcPreMarket,
  getPreMarket,
  isEvmChain,
  isSolanaChain,
  parseOrderId,
  SOLANA_MAINNET_CHAIN_ID,
  SOLANA_DEVNET_CHAIN_ID,
} from './helpers/chain';
import { handleError, printTxResultTable } from '../output';
import { parseUnits } from '../blockchain/evm/utils';
import { EVM_CHAINS } from '../blockchain/evm/constants';

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

export const otcCommand = new Command('otc')
  .description('OTC resell — resell a pre-market order position to a new buyer');

// ─── create ──────────────────────────────────────────────────────────────────
otcCommand
  .command('create <order-id>')
  .description('Create an OTC offer to resell your order position (buyer only)')
  .requiredOption('--price <n>', 'Resell price per token in exToken units (e.g. 1.5 for 1.5 USDC per token)')
  .requiredOption('--ex-token <addr>', 'Exchange token address')
  .option('--deadline <unix-ts>', 'Offer deadline (default: 1 year from now)')
  .action(async (orderIdArg, options, command) => {
    const globalOpts = command.optsWithGlobals();

    const ok = await confirmTx(
      `Create OTC offer for order ${orderIdArg} @ ${options.price} per token. Proceed?`,
      command
    );
    if (!ok) return;

    const spinner = ora('Creating OTC offer...').start();

    try {
      const mnemonic = getMnemonic();
      const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';

      let chainId = getOptionalChainIdFromOpts(command);
      let orderOnChainId: string;

      if (UUID_REGEX.test(orderIdArg.trim())) {
        const resolved = await resolveOrder(orderIdArg);
        chainId = chainId ?? resolved.chainId;
        orderOnChainId = resolved.orderIndex;
      } else {
        if (chainId == null) throw new Error('--chain-id is required when passing an on-chain ID (use a UUID to auto-resolve chain and ID)');
        orderOnChainId = orderIdArg;
      }

      const otc = getOtcPreMarket(chainId, mnemonic, apiUrl);

      const orderId = parseInt(orderOnChainId, 10);
      if (isNaN(orderId)) throw new Error(`Invalid order ID: ${orderOnChainId}`);
      const pricePerToken = parseFloat(options.price);
      const deadline = options.deadline
        ? parseInt(options.deadline, 10)
        : Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // default: 1 year
      if (isNaN(deadline)) throw new Error('--deadline must be a valid unix timestamp');

      // Fetch order to get amount — value = price × amount (total collateral)
      const preMarket = getPreMarket(chainId, mnemonic, apiUrl);
      const order = await (preMarket as any).getOrder(orderId);
      const amount = order?.amount ?? 0;
      if (!amount || amount <= 0) throw new Error(`Order ${orderIdArg} not found or has zero amount`);
      const totalValue = pricePerToken * amount;

      if (isEvmChain(chainId)) {
        const exDecimals = await (preMarket as any).getTokenDecimals(options.exToken);
        const value = parseUnits(totalValue.toString(), exDecimals);

        const tx = await (otc as any).createOffer({
          orderId,
          exTokenAddress: options.exToken,
          value,
          deadline,
        });
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'otc create' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSolanaChain(chainId)) {
        const exToken = new PublicKey(options.exToken);
        const exDecimals = await (preMarket as any).getTokenDecimals(options.exToken);
        const value = new BN(Math.round(totalValue * Math.pow(10, exDecimals)));
        const deadlineBN = new BN(deadline);

        const tx = await (otc as any).createOffer({
          orderId,
          exToken,
          value,
          deadline: deadlineBN,
        });
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'otc create' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else {
        throw new Error('OTC is only supported on EVM and Solana. Use --chain-id 1, 8453, 666666, etc.');
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// ─── fill ────────────────────────────────────────────────────────────────────
otcCommand
  .command('fill <otc-offer-id>')
  .description('Fill an OTC offer (become the new buyer of the order position)')
  .option('--with-discount', 'Use discount API for referral-enabled chains')
  .option('--offer-uuid <uuid>', 'OTC offer UUID from API (required for --with-discount)')
  .action(async (otcOfferIdArg, options, command) => {
    const globalOpts = command.optsWithGlobals();

    const ok = await confirmTx(`Fill OTC offer ${otcOfferIdArg}. Proceed?`, command);
    if (!ok) return;

    const spinner = ora('Filling OTC offer...').start();

    try {
      const mnemonic = getMnemonic();
      const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';

      let chainId = getOptionalChainIdFromOpts(command);
      let otcOnChainId: string;
      let offerUUID: string | undefined = options.offerUuid;

      if (UUID_REGEX.test(otcOfferIdArg.trim())) {
        const resolved = await resolveOtcOffer(otcOfferIdArg);
        chainId = chainId ?? resolved.chainId;
        otcOnChainId = resolved.exitPositionIndex;
        offerUUID = offerUUID ?? otcOfferIdArg;
      } else {
        if (chainId == null) throw new Error('--chain-id is required when passing an on-chain ID (use a UUID to auto-resolve chain and ID)');
        otcOnChainId = otcOfferIdArg;
      }

      const otc = getOtcPreMarket(chainId, mnemonic, apiUrl);

      if (isEvmChain(chainId)) {
        const offerId = otcOnChainId;
        let tx: any;
        if (options.withDiscount && offerUUID) {
          tx = await (otc as any).fillOfferWithDiscount({
            offerId,
            offerUUID,
          });
        } else {
          tx = await (otc as any).fillOffer(offerId);
        }
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'otc fill' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSolanaChain(chainId)) {
        const otcOfferPubkey = new PublicKey(otcOnChainId);
        const tx = await (otc as any).fillOffer(otcOfferPubkey);
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'otc fill' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else {
        throw new Error('OTC is only supported on EVM and Solana. Use --chain-id 1, 8453, 666666, etc.');
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// ─── cancel ───────────────────────────────────────────────────────────────────
otcCommand
  .command('cancel <otc-offer-id>')
  .description('Cancel an OTC offer (reclaim the order position)')
  .action(async (otcOfferIdArg, _options, command) => {
    const globalOpts = command.optsWithGlobals();

    const ok = await confirmTx(`Cancel OTC offer ${otcOfferIdArg}. Proceed?`, command);
    if (!ok) return;

    const spinner = ora('Cancelling OTC offer...').start();

    try {
      const mnemonic = getMnemonic();
      const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';

      let chainId = getOptionalChainIdFromOpts(command);
      let otcOnChainId: string;

      if (UUID_REGEX.test(otcOfferIdArg.trim())) {
        const resolved = await resolveOtcOffer(otcOfferIdArg);
        chainId = chainId ?? resolved.chainId;
        otcOnChainId = resolved.exitPositionIndex;
      } else {
        if (chainId == null) throw new Error('--chain-id is required when passing an on-chain ID (use a UUID to auto-resolve chain and ID)');
        otcOnChainId = otcOfferIdArg;
      }

      const otc = getOtcPreMarket(chainId, mnemonic, apiUrl);

      if (isEvmChain(chainId)) {
        const tx = await (otc as any).cancelOffer(otcOnChainId);
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'otc cancel' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSolanaChain(chainId)) {
        const otcOfferPubkey = new PublicKey(otcOnChainId);
        const tx = await (otc as any).cancelOffer(otcOfferPubkey);
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'otc cancel' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else {
        throw new Error('OTC is only supported on EVM and Solana. Use --chain-id 1, 8453, 666666, etc.');
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });
