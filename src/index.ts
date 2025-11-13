#!/usr/bin/env node

/**
 * Solana NFT Metadata Updater
 * Main entry point for updating Doge Capital NFT metadata on Solana
 */

import { Connection } from '@solana/web3.js';
import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import { loadConfig, displayConfig } from './config';
import { Logger } from './logger';
import { parseCSV, filterByRange } from './csvParser';
import { processBatch, calculateTotalCost } from './metadataUpdater';
import {
  loadWalletKeypair,
  checkWalletBalance,
  estimateCost,
  askConfirmation,
  setupGracefulShutdown,
  createSummary,
  saveCheckpoint,
  loadCheckpoint,
  deleteCheckpoint,
} from './utils';
import { Checkpoint } from './types';
import * as path from 'path';

/**
 * Main function
 */
async function main() {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║   Solana NFT Metadata Updater v1.0.0        ║'));
  console.log(chalk.bold.cyan('║   For Doge Capital NFT Collection           ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════╝\n'));

  try {
    // Load configuration
    const config = loadConfig();
    const logger = new Logger(config.logFilePath, config.logLevel);

    // Display configuration
    displayConfig(config);

    // Setup graceful shutdown
    const checkpointPath = path.join(path.dirname(config.logFilePath), 'checkpoint.json');
    setupGracefulShutdown(logger, async () => {
      logger.info('Saving logs...');
      await logger.saveLogs();
    });

    // Load wallet
    logger.info('Loading wallet...');
    const wallet = loadWalletKeypair(config.walletKeypairPath);
    logger.success(`Wallet loaded: ${wallet.publicKey.toBase58()}`);

    // Connect to Solana
    logger.info(`Connecting to Solana ${config.network}...`);
    const connection = new Connection(config.solanaRpcUrl, 'confirmed');

    // Check wallet balance
    logger.info('Checking wallet balance...');
    const balance = await checkWalletBalance(connection, wallet.publicKey);
    logger.success(`Wallet balance: ${balance.toFixed(6)} SOL`);

    // Parse CSV
    logger.info('Parsing CSV file...');
    let allMetadata = await parseCSV(config.csvFilePath, logger);

    // Apply range filter if specified
    if (config.nftRange) {
      logger.info(`Applying range filter: #${config.nftRange.start} - #${config.nftRange.end}`);
      allMetadata = filterByRange(allMetadata, config.nftRange);
      logger.success(`Filtered to ${allMetadata.length} NFTs`);
    }

    // Load checkpoint if resuming
    let startIndex = 0;
    let previousResults: any = { updated: 0, skipped: 0, failed: 0 };

    if (config.resumeFromCheckpoint) {
      const checkpoint = loadCheckpoint(checkpointPath);
      if (checkpoint) {
        logger.info(`Found checkpoint from ${checkpoint.timestamp}`);
        logger.info(`Resuming from NFT #${checkpoint.lastProcessedIndex + 1}`);
        startIndex = checkpoint.lastProcessedIndex + 1;
        previousResults = checkpoint.summary;

        // Filter out already processed mints
        allMetadata = allMetadata.filter(
          (m) => !checkpoint.processedMints.includes(m.mint)
        );
      } else {
        logger.warn('No checkpoint found, starting from beginning');
      }
    }

    const metadata = allMetadata.slice(startIndex);

    if (metadata.length === 0) {
      logger.warn('No NFTs to process');
      return;
    }

    // Estimate cost
    const estimatedCost = estimateCost(metadata.length);
    logger.info(`Estimated cost for ${metadata.length} updates: ${estimatedCost.toFixed(6)} SOL`);

    // Pre-flight checks
    if (!config.dryRun && balance < estimatedCost * 1.5) {
      logger.warn(
        `Wallet balance may be insufficient. Recommended: ${(estimatedCost * 1.5).toFixed(6)} SOL`
      );
    }

    // Confirmation prompt
    if (!config.skipConfirm) {
      console.log();
      logger.warn('⚠️  IMPORTANT: This will update metadata on-chain!');
      if (config.dryRun) {
        logger.info('DRY RUN mode is enabled - no transactions will be sent');
      } else {
        logger.warn('DRY RUN is DISABLED - real transactions will be sent!');
      }
      console.log();

      const confirmed = await askConfirmation('Do you want to proceed?');
      if (!confirmed) {
        logger.info('Operation cancelled by user');
        return;
      }
    }

    // Process NFTs
    console.log();
    logger.info('Starting NFT metadata update process...');
    console.log();

    const progressBar = new cliProgress.SingleBar({
      format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} NFTs | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(metadata.length, 0);

    const startTime = new Date().toISOString();
    let processedCount = 0;
    let updatedCount = previousResults.updated;
    let skippedCount = previousResults.skipped;
    let failedCount = previousResults.failed;
    const failedMints: string[] = [];
    const processedMints: string[] = [];

    // Process in batches
    for (let i = 0; i < metadata.length; i += config.batchSize) {
      const batch = metadata.slice(i, i + config.batchSize);

      const results = await processBatch(
        connection,
        wallet,
        batch,
        config.dryRun,
        logger,
        config.maxRetries,
        config.retryDelayMs
      );

      // Update counters
      for (const result of results) {
        processedCount++;
        processedMints.push(result.mint);

        if (result.status === 'updated') {
          updatedCount++;
        } else if (result.status === 'skipped') {
          skippedCount++;
        } else if (result.status === 'error') {
          failedCount++;
          failedMints.push(result.mint);
        }
      }

      progressBar.update(processedCount);

      // Save checkpoint
      if (processedCount % config.checkpointInterval === 0) {
        const checkpoint: Checkpoint = {
          lastProcessedIndex: startIndex + processedCount - 1,
          processedMints,
          timestamp: new Date().toISOString(),
          summary: {
            processed: processedCount,
            updated: updatedCount,
            skipped: skippedCount,
            failed: failedCount,
          },
        };
        saveCheckpoint(checkpoint, checkpointPath);
        logger.debug(`Checkpoint saved at ${processedCount} NFTs`);
      }

      // Delay between batches
      if (i + config.batchSize < metadata.length) {
        await new Promise((resolve) => setTimeout(resolve, config.batchDelayMs));
      }
    }

    progressBar.stop();

    const endTime = new Date().toISOString();
    const totalCostSOL = config.dryRun ? 0 : calculateTotalCost(logger.getLogs());

    // Create summary
    const summary = createSummary(
      processedCount,
      updatedCount,
      skippedCount,
      failedCount,
      totalCostSOL,
      startTime,
      endTime
    );

    // Display summary
    logger.displaySummary(summary);

    // Save logs and summary
    await logger.saveLogs();
    await logger.saveSummary(summary);

    // Save failed NFTs if any
    if (failedMints.length > 0) {
      await logger.saveFailedNFTs(failedMints);
    }

    // Delete checkpoint on successful completion
    if (failedCount === 0) {
      deleteCheckpoint(checkpointPath);
      logger.success('All NFTs processed successfully!');
    } else {
      logger.warn(
        `Some NFTs failed to update. Check failed_nfts.json and re-run with RESUME_FROM_CHECKPOINT=true`
      );
    }

    console.log();
    logger.success('✨ Operation completed!');
    console.log();
  } catch (error) {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error(chalk.red('\n❌ Unhandled error:'), error);
  process.exit(1);
});

