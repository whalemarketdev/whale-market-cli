import { Command } from 'commander';
import chalk from 'chalk';
import { config } from '../config';
import { EVM_CHAINS } from '../blockchain/evm/constants';
import { SOLANA_RPC } from '../blockchain/solana/constants';
import { SUI_RPC } from '../blockchain/sui/constants';
import { APTOS_RPC } from '../blockchain/aptos/constants';
import {
  SOLANA_MAINNET_CHAIN_ID,
  SOLANA_DEVNET_CHAIN_ID,
  SUI_MAINNET_CHAIN_ID,
  SUI_TESTNET_CHAIN_ID,
  APTOS_MAINNET_CHAIN_ID,
  APTOS_TESTNET_CHAIN_ID,
  resolveRpc,
} from './helpers/chain';

export const configCommand = new Command('config')
  .description('View or set config (api-url, chain-id, rpc)');

configCommand
  .command('set <key> <value>')
  .description('Set config value (api-url, chain-id)')
  .action((key, value) => {
    const k = key.toLowerCase().replace(/-/g, '') as string;
    if (k === 'apiurl' || k === 'api_url') {
      config.set('apiUrl', value);
      console.log(chalk.green(`\n✓ apiUrl set to: ${value}\n`));
    } else if (k === 'chainid' || k === 'chain_id') {
      const n = parseInt(value, 10);
      if (isNaN(n)) {
        console.error(chalk.red('chain-id must be a number'));
        process.exit(1);
      }
      config.set('chainId', n);
      console.log(chalk.green(`\n✓ chainId set to: ${n}\n`));
    } else {
      console.error(chalk.red(`Unknown key: ${key}. Use: api-url, chain-id`));
      process.exit(1);
    }
  });

configCommand
  .command('get [key]')
  .description('Get config value or all')
  .action((key) => {
    if (key) {
      const k = key.toLowerCase().replace(/-/g, '');
      if (k === 'apiurl' || k === 'api_url') {
        console.log(config.get('apiUrl') || '');
      } else if (k === 'chainid' || k === 'chain_id') {
        console.log(config.get('chainId') ?? '');
      } else {
        console.error(chalk.red(`Unknown key: ${key}`));
        process.exit(1);
      }
    } else {
      const all = config.getAll();
      const customRpcs = config.getCustomRpcs();
      console.log(chalk.cyan('\nConfig:'));
      console.log(chalk.white(`  apiUrl:        ${all.apiUrl || 'https://api.whales.market'}`));
      console.log(chalk.white(`  chainId:       ${all.chainId ?? 666666}`));
      console.log(chalk.white(`  activeWallet:  ${all.activeWallet || '-'}`));

      const rpcEntries = Object.entries(customRpcs);
      if (rpcEntries.length > 0) {
        console.log(chalk.white('  customRpcs:'));
        for (const [chainId, url] of rpcEntries) {
          console.log(chalk.white(`    ${chainId.padEnd(10)}→  ${url}`));
        }
      }

      console.log(chalk.gray(`  Path: ${config.getPath()}\n`));
    }
  });

configCommand
  .command('path')
  .description('Show config file path')
  .action(() => {
    console.log(config.getPath());
  });

// ─── config rpc ───────────────────────────────────────────────────────────────

const rpcCommand = new Command('rpc')
  .description('Manage custom RPC URLs per chain');

configCommand.addCommand(rpcCommand);

rpcCommand
  .command('set <chain-id> <url>')
  .description('Set a custom RPC URL for a chain')
  .action((chainIdArg, url) => {
    const chainId = parseInt(chainIdArg, 10);
    if (isNaN(chainId)) {
      console.error(chalk.red('chain-id must be a number. Run: whales config rpc chains'));
      process.exit(1);
    }
    config.setCustomRpc(chainId, url);
    console.log(chalk.green(`\n✓ Custom RPC for chain ${chainId} set to:\n  ${url}\n`));
  });

rpcCommand
  .command('get <chain-id>')
  .description('Show the resolved RPC URL for a chain (custom or default)')
  .action((chainIdArg) => {
    const chainId = parseInt(chainIdArg, 10);
    if (isNaN(chainId)) {
      console.error(chalk.red('chain-id must be a number. Run: whales config rpc chains'));
      process.exit(1);
    }
    const custom = config.getCustomRpc(chainId);
    const resolved = resolveRpc(chainId);
    const chainName = getChainName(chainId);

    console.log(chalk.cyan(`\nChain: ${chainName} (${chainId})`));
    if (custom) {
      console.log(chalk.white(`RPC:   ${resolved}`) + chalk.yellow('  [custom]'));
      console.log(chalk.gray(`Default: ${getDefaultRpc(chainId)}`));
    } else {
      console.log(chalk.white(`RPC:   ${resolved}`) + chalk.gray('  [default]'));
    }
    console.log('');
  });

rpcCommand
  .command('remove <chain-id>')
  .description('Remove custom RPC for a chain (revert to default)')
  .action((chainIdArg) => {
    const chainId = parseInt(chainIdArg, 10);
    if (isNaN(chainId)) {
      console.error(chalk.red('chain-id must be a number'));
      process.exit(1);
    }
    const existing = config.getCustomRpc(chainId);
    if (!existing) {
      console.log(chalk.yellow(`\nNo custom RPC set for chain ${chainId}.\n`));
      return;
    }
    config.removeCustomRpc(chainId);
    const chainName = getChainName(chainId);
    console.log(chalk.green(`\n✓ Custom RPC removed for ${chainName} (${chainId}). Reverted to default.\n`));
  });

rpcCommand
  .command('list')
  .description('List all custom RPC overrides')
  .action(() => {
    const customRpcs = config.getCustomRpcs();
    const entries = Object.entries(customRpcs);
    if (entries.length === 0) {
      console.log(chalk.gray('\nNo custom RPCs configured.\n'));
      return;
    }
    console.log(chalk.cyan('\nCustom RPC Overrides:\n'));
    const idW = 10, nameW = 22;
    console.log(
      chalk.gray(
        'Chain ID'.padEnd(idW) + 'Name'.padEnd(nameW) + 'Custom RPC'
      )
    );
    console.log(chalk.gray('─'.repeat(80)));
    for (const [chainId, url] of entries) {
      const name = getChainName(parseInt(chainId, 10));
      console.log(
        chalk.white(chainId.padEnd(idW)) +
        chalk.white(name.padEnd(nameW)) +
        chalk.cyan(url)
      );
    }
    console.log('');
  });

rpcCommand
  .command('chains')
  .description('List all supported chains with their IDs and default RPC URLs')
  .action(() => {
    const customRpcs = config.getCustomRpcs();
    const idW = 12, nameW = 24, typeW = 10;

    console.log(chalk.cyan('\nSupported Chains:\n'));
    console.log(
      chalk.gray(
        'Chain ID'.padEnd(idW) + 'Name'.padEnd(nameW) + 'Type'.padEnd(typeW) + 'Default RPC'
      )
    );
    console.log(chalk.gray('─'.repeat(100)));

    const printRow = (chainId: number, name: string, type: string, defaultRpc: string) => {
      const hasCustom = Boolean(customRpcs[chainId.toString()]);
      const marker = hasCustom ? chalk.yellow(' *') : '  ';
      console.log(
        chalk.white(String(chainId).padEnd(idW)) +
        chalk.white(name.padEnd(nameW)) +
        chalk.gray(type.padEnd(typeW)) +
        chalk.gray(defaultRpc) +
        marker
      );
    };

    // EVM chains — sorted mainnet first by chain ID
    const evmMainnets = Object.entries(EVM_CHAINS)
      .map(([id, c]) => ({ id: parseInt(id, 10), ...c }))
      .filter(c => c.id < 10000)
      .sort((a, b) => a.id - b.id);
    const evmTestnets = Object.entries(EVM_CHAINS)
      .map(([id, c]) => ({ id: parseInt(id, 10), ...c }))
      .filter(c => c.id >= 10000)
      .sort((a, b) => a.id - b.id);

    for (const c of [...evmMainnets, ...evmTestnets]) {
      printRow(c.id, c.name, 'EVM', c.rpcUrl);
    }

    console.log(chalk.gray('─'.repeat(100)));

    // Solana
    printRow(SOLANA_MAINNET_CHAIN_ID, 'Solana', 'Solana', SOLANA_RPC.MAINNET);
    printRow(SOLANA_DEVNET_CHAIN_ID, 'Solana Devnet', 'Solana', SOLANA_RPC.DEVNET);

    console.log(chalk.gray('─'.repeat(100)));

    // Sui
    printRow(SUI_MAINNET_CHAIN_ID, 'Sui', 'Sui', SUI_RPC.MAINNET);
    printRow(SUI_TESTNET_CHAIN_ID, 'Sui Testnet', 'Sui', SUI_RPC.TESTNET);

    console.log(chalk.gray('─'.repeat(100)));

    // Aptos
    printRow(APTOS_MAINNET_CHAIN_ID, 'Aptos', 'Aptos', APTOS_RPC.MAINNET);
    printRow(APTOS_TESTNET_CHAIN_ID, 'Aptos Testnet', 'Aptos', APTOS_RPC.TESTNET);

    console.log('');
    if (Object.keys(customRpcs).length > 0) {
      console.log(chalk.yellow('  * = custom RPC set\n'));
    }
    console.log(chalk.gray('  Use: whales config rpc set <chain-id> <url>\n'));
  });

// ─── helpers ──────────────────────────────────────────────────────────────────

function getChainName(chainId: number): string {
  if (EVM_CHAINS[chainId]) return EVM_CHAINS[chainId].name;
  if (chainId === SOLANA_MAINNET_CHAIN_ID) return 'Solana';
  if (chainId === SOLANA_DEVNET_CHAIN_ID) return 'Solana Devnet';
  if (chainId === SUI_MAINNET_CHAIN_ID) return 'Sui';
  if (chainId === SUI_TESTNET_CHAIN_ID) return 'Sui Testnet';
  if (chainId === APTOS_MAINNET_CHAIN_ID) return 'Aptos';
  if (chainId === APTOS_TESTNET_CHAIN_ID) return 'Aptos Testnet';
  return `Chain ${chainId}`;
}

function getDefaultRpc(chainId: number): string {
  if (chainId === SOLANA_DEVNET_CHAIN_ID) return SOLANA_RPC.DEVNET;
  if (chainId === SOLANA_MAINNET_CHAIN_ID) return SOLANA_RPC.MAINNET;
  if (chainId === SUI_TESTNET_CHAIN_ID) return SUI_RPC.TESTNET;
  if (chainId === SUI_MAINNET_CHAIN_ID) return SUI_RPC.MAINNET;
  if (chainId === APTOS_TESTNET_CHAIN_ID) return APTOS_RPC.TESTNET;
  if (chainId === APTOS_MAINNET_CHAIN_ID) return APTOS_RPC.MAINNET;
  return EVM_CHAINS[chainId]?.rpcUrl ?? '';
}
