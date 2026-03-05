import { Command } from 'commander';
import chalk from 'chalk';
import { config } from '../config';
import { auth } from '../auth';
import { createWallet, validateMnemonic, deriveAllAddresses } from '../utils/wallet';
import type { WalletEntry } from '../config';
import { handleOutput, handleError, printDetailTable } from '../output';

export const walletCommand = new Command('wallet')
  .description('Wallet management');

// Create wallet
walletCommand
  .command('create')
  .description('Generate new wallet and save to config')
  .option('--name <label>', 'Wallet label', 'default')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();

    try {
      const { mnemonic, addresses } = createWallet();
      const entry: WalletEntry = {
        name: options.name,
        mnemonic,
        createdAt: new Date().toISOString()
      };

      config.addWallet(entry);
      const wallets = config.getWallets();
      if (wallets.length === 1) {
        config.setActiveWallet(options.name);
      }

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({
          name: options.name,
          mnemonic,
          addresses,
          saved: true
        }, null, 2));
      } else {
        console.log(chalk.green('\n✓ Wallet created and saved!\n'));
        console.log(chalk.yellow('IMPORTANT: Save your mnemonic securely!'));
        console.log(chalk.white(`Mnemonic: ${mnemonic}`));
        console.log(chalk.white(`EVM: ${addresses.evm}`));
        console.log(chalk.white(`Solana: ${addresses.solana}\n`));
      }
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });

// Import wallet
walletCommand
  .command('import <mnemonic>')
  .description('Import existing wallet by 12/24-word seed phrase')
  .option('--name <label>', 'Wallet label', 'default')
  .action(async (mnemonic, options, command) => {
    const globalOpts = command.optsWithGlobals();

    try {
      const trimmed = mnemonic?.trim();
      if (!trimmed) {
        throw new Error('Mnemonic is required');
      }
      if (!validateMnemonic(trimmed)) {
        throw new Error('Invalid mnemonic phrase');
      }

      const addresses = deriveAllAddresses(trimmed);
      const entry: WalletEntry = {
        name: options.name,
        mnemonic: trimmed,
        createdAt: new Date().toISOString()
      };

      config.addWallet(entry);
      const wallets = config.getWallets();
      if (wallets.length === 1) {
        config.setActiveWallet(options.name);
      }

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({
          name: options.name,
          addresses,
          saved: true
        }, null, 2));
      } else {
        console.log(chalk.green('\n✓ Wallet imported!\n'));
        console.log(chalk.white(`EVM: ${addresses.evm}`));
        console.log(chalk.white(`Solana: ${addresses.solana}\n`));
      }
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });

// List wallets
walletCommand
  .command('list')
  .description('List all saved wallets')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();

    try {
      const wallets = config.getWallets();
      const activeName = config.get('activeWallet') as string | undefined;

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({
          wallets: wallets.map(w => ({
            name: w.name,
            createdAt: w.createdAt,
            active: w.name === activeName
          })),
          activeWallet: activeName
        }, null, 2));
      } else {
        if (wallets.length === 0) {
          console.log(chalk.yellow('\nNo wallets saved. Run: whales wallet create\n'));
          return;
        }
        console.log(chalk.cyan('\nSaved wallets:\n'));
        wallets.forEach(w => {
          const marker = w.name === activeName ? chalk.green(' (active)') : '';
          console.log(chalk.white(`  ${w.name}${marker}`));
        });
        console.log('');
      }
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });

// Use wallet
walletCommand
  .command('use <name>')
  .description('Switch active wallet')
  .action(async (name, options, command) => {
    const globalOpts = command.optsWithGlobals();

    try {
      config.setActiveWallet(name);
      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({ activeWallet: name }, null, 2));
      } else {
        console.log(chalk.green(`\n✓ Switched to wallet: ${name}\n`));
      }
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });

// Show wallet
walletCommand
  .command('show')
  .description('Display addresses on all chains from active or specified wallet')
  .option('--name <label>', 'Wallet to show (default: active)')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();

    try {
      let mnemonic: string;
      let walletName: string;

      if (options.name) {
        const wallet = config.getWallets().find(w => w.name === options.name);
        if (!wallet) {
          throw new Error(`Wallet "${options.name}" not found`);
        }
        mnemonic = wallet.mnemonic;
        walletName = wallet.name;
      } else {
        const active = config.getActiveWallet();
        if (!active) {
          throw new Error('No wallet configured. Run: whales setup or whales wallet create');
        }
        mnemonic = active.mnemonic;
        walletName = active.name;
      }

      const addresses = deriveAllAddresses(mnemonic);

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({
          name: walletName,
          evm: addresses.evm,
          solana: addresses.solana
        }, null, 2));
      } else {
        printDetailTable([
          ['Wallet', walletName],
          ['EVM', addresses.evm],
          ['Solana', addresses.solana]
        ]);
      }
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });

// Remove wallet
walletCommand
  .command('remove <name>')
  .description('Remove wallet from config')
  .action(async (name, options, command) => {
    const globalOpts = command.optsWithGlobals();

    try {
      config.removeWallet(name);
      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({ removed: name }, null, 2));
      } else {
        console.log(chalk.green(`\n✓ Wallet "${name}" removed\n`));
      }
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });

// Get address
walletCommand
  .command('address')
  .description('Show wallet address for current chain')
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();

    try {
      const address = auth.getAddress();

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({ address }, null, 2));
      } else {
        console.log(address);
      }
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });

// Link wallet (placeholder - would need API endpoint)
walletCommand
  .command('link <target-address>')
  .description('Link multiple wallets together')
  .action(async (targetAddress, options, command) => {
    const globalOpts = command.optsWithGlobals();

    try {
      const wallet = auth.getWallet();

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify({
          message: 'Wallet linking not yet implemented',
          currentAddress: wallet.address,
          targetAddress
        }, null, 2));
      } else {
        console.log(chalk.yellow('\nWallet linking not yet implemented'));
        console.log(chalk.white(`Current address: ${wallet.address}`));
        console.log(chalk.white(`Target address: ${targetAddress}\n`));
      }
    } catch (error: any) {
      handleError(error, globalOpts.format);
    }
  });
