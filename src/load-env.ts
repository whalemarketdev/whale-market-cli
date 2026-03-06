/**
 * Load .whales-cli.env before config is used.
 * Chỉ cần đổi domain (WHALES_API_URL) là dùng API khác.
 * Order: ~/.whales-cli.env, project/.whales-cli.env, cwd/.whales-cli.env (later overrides)
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  try {
    const content = readFileSync(filePath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (key) process.env[key] = val;
      }
    });
  } catch {
    // ignore
  }
}

loadEnvFile(join(homedir(), '.whales-cli.env'));
// Project root (load-env.js is in dist/, so parent has .whales-cli.env)
loadEnvFile(join(__dirname, '..', '.whales-cli.env'));
loadEnvFile(join(process.cwd(), '.whales-cli.env'));
