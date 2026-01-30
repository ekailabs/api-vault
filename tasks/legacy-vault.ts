// Legacy APIKeyVault tasks - kept for reference
// To use: uncomment the import in tasks/index.ts

import { task } from "hardhat/config";

task("deploy-vault")
  .addOptionalParam("domain", "SIWE domain (default: localhost)", "localhost")
  .setAction(async (args, hre) => {
    await hre.run("compile");

    const APIKeyVault = await hre.ethers.getContractFactory("APIKeyVault");
    const vault = await APIKeyVault.deploy(args.domain);
    await vault.waitForDeployment();

    console.log(`APIKeyVault deployed to: ${vault.target}`);
    console.log(`SIWE domain: ${args.domain}`);
    return vault.target;
  });

task("register-secret")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name (e.g., OPENAI_API_KEY)")
  .addOptionalParam("secret", "The secret (use env var for safety: --secret $MY_SECRET)")
  .setAction(async (args, hre) => {
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

    console.log(`Secret registered for ${args.provider} (${secret.length} chars) in tx: ${tx.hash}`);
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

task("vault-revoke-secret")
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

    const result = await vault.getSecretInfo(args.owner, providerId);
    console.log(`Secret info for ${args.provider}:`);
    console.log(`  Version: ${result.version}`);
    console.log(`  Exists: ${result.exists}`);
    console.log(`  Caller is allowed: ${result.isAllowed} (always false in CLI - use get-secret task)`);
  });
