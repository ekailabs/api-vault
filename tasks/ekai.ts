import { task } from "hardhat/config";

// Helper to convert provider name to bytes32
function providerToId(hre: any, name: string): string {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(name));
}

// Helper to convert model name to bytes32
function modelToId(hre: any, name: string): string {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(name));
}

task("deploy-ekai")
  .addOptionalParam("owner", "Initial owner address (defaults to deployer)")
  .setDescription("Deploy EkaiControlPlane contract")
  .setAction(async (args, hre) => {
    await hre.run("compile");

    const [deployer] = await hre.ethers.getSigners();
    const owner = args.owner || deployer.address;

    const EkaiControlPlane = await hre.ethers.getContractFactory("EkaiControlPlane");
    const ekai = await EkaiControlPlane.deploy(owner);
    await ekai.waitForDeployment();

    console.log(`EkaiControlPlane deployed to: ${ekai.target}`);
    console.log(`Owner: ${owner}`);
    return ekai.target;
  });

task("ekai-set-gateway")
  .addParam("address", "Contract address")
  .addParam("gateway", "Gateway address")
  .setDescription("Set the trusted ROFL gateway address")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const tx = await ekai.setGateway(args.gateway);
    await tx.wait();
    console.log(`Gateway set to ${args.gateway} in tx: ${tx.hash}`);
  });

task("ekai-set-rofl-key")
  .addParam("address", "Contract address")
  .addParam("pubkey", "ROFL public key (hex)")
  .addParam("keyversion", "Key version")
  .addFlag("inactive", "Set key as inactive")
  .setDescription("Set or rotate the ROFL encryption key")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const active = !args.inactive;
    const tx = await ekai.setRoflKey(args.pubkey, args.keyversion, active);
    await tx.wait();
    console.log(`ROFL key set (version ${args.keyversion}, active: ${active}) in tx: ${tx.hash}`);
  });

task("ekai-add-provider")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name (e.g., OPENAI, ANTHROPIC)")
  .setDescription("Add a valid provider to the registry")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providerId = providerToId(hre, args.provider);
    const tx = await ekai.addProvider(providerId);
    await tx.wait();
    console.log(`Provider ${args.provider} added in tx: ${tx.hash}`);
    console.log(`Provider ID: ${providerId}`);
  });

task("ekai-remove-provider")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name")
  .setDescription("Remove a provider from the registry")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providerId = providerToId(hre, args.provider);
    const tx = await ekai.removeProvider(providerId);
    await tx.wait();
    console.log(`Provider ${args.provider} removed in tx: ${tx.hash}`);
  });

task("ekai-set-secret")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name")
  .addOptionalParam("secret", "The secret (use env var for safety)")
  .setDescription("Store an encrypted secret for a provider")
  .setAction(async (args, hre) => {
    const secret = args.secret || process.env[args.provider];
    if (!secret) {
      console.error(`No secret provided. Use --secret or set ${args.provider} env var`);
      console.log(`Example: export ${args.provider}="sk-..." && npx hardhat ekai-set-secret ...`);
      return;
    }

    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providerId = providerToId(hre, args.provider);

    const isValid = await ekai.isValidProvider(providerId);
    if (!isValid) {
      console.error(`Invalid provider: ${args.provider}`);
      console.log("Add it first with: npx hardhat ekai-add-provider --provider " + args.provider);
      return;
    }

    const ciphertext = hre.ethers.toUtf8Bytes(secret);
    const tx = await ekai.setSecret(providerId, ciphertext);
    await tx.wait();
    console.log(`Secret set for ${args.provider} (${secret.length} chars) in tx: ${tx.hash}`);
  });

task("ekai-revoke-secret")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name")
  .setDescription("Revoke (delete) a secret")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providerId = providerToId(hre, args.provider);
    const tx = await ekai.revokeSecret(providerId);
    await tx.wait();
    console.log(`Secret revoked for ${args.provider} in tx: ${tx.hash}`);
  });

task("ekai-get-secret-info")
  .addParam("address", "Contract address")
  .addParam("owner", "Owner address")
  .addParam("provider", "Provider name")
  .setDescription("Get secret metadata (ciphertext is public as it's encrypted to ROFL key)")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providerId = providerToId(hre, args.provider);
    const [ciphertext, version, exists, roflKeyVersion] = await ekai.getSecretCiphertext(args.owner, providerId);
    console.log(`Secret info for ${args.provider}:`);
    console.log(`  Exists: ${exists}`);
    console.log(`  Version: ${version}`);
    console.log(`  ROFL Key Version: ${roflKeyVersion}`);
    console.log(`  Ciphertext length: ${(ciphertext.length - 2) / 2} bytes`);
  });

task("ekai-add-delegate")
  .addParam("address", "Contract address")
  .addParam("delegate", "Delegate address")
  .setDescription("Grant a delegate access to all your secrets")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const tx = await ekai.addDelegate(args.delegate);
    await tx.wait();
    console.log(`Delegate ${args.delegate} added in tx: ${tx.hash}`);
  });

task("ekai-remove-delegate")
  .addParam("address", "Contract address")
  .addParam("delegate", "Delegate address")
  .setDescription("Revoke a delegate's access")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const tx = await ekai.removeDelegate(args.delegate);
    await tx.wait();
    console.log(`Delegate ${args.delegate} removed in tx: ${tx.hash}`);
  });

task("ekai-check-delegate")
  .addParam("address", "Contract address")
  .addParam("owner", "Owner address")
  .addParam("delegate", "Delegate address")
  .setDescription("Check if a delegate is permitted")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const permitted = await ekai.isDelegatePermitted(args.owner, args.delegate);
    console.log(`Delegate ${args.delegate} permitted for owner ${args.owner}: ${permitted}`);
  });

task("ekai-add-model")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name")
  .addParam("model", "Model name (e.g., gpt-4, claude-3-opus)")
  .setDescription("Add a model to the allowed list for a provider")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providerId = providerToId(hre, args.provider);
    const modelId = modelToId(hre, args.model);
    const tx = await ekai.addAllowedModel(providerId, modelId);
    await tx.wait();
    console.log(`Model ${args.model} allowed for ${args.provider} in tx: ${tx.hash}`);
    console.log(`Model ID: ${modelId}`);
  });

task("ekai-remove-model")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name")
  .addParam("model", "Model name")
  .setDescription("Remove a model from the allowed list")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providerId = providerToId(hre, args.provider);
    const modelId = modelToId(hre, args.model);
    const tx = await ekai.removeAllowedModel(providerId, modelId);
    await tx.wait();
    console.log(`Model ${args.model} disallowed for ${args.provider} in tx: ${tx.hash}`);
  });

task("ekai-check-model")
  .addParam("address", "Contract address")
  .addParam("owner", "Owner address")
  .addParam("provider", "Provider name")
  .addParam("model", "Model name")
  .setDescription("Check if a model is permitted")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providerId = providerToId(hre, args.provider);
    const modelId = modelToId(hre, args.model);
    const permitted = await ekai.isModelPermitted(args.owner, providerId, modelId);
    console.log(`Model ${args.model} permitted for ${args.provider} (owner ${args.owner}): ${permitted}`);
  });

task("ekai-info")
  .addParam("address", "Contract address")
  .setDescription("Get contract info")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const owner = await ekai.owner();
    const gateway = await ekai.gateway();
    const [pubkey, version, active] = await ekai.getRoflKey();

    console.log("EkaiControlPlane Info:");
    console.log(`  Address: ${args.address}`);
    console.log(`  Owner: ${owner}`);
    console.log(`  Gateway: ${gateway || "(not set)"}`);
    console.log(`  ROFL Key:`);
    console.log(`    Pubkey: ${pubkey || "(not set)"}`);
    console.log(`    Version: ${version}`);
    console.log(`    Active: ${active}`);
  });

// Full demo for localnet
task("ekai-demo")
  .setDescription("End-to-end demo (localnet only)")
  .setAction(async (_args, hre) => {
    console.log("=== EkaiControlPlane Demo ===\n");

    const [owner, gateway, delegate] = await hre.ethers.getSigners();
    if (!delegate) {
      console.error("Error: This demo requires multiple signers (localnet with mnemonic)");
      return;
    }

    // Deploy
    console.log("1. Deploying EkaiControlPlane...");
    const address = await hre.run("deploy-ekai");
    console.log(`   Owner: ${owner.address}`);
    console.log(`   Gateway: ${gateway.address}`);
    console.log(`   Delegate: ${delegate.address}\n`);

    // Set gateway
    console.log("2. Setting gateway...");
    await hre.run("ekai-set-gateway", { address, gateway: gateway.address });

    // Set ROFL key
    console.log("\n3. Setting ROFL key...");
    await hre.run("ekai-set-rofl-key", {
      address,
      pubkey: "0x" + "00".repeat(32),
      keyversion: "1",
    });

    // Add provider
    console.log("\n4. Adding OPENAI provider...");
    await hre.run("ekai-add-provider", { address, provider: "OPENAI" });

    // Set secret
    console.log("\n5. Setting secret...");
    await hre.run("ekai-set-secret", {
      address,
      provider: "OPENAI",
      secret: "sk-test-secret-12345",
    });

    // Add delegate
    console.log("\n6. Adding delegate...");
    await hre.run("ekai-add-delegate", { address, delegate: delegate.address });

    // Check delegate
    console.log("\n7. Checking delegate permission...");
    await hre.run("ekai-check-delegate", {
      address,
      owner: owner.address,
      delegate: delegate.address,
    });

    // Add model restriction
    console.log("\n8. Adding model restriction...");
    await hre.run("ekai-add-model", {
      address,
      provider: "OPENAI",
      model: "gpt-4",
    });

    // Check models
    console.log("\n9. Checking model permissions...");
    await hre.run("ekai-check-model", {
      address,
      owner: owner.address,
      provider: "OPENAI",
      model: "gpt-4",
    });
    await hre.run("ekai-check-model", {
      address,
      owner: owner.address,
      provider: "OPENAI",
      model: "gpt-3.5-turbo",
    });

    // Get info
    console.log("\n10. Contract info...");
    await hre.run("ekai-info", { address });

    console.log("\n=== Demo Complete ===");
  });
