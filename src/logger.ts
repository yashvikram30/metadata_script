/**
 * Logger module
 * Handles console and file logging with different levels
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ProcessResult, Summary } from './types';

export class Logger {
  private logFilePath: string;
  private logLevel: string;
  private logs: ProcessResult[] = [];

  constructor(logFilePath: string, logLevel: string = 'info') {
    this.logFilePath = logFilePath;
    this.logLevel = logLevel;
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Log info message to console
   */
  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Log success message to console
   */
  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  /**
   * Log warning message to console
   */
  warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  /**
   * Log error message to console
   */
  error(message: string): void {
    console.log(chalk.red('✗'), message);
  }

  /**
   * Log debug message to console (only if log level is debug)
   */
  debug(message: string): void {
    if (this.logLevel === 'debug') {
      console.log(chalk.gray('🔍'), message);
    }
  }

  /**
   * Log process result for an NFT
   */
  logResult(result: ProcessResult): void {
    this.logs.push(result);

    // Console output with colors
    const prefix = `[${result.mint.substring(0, 8)}...]`;
    
    switch (result.status) {
      case 'updated':
        console.log(
          chalk.green('✓'),
          chalk.bold(prefix),
          chalk.green('Updated'),
          result.transactionSignature ? chalk.gray(`(${result.transactionSignature.substring(0, 8)}...)`) : ''
        );
        if (result.oldValues && result.newValues) {
          if (result.oldValues.name !== result.newValues.name) {
            console.log(chalk.gray(`  Name: "${result.oldValues.name}" → "${result.newValues.name}"`));
          }
          if (result.oldValues.symbol !== result.newValues.symbol) {
            console.log(chalk.gray(`  Symbol: "${result.oldValues.symbol}" → "${result.newValues.symbol}"`));
          }
          if (result.oldValues.uri !== result.newValues.uri) {
            console.log(chalk.gray(`  URI: "${result.oldValues.uri?.substring(0, 40)}..." → "${result.newValues.uri?.substring(0, 40)}..."`));
          }
        }
        break;

      case 'skipped':
        console.log(
          chalk.gray('→'),
          chalk.bold(prefix),
          chalk.gray('Skipped'),
          chalk.gray(`(${result.action})`)
        );
        break;

      case 'error':
        console.log(
          chalk.red('✗'),
          chalk.bold(prefix),
          chalk.red('Error:'),
          chalk.red(result.error || 'Unknown error')
        );
        break;
    }
  }

  /**
   * Save all logs to file
   */
  async saveLogs(): Promise<void> {
    try {
      const data = JSON.stringify(this.logs, null, 2);
      fs.writeFileSync(this.logFilePath, data, 'utf-8');
      this.success(`Logs saved to ${this.logFilePath}`);
    } catch (error) {
      this.error(`Failed to save logs: ${error}`);
    }
  }

  /**
   * Save failed NFTs to separate file for retry
   */
  async saveFailedNFTs(failedMints: string[]): Promise<void> {
    if (failedMints.length === 0) return;

    const dir = path.dirname(this.logFilePath);
    const failedFilePath = path.join(dir, 'failed_nfts.json');

    try {
      const data = JSON.stringify({
        timestamp: new Date().toISOString(),
        count: failedMints.length,
        mints: failedMints,
      }, null, 2);
      
      fs.writeFileSync(failedFilePath, data, 'utf-8');
      this.warn(`Failed NFTs saved to ${failedFilePath}`);
    } catch (error) {
      this.error(`Failed to save failed NFTs: ${error}`);
    }
  }

  /**
   * Generate and display summary report
   */
  displaySummary(summary: Summary): void {
    console.log('\n');
    console.log(chalk.bold.cyan('═══════════════════════════════════════════'));
    console.log(chalk.bold.cyan('           📊 SUMMARY REPORT              '));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════'));
    console.log();
    console.log(chalk.bold('Total Processed:      '), chalk.white(summary.totalProcessed.toString()));
    console.log(chalk.bold.green('Successfully Updated: '), chalk.green(summary.successfullyUpdated.toString()));
    console.log(chalk.bold.gray('Skipped:              '), chalk.gray(summary.skipped.toString()));
    console.log(chalk.bold.red('Failed:               '), chalk.red(summary.failed.toString()));
    console.log();
    console.log(chalk.bold('Total Cost:           '), chalk.yellow(`${summary.totalCostSOL.toFixed(6)} SOL`));
    console.log();
    console.log(chalk.bold('Start Time:           '), summary.startTime);
    console.log(chalk.bold('End Time:             '), summary.endTime);
    console.log(chalk.bold('Duration:             '), summary.duration);
    console.log();
    console.log(chalk.bold.cyan('═══════════════════════════════════════════'));
    console.log();
  }

  /**
   * Save summary to file
   */
  async saveSummary(summary: Summary): Promise<void> {
    const dir = path.dirname(this.logFilePath);
    const summaryPath = path.join(dir, 'summary.json');

    try {
      const data = JSON.stringify(summary, null, 2);
      fs.writeFileSync(summaryPath, data, 'utf-8');
      this.success(`Summary saved to ${summaryPath}`);
    } catch (error) {
      this.error(`Failed to save summary: ${error}`);
    }
  }

  /**
   * Get all logs
   */
  getLogs(): ProcessResult[] {
    return this.logs;
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}


