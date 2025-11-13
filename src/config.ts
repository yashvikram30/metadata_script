/**
 * Configuration module
 * Loads and validates configuration from environment variables and .env file
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { Config } from './types';

// Load environment variables from .env file
dotenv.config();

/**
 * Parse NFT range from string format "START-END"
 * @param rangeStr Range string (e.g., "0-100")
 * @returns Parsed range object or undefined
 */
function parseNFTRange(rangeStr?: string): { start: number; end: number } | undefined {
  if (!rangeStr || rangeStr.trim() === '') {
    return undefined;
  }

  const parts = rangeStr.split('-');
  if (parts.length !== 2) {
    throw new Error('Invalid NFT_RANGE format. Use: START-END (e.g., 0-100)');
  }

  const start = parseInt(parts[0], 10);
  const end = parseInt(parts[1], 10);

  if (isNaN(start) || isNaN(end)) {
    throw new Error('Invalid NFT_RANGE values. Both start and end must be numbers.');
  }

  if (start < 0 || end < 0) {
    throw new Error('NFT_RANGE values must be non-negative.');
  }

  if (start > end) {
    throw new Error('NFT_RANGE start must be less than or equal to end.');
  }

  return { start, end };
}

/**
 * Load and validate configuration
 * @returns Configuration object
 */
export function loadConfig(): Config {
  const config: Config = {
    solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    network: (process.env.NETWORK as 'mainnet-beta' | 'devnet') || 'devnet',
    walletKeypairPath: process.env.WALLET_KEYPAIR_PATH || './wallet.json',
    csvFilePath: process.env.CSV_FILE_PATH || './nft_metadata.csv',
    batchSize: parseInt(process.env.BATCH_SIZE || '25', 10),
    batchDelayMs: parseInt(process.env.BATCH_DELAY_MS || '500', 10),
    dryRun: process.env.DRY_RUN !== 'false',
    skipConfirm: process.env.SKIP_CONFIRM === 'true',
    nftRange: parseNFTRange(process.env.NFT_RANGE),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
    checkpointInterval: parseInt(process.env.CHECKPOINT_INTERVAL || '100', 10),
    resumeFromCheckpoint: process.env.RESUME_FROM_CHECKPOINT === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
    logFilePath: process.env.LOG_FILE_PATH || './logs/update_log.json',
  };

  // Validate network
  if (!['mainnet-beta', 'devnet'].includes(config.network)) {
    throw new Error('NETWORK must be either "mainnet-beta" or "devnet"');
  }

  // Validate wallet keypair path
  if (!fs.existsSync(config.walletKeypairPath)) {
    throw new Error(`Wallet keypair file not found: ${config.walletKeypairPath}`);
  }

  // Validate CSV file path
  if (!fs.existsSync(config.csvFilePath)) {
    throw new Error(`CSV file not found: ${config.csvFilePath}`);
  }

  // Validate numeric values
  if (config.batchSize <= 0) {
    throw new Error('BATCH_SIZE must be greater than 0');
  }

  if (config.batchDelayMs < 0) {
    throw new Error('BATCH_DELAY_MS must be non-negative');
  }

  if (config.maxRetries < 0) {
    throw new Error('MAX_RETRIES must be non-negative');
  }

  if (config.retryDelayMs < 0) {
    throw new Error('RETRY_DELAY_MS must be non-negative');
  }

  if (config.checkpointInterval <= 0) {
    throw new Error('CHECKPOINT_INTERVAL must be greater than 0');
  }

  return config;
}

/**
 * Display current configuration
 * @param config Configuration object
 */
export function displayConfig(config: Config): void {
  console.log('\n📋 Configuration:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Network:           ${config.network}`);
  console.log(`RPC URL:           ${config.solanaRpcUrl}`);
  console.log(`CSV File:          ${config.csvFilePath}`);
  console.log(`Wallet:            ${config.walletKeypairPath}`);
  console.log(`Batch Size:        ${config.batchSize}`);
  console.log(`Batch Delay:       ${config.batchDelayMs}ms`);
  console.log(`Max Retries:       ${config.maxRetries}`);
  console.log(`Checkpoint Every:  ${config.checkpointInterval} NFTs`);
  console.log(`Dry Run:           ${config.dryRun ? '✅ YES (no transactions will be sent)' : '❌ NO (transactions will be sent)'}`);
  
  if (config.nftRange) {
    console.log(`NFT Range:         #${config.nftRange.start} - #${config.nftRange.end}`);
  }
  
  if (config.resumeFromCheckpoint) {
    console.log(`Resume:            ✅ YES (will resume from checkpoint)`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

