import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { apiClient } from '../api';
import { auth } from '../auth';
import { config } from '../config';
import { handleOutput, handleError, printOffersTable, printDetailTable } from '../output';

export const offersCommand = new Command('offers')
  .description('Offer management');

// List offers
offersCommand
  .command('list')
  .description('List all offers')
  .option('--type <type>', 'Filter by type (buy|sell)')
  .option('--token <id>', 'Filter by token ID')
  .option('--limit <n>', 'Limit results', '20')
  .option('--page <n>', 'Page number', '1')
  .option('--debug', 'Show API URL being used')
  .option('--v2', 'Use /v2/offers (returns address; EVM offers only, no point market)')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const apiUrl = config.get('apiUrl') as string;
    const useV2 = options.v2;
    const path = useV2 ? '/v2/offers' : '/transactions/offers';
    const spinner = ora('Fetching offers...').start();

    try {
      const params: any = {
        take: parseInt(options.limit),
        page: parseInt(options.page),
        symbol: ''
      };
      if (options.type) params.type = options.type;

      const extractList = (res: any) => {
        const d = res?.data ?? res;
        return Array.isArray(d) ? d : (d?.list ?? []);
      };

      let offers: any[] = [];
      if (options.token) {
        params.token_id = options.token;
        // Token may be pre_market or point_market - fetch both and merge
        const fetchOffers = useV2 ? apiClient.getOffersV2.bind(apiClient) : apiClient.getOffers.bind(apiClient);
        const [res1, res2] = await Promise.all([
          fetchOffers({ ...params, category_token: 'pre_market' }),
          fetchOffers({ ...params, category_token: 'point_market' })
        ]);
        const list1 = extractList(res1);
        const list2 = extractList(res2);
        const seen = new Set<string>();
        offers = [...list1, ...list2].filter((o: any) => {
          const key = `${o.id ?? o.offer_index}-${o.network?.chain_id ?? o.chain_id ?? ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else {
        const response = useV2
          ? await apiClient.getOffersV2(params)
          : await apiClient.getOffers(params);
        offers = extractList(response);
      }

      spinner.stop();

      if (options.debug && globalOpts.format !== 'json') {
        console.log(chalk.gray(`API: ${apiUrl}${path}`));
      }
      
      handleOutput(
        offers,
        globalOpts.format,
        printOffersTable
      );
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// My offers
offersCommand
  .command('my')
  .description('List my offers (open by default, use V2 API)')
  .option('--status <status>', 'Filter by status (open|filled|cancelled)', 'open')
  .option('--symbol <symbol>', 'Filter by token symbol')
  .option('--limit <n>', 'Limit results', '20')
  .option('--page <n>', 'Page number', '1')
  .option('--address <addr>', 'Override address (default: from wallet)')
  .option('--debug', 'Show API URL, params, and raw response')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching your offers...').start();
    
    try {
      const chainId = typeof globalOpts.chainId === 'string' ? parseInt(globalOpts.chainId, 10) : (globalOpts.chainId ?? 666666);
      const address = (options.address ?? auth.getAddress(undefined, chainId)).toLowerCase();
      const params: any = {
        category_token: 'pre_market',
        is_by_me: true,
        status: options.status,
        page: parseInt(options.page),
        take: parseInt(options.limit),
      };
      if (options.symbol) params.symbol = options.symbol;
      const apiUrl = (globalOpts as any).apiUrl ?? (config.get('apiUrl') as string) ?? 'https://api.whales.market';
      const response = await apiClient.getSimpleOffersByAddress(address, params, apiUrl);
      spinner.stop();
      
      const d = response.data ?? response;
      let offers = Array.isArray(d) ? d : ((d as any)?.list ?? []);
      
      if (options.debug && globalOpts.format !== 'json') {
        const base = apiUrl.replace(/\/$/, '');
        const qs = new URLSearchParams(params).toString();
        console.log(chalk.gray(`API: ${base}/v2/simple-offers-by-address/${address}?${qs}`));
        console.log(chalk.gray(`Response: count=${(d as any)?.count ?? '?'}, list.length=${Array.isArray(offers) ? offers.length : '?'}`));
        if (offers.length === 0) {
          console.log(chalk.yellow('Tip: Use --api-url https://api-dev.whales-market.site for dev. Check address matches your wallet.'));
        }
      }
      
      handleOutput(
        offers,
        globalOpts.format,
        printOffersTable
      );
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// Get offer
offersCommand
  .command('get <offer-id>')
  .description('Get offer details')
  .action(async (offerId, options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching offer...').start();
    
    try {
      const response = await apiClient.getOffer(offerId);
      spinner.stop();
      
      const offer = response.data || response;
      
      if (globalOpts.format === 'json') {
        handleOutput(offer, globalOpts.format, () => {});
      } else {
        printDetailTable([
          ['ID', offer.id || '-'],
          ['Type', offer.type || '-'],
          ['Token ID', offer.token_id || '-'],
          ['Amount', offer.amount || '-'],
          ['Price', offer.price || '-'],
          ['Status', offer.status || '-'],
          ['Address', offer.address || '-']
        ]);
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// React to offer (placeholder)
offersCommand
  .command('react <offer-id>')
  .description('React to an offer')
  .action(async (offerId, options, command) => {
    const globalOpts = command.optsWithGlobals();
    
    try {
      // This would call POST /transactions/reaction-offer/:offerId
      // For now, just show a message
      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({
          message: 'Offer reaction not yet implemented',
          offerId
        }, null, 2));
      } else {
        console.log('Offer reaction not yet implemented');
      }
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });
