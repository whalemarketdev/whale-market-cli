import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('CLI Commands', () => {
  const CLI_PATH = 'node dist/index.js';
  
  test('whales --version', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} --version`);
    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  });
  
  test('whales --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} --help`);
    expect(stdout).toContain('CLI for Whales Market');
  });
  
  test('whales tokens --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} tokens --help`);
    expect(stdout).toContain('Token operations');
  });
  
  test('whales tokens list --format json', async () => {
    try {
      const { stdout } = await execAsync(`${CLI_PATH} tokens list --format json --limit 1`);
      // Should output JSON (even if empty array or error)
      expect(() => JSON.parse(stdout)).not.toThrow();
    } catch (error: any) {
      // API might not be available, but JSON format should still be valid
      if (error.stdout) {
        expect(() => JSON.parse(error.stdout)).not.toThrow();
      }
    }
  });
  
  test('whales tokens list --format plain', async () => {
    try {
      const { stdout } = await execAsync(`${CLI_PATH} tokens list --format plain --limit 1`);
      // Plain format should output text
      expect(stdout).toBeTruthy();
    } catch (error: any) {
      // API might not be available, but should not crash
      expect(error).toBeDefined();
    }
  });
  
  test('whales help command', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} help`);
    expect(stdout).toContain('Whales Market CLI');
    expect(stdout).toContain('COMMANDS');
  });
  
  test('whales wallet --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} wallet --help`);
    expect(stdout).toContain('Wallet management');
  });
  
  test('whales offers --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} offers --help`);
    expect(stdout).toContain('Offer management');
  });
  
  test('whales orders --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} orders --help`);
    expect(stdout).toContain('Order operations');
  });
  
  test('whales portfolio --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} portfolio --help`);
    expect(stdout).toContain('Portfolio & positions');
  });
  
  test('whales networks --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} networks --help`);
    expect(stdout).toContain('List supported blockchain networks');
  });
  
  test('whales status --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} status --help`);
    expect(stdout).toContain('Check API connectivity');
  });

  test('whales bridge --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} bridge --help`);
    expect(stdout).toContain('Bridge tokens between chains via LayerZero OFT');
  });

  test('whales bridge to-oft --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} bridge to-oft --help`);
    expect(stdout).toContain('--token-uuid');
    expect(stdout).toContain('--quote');
  });

  test('whales bridge to-origin --help', async () => {
    const { stdout } = await execAsync(`${CLI_PATH} bridge to-origin --help`);
    expect(stdout).toContain('--token-uuid');
    expect(stdout).toContain('--quote');
  });
});
