import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { createWallet, validateMnemonic, deriveAllAddresses } from '../utils/wallet';
import { config } from '../config';

export const setupCommand = new Command('setup')
  .description('Interactive first-time setup wizard')
  .action(async () => {
    console.log(chalk.cyan.bold('\n🐋 Welcome to Whales Market CLI!\n'));

    // 1. Choose wallet action
    const { walletAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'walletAction',
        message: 'Choose wallet setup:',
        choices: [
          { name: 'Create new wallet (EVM + Solana from one seed)', value: 'create' },
          { name: 'Import existing wallet (12/24-word mnemonic)', value: 'import' }
        ]
      }
    ]);

    let mnemonic: string;
    let addresses: { evm: string; solana: string };

    if (walletAction === 'create') {
      const { mnemonic: m, addresses: a } = createWallet();
      mnemonic = m;
      addresses = a;

      console.log(chalk.green('\n✓ Wallet created!'));
      console.log(chalk.yellow('\nIMPORTANT: Save your mnemonic securely!'));
      console.log(chalk.white(`Mnemonic: ${mnemonic}`));
      console.log(chalk.white(`EVM: ${addresses.evm}`));
      console.log(chalk.white(`Solana: ${addresses.solana}\n`));

      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Have you saved your mnemonic?',
          default: false
        }
      ]);

      if (!confirmed) {
        console.log(chalk.red('Setup cancelled. Please save your mnemonic first.'));
        process.exit(0);
      }
    } else {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'mnemonic',
          message: 'Enter your 12 or 24-word mnemonic phrase:',
          mask: '*'
        }
      ]);

      const trimmed = answers.mnemonic?.trim();
      if (!trimmed) {
        console.log(chalk.red('\n✗ Mnemonic is required\n'));
        process.exit(1);
      }
      if (!validateMnemonic(trimmed)) {
        console.log(chalk.red('\n✗ Invalid mnemonic phrase\n'));
        process.exit(1);
      }

      mnemonic = trimmed;
      addresses = deriveAllAddresses(mnemonic);
      console.log(chalk.green(`\n✓ Wallet imported!`));
      console.log(chalk.white(`EVM: ${addresses.evm}`));
      console.log(chalk.white(`Solana: ${addresses.solana}\n`));
    }

    // 2. Primary chain
    const { chainId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'chainId',
        message: 'Primary chain for API:',
        choices: [
          { name: 'Solana', value: 666666 },
          { name: 'Ethereum', value: 1 }
        ]
      }
    ]);

    // 3. API URL
    const { apiUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiUrl',
        message: 'API URL:',
        default: 'https://api.whales.market'
      }
    ]);

    // 4. Save config
    const entry = {
      name: 'default',
      mnemonic,
      createdAt: new Date().toISOString()
    };
    const existing = config.getWallets().find(w => w.name === 'default');
    if (existing) {
      config.removeWallet('default');
    }
    config.addWallet(entry);
    config.setActiveWallet('default');
    config.set('apiUrl', apiUrl);
    config.set('chainId', chainId);

    const primaryAddress = chainId === 666666 ? addresses.solana : addresses.evm;

    console.log(chalk.green('\n✓ Setup complete!\n'));
    console.log(chalk.cyan('Your wallet address: ') + chalk.white(primaryAddress));
    console.log(chalk.gray('Config saved to: ' + config.getPath() + '\n'));
    console.log(chalk.cyan('Try these commands:'));
    console.log(chalk.white('  whales tokens list'));
    console.log(chalk.white('  whales offers my'));
    console.log(chalk.white('  whales portfolio show'));
    console.log(chalk.white('  whales wallet show\n'));
  });
