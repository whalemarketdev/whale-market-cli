import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../api';
import { auth } from '../auth';
import { config } from '../config';
import { handleOutput, handleError, printDetailTable, printOrdersTable } from '../output';
import { getChainAdapter } from './helpers/chain';

export const portfolioCommand = new Command('portfolio')
  .description('Portfolio & positions');

// Show portfolio
portfolioCommand
  .command('show')
  .description('Show portfolio summary')
  .option('--address <addr>', 'Wallet address (defaults to configured wallet)')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching portfolio...').start();
    
    try {
      const address = options.address || auth.getAddress();
      
      // Get offers and orders for this address
      const [offersResponse, ordersResponse] = await Promise.all([
        apiClient.getOffersByAddress(address).catch(() => ({ data: [] })),
        apiClient.getOrdersByAddress(address).catch(() => ({ data: [] }))
      ]);
      
      const offers = offersResponse.data || [];
      const orders = ordersResponse.data || [];
      
      spinner.stop();
      
      if (globalOpts.format === 'json') {
        handleOutput({
          address,
          offers: offers.length,
          orders: orders.length,
          offersList: offers,
          ordersList: orders
        }, globalOpts.format, () => {});
      } else {
        console.log(`\nPortfolio for ${address}\n`);
        printDetailTable([
          ['Total Offers', String(offers.length)],
          ['Total Orders', String(orders.length)],
          ['Open Offers', String(offers.filter((o: any) => o.status === 'open').length)],
          ['Filled Orders', String(orders.filter((o: any) => o.status === 'filled').length)]
        ]);
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// Positions
portfolioCommand
  .command('positions')
  .description('List positions')
  .option('--type <type>', 'Filter by type (open|filled)')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching positions...').start();
    
    try {
      const address = auth.getAddress();
      const response = await apiClient.getOrdersByAddress(address);
      spinner.stop();
      
      let orders = response.data || [];
      
      if (options.type) {
        orders = orders.filter((order: any) => order.status === options.type);
      }
      
      handleOutput(
        orders,
        globalOpts.format,
        printOrdersTable
      );
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// Balance (on-chain via ChainAdapter)
portfolioCommand
  .command('balance')
  .description('Show on-chain token balances')
  .option('--chain <evm|solana|sui|aptos>', 'Chain to query (default: from --chain-id)')
  .option('--token <addr>', 'Token address/mint (omit for native balance)')
  .option('--address <addr>', 'Wallet address (default: from active wallet)')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching balance...').start();

    try {
      const wallet = config.getActiveWallet();
      if (!wallet?.mnemonic) {
        throw new Error('No wallet configured. Run: whales setup or whales wallet import');
      }

      let chainId: number;
      if (options.chain) {
        const chainMap: Record<string, number> = {
          evm: 1,
          solana: 666666,
          sui: 900000,
          aptos: 900001,
        };
        chainId = chainMap[options.chain.toLowerCase()] ?? 666666;
      } else {
        chainId = typeof globalOpts.chainId === 'string'
          ? parseInt(globalOpts.chainId, 10)
          : (globalOpts.chainId ?? 666666);
      }

      const adapter = getChainAdapter(chainId);
      const address = options.address || await adapter.getAddress(wallet.mnemonic);
      const tokenAddress = options.token;

      const balance = await adapter.getBalance(address, tokenAddress);
      spinner.stop();

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({
          address,
          chainId,
          token: tokenAddress || 'native',
          balance,
        }, null, 2));
      } else {
        const tokenLabel = tokenAddress ? `Token (${tokenAddress.slice(0, 12)}…)` : 'Native';
        printDetailTable([
          ['Address', address],
          ['Chain ID', String(chainId)],
          [tokenLabel, balance],
        ]);
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });
