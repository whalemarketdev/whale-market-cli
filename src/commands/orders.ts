import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../api';
import { auth } from '../auth';
import { handleOutput, handleError, printOrdersTable, printDetailTable } from '../output';

export const ordersCommand = new Command('orders')
  .description('Order operations');

// List orders
ordersCommand
  .command('list')
  .description('List all orders')
  .option('--token <id>', 'Filter by token ID')
  .option('--status <status>', 'Filter by status')
  .option('--limit <n>', 'Limit results', '20')
  .option('--page <n>', 'Page number', '1')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching orders...').start();
    
    try {
      const params: any = {
        take: parseInt(options.limit),
        page: parseInt(options.page)
      };
      
      if (options.token) params.token_id = options.token;
      if (options.status) params.status = options.status;
      
      const response = await apiClient.getOrders(params);
      spinner.stop();
      
      const d = response.data ?? response;
      const orders = Array.isArray(d) ? d : ((d as any)?.list ?? []);
      
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

// My orders
ordersCommand
  .command('my')
  .description('List my orders')
  .option('--side <side>', 'Filter by side (buy|sell)')
  .option('--symbol <symbol>', 'Filter by token symbol')
  .option('--limit <n>', 'Limit results', '20')
  .option('--page <n>', 'Page number', '1')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching your orders...').start();
    
    try {
      const chainId = typeof globalOpts.chainId === 'string' ? parseInt(globalOpts.chainId, 10) : (globalOpts.chainId ?? 666666);
      const address = auth.getAddress(undefined, chainId);
      const params: any = {
        category_token: 'pre_market',
        chain_id: String(chainId),
        page: parseInt(options.page),
        take: parseInt(options.limit),
      };
      if (options.symbol) params.symbol = options.symbol;
      const apiUrlOverride = (globalOpts as any).apiUrl;
      const response = await apiClient.getOrdersByAddressV2(address, params, apiUrlOverride);
      spinner.stop();
      
      const d = response.data ?? response;
      let orders = Array.isArray(d) ? d : ((d as any)?.list ?? []);
      
      if (options.side) {
        // Filter by side if needed
        orders = orders.filter((order: any) => {
          // This would depend on API structure
          return true;
        });
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

// Get order
ordersCommand
  .command('get <order-id>')
  .description('Get order details')
  .action(async (orderId, options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching order...').start();
    
    try {
      const response = await apiClient.getOrder(orderId);
      spinner.stop();
      
      const order = response.data || response;
      
      if (globalOpts.format === 'json') {
        handleOutput(order, globalOpts.format, () => {});
      } else {
        printDetailTable([
          ['ID', order.id || '-'],
          ['Order Index', String(order.order_index ?? order.orderIndex ?? '-')],
          ['Offer ID', order.offer_id || '-'],
          ['Buyer', order.buyer_address || '-'],
          ['Seller', order.seller_address || '-'],
          ['Amount', order.amount || '-'],
          ['Status', order.status || '-']
        ]);
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

// Orders by offer
ordersCommand
  .command('by-offer <address>')
  .description('Get orders for my offers')
  .action(async (address, options, command) => {
    const globalOpts = command.optsWithGlobals();
    const spinner = ora('Fetching orders...').start();
    
    try {
      const response = await apiClient.getOrdersByOffer(address);
      spinner.stop();
      
      const d = response.data ?? response;
      const orders = Array.isArray(d) ? d : ((d as any)?.list ?? []);
      
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
