import { Command } from 'commander';
import chalk from 'chalk';
import { OutputFormat } from '../types';

export const helpCommand = new Command('help')
  .description('Show comprehensive help documentation')
  .argument('[command]', 'Command to show help for')
  .action(async (commandName?: string) => {
    if (commandName) {
      // Show help for specific command
      return;
    }
    
    // Show comprehensive help
    console.log(chalk.cyan.bold('\n🐋 Whales Market CLI - Complete Documentation\n'));
    
    console.log(chalk.yellow('USAGE:'));
    console.log(chalk.white('  whales [options] [command] [subcommand] [arguments]\n'));
    
    console.log(chalk.yellow('GLOBAL OPTIONS:'));
    console.log(chalk.white('  -f, --format <format>     Output format: table (default), json, or plain'));
    console.log(chalk.white('  -k, --private-key <key>   (deprecated) Use wallet commands instead'));
    console.log(chalk.white('  --api-url <url>           API endpoint URL'));
    console.log(chalk.white('  --chain-id <id>           Chain ID (default: 666666)'));
    console.log(chalk.white('  -V, --version             Show version number'));
    console.log(chalk.white('  -h, --help                Show help\n'));
    
    console.log(chalk.yellow('COMMANDS:\n'));
    
    // Setup
    console.log(chalk.cyan('  setup'));
    console.log(chalk.gray('    Interactive first-time setup wizard'));
    console.log(chalk.white('    Usage: whales setup\n'));
    
    // Wallet
    console.log(chalk.cyan('  wallet'));
    console.log(chalk.gray('    Wallet management (multi-chain from one seed)'));
    console.log(chalk.white('    Subcommands:'));
    console.log(chalk.white('      create [--name <label>]      Generate new wallet'));
    console.log(chalk.white('      import <mnemonic> [--name]   Import by 12/24-word seed'));
    console.log(chalk.white('      list                         List saved wallets'));
    console.log(chalk.white('      use <name>                   Switch active wallet'));
    console.log(chalk.white('      show [--name <label>]        Show addresses on all chains'));
    console.log(chalk.white('      remove <name>                Remove wallet'));
    console.log(chalk.white('      address                      Show address for current chain'));
    console.log(chalk.white('      link <target-address>        Link wallets (placeholder)'));
    console.log(chalk.white('    Usage: whales wallet create --name main\n'));
    
    // Tokens
    console.log(chalk.cyan('  tokens'));
    console.log(chalk.gray('    Token operations'));
    console.log(chalk.white('    Subcommands:'));
    console.log(chalk.white('      list [--status active|ended] [--chain <id>] [--limit <n>] [--page <n>]'));
    console.log(chalk.white('      get <token-id>               Get token details'));
    console.log(chalk.white('      search <query> [--limit <n>] Search tokens'));
    console.log(chalk.white('      highlight                    Get highlighted/trending tokens'));
    console.log(chalk.white('      stats                        Get prediction stats'));
    console.log(chalk.white('    Usage: whales tokens list --limit 10\n'));
    
    // Offers
    console.log(chalk.cyan('  offers'));
    console.log(chalk.gray('    Offer management'));
    console.log(chalk.white('    Subcommands:'));
    console.log(chalk.white('      list [--type buy|sell] [--token <id>] [--limit <n>] [--page <n>]'));
    console.log(chalk.white('      my [--status open|filled]    List my offers'));
    console.log(chalk.white('      get <offer-id>               Get offer details'));
    console.log(chalk.white('      react <offer-id>             React to an offer'));
    console.log(chalk.white('    Usage: whales offers my --status open\n'));
    
    // Orders
    console.log(chalk.cyan('  orders'));
    console.log(chalk.gray('    Order operations'));
    console.log(chalk.white('    Subcommands:'));
    console.log(chalk.white('      list [--token <id>] [--status <status>] [--limit <n>] [--page <n>]'));
    console.log(chalk.white('      my [--side buy|sell]         List my orders'));
    console.log(chalk.white('      get <order-id>               Get order details'));
    console.log(chalk.white('      by-offer <address>           Orders for my offers'));
    console.log(chalk.white('    Usage: whales orders my\n'));
    
    // Portfolio
    console.log(chalk.cyan('  portfolio'));
    console.log(chalk.gray('    Portfolio & positions'));
    console.log(chalk.white('    Subcommands:'));
    console.log(chalk.white('      show [--address <addr>]      Show portfolio summary'));
    console.log(chalk.white('      positions [--type open|filled]  List positions'));
    console.log(chalk.white('      balance [--token <symbol>]   Show token balances'));
    console.log(chalk.white('    Usage: whales portfolio show\n'));
    
    // Orderbook
    console.log(chalk.cyan('  orderbook'));
    console.log(chalk.gray('    Order book v2 operations'));
    console.log(chalk.white('    Subcommands:'));
    console.log(chalk.white('      snapshot                     Get order book snapshot statistics'));
    console.log(chalk.white('      positions --telegram-id <id> Get positions'));
    console.log(chalk.white('      pairs --telegram-id <id>     List trading pairs'));
    console.log(chalk.white('      filled <id>                   Get filled order details'));
    console.log(chalk.white('    Usage: whales orderbook snapshot\n'));
    
    // Referral
    console.log(chalk.cyan('  referral'));
    console.log(chalk.gray('    Referral system'));
    console.log(chalk.white('    Subcommands:'));
    console.log(chalk.white('      summary [--address <addr>]   Campaign summary'));
    console.log(chalk.white('      campaigns [--address <addr>] List campaigns'));
    console.log(chalk.white('      earnings [--address <addr>]  Show earnings'));
    console.log(chalk.white('      transactions [--address <addr>]  Get transactions'));
    console.log(chalk.white('    Usage: whales referral summary\n'));
    
    // Networks
    console.log(chalk.cyan('  networks'));
    console.log(chalk.gray('    List supported blockchain networks'));
    console.log(chalk.white('    Usage: whales networks list\n'));
    
    // Status
    console.log(chalk.cyan('  status'));
    console.log(chalk.gray('    Check API connectivity and wallet status'));
    console.log(chalk.white('    Usage: whales status\n'));
    
    // Shell
    console.log(chalk.cyan('  shell'));
    console.log(chalk.gray('    Interactive REPL mode'));
    console.log(chalk.white('    Usage: whales shell\n'));
    
    // Upgrade
    console.log(chalk.cyan('  upgrade'));
    console.log(chalk.gray('    Self-update from npm registry'));
    console.log(chalk.white('    Usage: whales upgrade\n'));
    
    console.log(chalk.yellow('EXAMPLES:\n'));
    console.log(chalk.white('  # List tokens in table format (default)'));
    console.log(chalk.gray('  whales tokens list --limit 10\n'));
    console.log(chalk.white('  # Get JSON output for scripting'));
    console.log(chalk.gray('  whales --format json tokens list\n'));
    console.log(chalk.white('  # Get plain text output'));
    console.log(chalk.gray('  whales --format plain tokens list\n'));
    console.log(chalk.white('  # View your offers'));
    console.log(chalk.gray('  whales offers my\n'));
    console.log(chalk.white('  # Check portfolio'));
    console.log(chalk.gray('  whales portfolio show\n'));
    console.log(chalk.white('  # Search for tokens'));
    console.log(chalk.gray('  whales tokens search "example"\n'));
    
    console.log(chalk.yellow('FORMAT OPTIONS:\n'));
    console.log(chalk.white('  table  (default) - Formatted table with borders and colors'));
    console.log(chalk.white('  json            - JSON output for scripting/automation'));
    console.log(chalk.white('  plain           - Plain text table without borders\n'));
    
    console.log(chalk.yellow('CONFIGURATION:\n'));
    console.log(chalk.white('  Config file location:'));
    console.log(chalk.gray('    macOS:   ~/Library/Preferences/whales-market-cli/config.json'));
    console.log(chalk.gray('    Linux:   ~/.config/whales-market-cli/config.json'));
    console.log(chalk.gray('    Windows: %APPDATA%\\whales-market-cli\\config.json\n'));
    
    console.log(chalk.white('  Environment variables:'));
    console.log(chalk.gray('    WHALES_API_URL      - API endpoint URL'));
    console.log(chalk.gray('    WHALES_CHAIN_ID     - Chain ID\n'));
    
    console.log(chalk.yellow('GETTING HELP:\n'));
    console.log(chalk.white('  whales --help                    Show this help'));
    console.log(chalk.white('  whales <command> --help         Show help for a command'));
    console.log(chalk.white('  whales <command> <subcommand> --help  Show help for a subcommand\n'));
    
    console.log(chalk.gray('For more information, visit: https://github.com/whales-market/whale-market-cli\n'));
  });
