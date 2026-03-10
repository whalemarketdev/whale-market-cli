import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { apiClient } from '../api';
import { handleOutput, handleError } from '../output';
import Table from 'cli-table3';

export const bookCommand = new Command('book')
  .description('Order book operations')
  .argument('<symbol>', 'Token symbol (e.g., PENGU, BTC)')
  .option('--depth <n>', 'Limit order book depth (number of levels)', '10')
  .option('--live', 'Stream order book in real-time (WebSocket)')
  .option('--chain-id <id>', 'Filter by chain ID')
  .action(async (symbol, options, command) => {
    const globalOpts = command.optsWithGlobals();
    
    if (options.live) {
      // TODO: Implement WebSocket streaming
      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({
          error: 'Live streaming not yet implemented',
          message: 'WebSocket support coming soon'
        }, null, 2));
      } else {
        console.log(chalk.yellow('Live streaming not yet implemented. WebSocket support coming soon.'));
      }
      return;
    }
    
    const spinner = ora(`Fetching order book for ${symbol}...`).start();
    
    try {
      const depth = parseInt(options.depth);
      
      // Fetch offers from V2 API (same as whales.market frontend)
      // Use symbol as-is: API may be case-sensitive (e.g. chalee_admin2)
      const params: any = {
        symbol: symbol.trim(),
        status: 'open',
        category_token: 'pre_market',
        order_type: 'normal',
        take: 200, // API max limit
        page: 1,
      };
      
      if (options.chainId) {
        params.chains = String(options.chainId);
      }
      
      const apiUrl = (globalOpts as any).apiUrl;
      const response: any = await apiClient.getOffersV2(params, apiUrl);
      spinner.stop();
      
      // Handle different response structures
      // V2 API: { data: { list: [...], count, ... } }
      // V1/transactions: { data: [...] } or { list: [...] }
      let offers = [];
      if (response.data?.list && Array.isArray(response.data.list)) {
        offers = response.data.list;
      } else if (response.data && Array.isArray(response.data)) {
        offers = response.data;
      } else if (response.list && Array.isArray(response.list)) {
        offers = response.list;
      } else if (Array.isArray(response)) {
        offers = response;
      }
      
      if (offers.length === 0) {
        if (globalOpts.format === 'json') {
          handleOutput({
            symbol,
            sell_orders: [],
            buy_orders: [],
            spread: 0,
            message: 'No open orders found'
          }, globalOpts.format, () => {});
        } else {
          console.log(chalk.yellow(`\nNo open orders found for ${symbol}\n`));
        }
        return;
      }
      
      // Separate buy and sell offers
      const buyOffers = offers
        .filter((o: any) => o.type === 'buy' || o.offer_type === 'buy')
        .map((o: any) => parseOffer(o))
        .sort((a: any, b: any) => b.price - a.price) // Sort descending (best bid first)
        .slice(0, depth);
      
      const sellOffers = offers
        .filter((o: any) => o.type === 'sell' || o.offer_type === 'sell')
        .map((o: any) => parseOffer(o))
        .sort((a: any, b: any) => a.price - b.price) // Sort ascending (best ask first)
        .slice(0, depth);
      
      // Calculate spread
      const bestBid = buyOffers.length > 0 ? buyOffers[0].price : 0;
      const bestAsk = sellOffers.length > 0 ? sellOffers[0].price : 0;
      const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
      const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;
      
      if (globalOpts.format === 'json') {
        handleOutput({
          symbol,
          sell_orders: sellOffers,
          buy_orders: buyOffers,
          spread,
          spread_percent: spreadPercent,
          best_bid: bestBid,
          best_ask: bestAsk,
          timestamp: Date.now()
        }, globalOpts.format, () => {});
      } else {
        printOrderBook(symbol, sellOffers, buyOffers, spread, spreadPercent);
      }
    } catch (error: any) {
      spinner.stop();
      handleError(error, globalOpts.format);
    }
  });

function parseOffer(offer: any): any {
  const totalAmount = parseFloat(offer.total_amount || 0);
  const filledAmount = parseFloat(offer.filled_amount || 0);
  const remaining = totalAmount - filledAmount;
  
  // Calculate price - V2 API has offer_price_usd (USD), fallback to price/collateral
  let price = 0;
  if (offer.offer_price_usd != null) {
    price = parseFloat(offer.offer_price_usd);
  } else if (offer.price) {
    price = parseFloat(offer.price);
  } else if (offer.collateral && totalAmount > 0) {
    // For sell offers: price = collateral / total_amount
    price = parseFloat(offer.collateral) / totalAmount;
  }
  
  // Determine fill status
  let fillStatus = 'Open';
  if (filledAmount === 0) {
    fillStatus = 'Open';
  } else if (filledAmount < totalAmount) {
    fillStatus = 'Partial';
  } else {
    fillStatus = 'Filled';
  }
  
  // Calculate value (remaining * price)
  const value = remaining * price;
  
  // full_match: true = fill entire amount only, false = allow partial fill
  const matchType = offer.full_match === true ? 'Full' : 'Partial';

  return {
    id: offer.id ?? '-',
    index: offer.offer_index ?? offer.offerIndex ?? '-',
    price,
    size: totalAmount,
    filled: filledAmount,
    remaining,
    fill_status: fillStatus,
    match_type: matchType,
    value,
    type: offer.type || offer.offer_type
  };
}

function printOrderBook(
  symbol: string,
  sellOrders: any[],
  buyOrders: any[],
  spread: number,
  spreadPercent: number
): void {
  console.log(chalk.cyan.bold(`\nOrder Book — ${symbol}`));
  console.log(chalk.gray(`Spread: $${spread.toFixed(4)} (${spreadPercent.toFixed(2)}%)\n`));
  
  // Sell Orders (Asks)
  if (sellOrders.length > 0) {
    console.log(chalk.red.bold('══ SELL ORDERS (Asks) ══════════════════════════════════════════════'));
    
    const sellTable = new Table({
      head: [
        chalk.cyan('#'),
        chalk.cyan('ID'),
        chalk.cyan('Index'),
        chalk.cyan('Price'),
        chalk.cyan('Size'),
        chalk.cyan('Filled'),
        chalk.cyan('Remaining'),
        chalk.cyan('Match'),
        chalk.cyan('Fill'),
        chalk.cyan('Value')
      ],
      colWidths: [4, 12, 8, 12, 10, 10, 10, 8, 8, 12],
      style: {
        head: [],
        border: []
      }
    });
    
    sellOrders.forEach((order, index) => {
      sellTable.push([
        (index + 1).toString(),
        String(order.id ?? '-'),
        String(order.index ?? '-'),
        formatPrice(order.price),
        formatAmount(order.size),
        formatAmount(order.filled),
        formatAmount(order.remaining),
        formatMatchType(order.match_type),
        formatFillStatus(order.fill_status),
        formatValue(order.value)
      ]);
    });
    
    console.log(sellTable.toString());
  } else {
    console.log(chalk.red.bold('══ SELL ORDERS (Asks) ══════════════════════════════════════════════'));
    console.log(chalk.gray('  No sell orders\n'));
  }
  
  console.log(''); // Empty line between sections
  
  // Buy Orders (Bids)
  if (buyOrders.length > 0) {
    console.log(chalk.green.bold('══ BUY ORDERS (Bids) ═══════════════════════════════════════════════'));
    
    const buyTable = new Table({
      head: [
        chalk.cyan('#'),
        chalk.cyan('ID'),
        chalk.cyan('Index'),
        chalk.cyan('Price'),
        chalk.cyan('Size'),
        chalk.cyan('Filled'),
        chalk.cyan('Remaining'),
        chalk.cyan('Match'),
        chalk.cyan('Fill'),
        chalk.cyan('Value')
      ],
      colWidths: [4, 12, 8, 12, 10, 10, 10, 8, 8, 12],
      style: {
        head: [],
        border: []
      }
    });
    
    buyOrders.forEach((order, index) => {
      buyTable.push([
        (index + 1).toString(),
        String(order.id ?? '-'),
        String(order.index ?? '-'),
        formatPrice(order.price),
        formatAmount(order.size),
        formatAmount(order.filled),
        formatAmount(order.remaining),
        formatMatchType(order.match_type),
        formatFillStatus(order.fill_status),
        formatValue(order.value)
      ]);
    });
    
    console.log(buyTable.toString());
  } else {
    console.log(chalk.green.bold('══ BUY ORDERS (Bids) ═══════════════════════════════════════════════'));
    console.log(chalk.gray('  No buy orders\n'));
  }
  
  console.log('');
}

function formatPrice(price: number): string {
  if (price === 0) return '-';
  if (price < 0.0001) return price.toExponential(4);
  if (price < 1) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(4)}`;
}

function formatAmount(amount: number): string {
  if (amount === 0) return '0';
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
  return amount.toFixed(2);
}

function formatValue(value: number): string {
  if (value === 0) return '-';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatMatchType(matchType: string): string {
  return matchType === 'Full' ? chalk.blue(matchType) : chalk.magenta(matchType);
}

function formatFillStatus(status: string): string {
  switch (status) {
    case 'Open':
      return chalk.green(status);
    case 'Partial':
      return chalk.yellow(status);
    case 'Filled':
      return chalk.gray(status);
    default:
      return status;
  }
}
