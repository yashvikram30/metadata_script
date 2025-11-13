/**
 * CSV Parser module
 * Parses CSV file and extracts NFT metadata
 */

import * as fs from 'fs';
import csvParser from 'csv-parser';
import { CSVRow, NFTMetadata } from './types';
import { Logger } from './logger';

/**
 * Parse CSV file and extract NFT metadata
 * @param csvFilePath Path to CSV file
 * @param logger Logger instance
 * @returns Promise with array of NFT metadata
 */
export async function parseCSV(
  csvFilePath: string,
  logger: Logger
): Promise<NFTMetadata[]> {
  return new Promise((resolve, reject) => {
    const nftMetadata: NFTMetadata[] = [];
    const errors: string[] = [];

    logger.info(`Reading CSV file: ${csvFilePath}`);

    fs.createReadStream(csvFilePath)
      .pipe(csvParser())
      .on('data', (row: CSVRow) => {
        try {
          // Parse the account_data JSON
          const accountData = JSON.parse(row.account_data);

          // Extract metadata
          const metadata: NFTMetadata = {
            mint: row.mint.trim(),
            name: accountData.name.trim(),
            symbol: accountData.symbol.trim(),
            uri: accountData.uri.trim(),
          };

          // Validate required fields
          if (!metadata.mint || !metadata.name || !metadata.symbol || !metadata.uri) {
            errors.push(`Invalid row: missing required fields for mint ${row.mint}`);
            return;
          }

          nftMetadata.push(metadata);
        } catch (error) {
          errors.push(`Error parsing row for mint ${row.mint}: ${error}`);
        }
      })
      .on('end', () => {
        if (errors.length > 0) {
          logger.warn(`Encountered ${errors.length} parsing errors:`);
          errors.slice(0, 5).forEach(err => logger.warn(`  ${err}`));
          if (errors.length > 5) {
            logger.warn(`  ... and ${errors.length - 5} more`);
          }
        }

        logger.success(`Successfully parsed ${nftMetadata.length} NFT records from CSV`);
        resolve(nftMetadata);
      })
      .on('error', (error: Error) => {
        logger.error(`Error reading CSV file: ${error}`);
        reject(error);
      });
  });
}

/**
 * Filter NFT metadata by range
 * @param metadata Array of NFT metadata
 * @param range Optional range filter
 * @returns Filtered array
 */
export function filterByRange(
  metadata: NFTMetadata[],
  range?: { start: number; end: number }
): NFTMetadata[] {
  if (!range) {
    return metadata;
  }

  return metadata.slice(range.start, range.end + 1);
}

/**
 * Validate CSV file format
 * @param csvFilePath Path to CSV file
 * @returns Promise that resolves if valid, rejects if invalid
 */
export async function validateCSVFormat(
  csvFilePath: string
): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    let headerChecked = false;
    const requiredColumns = ['mint', 'account_data', 'image', 'status'];

    fs.createReadStream(csvFilePath)
      .pipe(csvParser())
      .on('headers', (headers: string[]) => {
        headerChecked = true;
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          resolve({
            valid: false,
            error: `Missing required columns: ${missingColumns.join(', ')}`,
          });
        }
      })
      .on('data', (row: CSVRow) => {
        if (!headerChecked) {
          return;
        }

        // Test parse first row
        try {
          JSON.parse(row.account_data);
          resolve({ valid: true });
        } catch (error) {
          resolve({
            valid: false,
            error: `Invalid JSON in account_data field: ${error}`,
          });
        }
      })
      .on('error', (error: Error) => {
        resolve({
          valid: false,
          error: `Error reading CSV: ${error}`,
        });
      });
  });
}

