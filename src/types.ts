/**
 * Type definitions for the NFT metadata updater
 */

export interface NFTMetadata {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
}

export interface CSVRow {
  mint: string;
  account_data: string;
  image: string;
  status: string;
}

export interface ProcessResult {
  mint: string;
  status: 'updated' | 'skipped' | 'error';
  action?: string;
  oldValues?: {
    name?: string;
    symbol?: string;
    uri?: string;
  };
  newValues?: {
    name?: string;
    symbol?: string;
    uri?: string;
  };
  error?: string;
  transactionSignature?: string;
  timestamp: string;
}

export interface Summary {
  totalProcessed: number;
  successfullyUpdated: number;
  skipped: number;
  failed: number;
  totalCostSOL: number;
  startTime: string;
  endTime: string;
  duration: string;
}

export interface Checkpoint {
  lastProcessedIndex: number;
  processedMints: string[];
  timestamp: string;
  summary: {
    processed: number;
    updated: number;
    skipped: number;
    failed: number;
  };
}

export interface Config {
  solanaRpcUrl: string;
  network: 'mainnet-beta' | 'devnet';
  walletKeypairPath: string;
  csvFilePath: string;
  batchSize: number;
  batchDelayMs: number;
  dryRun: boolean;
  skipConfirm: boolean;
  nftRange?: { start: number; end: number };
  maxRetries: number;
  retryDelayMs: number;
  checkpointInterval: number;
  resumeFromCheckpoint: boolean;
  logLevel: string;
  logFilePath: string;
}


