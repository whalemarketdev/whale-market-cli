import { Command } from 'commander';
import chalk from 'chalk';
import { config } from '../config';

export const configCommand = new Command('config')
  .description('View or set config (api-url, chain-id)');

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
      console.log(chalk.cyan('\nConfig:'));
      console.log(chalk.white(`  apiUrl: ${all.apiUrl || 'https://api.whales.market'}`));
      console.log(chalk.white(`  chainId: ${all.chainId ?? 666666}`));
      console.log(chalk.white(`  activeWallet: ${all.activeWallet || '-'}`));
      console.log(chalk.gray(`  Path: ${config.getPath()}\n`));
    }
  });

configCommand
  .command('path')
  .description('Show config file path')
  .action(() => {
    console.log(config.getPath());
  });
