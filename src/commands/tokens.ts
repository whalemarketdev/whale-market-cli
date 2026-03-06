import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { apiClient } from '../api';
import { handleOutput, handleError, printTokensTable, printTokensTableDetailed, printDetailTable, formatPrice } from '../output';
import { getExTokensForChain, formatExTokensForDisplay } from '../blockchain/evm/ex-tokens';

export const tokensCommand = new Command('tokens')
  .description('Token operations');

// List tokens (uses V2 API - same as whales.market frontend)
tokensCommand
  .command('list')
  .description('List all tokens')
  .option('--status <status>', 'Filter by status (active|settling|ended)')
  .option('--chain <id>', 'Filter by chain ID')
  .option('--limit <n>', 'Limit results', '20')
  .option('--page <n>', 'Page number', '1')
  .option('--detailed', 'Show detailed information with full addresses')
  .option('--no-fdv', 'Hide Implied FDV column')
  .option('--no-volume', 'Hide 24h Volume column')
  .option('--no-total-vol', 'Hide Total Volume column')
  .option('--show-address', 'Show Token ID/Address column')
  .option('--sort <sort>', 'Sort by (vol|price|created) - vol default', 'vol')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching tokens...').start();
    
    try {
      const params: any = {
        take: parseInt(options.limit),
        page: parseInt(options.page),
        type: 'pre_market',
        category: 'pre_market',
        sort_vol: 'DESC'
      };
      
      // Status filter - default: active + settling (like frontend)
      if (options.status) {
        params.statuses = [options.status];
      } else {
        params.statuses = ['active', 'settling'];
      }
      
      if (options.chain) params.chain_id = parseInt(options.chain);
      
      // Sort option
      if (options.sort === 'price') {
        delete params.sort_vol;
        params.sort_last_price = 'DESC';
      } else if (options.sort === 'created') {
        delete params.sort_vol;
        params.sort_created_at = 'DESC';
      }
      
      const response: any = await apiClient.getTokensV2(params);
      spinner.stop();
      
      // V2 API returns { data: { count, list: [...] } }
      const tokens = response.data?.list || response.data || [];
      
      // FDV, 24h Vol, Total Vol shown by default
      const showFdv = options.fdv !== false;
      const showVolume = options.volume !== false;
      const showTotalVol = options.totalVol !== false;
      const showAddress = !!options.showAddress;

      // If detailed mode or JSON/plain format, show full data
      if (options.detailed || globalOpts.format === 'json' || globalOpts.format === 'plain') {
        handleOutput(
          tokens,
          globalOpts.format,
          options.detailed ? printTokensTableDetailed : (data: any) => printTokensTable(data, {
            showFdv,
            showVolume,
            showTotalVol,
            showAddress
          })
        );
      } else {
        handleOutput(
          tokens,
          globalOpts.format,
          (data: any) => printTokensTable(data, {
            showFdv,
            showVolume,
            showTotalVol,
            showAddress
          })
        );
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// Get token by ID (UUID) or symbol
tokensCommand
  .command('get <token-id>')
  .description('Get token details by UUID or symbol')
  .action(async (tokenId, options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching token...').start();

    try {
      let token: any = null;

      // 1. Try detail endpoint (works when server supports UUID)
      try {
        const response = await apiClient.getToken(tokenId);
        token = response.data || response;
      } catch {
        // 2. Fallback: get from list with ids filter (works on dev API)
        const res: any = await apiClient.getTokensV2({
          ids: tokenId,
          type: 'pre_market',
          category: 'pre_market',
          statuses: ['active', 'settling', 'ended'],
          take: 1,
          page: 1
        });
        const list = res.data?.list || res.data || [];
        if (list.length > 0) {
          token = list[0];
        }
      }

      if (!token) {
        spinner.stop();
        throw new Error('Token not found');
      }

      spinner.stop();

      if (globalOpts.format === 'json') {
        handleOutput(token, globalOpts.output, () => {});
      } else {
        const priceVal = token.price && parseFloat(token.price.toString()) > 0 ? token.price : token.last_price;
        const chainId = token.chain_id ?? token.network?.chain_id;
        const chainIdNum = chainId != null ? parseInt(String(chainId), 10) : undefined;
        const addr = token.address || token.pre_token_address || token.tge_token_address || token.tge_oft_address || '-';
        const preAddr = token.pre_token_address || '-';
        const tgeAddr = token.tge_token_address || token.tge_oft_address || '-';
        // Prefer accepted_tokens from API if available, else use static list
        const apiAccepted = token.accepted_tokens as Array<{ symbol?: string; address?: string }> | undefined;
        let exTokensDisplay: string;
        if (apiAccepted?.length) {
          exTokensDisplay = apiAccepted.map((t) => `${t.symbol || '?'}: ${t.address || '-'}`).join('\n           ');
        } else {
          exTokensDisplay = chainIdNum != null ? formatExTokensForDisplay(chainIdNum) : '-';
        }

        const detailRows: [string, string][] = [
          ['ID', token.id || '-'],
          ['Name', token.name || '-'],
          ['Symbol', token.symbol || '-'],
          ['Status', token.status || '-'],
          ['Price', formatPrice(priceVal)],
          ['Chain ID', String(chainId ?? '-')],
          ['Token ID', token.token_id || '-'],
          ['Address', addr],
          ['Pre Token Address', preAddr],
          ['TGE Token Address', tgeAddr],
          ['Accepted ex-tokens (--ex-token)', exTokensDisplay],
          ['Description', token.description || token.token_info?.description || '-']
        ];
        printDetailTable(detailRows);
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// List accepted ex-tokens (collateral) for a chain - for trade create-offer --ex-token
tokensCommand
  .command('ex-tokens')
  .description('List accepted ex-tokens (collateral) for a chain - use with --chain-id')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const chainId = parseInt(String(globalOpts.chainId ?? 97), 10);
    const tokens = getExTokensForChain(chainId);

    if (globalOpts.format === 'json') {
      console.log(JSON.stringify({ chainId, tokens }, null, 2));
      return;
    }

    if (tokens.length === 0) {
      console.log(`No ex-tokens for chain ${chainId}. Use --chain-id to specify chain.`);
      return;
    }

    console.log(chalk.cyan(`\nAccepted ex-tokens for chain ${chainId} (use with --ex-token):\n`));
    printDetailTable(
      tokens.map((t) => [t.symbol, `${t.address} (${t.decimals} decimals)`])
    );
    console.log(chalk.gray('\nExample: whale trade create-offer --token <token_id> --side buy --price 0.5 --amount 1000 --ex-token <address above> --chain-id ' + chainId + '\n'));
  });

// Search tokens (uses V2 API)
tokensCommand
  .command('search <query>')
  .description('Search tokens')
  .option('--limit <n>', 'Limit results', '10')
  .action(async (query, options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Searching tokens...').start();
    
    try {
      const params: any = {
        search: query,
        take: parseInt(options.limit),
        type: 'pre_market',
        category: 'pre_market',
        statuses: ['active', 'settling']
      };
      
      const response: any = await apiClient.getTokensV2(params);
      spinner.stop();
      
      const tokens = response.data?.list || response.data || [];
      
      handleOutput(
        tokens,
        globalOpts.format,
        (data: any) => printTokensTable(data, { showFdv: true, showVolume: true })
      );
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// Highlight tokens
tokensCommand
  .command('highlight')
  .description('Get highlighted/trending tokens')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching highlighted tokens...').start();
    
    try {
      const response = await apiClient.get('/tokens/highlight') as any;
      spinner.stop();
      
      const tokens = response.data || response || [];
      
      handleOutput(
        tokens,
        globalOpts.format,
        (data: any) => printTokensTable(data, { showFdv: true, showVolume: true })
      );
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// Stats
tokensCommand
  .command('stats')
  .description('Get prediction stats for all tokens')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching stats...').start();
    
    try {
      const response = await apiClient.get('/tokens/prediction-stats') as any;
      spinner.stop();
      
      const stats = response.data || response;
      
      handleOutput(
        stats,
        globalOpts.format,
        (data) => {
          if (Array.isArray(data)) {
            printTokensTable(data);
          } else {
            printDetailTable(Object.entries(data).map(([k, v]) => [k, String(v)]));
          }
        }
      );
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });
