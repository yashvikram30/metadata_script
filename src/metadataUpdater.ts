/**
 * Metadata Updater module
 * Core logic for updating NFT metadata on Solana using Metaplex
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { NFTMetadata, ProcessResult } from './types';
import { Logger } from './logger';
import { retryWithBackoff, sleep } from './utils';

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

/**
 * Get metadata account PDA (Program Derived Address)
 * @param mint Mint public key
 * @returns Metadata account public key
 */
export function getMetadataAccount(mint: PublicKey): PublicKey {
  const [metadataAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return metadataAccount;
}

/**
 * Create update metadata instruction
 * @param metadataAccount Metadata account public key
 * @param updateAuthority Update authority public key
 * @param name NFT name
 * @param symbol NFT symbol
 * @param uri Metadata URI
 * @returns Transaction instruction
 */
function createUpdateMetadataInstruction(
  metadataAccount: PublicKey,
  updateAuthority: PublicKey,
  name: string,
  symbol: string,
  uri: string
): import('@solana/web3.js').TransactionInstruction {
  // Update Metadata Account V2 instruction discriminator
  const discriminator = Buffer.from([15]); // UpdateMetadataAccountV2

  // Create instruction data
  const data = Buffer.concat([
    discriminator,
    // UpdateMetadataAccountArgsV2
    Buffer.from([1]), // Has data (Some)
    // DataV2
    encodeString(name),
    encodeString(symbol),
    encodeString(uri),
    Buffer.from([0, 0]), // sellerFeeBasisPoints = 0
    Buffer.from([0]), // creators = None
    Buffer.from([0]), // collection = None
    Buffer.from([0]), // uses = None
    // Update authority (keep same)
    Buffer.from([0]), // updateAuthority = None (keep existing)
    // Primary sale happened (keep existing)
    Buffer.from([0]), // primarySaleHappened = None
    // Is mutable (keep existing)
    Buffer.from([0]), // isMutable = None
  ]);

  const keys = [
    { pubkey: metadataAccount, isSigner: false, isWritable: true },
    { pubkey: updateAuthority, isSigner: true, isWritable: false },
  ];

  return new (require('@solana/web3.js').TransactionInstruction)({
    keys,
    programId: TOKEN_METADATA_PROGRAM_ID,
    data,
  });
}

/**
 * Encode string for Metaplex instruction
 * @param str String to encode
 * @returns Encoded buffer
 */
function encodeString(str: string): Buffer {
  const strBytes = Buffer.from(str, 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32LE(strBytes.length, 0);
  return Buffer.concat([length, strBytes]);
}

/**
 * Fetch current on-chain metadata for an NFT
 * @param connection Solana connection
 * @param mint Mint address
 * @returns Current metadata or null if not found
 */
export async function fetchCurrentMetadata(
  connection: Connection,
  mint: PublicKey
): Promise<{ name: string; symbol: string; uri: string; updateAuthority: PublicKey } | null> {
  try {
    const metadataAccount = getMetadataAccount(mint);
    const accountInfo = await connection.getAccountInfo(metadataAccount);

    if (!accountInfo) {
      return null;
    }

    // Parse metadata account
    // The metadata structure follows Metaplex Token Metadata standard
    const data = accountInfo.data;

    // Skip first byte (key)
    let offset = 1;

    // Read update authority (32 bytes)
    const updateAuthority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read mint (32 bytes)
    offset += 32;

    // Read name (first 4 bytes are string length, then the string)
    const nameLength = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLength).toString('utf-8').replace(/\0/g, '');
    offset += nameLength;

    // Read symbol
    const symbolLength = data.readUInt32LE(offset);
    offset += 4;
    const symbol = data.slice(offset, offset + symbolLength).toString('utf-8').replace(/\0/g, '');
    offset += symbolLength;

    // Read URI
    const uriLength = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.slice(offset, offset + uriLength).toString('utf-8').replace(/\0/g, '');

    return { name, symbol, uri, updateAuthority };
  } catch (error) {
    console.error(`Error fetching metadata for ${mint.toBase58()}:`, error);
    return null;
  }
}

/**
 * Compare current metadata with original
 * @param current Current metadata
 * @param original Original metadata
 * @returns True if different, false if same
 */
export function isMetadataDifferent(
  current: { name: string; symbol: string; uri: string },
  original: NFTMetadata
): boolean {
  return (
    current.name.trim() !== original.name.trim() ||
    current.symbol.trim() !== original.symbol.trim() ||
    current.uri.trim() !== original.uri.trim()
  );
}

/**
 * Update metadata for a single NFT
 * @param connection Solana connection
 * @param wallet Wallet keypair
 * @param metadata NFT metadata to update to
 * @param dryRun If true, simulate only
 * @param logger Logger instance
 * @param maxRetries Maximum number of retries
 * @param retryDelayMs Delay between retries
 * @returns Process result
 */
export async function updateNFTMetadata(
  connection: Connection,
  wallet: Keypair,
  metadata: NFTMetadata,
  dryRun: boolean,
  logger: Logger,
  maxRetries: number,
  retryDelayMs: number
): Promise<ProcessResult> {
  const timestamp = new Date().toISOString();
  const mint = new PublicKey(metadata.mint);

  try {
    // Fetch current metadata
    logger.debug(`Fetching metadata for ${metadata.mint}`);
    const current = await retryWithBackoff(
      () => fetchCurrentMetadata(connection, mint),
      maxRetries,
      retryDelayMs
    );

    if (!current) {
      return {
        mint: metadata.mint,
        status: 'error',
        error: 'Failed to fetch current metadata',
        timestamp,
      };
    }

    // Check if update authority matches
    if (!current.updateAuthority.equals(wallet.publicKey)) {
      return {
        mint: metadata.mint,
        status: 'error',
        error: `Update authority mismatch. Expected: ${wallet.publicKey.toBase58()}, Found: ${current.updateAuthority.toBase58()}`,
        timestamp,
      };
    }

    // Compare metadata
    if (!isMetadataDifferent(current, metadata)) {
      return {
        mint: metadata.mint,
        status: 'skipped',
        action: 'metadata already matches',
        timestamp,
      };
    }

    // If dry run, return early
    if (dryRun) {
      return {
        mint: metadata.mint,
        status: 'updated',
        action: 'dry run - would update',
        oldValues: {
          name: current.name,
          symbol: current.symbol,
          uri: current.uri,
        },
        newValues: {
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadata.uri,
        },
        timestamp,
      };
    }

    // Create update instruction manually
    logger.debug(`Creating update instruction for ${metadata.mint}`);
    const metadataAccount = getMetadataAccount(mint);

    // Create the update metadata instruction using the raw instruction format
    const updateInstruction = createUpdateMetadataInstruction(
      metadataAccount,
      wallet.publicKey,
      metadata.name,
      metadata.symbol,
      metadata.uri
    );

    // Create and send transaction
    const transaction = new Transaction().add(updateInstruction);
    transaction.feePayer = wallet.publicKey;

    logger.debug(`Sending transaction for ${metadata.mint}`);
    const signature = await retryWithBackoff(
      () =>
        sendAndConfirmTransaction(connection, transaction, [wallet], {
          commitment: 'confirmed',
          skipPreflight: false,
        }),
      maxRetries,
      retryDelayMs
    );

    return {
      mint: metadata.mint,
      status: 'updated',
      oldValues: {
        name: current.name,
        symbol: current.symbol,
        uri: current.uri,
      },
      newValues: {
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
      },
      transactionSignature: signature,
      timestamp,
    };
  } catch (error: unknown) {
    return {
      mint: metadata.mint,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      timestamp,
    };
  }
}

/**
 * Process batch of NFTs
 * @param connection Solana connection
 * @param wallet Wallet keypair
 * @param batch Batch of NFT metadata
 * @param dryRun If true, simulate only
 * @param logger Logger instance
 * @param maxRetries Maximum retries per NFT
 * @param retryDelayMs Delay between retries
 * @returns Array of process results
 */
export async function processBatch(
  connection: Connection,
  wallet: Keypair,
  batch: NFTMetadata[],
  dryRun: boolean,
  logger: Logger,
  maxRetries: number,
  retryDelayMs: number
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];

  for (const metadata of batch) {
    const result = await updateNFTMetadata(
      connection,
      wallet,
      metadata,
      dryRun,
      logger,
      maxRetries,
      retryDelayMs
    );

    results.push(result);
    logger.logResult(result);

    // Small delay between individual NFT updates to avoid rate limiting
    await sleep(100);
  }

  return results;
}

/**
 * Calculate total transaction cost
 * @param results Array of process results
 * @param avgFeePerTx Average fee per transaction (default: 0.000005 SOL)
 * @returns Total cost in SOL
 */
export function calculateTotalCost(
  results: ProcessResult[],
  avgFeePerTx: number = 0.000005
): number {
  const successfulUpdates = results.filter((r) => r.status === 'updated' && r.transactionSignature);
  return successfulUpdates.length * avgFeePerTx;
}

