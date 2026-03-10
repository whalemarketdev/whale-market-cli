import Table from 'cli-table3';
import chalk from 'chalk';
import { Token } from '../types';

// Utility functions
export function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export function formatStatus(status: string): string {
  const colors: Record<string, (text: string) => string> = {
    active: chalk.green,
    ended: chalk.gray,
    pending: chalk.yellow,
    open: chalk.green,
    filled: chalk.blue,
    cancelled: chalk.red,
    closed: chalk.gray
  };
  return (colors[status.toLowerCase()] || chalk.white)(status);
}

export function formatPrice(price: string | number | undefined): string {
  if (price === null || price === undefined) return '-';
  const num = parseFloat(price.toString());
  if (isNaN(num) || num === 0) return '-';
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

export function getChainName(chainId: number | string | undefined, network?: any): string {
  let chainName = '';
  let chainIdNum: number | undefined;
  
  // If network object is provided, use its name and chain_id
  if (network) {
    chainName = network.name || '';
    chainIdNum = network.chain_id;
  }
  
  // If no network name but we have chainId, try to map it
  if (!chainName && chainId) {
    const numId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
    if (!isNaN(numId)) {
      chainIdNum = numId;
      const chains: Record<number, string> = {
        666666: 'Solana',
        999999: 'Solana Devnet',
        1: 'Ethereum',
        56: 'BSC',
        137: 'Polygon',
        42161: 'Arbitrum',
        10: 'Optimism',
        8453: 'Base',
        324: 'zkSync Era',
        59144: 'Linea',
        5000: 'Mantle',
        169: 'Manta Pacific'
      };
      chainName = chains[numId] || `Chain ${numId}`;
    }
  }
  
  // Format as "ChainName(chainId)" if both are available
  if (chainName && chainIdNum !== undefined) {
    return `${chainName}(${chainIdNum})`;
  }
  
  // Fallback to just chain name or chain ID
  if (chainName) return chainName;
  if (chainIdNum !== undefined) return `Chain(${chainIdNum})`;
  
  return '-';
}

// Table formatters
export function printTokensTable(tokens: any[], options?: { showFdv?: boolean; showVolume?: boolean; showTotalVol?: boolean; showAddress?: boolean }): void {
  if (!tokens || tokens.length === 0) {
    console.log('No tokens found');
    return;
  }
  
  // Build dynamic columns based on options
  const heads = [
    chalk.cyan('ID'),
    chalk.cyan('Name'),
    chalk.cyan('Symbol'),
    chalk.cyan('Status'),
    chalk.cyan('Price'),
  ];
  
  const colWidths = [38, 20, 10, 10, 12];
  
  if (options?.showFdv) {
    heads.push(chalk.cyan('Implied FDV'));
    colWidths.push(15);
  }
  
  if (options?.showVolume) {
    heads.push(chalk.cyan('24h Vol'));
    colWidths.push(12);
  }
  
  if (options?.showTotalVol) {
    heads.push(chalk.cyan('Total Vol'));
    colWidths.push(12);
  }
  
  heads.push(chalk.cyan('Chain'), chalk.cyan('Type'));
  colWidths.push(18, 12);
  
  if (options?.showAddress) {
    heads.push(chalk.cyan('Token ID/Address'));
    colWidths.push(50);
  }
  
  const table = new Table({
    head: heads,
    colWidths: colWidths,
    style: {
      head: [],
      border: []
    }
  });
  
  tokens.forEach((token: any) => {
    // Extract network name from network object or network_id
    const networkName = getChainName(token.chain_id || token.network_id, token.network);
    
    // Price display - prefer last_price if price is 0
    const priceValue = (token.price && parseFloat(token.price.toString()) > 0) ? token.price : token.last_price;
    const displayPrice = formatPrice(priceValue);
    
    // Calculate Implied FDV (total_supply × last_price)
    // total_supply can be at top level or nested in token_info
    let impliedFdv = '-';
    const totalSupply = token.total_supply ?? token.token_info?.total_supply ?? token.info?.total_supply;
    const lastPrice = token.last_price ?? token.price;
    if (lastPrice && totalSupply) {
      const fdv = parseFloat(totalSupply.toString()) * parseFloat(lastPrice.toString());
      impliedFdv = formatPrice(fdv);
    }
    
    // Get 24h volume
    let volume24h = '-';
    if (token.volume && typeof token.volume === 'object' && token.volume.h24) {
      volume24h = formatPrice(token.volume.h24);
    } else if (token.volume_24h) {
      volume24h = formatPrice(token.volume_24h);
    }
    
    // Get total volume
    let totalVol = '-';
    const totalVolVal = token.total_volume ?? token.volume?.total_vol;
    if (totalVolVal != null) {
      totalVol = formatPrice(totalVolVal);
    }
    
    // Format addresses - show token_id (for orders) or address/pre_token_address
    // Show full addresses for agent analysis
    const tokenId = token.token_id || '-';
    const address = token.address || token.pre_token_address || '-';
    // Show full address/token_id (up to 50 chars fits in column)
    const displayAddress = address !== '-' ? (address.length > 50 ? address.substring(0, 47) + '...' : address) : (tokenId !== '-' ? (tokenId.length > 50 ? tokenId.substring(0, 47) + '...' : tokenId) : '-');
    
    const row: any[] = [
      token.id || '-',  // Full UUID ID
      truncate(token.name || '-', 23),
      token.symbol || '-',
      formatStatus(token.status || 'unknown'),
      displayPrice,
    ];
    
    if (options?.showFdv) {
      row.push(impliedFdv);
    }
    
    if (options?.showVolume) {
      row.push(volume24h);
    }
    
    if (options?.showTotalVol) {
      row.push(totalVol);
    }
    
    row.push(networkName, token.type || token.category || '-');
    if (options?.showAddress) {
      row.push(displayAddress);
    }
    
    table.push(row);
  });
  
  console.log(table.toString());
}

// Detailed table formatter with full addresses and more fields
export function printTokensTableDetailed(tokens: any[]): void {
  if (!tokens || tokens.length === 0) {
    console.log('No tokens found');
    return;
  }
  
  tokens.forEach((token: any, index: number) => {
    if (index > 0) console.log('\n' + '='.repeat(100) + '\n');
    
    const networkName = getChainName(token.chain_id || token.network_id, token.network);
    const priceValue = (token.price && parseFloat(token.price.toString()) > 0) ? token.price : token.last_price;
    
    printDetailTable([
      ['ID', token.id || '-'],
      ['Name', token.name || '-'],
      ['Symbol', token.symbol || '-'],
      ['Status', token.status || '-'],
      ['Price', formatPrice(priceValue)],
      ['Last Price', formatPrice(token.last_price)],
      ['Chain', networkName],
      ['Token ID', token.token_id || '-'],
      ['Address', token.address || '-'],
      ['Pre Token Address', token.pre_token_address || '-'],
      ['Type', token.type || '-'],
      ['Category', token.category || '-'],
      ['Short ID', token.short_id || '-'],
      ['Network ID', token.network_id || '-'],
      ['Decimals', token.decimals || '-'],
      ['Settle Rate', token.settle_rate || '-'],
      ['Total Volume Ask', token.total_volume_ask ? `$${parseFloat(token.total_volume_ask.toString()).toFixed(2)}` : '-'],
      ['Total Volume Bid', token.total_volume_bid ? `$${parseFloat(token.total_volume_bid.toString()).toFixed(2)}` : '-'],
      ['Average Bid', formatPrice(token.average_bid)],
      ['Average Ask', formatPrice(token.average_ask)]
    ]);
  });
}

export function printOffersTable(offers: any[]): void {
  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('Offer UUID'),
      chalk.cyan('Type'),
      chalk.cyan('Token UUID'),
      chalk.cyan('Amount'),
      chalk.cyan('Price'),
      chalk.cyan('Status'),
      chalk.cyan('Address'),
      chalk.cyan('OTC ID')
    ],
    colWidths: [6, 38, 8, 12, 12, 10, 8, 44, 8]
  });
  
  offers.forEach((offer: any) => {
    // API may return: offer_by_user.address, offerByUser.address, offer_by_user__address, or address
    const addr = offer.address ?? offer.offer_by_user?.address ?? (offer as any).offerByUser?.address;
    const address = addr ?? (offer as any).offer_by_user__address ?? '-';
    const idx = offer.offer_index ?? offer.offerIndex ?? '-';
    const otcIndex = offer.exit_position_index ?? offer.exitPositionIndex ?? '-';
    table.push([
      idx,
      offer.id,
      offer.type ?? offer.offer_type ?? '-',
      offer.token_id ?? offer.token?.id ?? '-',
      offer.amount ?? offer.total_amount ?? '-',
      formatPrice(offer.price ?? offer.offer_price_usd),
      formatStatus(offer.status || 'unknown'),
      address,
      otcIndex
    ]);
  });
  
  console.log(table.toString());
}

export function printOrdersTable(orders: any[]): void {
  const table = new Table({
    head: [
      chalk.cyan('Order UUID'),
      chalk.cyan('Order ID'),
      chalk.cyan('Offer UUID'),
      chalk.cyan('Buyer'),
      chalk.cyan('Seller'),
      chalk.cyan('Amount'),
      chalk.cyan('Status')
    ],
    colWidths: [38, 10, 12, 20, 20, 15, 8]
  });
  
  orders.forEach((order: any) => {
    const buyerAddr = order.buyer_address ?? order.buyer?.address ?? '-';
    const sellerAddr = order.seller_address ?? order.seller?.address ?? '-';
    const orderIndex = order.order_index ?? order.orderIndex ?? '-';
    table.push([
      order.id || '-',
      String(orderIndex),
      order.offer_id || '-',
      truncate(buyerAddr, 18),
      truncate(sellerAddr, 18),
      order.amount || '-',
      formatStatus(order.status || 'unknown')
    ]);
  });
  
  console.log(table.toString());
}

export function printDetailTable(rows: Array<[string, string]>): void {
  const table = new Table({
    colWidths: [20, 50]
  });
  
  rows.forEach(([key, value]) => {
    table.push([chalk.cyan(key), value]);
  });
  
  console.log(table.toString());
}

export function printNetworksTable(networks: any[]): void {
  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('Name'),
      chalk.cyan('Chain ID'),
      chalk.cyan('RPC URL')
    ],
    colWidths: [8, 20, 12, 40]
  });
  
  networks.forEach((network: any) => {
    table.push([
      network.id || '-',
      network.name || '-',
      network.chain_id || '-',
      truncate(network.rpc_url || '-', 38)
    ]);
  });
  
  console.log(table.toString());
}

/** Display transaction result (txHash) in a table. Optionally pass explorerUrl for link. */
export function printTxResultTable(
  txResult: { txHash: string; wait(): Promise<void> },
  options?: { explorerUrl?: string; action?: string }
): void {
  const table = new Table({ colWidths: [18, 70] });
  table.push(
    [chalk.cyan('Transaction'), txResult.txHash],
    [chalk.cyan('Status'), chalk.green('Submitted')]
  );
  if (options?.action) {
    table.push([chalk.cyan('Action'), options.action]);
  }
  if (options?.explorerUrl) {
    const link = `${options.explorerUrl}/tx/${txResult.txHash}`;
    table.push([chalk.cyan('Explorer'), link]);
  }
  console.log(table.toString());
}
