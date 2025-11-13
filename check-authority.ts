#!/usr/bin/env ts-node

/**
 * Check Update Authority Script
 * Verifies if your wallet has update authority for NFTs in CSV
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { fetchCurrentMetadata } from './src/metadataUpdater';
import { parseCSV } from './src/csvParser';
import { Logger } from './src/logger';
import { loadWalletKeypair } from './src/utils';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkAuthority() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   Update Authority Checker                   ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const csvPath = process.env.CSV_FILE_PATH || './test_nfts.csv';
  const walletPath = process.env.WALLET_KEYPAIR_PATH || './wallet.json';

  console.log(`🌐 Connecting to: ${rpcUrl}`);
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log(`🔑 Loading wallet: ${walletPath}`);
  const wallet = loadWalletKeypair(walletPath);
  console.log(`   Your wallet: ${wallet.publicKey.toBase58()}\n`);

  console.log(`📝 Loading CSV: ${csvPath}`);
  const logger = new Logger('./logs/authority-check.log', 'info');
  const csvMetadata = await parseCSV(csvPath, logger);

  console.log(`\n🔍 Checking update authority for ${csvMetadata.length} NFTs...\n`);

  let hasAuthority = 0;
  let noAuthority = 0;
  let notFound = 0;
  const issues: string[] = [];

  for (const csvData of csvMetadata) {
    console.log(`📦 ${csvData.mint.substring(0, 8)}... (${csvData.name})`);

    // Validate mint address format
    let mint: PublicKey;
    try {
      mint = new PublicKey(csvData.mint);
    } catch (error) {
      console.log(`   ❌ Invalid mint address format`);
      notFound++;
      issues.push(`${csvData.mint}: Invalid address format`);
      continue;
    }

    try {
      const onChain = await fetchCurrentMetadata(connection, mint);

      if (!onChain) {
        console.log(`   ❌ NFT not found on-chain`);
        notFound++;
        issues.push(`${csvData.mint}: NFT not found`);
        continue;
      }

      const hasAuth = onChain.updateAuthority.equals(wallet.publicKey);
      
      if (hasAuth) {
        console.log(`   ✅ You have update authority`);
        console.log(`      Authority: ${onChain.updateAuthority.toBase58()}`);
        hasAuthority++;
      } else {
        console.log(`   ❌ You do NOT have update authority`);
        console.log(`      Required: ${onChain.updateAuthority.toBase58()}`);
        console.log(`      Your wallet: ${wallet.publicKey.toBase58()}`);
        noAuthority++;
        issues.push(`${csvData.mint}: Authority mismatch (required: ${onChain.updateAuthority.toBase58()})`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      issues.push(`${csvData.mint}: ${error}`);
      notFound++;
    }
  }

  // Summary
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║              📊 AUTHORITY SUMMARY            ║`);
  console.log(`╚═══════════════════════════════════════════════╝\n`);

  console.log(`Total NFTs:        ${csvMetadata.length}`);
  console.log(`✅ Has Authority:   ${hasAuthority}`);
  console.log(`❌ No Authority:    ${noAuthority}`);
  console.log(`⚠️  Not Found:       ${notFound}`);

  if (issues.length > 0 && noAuthority > 0) {
    console.log(`\n⚠️  NFTs You Cannot Update:\n`);
    issues.filter(i => i.includes('Authority mismatch')).forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }

  if (hasAuthority === csvMetadata.length) {
    console.log(`\n🎉 SUCCESS! You have update authority for ALL NFTs!`);
    console.log(`   You can proceed with updating metadata.\n`);
  } else if (hasAuthority > 0) {
    console.log(`\n⚠️  PARTIAL: You can update ${hasAuthority}/${csvMetadata.length} NFTs.`);
    console.log(`   ${noAuthority} NFTs require a different wallet.\n`);
  } else {
    console.log(`\n❌ FAILED: You don't have update authority for any NFTs.`);
    console.log(`   You need to use the correct wallet or transfer authority.\n`);
  }

  console.log(`💡 Your wallet address: ${wallet.publicKey.toBase58()}`);
  console.log(`   Use this to verify on Solana Explorer.\n`);
}

checkAuthority().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

