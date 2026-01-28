import { task } from "hardhat/config";

task("deploy-vault").setAction(async (_args, hre) => {
  await hre.run("compile");

  const APIKeyVault = await hre.ethers.getContractFactory("APIKeyVault");
  const vault = await APIKeyVault.deploy();
  await vault.waitForDeployment();

  console.log(`APIKeyVault deployed to: ${vault.target}`);
  return vault.target;
});

task("register-secret")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name (e.g., OPENAI_API_KEY)")
  .addOptionalParam("secret", "The secret (use env var for safety: --secret $MY_SECRET)")
  .setAction(async (args, hre) => {
    // Prefer reading from env var for security (avoids shell history)
    const secret = args.secret || process.env[args.provider];
    if (!secret) {
      console.error(`No secret provided. Use --secret or set ${args.provider} env var`);
      console.log(`Example: export ${args.provider}="sk-..." && npx hardhat register-secret ...`);
      return;
    }

    const vault = await hre.ethers.getContractAt("APIKeyVault", args.address);
    const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(args.provider));

    const isValid = await vault.isValidProvider(providerId);
    if (!isValid) {
      console.error(`Invalid provider: ${args.provider}`);
      console.log("Valid providers: ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, OPENROUTER_API_KEY, ZAI_API_KEY, GOOGLE_API_KEY");
      return;
    }

    const ciphertext = hre.ethers.toUtf8Bytes(secret);
    const tx = await vault.registerSecret(providerId, ciphertext);
    await tx.wait();

    console.log(`✓ Secret registered for ${args.provider} (${secret.length} chars) in tx: ${tx.hash}`);
  });

task("add-allowlist")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name (e.g., OPENAI_API_KEY)")
  .addParam("user", "Address to add to allowlist")
  .setAction(async (args, hre) => {
    const vault = await hre.ethers.getContractAt("APIKeyVault", args.address);
    const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(args.provider));

    const tx = await vault.addToAllowlist(providerId, args.user);
    await tx.wait();

    console.log(`Added ${args.user} to allowlist for ${args.provider} in tx: ${tx.hash}`);
  });

task("remove-allowlist")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name (e.g., OPENAI_API_KEY)")
  .addParam("user", "Address to remove from allowlist")
  .setAction(async (args, hre) => {
    const vault = await hre.ethers.getContractAt("APIKeyVault", args.address);
    const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(args.provider));

    const tx = await vault.removeFromAllowlist(providerId, args.user);
    await tx.wait();

    console.log(`Removed ${args.user} from allowlist for ${args.provider} in tx: ${tx.hash}`);
  });

task("get-secret")
  .addParam("address", "Contract address")
  .addParam("owner", "Owner address")
  .addParam("provider", "Provider name (e.g., OPENAI_API_KEY)")
  .setAction(async (args, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const vault = await hre.ethers.getContractAt("APIKeyVault", args.address, signer);
    const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(args.provider));

    try {
      // Step 1: Request access (stores pending secret)
      console.log("Requesting secret access...");
      const tx = await vault.getSecretTx(args.owner, providerId);
      await tx.wait();
      console.log(`Access granted in tx: ${tx.hash}`);

      // Step 2: Create signature for claim
      const message = "claim-secret";
      const hash = hre.ethers.hashMessage(message);
      const sig = await signer.signMessage(message);
      const { v, r, s } = hre.ethers.Signature.from(sig);

      // Step 3: Claim secret using signature (view call with signature verification)
      const ciphertext = await vault.claimSecret(hash, v, r, s);
      const secret = hre.ethers.toUtf8String(ciphertext);

      // Step 4: Clear pending
      const clearTx = await vault.clearPending();
      await clearTx.wait();

      console.log(`✓ Secret for ${args.provider}: ${secret}`);
    } catch (e: any) {
      console.error(`Failed to get secret: ${e.reason || e.message}`);
    }
  });

task("log-access")
  .addParam("address", "Contract address")
  .addParam("owner", "Owner address")
  .addParam("provider", "Provider name (e.g., OPENAI_API_KEY)")
  .setAction(async (args, hre) => {
    const vault = await hre.ethers.getContractAt("APIKeyVault", args.address);
    const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(args.provider));

    const tx = await vault.logAccess(args.owner, providerId);
    await tx.wait();

    console.log(`Access logged for ${args.provider} in tx: ${tx.hash}`);
  });

task("revoke-secret")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name (e.g., OPENAI_API_KEY)")
  .setAction(async (args, hre) => {
    const vault = await hre.ethers.getContractAt("APIKeyVault", args.address);
    const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(args.provider));

    const tx = await vault.revokeSecret(providerId);
    await tx.wait();

    console.log(`Secret revoked for ${args.provider} in tx: ${tx.hash}`);
  });

task("get-secret-info")
  .addParam("address", "Contract address")
  .addParam("owner", "Owner address")
  .addParam("provider", "Provider name (e.g., OPENAI_API_KEY)")
  .setAction(async (args, hre) => {
    const vault = await hre.ethers.getContractAt("APIKeyVault", args.address);
    const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(args.provider));

    // Note: isAllowed will be false for CLI calls (msg.sender = address(0) for unsigned view calls)
    // This is expected - use get-secret task to actually retrieve secrets via transaction
    const result = await vault.getSecretInfo(args.owner, providerId);
    console.log(`Secret info for ${args.provider}:`);
    console.log(`  Version: ${result.version}`);
    console.log(`  Exists: ${result.exists}`);
    console.log(`  Caller is allowed: ${result.isAllowed} (always false in CLI - use get-secret task)`);
  });

// Full demo - for localnet with multiple accounts only
task("full-vault-demo")
  .setDescription("End-to-end demo (localnet only - requires multiple signers)")
  .setAction(async (_args, hre) => {
    console.log("=== API Key Vault Demo (Localnet) ===\n");

    const [owner, allowedUser] = await hre.ethers.getSigners();
    if (!allowedUser) {
      console.error("Error: This demo requires multiple signers (localnet with mnemonic)");
      console.log("For testnet, use individual tasks:");
      console.log("  1. npx hardhat deploy-vault --network sapphire-testnet");
      console.log("  2. npx hardhat register-secret --address <addr> ...");
      console.log("  3. npx hardhat add-allowlist --address <addr> ...");
      console.log("  4. npx hardhat get-secret --address <addr> ...");
      return;
    }

    // Deploy
    console.log("1. Deploying APIKeyVault...");
    const address = await hre.run("deploy-vault");
    console.log(`   Owner: ${owner.address}`);
    console.log(`   Allowed User: ${allowedUser.address}\n`);

    // Register secret
    console.log("2. Registering secret...");
    await hre.run("register-secret", {
      address,
      provider: "OPENAI_API_KEY",
      secret: "sk-test-secret-key-12345",
    });

    // Add to allowlist
    console.log("\n3. Adding allowed user to allowlist...");
    await hre.run("add-allowlist", {
      address,
      provider: "OPENAI_API_KEY",
      user: allowedUser.address,
    });

    // Get secret info
    console.log("\n4. Getting secret info...");
    const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("OPENAI_API_KEY"));
    const vault = await hre.ethers.getContractAt("APIKeyVault", address, allowedUser);

    const infoResult = await vault.getSecretInfo(owner.address, providerId);
    console.log(`   Version: ${infoResult.version}`);
    console.log(`   Exists: ${infoResult.exists}`);
    console.log(`   Note: isAllowed always false in CLI (unsigned view calls)`);

    // Get secret using signature-based claim
    console.log("\n5. Getting secret via signature-based claim...");
    console.log(`   Signer address: ${allowedUser.address}`);

    try {
      // Step 1: Request access
      const tx = await vault.getSecretTx(owner.address, providerId);
      await tx.wait();
      console.log(`   Access granted in tx: ${tx.hash}`);

      // Step 2: Sign message and claim
      const message = "claim-secret";
      const hash = hre.ethers.hashMessage(message);
      const sig = await allowedUser.signMessage(message);
      const { v, r, s } = hre.ethers.Signature.from(sig);

      // Step 3: Claim with signature
      const ciphertext = await vault.claimSecret(hash, v, r, s);
      const secret = hre.ethers.toUtf8String(ciphertext);

      // Step 4: Clear pending
      await vault.clearPending();

      console.log(`   ✓ Secret: ${secret}`);
    } catch (e: any) {
      console.error(`   Failed: ${e.reason || e.message}`);
    }

    console.log("\n=== Demo Complete ===");
  });
