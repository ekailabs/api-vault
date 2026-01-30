import { task } from "hardhat/config";

// Helper to convert provider name to bytes32
function providerToId(hre: any, name: string): string {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(name.toUpperCase()));
}

// Helper to convert model name to bytes32
function modelToId(hre: any, name: string): string {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(name));
}

// ============ Deployment ============

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

// ============ Admin: Gateway ============

task("ekai-set-gateway")
  .addParam("address", "Contract address")
  .addParam("gateway", "Gateway address")
  .setDescription("Set the trusted gateway address (fallback for non-ROFL calls)")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const tx = await ekai.setGateway(args.gateway);
    await tx.wait();
    console.log(`Gateway set to ${args.gateway} in tx: ${tx.hash}`);
  });

task("ekai-clear-gateway")
  .addParam("address", "Contract address")
  .setDescription("Clear the gateway address (emergency)")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const tx = await ekai.clearGateway();
    await tx.wait();
    console.log(`Gateway cleared in tx: ${tx.hash}`);
  });

// ============ Admin: ROFL App ID ============

task("ekai-set-rofl-app-id")
  .addParam("address", "Contract address")
  .addParam("appid", "ROFL app ID (21 bytes hex, e.g., 0x...)")
  .setDescription("Set the ROFL app ID for Sapphire native verification")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const tx = await ekai.setRoflAppId(args.appid);
    await tx.wait();
    console.log(`ROFL App ID set to ${args.appid} in tx: ${tx.hash}`);
  });

task("ekai-clear-rofl-app-id")
  .addParam("address", "Contract address")
  .setDescription("Clear the ROFL app ID")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const tx = await ekai.clearRoflAppId();
    await tx.wait();
    console.log(`ROFL App ID cleared in tx: ${tx.hash}`);
  });

// ============ Admin: ROFL Key ============

task("ekai-set-rofl-key")
  .addParam("address", "Contract address")
  .addParam("pubkey", "ROFL public key (hex)")
  .addFlag("inactive", "Set key as inactive")
  .setDescription("Set or rotate the ROFL encryption key (version auto-increments)")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const active = !args.inactive;
    const tx = await ekai.setRoflKey(args.pubkey, active);
    await tx.wait();
    const [, version] = await ekai.getRoflKey();
    console.log(`ROFL key set (version ${version}, active: ${active}) in tx: ${tx.hash}`);
  });

task("ekai-set-rofl-key-active")
  .addParam("address", "Contract address")
  .addParam("active", "true or false")
  .setDescription("Toggle ROFL key active state without changing the key")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const active = args.active === "true";
    const tx = await ekai.setRoflKeyActive(active);
    await tx.wait();
    console.log(`ROFL key active state set to ${active} in tx: ${tx.hash}`);
  });

// ============ Admin: Providers ============

task("ekai-add-provider")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name (e.g., OPENAI, ANTHROPIC)")
  .setDescription("Add a valid provider to the registry")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providerId = providerToId(hre, args.provider);
    const tx = await ekai.addProvider(providerId);
    await tx.wait();
    console.log(`Provider ${args.provider.toUpperCase()} added in tx: ${tx.hash}`);
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
    console.log(`Provider ${args.provider.toUpperCase()} removed in tx: ${tx.hash}`);
  });

// ============ Admin: Pause ============

task("ekai-pause")
  .addParam("address", "Contract address")
  .setDescription("Pause the contract (emergency stop)")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const tx = await ekai.pause();
    await tx.wait();
    console.log(`Contract paused in tx: ${tx.hash}`);
  });

task("ekai-unpause")
  .addParam("address", "Contract address")
  .setDescription("Unpause the contract")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const tx = await ekai.unpause();
    await tx.wait();
    console.log(`Contract unpaused in tx: ${tx.hash}`);
  });

// ============ User: Secrets ============

task("ekai-set-secret")
  .addParam("address", "Contract address")
  .addParam("provider", "Provider name")
  .addOptionalParam("secret", "The secret (use env var for safety)")
  .setDescription("Store an encrypted secret for a provider (requires active ROFL key)")
  .setAction(async (args, hre) => {
    const secret = args.secret || process.env[args.provider.toUpperCase()];
    if (!secret) {
      console.error(`No secret provided. Use --secret or set ${args.provider.toUpperCase()} env var`);
      console.log(`Example: export ${args.provider.toUpperCase()}="sk-..." && npx hardhat ekai-set-secret ...`);
      return;
    }

    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providerId = providerToId(hre, args.provider);

    // Check provider is valid
    const isValid = await ekai.isValidProvider(providerId);
    if (!isValid) {
      console.error(`Invalid provider: ${args.provider.toUpperCase()}`);
      console.log("Add it first with: npx hardhat ekai-add-provider --provider " + args.provider.toUpperCase());
      return;
    }

    // Check ROFL key is active
    const [pubkey, , active] = await ekai.getRoflKey();
    if (pubkey === "0x" || !active) {
      console.error("ROFL key is not active. Set it first with ekai-set-rofl-key");
      return;
    }

    const ciphertext = hre.ethers.toUtf8Bytes(secret);
    const tx = await ekai.setSecret(providerId, ciphertext);
    await tx.wait();
    console.log(`Secret set for ${args.provider.toUpperCase()} (${secret.length} chars) in tx: ${tx.hash}`);
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
    console.log(`Secret revoked for ${args.provider.toUpperCase()} in tx: ${tx.hash}`);
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
    console.log(`Secret info for ${args.provider.toUpperCase()}:`);
    console.log(`  Exists: ${exists}`);
    console.log(`  Version: ${version}`);
    console.log(`  ROFL Key Version: ${roflKeyVersion}`);
    console.log(`  Ciphertext length: ${(ciphertext.length - 2) / 2} bytes`);
  });

// ============ User: Delegates ============

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

// ============ User: Models ============

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
    console.log(`Model ${args.model} allowed for ${args.provider.toUpperCase()} in tx: ${tx.hash}`);
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
    console.log(`Model ${args.model} disallowed for ${args.provider.toUpperCase()} in tx: ${tx.hash}`);
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
    console.log(`Model ${args.model} permitted for ${args.provider.toUpperCase()} (owner ${args.owner}): ${permitted}`);
  });

// ============ Info ============

task("ekai-info")
  .addParam("address", "Contract address")
  .setDescription("Get contract info")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const owner = await ekai.owner();
    const gateway = await ekai.gateway();
    const roflAppId = await ekai.getRoflAppId();
    const [pubkey, version, active] = await ekai.getRoflKey();
    const paused = await ekai.isPaused();

    console.log("EkaiControlPlane Info:");
    console.log(`  Address: ${args.address}`);
    console.log(`  Owner: ${owner}`);
    console.log(`  Paused: ${paused}`);
    console.log(`  Gateway: ${gateway === hre.ethers.ZeroAddress ? "(not set)" : gateway}`);
    console.log(`  ROFL App ID: ${roflAppId === "0x" + "00".repeat(21) ? "(not set)" : roflAppId}`);
    console.log(`  ROFL Key:`);
    console.log(`    Pubkey: ${pubkey === "0x" ? "(not set)" : pubkey}`);
    console.log(`    Version: ${version}`);
    console.log(`    Active: ${active}`);
  });

// ============ Setup Helper ============

task("ekai-setup")
  .addParam("address", "Contract address")
  .addOptionalParam("gateway", "Gateway address")
  .addOptionalParam("roflappid", "ROFL app ID (21 bytes hex)")
  .addOptionalParam("roflkey", "ROFL public key (hex)")
  .setDescription("Setup contract with gateway, ROFL app ID, ROFL key, and all providers")
  .setAction(async (args, hre) => {
    const ekai = await hre.ethers.getContractAt("EkaiControlPlane", args.address);
    const providers = ["OPENAI", "ANTHROPIC", "GOOGLE", "XAI", "OPENROUTER", "GROQ"];

    console.log("=== EkaiControlPlane Setup ===\n");

    // Set gateway if provided
    if (args.gateway) {
      console.log(`Setting gateway to ${args.gateway}...`);
      const tx = await ekai.setGateway(args.gateway);
      await tx.wait();
      console.log(`  Done: ${tx.hash}\n`);
    }

    // Set ROFL app ID if provided
    if (args.roflappid) {
      console.log(`Setting ROFL App ID to ${args.roflappid}...`);
      const tx = await ekai.setRoflAppId(args.roflappid);
      await tx.wait();
      console.log(`  Done: ${tx.hash}\n`);
    }

    // Set ROFL key if provided
    if (args.roflkey) {
      console.log(`Setting ROFL key...`);
      const tx = await ekai.setRoflKey(args.roflkey, true);
      await tx.wait();
      const [, version] = await ekai.getRoflKey();
      console.log(`  Done (version ${version}): ${tx.hash}\n`);
    }

    // Add all providers
    console.log("Adding providers...");
    for (const provider of providers) {
      const providerId = providerToId(hre, provider);
      const isValid = await ekai.isValidProvider(providerId);
      if (!isValid) {
        const tx = await ekai.addProvider(providerId);
        await tx.wait();
        console.log(`  ${provider}: added`);
      } else {
        console.log(`  ${provider}: already exists`);
      }
    }

    console.log("\n=== Setup Complete ===\n");
    await hre.run("ekai-info", { address: args.address });
  });

// ============ Demo ============

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

    // Set ROFL key (version auto-increments)
    console.log("\n3. Setting ROFL key...");
    await hre.run("ekai-set-rofl-key", {
      address,
      pubkey: "0x" + "ab".repeat(32),
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
