#!/usr/bin/env ts-node

/**
 * Helper script to create test NFTs on Devnet
 * 
 * ⚠️  NOTE: This script may fail due to Metaplex instruction format complexity.
 * 
 * For more reliable NFT creation, use Metaboss instead:
 *   1. Install: cargo install metaboss
 *   2. Create: metaboss mint one --keypair wallet.json --url devnet --metadata <metadata.json>
 * 
 * See CREATE_TEST_NFTS.md for detailed instructions.
 * 
 * This script attempts to create NFTs but may encounter errors with the metadata instruction.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  MintLayout,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as fs from 'fs';
import { loadWalletKeypair } from './src/utils';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

interface TestNFTData {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
}

/**
 * Get metadata account PDA
 */
function getMetadataAccount(mint: PublicKey): PublicKey {
  const [metadataAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );
  return metadataAccount;
}

/**
 * Create metadata instruction using CreateMetadataAccountV3
 * Note: This uses the V3 instruction format which is the current standard
 */
function createMetadataInstruction(
  metadataAccount: PublicKey,
  mint: PublicKey,
  mintAuthority: PublicKey,
  payer: PublicKey,
  updateAuthority: PublicKey,
  name: string,
  symbol: string,
  uri: string
): import('@solana/web3.js').TransactionInstruction {
  // Instruction discriminator for CreateMetadataAccountV3 is 33 (0x21)
  const discriminator = Buffer.from([33]);

  // Encode strings with length prefix (4 bytes little-endian)
  function encodeString(str: string): Buffer {
    const strBytes = Buffer.from(str, 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32LE(strBytes.length, 0);
    return Buffer.concat([len, strBytes]);
  }

  // Create data buffer
  const data = Buffer.concat([
    discriminator, // Instruction discriminator
    encodeString(name), // Name
    encodeString(symbol), // Symbol
    encodeString(uri), // URI
    Buffer.from([0, 0]), // seller_fee_basis_points (u16) = 0
    Buffer.from([0]), // creators = None (Option::None)
    Buffer.from([0]), // collection = None
    Buffer.from([0]), // uses = None
    Buffer.from([1]), // is_mutable = true (bool)
    Buffer.from([0]), // collection_details = None
  ]);

  const keys = [
    { pubkey: metadataAccount, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: mintAuthority, isSigner: true, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: false },
    { pubkey: updateAuthority, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new (require('@solana/web3.js').TransactionInstruction)({
    keys,
    programId: TOKEN_METADATA_PROGRAM_ID,
    data,
  });
}

/**
 * Create a test NFT
 */
async function createTestNFT(
  connection: Connection,
  payer: Keypair,
  name: string,
  symbol: string,
  uri: string
): Promise<TestNFTData> {
  console.log(`\n🎨 Creating NFT: ${name}...`);

  // Generate mint keypair
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  console.log(`  Mint: ${mint.toBase58()}`);

  // Get associated token account
  const associatedTokenAccount = await getAssociatedTokenAddress(
    mint,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Get metadata account
  const metadataAccount = getMetadataAccount(mint);

  // Calculate rent
  const rentMint = await connection.getMinimumBalanceForRentExemption(MintLayout.span);

  // Create transaction
  const transaction = new Transaction();

  // 1. Create mint account
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      space: MintLayout.span,
      lamports: rentMint,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  // 2. Initialize mint (0 decimals for NFT)
  transaction.add(
    createInitializeMintInstruction(mint, 0, payer.publicKey, payer.publicKey, TOKEN_PROGRAM_ID)
  );

  // 3. Create associated token account
  transaction.add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      associatedTokenAccount,
      payer.publicKey,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // 4. Mint 1 token
  transaction.add(
    createMintToInstruction(mint, associatedTokenAccount, payer.publicKey, 1, [], TOKEN_PROGRAM_ID)
  );

  // 5. Create metadata
  transaction.add(
    createMetadataInstruction(
      metadataAccount,
      mint,
      payer.publicKey,
      payer.publicKey,
      payer.publicKey,
      name,
      symbol,
      uri
    )
  );

    // Send transaction
    console.log(`  Sending transaction...`);
    try {
      const signature = await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], {
        commitment: 'confirmed',
      });

      console.log(`  ✅ Success! Signature: ${signature.substring(0, 20)}...`);
      console.log(`  View on Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      return {
        mint: mint.toBase58(),
        name,
        symbol,
        uri,
      };
    } catch (error: any) {
      console.error(`  ❌ Error creating NFT:`, error?.message || error);
      
      // Check if it's a metadata instruction error
      if (error?.transactionLogs?.some((log: string) => log.includes('deprecated'))) {
        console.error(`\n  ⚠️  The metadata instruction format may be incorrect.`);
        console.error(`  💡 Alternative: Use Metaboss to create test NFTs:`);
        console.error(`     Install: cargo install metaboss`);
        console.error(`     Create: metaboss mint one --keypair wallet.json --url devnet --metadata <metadata.json>`);
        console.error(`\n  Or use existing NFTs on devnet that you already own.\n`);
      }
      
      throw error;
    }
}

/**
 * Generate CSV file from test NFTs
 */
function generateCSV(nfts: TestNFTData[], outputPath: string): void {
  console.log(`\n📝 Generating CSV file...`);

  const rows = ['mint,account_data,image,status'];

  nfts.forEach((nft) => {
    const accountData = JSON.stringify({
      mint: nft.mint,
      name: `${nft.name} - Updated`, // Add "Updated" to test the update
      symbol: nft.symbol,
      uri: nft.uri.replace('.json', '-updated.json'), // Change URI to test update
    });

    const escapedAccountData = accountData.replace(/"/g, '""');
    rows.push(`${nft.mint},"${escapedAccountData}",${nft.uri.replace('.json', '.png')},ok`);
  });

  fs.writeFileSync(outputPath, rows.join('\n'), 'utf-8');
  console.log(`  ✅ CSV saved to: ${outputPath}`);
}

/**
 * Main function
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   Devnet Test NFT Creator                    ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  
  console.log('⚠️  Note: This script may fail due to Metaplex instruction complexity.');
  console.log('💡 For more reliable results, use Metaboss (see CREATE_TEST_NFTS.md)\n');

  try {
    // Load wallet
    const walletPath = process.env.WALLET_KEYPAIR_PATH || './wallet.json';

    if (!fs.existsSync(walletPath)) {
      console.error(`❌ Wallet not found: ${walletPath}`);
      console.log('\n📝 Please create a wallet first:');
      console.log('   solana-keygen new --outfile wallet.json');
      console.log('   solana airdrop 2 $(solana-keygen pubkey wallet.json) --url devnet');
      console.log('\n   Or convert existing private key:');
      console.log('   npm run convert-keypair\n');
      process.exit(1);
    }

    console.log(`🔑 Loading wallet from: ${walletPath}`);
    const wallet = loadWalletKeypair(walletPath);
    console.log(`   Wallet: ${wallet.publicKey.toBase58()}\n`);

    // Connect to devnet
    console.log(`🌐 Connecting to Solana Devnet...`);
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    // Check balance
    const balance = await connection.getBalance(wallet.publicKey);
    const balanceSOL = balance / 1e9;
    console.log(`   Balance: ${balanceSOL.toFixed(4)} SOL\n`);

    if (balanceSOL < 0.5) {
      console.warn(`⚠️  Low balance! You need at least 0.5 SOL for testing.`);
      console.log(`   Get devnet SOL:`);
      console.log(`   solana airdrop 2 ${wallet.publicKey.toBase58()} --url devnet\n`);
      process.exit(1);
    }

    // Number of test NFTs to create
    const numNFTs = parseInt(process.env.NUM_TEST_NFTS || '3');
    console.log(`📊 Creating ${numNFTs} test NFTs...\n`);

    const createdNFTs: TestNFTData[] = [];

    // Create test NFTs
    for (let i = 0; i < numNFTs; i++) {
      try {
        const nft = await createTestNFT(
          connection,
          wallet,
          `Test NFT #${i}`,
          'TEST',
          `https://example.com/metadata-${i}.json`
        );
        createdNFTs.push(nft);

        // Small delay between NFTs
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to create NFT #${i}:`, error);
      }
    }

    if (createdNFTs.length === 0) {
      console.error('\n❌ No NFTs were created successfully.');
      process.exit(1);
    }

    // Generate CSV
    const csvPath = './test_nfts.csv';
    generateCSV(createdNFTs, csvPath);

    // Save mint addresses for reference
    const mintsPath = './test_nfts_mints.json';
    fs.writeFileSync(mintsPath, JSON.stringify(createdNFTs, null, 2), 'utf-8');
    console.log(`  ✅ Mint addresses saved to: ${mintsPath}`);

    // Summary
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║              ✅ SUCCESS!                      ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    console.log(`Created ${createdNFTs.length} test NFTs on Devnet:\n`);
    createdNFTs.forEach((nft, index) => {
      console.log(`  ${index + 1}. ${nft.name}`);
      console.log(`     Mint: ${nft.mint}`);
      console.log(`     Explorer: https://explorer.solana.com/address/${nft.mint}?cluster=devnet\n`);
    });

    console.log('📝 Next Steps:\n');
    console.log('  1. Update your .env file:');
    console.log('     CSV_FILE_PATH=./test_nfts.csv\n');
    console.log('  2. Run the updater in dry run mode:');
    console.log('     npm run update:dry\n');
    console.log('  3. If dry run looks good, run for real:');
    console.log('     DRY_RUN=false npm start\n');
    console.log('  4. Verify updates on Solana Explorer (links above)\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

