import { task } from "hardhat/config";
import { wrapEthersSigner } from "@oasisprotocol/sapphire-ethers-v6";

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
    // Wrap signer for signed queries (authenticated view calls)
    const wrappedSigner = wrapEthersSigner(signer);

    const abi = (await hre.artifacts.readArtifact("APIKeyVault")).abi;
    const vault = new hre.ethers.Contract(args.address, abi, wrappedSigner);
    const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(args.provider));

    try {
      const ciphertext = await vault.getSecret.staticCall(args.owner, providerId);
      const secret = hre.ethers.toUtf8String(ciphertext);
      // Never print actual secret - only confirm retrieval
      console.log(`Secret for ${args.provider}: ✓ Retrieved (${secret.length} chars)`);
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
    const [signer] = await hre.ethers.getSigners();
    // Wrap signer for signed queries (authenticated view calls)
    const wrappedSigner = wrapEthersSigner(signer);

    const abi = (await hre.artifacts.readArtifact("APIKeyVault")).abi;
    const vault = new hre.ethers.Contract(args.address, abi, wrappedSigner);
    const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(args.provider));

    const result = await vault.getSecretInfo.staticCall(args.owner, providerId);
    console.log(`Secret info for ${args.provider}:`);
    console.log(`  Version: ${result[0]}`);
    console.log(`  Exists: ${result[1]}`);
    console.log(`  Caller is allowed: ${result[2]}`);
  });

task("full-vault-demo").setAction(async (_args, hre) => {
  console.log("=== API Key Vault Demo ===\n");

  // Deploy
  console.log("1. Deploying APIKeyVault...");
  const address = await hre.run("deploy-vault");

  const [owner, allowedUser] = await hre.ethers.getSigners();
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

  // Get secret info (using allowedUser to check their allowlist status)
  console.log("\n4. Getting secret info as allowedUser...");
  const providerId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("OPENAI_API_KEY"));

  // Wrap signer for signed queries (authenticated view calls)
  const wrappedAllowedUser = wrapEthersSigner(allowedUser);
  const abi = (await hre.artifacts.readArtifact("APIKeyVault")).abi;
  const vault = new hre.ethers.Contract(address as string, abi, wrappedAllowedUser);

  const infoResult = await vault.getSecretInfo.staticCall(owner.address, providerId);
  console.log(`   Version: ${infoResult[0]}`);
  console.log(`   Exists: ${infoResult[1]}`);
  console.log(`   Caller is allowed: ${infoResult[2]}`);

  // Get secret using staticCallResult (authenticated view call)
  console.log("\n5. Getting secret with authenticated view call...");
  console.log(`   Signer address: ${allowedUser.address}`);

  try {
    const result = await vault.getSecret.staticCall(owner.address, providerId);
    const secret = hre.ethers.toUtf8String(result);
    // Never print actual secret - only confirm retrieval
    console.log(`   ✓ Secret retrieved successfully (${secret.length} chars)`);
  } catch (e: any) {
    console.error(`   Failed: ${e.reason || e.message}`);
  }

  // Log access (transaction) - wrapped signer works for transactions too
  console.log("\n6. Logging access...");
  const tx = await vault.logAccess(owner.address, providerId);
  await tx.wait();
  console.log("   Access logged on-chain");

  console.log("\n=== Demo Complete ===");
});
