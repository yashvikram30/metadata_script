/**
 * Utility functions
 * Helper functions for various operations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Checkpoint, Summary } from './types';
import { Logger } from './logger';

/**
 * Load wallet keypair from JSON file
 * @param keypairPath Path to keypair JSON file
 * @returns Keypair object
 */
export function loadWalletKeypair(keypairPath: string): Keypair {
  const secretKeyString = fs.readFileSync(keypairPath, 'utf-8');
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Check wallet balance
 * @param connection Solana connection
 * @param publicKey Wallet public key
 * @returns Balance in SOL
 */
export async function checkWalletBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Estimate transaction cost
 * @param numTransactions Number of transactions
 * @param avgFeePerTx Average fee per transaction in SOL (default: 0.000005)
 * @returns Estimated cost in SOL
 */
export function estimateCost(
  numTransactions: number,
  avgFeePerTx: number = 0.000005
): number {
  return numTransactions * avgFeePerTx;
}

/**
 * Sleep for specified milliseconds
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay in milliseconds
 * @returns Result of function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Ask for user confirmation
 * @param question Question to ask
 * @returns Promise with boolean answer
 */
export async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + ' (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Format duration from milliseconds
 * @param ms Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Save checkpoint
 * @param checkpoint Checkpoint data
 * @param checkpointPath Path to checkpoint file
 */
export function saveCheckpoint(checkpoint: Checkpoint, checkpointPath: string): void {
  const dir = path.dirname(checkpointPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

/**
 * Load checkpoint
 * @param checkpointPath Path to checkpoint file
 * @returns Checkpoint data or null if not found
 */
export function loadCheckpoint(checkpointPath: string): Checkpoint | null {
  if (!fs.existsSync(checkpointPath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(checkpointPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading checkpoint: ${error}`);
    return null;
  }
}

/**
 * Delete checkpoint file
 * @param checkpointPath Path to checkpoint file
 */
export function deleteCheckpoint(checkpointPath: string): void {
  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
  }
}

/**
 * Truncate string to specified length
 * @param str String to truncate
 * @param maxLength Maximum length
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
}

/**
 * Create summary object
 * @param totalProcessed Total number processed
 * @param successfullyUpdated Number successfully updated
 * @param skipped Number skipped
 * @param failed Number failed
 * @param totalCostSOL Total cost in SOL
 * @param startTime Start time ISO string
 * @param endTime End time ISO string
 * @returns Summary object
 */
export function createSummary(
  totalProcessed: number,
  successfullyUpdated: number,
  skipped: number,
  failed: number,
  totalCostSOL: number,
  startTime: string,
  endTime: string
): Summary {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const durationMs = endMs - startMs;

  return {
    totalProcessed,
    successfullyUpdated,
    skipped,
    failed,
    totalCostSOL,
    startTime,
    endTime,
    duration: formatDuration(durationMs),
  };
}

/**
 * Validate Solana public key
 * @param address Address string
 * @returns true if valid, false otherwise
 */
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Setup graceful shutdown handler
 * @param logger Logger instance
 * @param onShutdown Callback to execute on shutdown
 */
export function setupGracefulShutdown(
  logger: Logger,
  onShutdown: () => Promise<void>
): void {
  let isShuttingDown = false;

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.warn(`\n\nReceived ${signal}. Shutting down gracefully...`);

    try {
      await onShutdown();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error}`);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}


