#!/usr/bin/env ts-node

/**
 * Private Key to BS58 Array Converter
 * Converts a private key (base58 string or hex) to Solana keypair array format
 */

import * as readline from 'readline';
import bs58 from 'bs58';

/**
 * Convert private key to Solana keypair array format
 */
function convertToKeypairArray(privateKey: string): number[] {
  try {
    // Remove any whitespace
    privateKey = privateKey.trim();

    // Try to decode as base58 (most common Solana format)
    let keyBytes: Uint8Array;

    if (privateKey.startsWith('[')) {
      // Already in array format
      const parsed = JSON.parse(privateKey);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      throw new Error('Invalid array format');
    } else if (privateKey.startsWith('0x') || /^[0-9a-fA-F]+$/.test(privateKey)) {
      // Hex format
      const hex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      if (hex.length !== 128 && hex.length !== 64) {
        throw new Error('Invalid hex length. Expected 64 or 128 characters');
      }
      // Convert hex to bytes
      keyBytes = Uint8Array.from(
        hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
    } else {
      // Try base58 decode
      keyBytes = bs58.decode(privateKey);
    }

    // Validate length (Solana keypairs are 64 bytes)
    if (keyBytes.length !== 64) {
      throw new Error(
        `Invalid key length: ${keyBytes.length} bytes. Expected 64 bytes (32-byte secret key + 32-byte public key)`
      );
    }

    // Convert to array
    return Array.from(keyBytes);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to convert key: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   Private Key to BS58 Array Converter       ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  try {
    console.log('📝 Enter your private key in one of these formats:');
    console.log('   - Base58 string (e.g., 5KJvsngHeM...');
    console.log('   - Hex string (e.g., 0x1234... or 1234...');
    console.log('   - Array format (e.g., [123,45,67,...]');
    console.log('   - Or paste your Solana keypair JSON array\n');

    const privateKey = await question('Private Key: ');

    if (!privateKey || privateKey.trim().length === 0) {
      console.error('\n❌ Error: Private key cannot be empty');
      process.exit(1);
    }

    console.log('\n🔄 Converting...\n');

    const keypairArray = convertToKeypairArray(privateKey);

    console.log('✅ Conversion successful!\n');
    console.log('📋 Keypair Array (copy this):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(keypairArray));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Ask if user wants to save to file
    const saveToFile = await question('💾 Save to wallet.json file? (yes/no): ');

    if (saveToFile.toLowerCase() === 'yes' || saveToFile.toLowerCase() === 'y') {
      const filename = await question('📁 Filename (default: wallet.json): ') || 'wallet.json';

      // Remove .json extension if provided
      const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;

      // Write to file
      require('fs').writeFileSync(finalFilename, JSON.stringify(keypairArray), 'utf-8');

      console.log(`\n✅ Keypair saved to: ${finalFilename}`);
      console.log(`\n⚠️  SECURITY WARNING:`);
      console.log(`   - Never share this file`);
      console.log(`   - Never commit to git`);
      console.log(`   - Keep it secure!\n`);
    }

    // Show public key if possible
    try {
      const { Keypair } = require('@solana/web3.js');
      const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairArray));
      console.log('🔑 Public Key:', keypair.publicKey.toBase58());
      console.log('   (Verify this matches your expected public key)\n');
    } catch (error) {
      console.log('⚠️  Could not derive public key (this is okay)\n');
    }

    console.log('✨ Done!\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    console.error('\n💡 Tips:');
    console.error('   - Make sure the private key is correct');
    console.error('   - Check the format (base58, hex, or array)');
    console.error('   - Solana keypairs must be 64 bytes\n');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { convertToKeypairArray };


