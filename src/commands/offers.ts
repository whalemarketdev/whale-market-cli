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
  .description('List my offers')
  .option('--status <status>', 'Filter by status (open|filled|cancelled)')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching your offers...').start();
    
    try {
      const address = auth.getAddress();
      const response = await apiClient.getOffersByAddress(address);
      spinner.stop();
      
      let offers = response.data || [];
      
      if (options.status) {
        offers = offers.filter((offer: any) => offer.status === options.status);
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
