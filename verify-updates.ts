#!/usr/bin/env ts-node

/**
 * Verification script to check if metadata updates were successful
 * Compares on-chain metadata with CSV values
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { fetchCurrentMetadata } from './src/metadataUpdater';
import { parseCSV } from './src/csvParser';
import { Logger } from './src/logger';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

async function verifyUpdates() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   Metadata Update Verification              ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const csvPath = process.env.CSV_FILE_PATH || './test_nfts.csv';
  const logPath = process.env.LOG_FILE_PATH || './logs/update_log.json';

  console.log(`🌐 Connecting to: ${rpcUrl}`);
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log(`📝 Loading CSV: ${csvPath}`);
  const logger = new Logger('./logs/verify.log', 'info');
  const csvMetadata = await parseCSV(csvPath, logger);

  console.log(`📋 Loading update log: ${logPath}`);
  let updateLog: any[] = [];
  if (fs.existsSync(logPath)) {
    updateLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  }

  console.log(`\n🔍 Verifying ${csvMetadata.length} NFTs...\n`);

  let verified = 0;
  let failed = 0;
  let skipped = 0;
  const issues: string[] = [];

  for (const csvData of csvMetadata) {
    const mint = new PublicKey(csvData.mint);
    const logEntry = updateLog.find((e: any) => e.mint === csvData.mint);

    console.log(`\n📦 NFT: ${csvData.mint.substring(0, 8)}...`);
    console.log(`   Expected: "${csvData.name}" / "${csvData.symbol}" / "${csvData.uri.substring(0, 40)}..."`);

    try {
      const onChain = await fetchCurrentMetadata(connection, mint);

      if (!onChain) {
        console.log(`   ❌ No metadata found on-chain`);
        issues.push(`${csvData.mint}: No metadata account found`);
        failed++;
        continue;
      }

      console.log(`   On-chain: "${onChain.name}" / "${onChain.symbol}" / "${onChain.uri.substring(0, 40)}..."`);

      // Compare
      const nameMatch = onChain.name.trim() === csvData.name.trim();
      const symbolMatch = onChain.symbol.trim() === csvData.symbol.trim();
      const uriMatch = onChain.uri.trim() === csvData.uri.trim();

      if (nameMatch && symbolMatch && uriMatch) {
        console.log(`   ✅ All fields match!`);
        verified++;
      } else {
        console.log(`   ⚠️  Mismatch detected:`);
        if (!nameMatch) {
          console.log(`      Name: "${onChain.name}" ≠ "${csvData.name}"`);
          issues.push(`${csvData.mint}: Name mismatch`);
        }
        if (!symbolMatch) {
          console.log(`      Symbol: "${onChain.symbol}" ≠ "${csvData.symbol}"`);
          issues.push(`${csvData.mint}: Symbol mismatch`);
        }
        if (!uriMatch) {
          console.log(`      URI: "${onChain.uri}" ≠ "${csvData.uri}"`);
          issues.push(`${csvData.mint}: URI mismatch`);
        }
        failed++;
      }

      // Show log entry status
      if (logEntry) {
        if (logEntry.status === 'skipped') {
          skipped++;
          console.log(`   ℹ️  Log shows: Skipped (${logEntry.action})`);
        } else if (logEntry.status === 'updated') {
          console.log(`   ℹ️  Log shows: Updated`);
          if (logEntry.transactionSignature) {
            console.log(`   📝 TX: ${logEntry.transactionSignature.substring(0, 20)}...`);
            console.log(`   🔗 Explorer: https://explorer.solana.com/tx/${logEntry.transactionSignature}?cluster=devnet`);
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      issues.push(`${csvData.mint}: ${error}`);
      failed++;
    }
  }

  // Summary
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║              📊 VERIFICATION SUMMARY         ║`);
  console.log(`╚═══════════════════════════════════════════════╝\n`);

  console.log(`Total NFTs:        ${csvMetadata.length}`);
  console.log(`✅ Verified:       ${verified} (metadata matches CSV)`);
  console.log(`⚠️  Failed:         ${failed} (mismatches or errors)`);
  console.log(`⏭️  Skipped:        ${skipped} (already matched)`);

  if (issues.length > 0) {
    console.log(`\n⚠️  Issues Found:\n`);
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }

  if (verified === csvMetadata.length) {
    console.log(`\n🎉 SUCCESS! All NFTs have correct metadata on-chain!`);
  } else if (verified > 0) {
    console.log(`\n⚠️  PARTIAL: Some NFTs verified, but ${failed} have issues.`);
    console.log(`   Check the issues above and verify on Solana Explorer.`);
  } else {
    console.log(`\n❌ FAILED: No NFTs verified correctly.`);
    console.log(`   The update instruction may not be working correctly.`);
    console.log(`   Check transaction signatures on Solana Explorer.`);
  }

  console.log(`\n💡 Tip: Check individual NFTs on Solana Explorer:`);
  csvMetadata.forEach((nft) => {
    console.log(`   https://explorer.solana.com/address/${nft.mint}?cluster=devnet`);
  });
}

verifyUpdates().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


