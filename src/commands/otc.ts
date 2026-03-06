import { Command } from 'commander';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import ora from 'ora';
import { config } from '../config';
import { confirmTx } from './helpers/confirm';
import {
  getOtcPreMarket,
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

function getChainIdFromOpts(command: Command): number {
  const chainId = command.optsWithGlobals().chainId;
  return typeof chainId === 'string' ? parseInt(chainId, 10) : (chainId ?? 666666);
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
  .requiredOption('--price <n>', 'Resell price in exToken units (e.g. 50 for 50 USDC)')
  .requiredOption('--deadline <unix-ts>', 'Offer deadline (unix timestamp)')
  .requiredOption('--ex-token <addr>', 'Exchange token address')
  .option('--ex-token-decimals <n>', 'Exchange token decimals for EVM (default: 6)', '6')
  .action(async (orderIdArg, options, command) => {
    const globalOpts = command.optsWithGlobals();
    const chainId = getChainIdFromOpts(command);

    const ok = await confirmTx(`Create OTC offer for order ${orderIdArg} @ ${options.price}. Proceed?`, command);
    if (!ok) return;

    const spinner = ora('Creating OTC offer...').start();

    try {
      const mnemonic = getMnemonic();
      const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';
      const otc = getOtcPreMarket(chainId, mnemonic, apiUrl);

      const orderId = parseOrderId(chainId, orderIdArg) as number;
      const price = parseFloat(options.price);
      const deadline = parseInt(options.deadline, 10);
      if (isNaN(deadline)) throw new Error('--deadline must be a valid unix timestamp');

      if (isEvmChain(chainId)) {
        const exDecimals = parseInt(options.exTokenDecimals, 10) || 6;
        const value = parseUnits(price.toString(), exDecimals);

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
        const value = new BN(Math.round(price * 1_000_000));
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
    const chainId = getChainIdFromOpts(command);

    const ok = await confirmTx(`Fill OTC offer ${otcOfferIdArg}. Proceed?`, command);
    if (!ok) return;

    const spinner = ora('Filling OTC offer...').start();

    try {
      const mnemonic = getMnemonic();
      const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';
      const otc = getOtcPreMarket(chainId, mnemonic, apiUrl);

      if (isEvmChain(chainId)) {
        const offerId = otcOfferIdArg;
        let tx: any;
        if (options.withDiscount && options.offerUuid) {
          tx = await (otc as any).fillOfferWithDiscount({
            offerId,
            offerUUID: options.offerUuid,
          });
        } else {
          tx = await (otc as any).fillOffer(offerId);
        }
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'otc fill' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSolanaChain(chainId)) {
        const otcOfferPubkey = new PublicKey(otcOfferIdArg);
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
  .action(async (otcOfferIdArg, options, command) => {
    const globalOpts = command.optsWithGlobals();
    const chainId = getChainIdFromOpts(command);

    const ok = await confirmTx(`Cancel OTC offer ${otcOfferIdArg}. Proceed?`, command);
    if (!ok) return;

    const spinner = ora('Cancelling OTC offer...').start();

    try {
      const mnemonic = getMnemonic();
      const apiUrl = (config.get('apiUrl') as string) || 'https://api.whales.market';
      const otc = getOtcPreMarket(chainId, mnemonic, apiUrl);

      if (isEvmChain(chainId)) {
        const tx = await (otc as any).cancelOffer(otcOfferIdArg);
        spinner.stop();
        printTxResultTable(tx, { explorerUrl: getExplorerUrl(chainId), action: 'otc cancel' });
        await tx.wait();
        if (globalOpts.format !== 'json') console.log('Confirmed on-chain.');
      } else if (isSolanaChain(chainId)) {
        const otcOfferPubkey = new PublicKey(otcOfferIdArg);
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
