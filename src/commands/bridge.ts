import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { config } from '../config';
import { apiClient } from '../api';
import { handleError } from '../output';
import { getOFTBridge, OFTBridgeTokenConfig } from './helpers/chain';
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
      const walletAddress = bridge.cfg.signer.address;

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
      const walletAddress = bridge.cfg.signer.address;

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
      console.log(`\n  OFT balance:      ${ethers.formatUnits(oftBalance, decimals)} ${symbol}`);
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
