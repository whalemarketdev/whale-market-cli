import inquirer from 'inquirer';
import chalk from 'chalk';
import { Command } from 'commander';

/** Prompt for yes/no confirmation before executing a write operation. Returns false if cancelled. */
export async function confirmTx(message: string, command: Command): Promise<boolean> {
  const globalOpts = command.optsWithGlobals();
  if (globalOpts.yes || globalOpts.format === 'json') return true;
  const { confirmed } = await inquirer.prompt([
    { type: 'confirm', name: 'confirmed', message, default: false },
  ]);
  if (!confirmed) {
    console.log(chalk.yellow('Cancelled.'));
    return false;
  }
  return true;
}
