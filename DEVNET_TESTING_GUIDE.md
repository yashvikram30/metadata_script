# 🧪 Devnet Testing Guide

Complete guide to testing the Solana NFT Metadata Updater on Devnet before running on Mainnet.

## 📋 Table of Contents

1. [Why Test on Devnet?](#why-test-on-devnet)
2. [Prerequisites](#prerequisites)
3. [Setup Steps](#setup-steps)
4. [Creating Test NFTs](#creating-test-nfts)
5. [Testing the Script](#testing-the-script)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [Moving to Mainnet](#moving-to-mainnet)

---

## 🎯 Why Test on Devnet?

Testing on Devnet is **CRITICAL** before running on Mainnet because:

- ✅ **Free**: Devnet SOL is free (from faucet)
- ✅ **Safe**: No real funds at risk
- ✅ **Realistic**: Same environment as Mainnet
- ✅ **Catch Issues**: Find bugs before they cost money
- ✅ **Practice**: Get familiar with the process

**Never skip devnet testing!** Even experienced developers test on devnet first.

---

## 📦 Prerequisites

Before starting, ensure you have:

- [x] Node.js 18+ installed
- [x] Project dependencies installed (`npm install`)
- [x] Project built (`npm run build`)
- [x] A Solana wallet (we'll create one for devnet)
- [x] Basic understanding of Solana and NFTs

---

## 🚀 Setup Steps

### Step 1: Create a Devnet Wallet

You should use a **separate wallet** for devnet testing (not your mainnet wallet).

#### Option A: Create New Wallet with Solana CLI

```bash
# Install Solana CLI if not installed
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Create new keypair for devnet
solana-keygen new --outfile wallet.json

# View public key
solana-keygen pubkey wallet.json
```

#### Option B: Use Existing Wallet

If you already have a `wallet.json` file in the project directory (like you do), you can use it directly:

```bash
# Your wallet.json is already in the project directory
# Just make sure it has the correct format (array of numbers)
```

**Note**: You can also convert a private key to the correct format using:
```bash
npm run convert-keypair
```

### Step 2: Get Devnet SOL

Get free devnet SOL from the faucet:

```bash
# Using Solana CLI
solana airdrop 2 <YOUR_PUBKEY> --url devnet

# Or use web faucet
# Visit: https://faucet.solana.com/
```

**Recommended**: Get at least 2 SOL for testing.

Verify your balance:

```bash
solana balance <YOUR_PUBKEY> --url devnet
```

### Step 3: Configure for Devnet

Update your `.env` file:

```bash
# Copy example if not already done
cp env.example .env
```

Edit `.env` with devnet settings:

```env
# Devnet RPC
SOLANA_RPC_URL=https://api.devnet.solana.com
NETWORK=devnet

# Your devnet wallet (use existing wallet.json)
WALLET_KEYPAIR_PATH=./wallet.json

# Test CSV (we'll create this)
CSV_FILE_PATH=./test_nfts.csv

# Start with dry run
DRY_RUN=true

# Smaller batch for testing
BATCH_SIZE=5
BATCH_DELAY_MS=1000

# Other settings
MAX_RETRIES=3
SKIP_CONFIRM=false
```

---

## 🎨 Creating Test NFTs

You have two options:

### Option A: Use Metaboss (Recommended)

[Metaboss](https://metaboss.rs/) is a CLI tool for Metaplex operations.

#### Install Metaboss

```bash
# macOS/Linux
bash <(curl -sSf https://raw.githubusercontent.com/samuelvanderwaal/metaboss/main/scripts/install.sh)

# Or with cargo
cargo install metaboss
```

#### Create Test NFTs

1. **Create JSON metadata files** (save as `metadata-1.json`, etc.):

```json
{
  "name": "Test NFT #1",
  "symbol": "TEST",
  "description": "Test NFT for metadata updater",
  "image": "https://arweave.net/test-image-1",
  "attributes": [],
  "properties": {
    "files": [
      {
        "uri": "https://arweave.net/test-image-1",
        "type": "image/png"
      }
    ],
    "category": "image"
  }
}
```

2. **Upload metadata to Arweave** (or use a public URL):

```bash
# Using Metaboss (requires AR tokens)
metaboss upload nft --keypair devnet-wallet.json --image image.png --metadata metadata-1.json
```

3. **Mint NFTs on Devnet**:

```bash
# Mint single NFT
metaboss mint one \
  --keypair devnet-wallet.json \
  --url devnet \
  --metadata https://your-metadata-url.json
```

Repeat for 3-5 test NFTs.

### Option B: Use Our Helper Script

We've created a helper script to simplify test NFT creation.

```bash
# Create test NFTs (we'll add this script next)
npm run create-test-nfts
```

### Option C: Use Existing Devnet NFTs

If you already have NFTs on devnet with update authority, you can use those!

---

## 📝 Create Test CSV File

After creating test NFTs, create a CSV file with their data.

**Format**: `test_nfts.csv`

```csv
mint,account_data,image,status
<MINT_ADDRESS_1>,"{""mint"":""<MINT_ADDRESS_1>"",""name"":""Test NFT #1 - Updated"",""symbol"":""TEST"",""uri"":""https://arweave.net/updated-1""}",https://arweave.net/image-1.png,ok
<MINT_ADDRESS_2>,"{""mint"":""<MINT_ADDRESS_2>"",""name"":""Test NFT #2 - Updated"",""symbol"":""TEST"",""uri"":""https://arweave.net/updated-2""}",https://arweave.net/image-2.png,ok
<MINT_ADDRESS_3>,"{""mint"":""<MINT_ADDRESS_3>"",""name"":""Test NFT #3 - Updated"",""symbol"":""TEST"",""uri"":""https://arweave.net/updated-3""}",https://arweave.net/image-3.png,ok
```

**Important**: 
- Replace `<MINT_ADDRESS_X>` with actual mint addresses
- The `name`, `symbol`, and `uri` in `account_data` are the **new values** you want to set

---

## 🧪 Testing the Script

### Test 1: Dry Run (No Transactions)

First, always test with dry run:

```bash
npm run update:dry
```

**Expected Output**:
```
╔═══════════════════════════════════════════════╗
║   Solana NFT Metadata Updater v1.0.0        ║
║   For Doge Capital NFT Collection           ║
╚═══════════════════════════════════════════════╝

📋 Configuration:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Network:           devnet
RPC URL:           https://api.devnet.solana.com
...
Dry Run:           ✅ YES (no transactions will be sent)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ Loading wallet...
✓ Wallet loaded: <YOUR_PUBKEY>

ℹ Connecting to Solana devnet...
✓ Wallet balance: 2.000000 SOL

ℹ Parsing CSV file...
✓ Successfully parsed 3 NFT records from CSV
```

**What to Check**:
- ✅ Configuration is correct (devnet, dry run enabled)
- ✅ Wallet loaded successfully
- ✅ CSV parsed correctly
- ✅ All NFTs are detected

### Test 2: Verify Update Preview

Check the dry run output:

```
✓ [Dpw1ezMy...] Updated (dry run - would update)
  Name: "Test NFT #1" → "Test NFT #1 - Updated"
  URI: "https://arweave.net/old-1" → "https://arweave.net/updated-1"
```

**Verify**:
- ✅ Correct NFTs are identified
- ✅ Changes look correct (old → new values)
- ✅ No unexpected errors

### Test 3: Check Logs

Review the detailed logs:

```bash
cat logs/update_log.json | jq
```

Look for:
- Correct mint addresses
- Proper old/new values
- No error messages

### Test 4: Single NFT Update (Real Transaction)

Now test with **ONE** NFT:

1. Edit `.env`:
   ```env
   DRY_RUN=false
   NFT_RANGE=0-0
   ```

2. Run the script:
   ```bash
   npm start
   ```

3. Confirm when prompted

**Expected Output**:
```
✓ [Dpw1ezMy...] Updated (5k7x2...)
  Name: "Test NFT #1" → "Test NFT #1 - Updated"
```

### Test 5: Verify On-Chain

Verify the update worked:

```bash
# Using Solana CLI
solana account <MINT_ADDRESS> --url devnet

# Or check on Solana Explorer
# https://explorer.solana.com/address/<MINT_ADDRESS>?cluster=devnet
```

### Test 6: Multiple NFTs

If first NFT worked:

1. Update `.env`:
   ```env
   NFT_RANGE=  # Remove range (process all)
   ```

2. Run again:
   ```bash
   npm start
   ```

### Test 7: Test Resume from Checkpoint

Simulate interruption:

1. Start the script
2. Press `Ctrl+C` after 1-2 NFTs
3. Resume:
   ```bash
   RESUME_FROM_CHECKPOINT=true npm start
   ```

**Verify**: It continues from where it left off.

---

## ✅ Verification Checklist

After testing, verify:

### On-Chain Verification

```bash
# For each NFT, check on Solana Explorer
https://explorer.solana.com/address/<MINT_ADDRESS>?cluster=devnet
```

Check:
- [ ] Metadata account exists
- [ ] Name is updated correctly
- [ ] Symbol is updated correctly
- [ ] URI is updated correctly
- [ ] Update authority is still your wallet

### Script Verification

Check logs:

- [ ] `logs/update_log.json` shows all operations
- [ ] `logs/summary.json` has correct statistics
- [ ] No unexpected errors
- [ ] Transaction signatures are valid

### Test Edge Cases

Test these scenarios:

1. **NFT Already Has Correct Metadata**:
   - Run script twice on same NFT
   - Should skip on second run

2. **Invalid Mint Address**:
   - Add fake mint to CSV
   - Should handle gracefully

3. **Insufficient Balance**:
   - Try with near-zero balance
   - Should warn appropriately

4. **Network Issues**:
   - Try with invalid RPC
   - Should retry correctly

---

## 🐛 Troubleshooting

### Issue: "Wallet keypair file not found"

**Solution**:
```bash
# Check file exists
ls -la wallet.json

# Update .env path (should already be set)
WALLET_KEYPAIR_PATH=./wallet.json
```

### Issue: "Insufficient balance"

**Solution**:
```bash
# Get more devnet SOL
solana airdrop 2 <YOUR_PUBKEY> --url devnet

# Check balance
solana balance <YOUR_PUBKEY> --url devnet
```

### Issue: "Update authority mismatch"

**Solution**:
- The wallet doesn't have authority to update these NFTs
- Use NFTs you created with this wallet
- Or transfer update authority to your wallet

### Issue: "Failed to fetch metadata"

**Solution**:
```bash
# Verify NFT exists on devnet
solana account <MINT_ADDRESS> --url devnet

# Check if mint address is correct
# Verify it's a valid SPL token mint
```

### Issue: "RPC request failed"

**Solution**:
```bash
# Try different RPC endpoint
SOLANA_RPC_URL=https://api.devnet.solana.com

# Or use custom RPC
# Increase delays
BATCH_DELAY_MS=2000
```

### Issue: "Transaction failed"

**Solution**:
- Check devnet SOL balance
- Verify update authority
- Check transaction details on explorer
- Try with smaller batch size

---

## 🎓 Testing Best Practices

1. **Start Small**: Test with 1-2 NFTs first
2. **Always Dry Run**: Never skip `DRY_RUN=true` testing
3. **Verify Each Step**: Check logs and explorer
4. **Test Edge Cases**: Try various scenarios
5. **Document Issues**: Note any problems
6. **Keep Test Data**: Save test CSV and logs

---

## 🚀 Moving to Mainnet

Only move to mainnet after:

- [x] All devnet tests pass
- [x] Verified updates on-chain (devnet explorer)
- [x] Tested with various scenarios
- [x] Comfortable with the process
- [x] Have backup of mainnet data
- [x] Using premium RPC for mainnet
- [x] Sufficient mainnet SOL (2x estimated cost)

### Mainnet Configuration

Update `.env`:

```env
# Switch to mainnet
NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Use your mainnet wallet
WALLET_KEYPAIR_PATH=./mainnet-wallet.json

# Your mainnet CSV
CSV_FILE_PATH=./nft_metadata.csv

# Start with dry run!
DRY_RUN=true

# Production settings
BATCH_SIZE=25
BATCH_DELAY_MS=500
```

### Pre-Mainnet Checklist

- [ ] All devnet tests successful
- [ ] Mainnet wallet has update authority
- [ ] Sufficient mainnet SOL balance
- [ ] CSV data verified correct
- [ ] Backup of all data
- [ ] Dry run on mainnet completed
- [ ] Reviewed dry run logs
- [ ] Team/stakeholders notified
- [ ] Ready to proceed

### First Mainnet Run

```bash
# 1. Dry run on mainnet
NETWORK=mainnet-beta DRY_RUN=true npm start

# 2. Review logs carefully

# 3. Test with small range
NETWORK=mainnet-beta DRY_RUN=false NFT_RANGE=0-10 npm start

# 4. Verify on explorer

# 5. If all good, full run
NETWORK=mainnet-beta DRY_RUN=false npm start
```

---

## 📚 Additional Resources

### Devnet Resources

- **Devnet Faucet**: https://faucet.solana.com/
- **Devnet Explorer**: https://explorer.solana.com/?cluster=devnet
- **Metaboss Docs**: https://metaboss.rs/
- **Solana Docs**: https://docs.solana.com/

### Helper Commands

```bash
# Check devnet balance
solana balance <PUBKEY> --url devnet

# Get devnet SOL
solana airdrop 2 <PUBKEY> --url devnet

# View transaction
solana confirm <SIGNATURE> --url devnet

# View account info
solana account <ADDRESS> --url devnet

# Check configuration
cat .env | grep NETWORK
```

---

## 🎉 Summary

Testing on devnet:
1. ✅ Creates a safe environment
2. ✅ Costs nothing (free SOL)
3. ✅ Catches issues early
4. ✅ Builds confidence
5. ✅ Saves money (avoiding mainnet mistakes)

**Remember**: 
- Always test on devnet first
- Never skip dry run mode
- Verify every update on explorer
- Keep detailed notes
- Only move to mainnet when 100% confident

---

**Questions?** Review the main README.md or check the troubleshooting section.

**Ready for Mainnet?** Follow the "Moving to Mainnet" section above.

Good luck testing! 🚀

