import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function deployFixture() {
  const [owner, gateway, delegate, other] = await ethers.getSigners();
  const EkaiControlPlane = await ethers.getContractFactory("EkaiControlPlane");
  const ekai = await EkaiControlPlane.deploy(owner.address);
  await ekai.waitForDeployment();

  const OPENAI = ethers.keccak256(ethers.toUtf8Bytes("OPENAI"));
  const ANTHROPIC = ethers.keccak256(ethers.toUtf8Bytes("ANTHROPIC"));
  const GPT4 = ethers.keccak256(ethers.toUtf8Bytes("gpt-4"));
  const GPT35 = ethers.keccak256(ethers.toUtf8Bytes("gpt-3.5-turbo"));

  return { ekai, owner, gateway, delegate, other, OPENAI, ANTHROPIC, GPT4, GPT35 };
}

describe("EkaiControlPlane", function () {
  describe("Admin Functions", function () {
    it("deploys with correct owner", async function () {
      const { ekai, owner } = await loadFixture(deployFixture);
      expect(await ekai.owner()).to.equal(owner.address);
    });

    it("allows owner to set gateway", async function () {
      const { ekai, gateway } = await loadFixture(deployFixture);
      await expect(ekai.setGateway(gateway.address))
        .to.emit(ekai, "GatewayUpdated")
        .withArgs(ethers.ZeroAddress, gateway.address);
      expect(await ekai.gateway()).to.equal(gateway.address);
    });

    it("rejects zero address gateway", async function () {
      const { ekai } = await loadFixture(deployFixture);
      await expect(ekai.setGateway(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(ekai, "InvalidGateway");
    });

    it("allows owner to clear gateway", async function () {
      const { ekai, gateway } = await loadFixture(deployFixture);
      await ekai.setGateway(gateway.address);
      await expect(ekai.clearGateway())
        .to.emit(ekai, "GatewayUpdated")
        .withArgs(gateway.address, ethers.ZeroAddress);
      expect(await ekai.gateway()).to.equal(ethers.ZeroAddress);
    });

    it("rejects non-owner setting gateway", async function () {
      const { ekai, other, gateway } = await loadFixture(deployFixture);
      await expect(ekai.connect(other).setGateway(gateway.address))
        .to.be.revertedWithCustomError(ekai, "OwnableUnauthorizedAccount");
    });

    it("allows owner to set ROFL key with auto-increment version", async function () {
      const { ekai } = await loadFixture(deployFixture);
      const pubkey = ethers.toUtf8Bytes("test-pubkey");
      await expect(ekai.setRoflKey(pubkey, true))
        .to.emit(ekai, "RoflKeyUpdated")
        .withArgs(ethers.hexlify(pubkey), 1, true);

      const [storedPubkey, version, active] = await ekai.getRoflKey();
      expect(storedPubkey).to.equal(ethers.hexlify(pubkey));
      expect(version).to.equal(1);
      expect(active).to.equal(true);

      // Second call should increment version
      const pubkey2 = ethers.toUtf8Bytes("test-pubkey-2");
      await ekai.setRoflKey(pubkey2, true);
      const [, version2] = await ekai.getRoflKey();
      expect(version2).to.equal(2);
    });

    it("rejects empty ROFL key", async function () {
      const { ekai } = await loadFixture(deployFixture);
      await expect(ekai.setRoflKey("0x", true))
        .to.be.revertedWithCustomError(ekai, "InvalidRoflKey");
    });

    it("allows owner to toggle ROFL key active state", async function () {
      const { ekai } = await loadFixture(deployFixture);
      const pubkey = ethers.toUtf8Bytes("test-pubkey");
      await ekai.setRoflKey(pubkey, true);

      await ekai.setRoflKeyActive(false);
      const [, , active] = await ekai.getRoflKey();
      expect(active).to.equal(false);
    });

    it("allows owner to set and clear ROFL app ID", async function () {
      const { ekai } = await loadFixture(deployFixture);
      const appId = "0x0000000000000000000000000000000000000001" + "00";
      await expect(ekai.setRoflAppId(appId))
        .to.emit(ekai, "RoflAppIdUpdated");
      expect(await ekai.getRoflAppId()).to.equal(appId);

      await ekai.clearRoflAppId();
      expect(await ekai.getRoflAppId()).to.equal("0x" + "00".repeat(21));
    });

    it("rejects zero ROFL app ID", async function () {
      const { ekai } = await loadFixture(deployFixture);
      await expect(ekai.setRoflAppId("0x" + "00".repeat(21)))
        .to.be.revertedWithCustomError(ekai, "InvalidRoflAppId");
    });

    it("allows owner to add and remove providers", async function () {
      const { ekai, OPENAI } = await loadFixture(deployFixture);

      expect(await ekai.isValidProvider(OPENAI)).to.equal(false);

      await expect(ekai.addProvider(OPENAI))
        .to.emit(ekai, "ProviderAdded")
        .withArgs(OPENAI);
      expect(await ekai.isValidProvider(OPENAI)).to.equal(true);

      await expect(ekai.addProvider(OPENAI))
        .to.be.revertedWithCustomError(ekai, "ProviderExists");

      await expect(ekai.removeProvider(OPENAI))
        .to.emit(ekai, "ProviderRemoved")
        .withArgs(OPENAI);
      expect(await ekai.isValidProvider(OPENAI)).to.equal(false);

      await expect(ekai.removeProvider(OPENAI))
        .to.be.revertedWithCustomError(ekai, "ProviderNotFound");
    });

    it("rejects zero bytes32 provider ID", async function () {
      const { ekai } = await loadFixture(deployFixture);
      await expect(ekai.addProvider(ethers.ZeroHash))
        .to.be.revertedWithCustomError(ekai, "InvalidProvider");
    });

    it("supports two-step ownership transfer", async function () {
      const { ekai, owner, other } = await loadFixture(deployFixture);

      await ekai.transferOwnership(other.address);
      expect(await ekai.owner()).to.equal(owner.address);
      expect(await ekai.pendingOwner()).to.equal(other.address);

      await ekai.connect(other).acceptOwnership();
      expect(await ekai.owner()).to.equal(other.address);
    });
  });

  describe("Pause functionality", function () {
    it("allows owner to pause and unpause", async function () {
      const { ekai, owner } = await loadFixture(deployFixture);

      await expect(ekai.pause())
        .to.emit(ekai, "Paused")
        .withArgs(owner.address);
      expect(await ekai.isPaused()).to.equal(true);

      await expect(ekai.unpause())
        .to.emit(ekai, "Unpaused")
        .withArgs(owner.address);
      expect(await ekai.isPaused()).to.equal(false);
    });

    it("blocks setSecret when paused", async function () {
      const { ekai, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.pause();

      await expect(ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret")))
        .to.be.revertedWithCustomError(ekai, "ContractPaused");
    });

    it("blocks addDelegate when paused", async function () {
      const { ekai, delegate } = await loadFixture(deployFixture);
      await ekai.pause();

      await expect(ekai.addDelegate(delegate.address))
        .to.be.revertedWithCustomError(ekai, "ContractPaused");
    });

    it("blocks addAllowedModel when paused", async function () {
      const { ekai, OPENAI, GPT4 } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.pause();

      await expect(ekai.addAllowedModel(OPENAI, GPT4))
        .to.be.revertedWithCustomError(ekai, "ContractPaused");
    });

    it("allows revoke operations when paused", async function () {
      const { ekai, owner, delegate, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), true);
      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret"));
      await ekai.addDelegate(delegate.address);

      await ekai.pause();

      // Revoke operations should still work when paused
      await expect(ekai.revokeSecret(OPENAI)).to.emit(ekai, "SecretRevoked");
      await expect(ekai.removeDelegate(delegate.address)).to.emit(ekai, "DelegateRemoved");
    });
  });

  describe("Secrets", function () {
    it("allows user to set secret for valid provider", async function () {
      const { ekai, owner, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), true);

      const ciphertext = ethers.toUtf8Bytes("encrypted-api-key");
      await expect(ekai.setSecret(OPENAI, ciphertext))
        .to.emit(ekai, "SecretSet")
        .withArgs(owner.address, OPENAI, 1);

      const [stored, version, exists, roflVersion] = await ekai.getSecretCiphertext(owner.address, OPENAI);
      expect(stored).to.equal(ethers.hexlify(ciphertext));
      expect(version).to.equal(1);
      expect(exists).to.equal(true);
    });

    it("rejects setting secret for invalid provider", async function () {
      const { ekai, OPENAI } = await loadFixture(deployFixture);

      await expect(ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret")))
        .to.be.revertedWithCustomError(ekai, "InvalidProvider");
    });

    it("rejects empty ciphertext", async function () {
      const { ekai, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), true);

      await expect(ekai.setSecret(OPENAI, "0x"))
        .to.be.revertedWithCustomError(ekai, "EmptyCiphertext");
    });

    it("rejects setting secret when ROFL key not active", async function () {
      const { ekai, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);

      // No ROFL key set
      await expect(ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret")))
        .to.be.revertedWithCustomError(ekai, "RoflKeyNotActive");

      // ROFL key set but not active
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), false);
      await expect(ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret")))
        .to.be.revertedWithCustomError(ekai, "RoflKeyNotActive");
    });

    it("increments version on re-set", async function () {
      const { ekai, owner, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), true);

      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("v1"));
      await expect(ekai.setSecret(OPENAI, ethers.toUtf8Bytes("v2")))
        .to.emit(ekai, "SecretSet")
        .withArgs(owner.address, OPENAI, 2);

      const [, version, ,] = await ekai.getSecretCiphertext(owner.address, OPENAI);
      expect(version).to.equal(2);
    });

    it("allows user to revoke secret", async function () {
      const { ekai, owner, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), true);
      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret"));

      await expect(ekai.revokeSecret(OPENAI))
        .to.emit(ekai, "SecretRevoked")
        .withArgs(owner.address, OPENAI, 2);

      const [ciphertext, version, exists, ] = await ekai.getSecretCiphertext(owner.address, OPENAI);
      expect(ciphertext).to.equal("0x");
      expect(version).to.equal(2);
      expect(exists).to.equal(false);
    });

    it("rejects revoking non-existent secret", async function () {
      const { ekai, OPENAI } = await loadFixture(deployFixture);

      await expect(ekai.revokeSecret(OPENAI))
        .to.be.revertedWithCustomError(ekai, "SecretNotFound");
    });
  });

  describe("Delegates", function () {
    it("allows adding and removing delegates", async function () {
      const { ekai, owner, delegate } = await loadFixture(deployFixture);

      await expect(ekai.addDelegate(delegate.address))
        .to.emit(ekai, "DelegateAdded")
        .withArgs(owner.address, delegate.address);

      expect(await ekai.delegateAllowed(owner.address, delegate.address)).to.equal(true);
      expect(await ekai.delegateCount(owner.address)).to.equal(1);

      await expect(ekai.removeDelegate(delegate.address))
        .to.emit(ekai, "DelegateRemoved")
        .withArgs(owner.address, delegate.address);

      expect(await ekai.delegateAllowed(owner.address, delegate.address)).to.equal(false);
      expect(await ekai.delegateCount(owner.address)).to.equal(0);
    });

    it("rejects adding zero address delegate", async function () {
      const { ekai } = await loadFixture(deployFixture);
      await expect(ekai.addDelegate(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(ekai, "InvalidDelegate");
    });

    it("rejects adding duplicate delegate", async function () {
      const { ekai, delegate } = await loadFixture(deployFixture);
      await ekai.addDelegate(delegate.address);
      await expect(ekai.addDelegate(delegate.address))
        .to.be.revertedWithCustomError(ekai, "DelegateExists");
    });

    it("rejects removing non-existent delegate", async function () {
      const { ekai, delegate } = await loadFixture(deployFixture);
      await expect(ekai.removeDelegate(delegate.address))
        .to.be.revertedWithCustomError(ekai, "DelegateNotFound");
    });

    describe("isDelegatePermitted", function () {
      it("always permits owner self-access", async function () {
        const { ekai, owner } = await loadFixture(deployFixture);
        expect(await ekai.isDelegatePermitted(owner.address, owner.address)).to.equal(true);
      });

      it("denies all when delegateCount is 0", async function () {
        const { ekai, owner, delegate, other } = await loadFixture(deployFixture);
        expect(await ekai.isDelegatePermitted(owner.address, delegate.address)).to.equal(false);
        expect(await ekai.isDelegatePermitted(owner.address, other.address)).to.equal(false);
      });

      it("permits allowed delegate when delegateCount > 0", async function () {
        const { ekai, owner, delegate, other } = await loadFixture(deployFixture);
        await ekai.addDelegate(delegate.address);

        expect(await ekai.isDelegatePermitted(owner.address, delegate.address)).to.equal(true);
        expect(await ekai.isDelegatePermitted(owner.address, other.address)).to.equal(false);
      });
    });
  });

  describe("Models", function () {
    it("rejects adding model for invalid provider", async function () {
      const { ekai, OPENAI, GPT4 } = await loadFixture(deployFixture);

      await expect(ekai.addAllowedModel(OPENAI, GPT4))
        .to.be.revertedWithCustomError(ekai, "InvalidProvider");
    });

    it("rejects adding zero bytes32 model ID", async function () {
      const { ekai, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);

      await expect(ekai.addAllowedModel(OPENAI, ethers.ZeroHash))
        .to.be.revertedWithCustomError(ekai, "InvalidModel");
    });

    it("allows adding and removing models", async function () {
      const { ekai, owner, OPENAI, GPT4 } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);

      await expect(ekai.addAllowedModel(OPENAI, GPT4))
        .to.emit(ekai, "ModelAllowed")
        .withArgs(owner.address, OPENAI, GPT4);

      expect(await ekai.modelAllowed(owner.address, OPENAI, GPT4)).to.equal(true);
      expect(await ekai.modelCount(owner.address, OPENAI)).to.equal(1);

      await expect(ekai.removeAllowedModel(OPENAI, GPT4))
        .to.emit(ekai, "ModelDisallowed")
        .withArgs(owner.address, OPENAI, GPT4);

      expect(await ekai.modelAllowed(owner.address, OPENAI, GPT4)).to.equal(false);
      expect(await ekai.modelCount(owner.address, OPENAI)).to.equal(0);
    });

    it("rejects adding duplicate model", async function () {
      const { ekai, OPENAI, GPT4 } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.addAllowedModel(OPENAI, GPT4);
      await expect(ekai.addAllowedModel(OPENAI, GPT4))
        .to.be.revertedWithCustomError(ekai, "ModelExists");
    });

    it("rejects removing non-allowed model", async function () {
      const { ekai, OPENAI, GPT4 } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await expect(ekai.removeAllowedModel(OPENAI, GPT4))
        .to.be.revertedWithCustomError(ekai, "ModelNotFound");
    });

    describe("isModelPermitted", function () {
      it("permits all models when modelCount is 0", async function () {
        const { ekai, owner, OPENAI, GPT4, GPT35 } = await loadFixture(deployFixture);
        expect(await ekai.isModelPermitted(owner.address, OPENAI, GPT4)).to.equal(true);
        expect(await ekai.isModelPermitted(owner.address, OPENAI, GPT35)).to.equal(true);
      });

      it("restricts to allowed models when modelCount > 0", async function () {
        const { ekai, owner, OPENAI, GPT4, GPT35 } = await loadFixture(deployFixture);
        await ekai.addProvider(OPENAI);
        await ekai.addAllowedModel(OPENAI, GPT4);

        expect(await ekai.isModelPermitted(owner.address, OPENAI, GPT4)).to.equal(true);
        expect(await ekai.isModelPermitted(owner.address, OPENAI, GPT35)).to.equal(false);
      });
    });
  });

  describe("Gateway - logReceipt", function () {
    it("allows gateway to log receipt with versions from storage", async function () {
      const { ekai, owner, gateway, delegate, OPENAI, GPT4 } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setGateway(gateway.address);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), true);
      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret"));

      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("request-1"));

      // logReceipt reads versions from storage
      await expect(ekai.connect(gateway).logReceipt(
        requestHash,
        owner.address,
        delegate.address,
        OPENAI,
        GPT4,
        100,
        50
      )).to.emit(ekai, "ReceiptLogged")
        .withArgs(
          requestHash,
          owner.address,
          delegate.address,
          OPENAI,
          GPT4,
          100,
          50,
          1,  // roflKey.version (auto-set by setRoflKey)
          1,  // secret.version (auto-set by setSecret)
          (value: bigint) => value > 0  // timestamp
        );
    });

    it("rejects non-gateway calling logReceipt", async function () {
      const { ekai, owner, delegate, other, OPENAI, GPT4 } = await loadFixture(deployFixture);
      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("request-1"));

      await expect(ekai.connect(other).logReceipt(
        requestHash,
        owner.address,
        delegate.address,
        OPENAI,
        GPT4,
        100,
        50
      )).to.be.revertedWithCustomError(ekai, "NotAuthorized");
    });
  });

  describe("Secret isolation", function () {
    it("secrets are isolated per owner", async function () {
      const { ekai, owner, other, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), true);

      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("owner-secret"));
      await ekai.connect(other).setSecret(OPENAI, ethers.toUtf8Bytes("other-secret"));

      const [ownerCiphertext, , ownerExists, ] = await ekai.getSecretCiphertext(owner.address, OPENAI);
      const [otherCiphertext, , otherExists, ] = await ekai.getSecretCiphertext(other.address, OPENAI);

      expect(ethers.toUtf8String(ownerCiphertext)).to.equal("owner-secret");
      expect(ethers.toUtf8String(otherCiphertext)).to.equal("other-secret");
      expect(ownerExists).to.equal(true);
      expect(otherExists).to.equal(true);
    });

    it("revoking one owner's secret doesn't affect another", async function () {
      const { ekai, owner, other, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), true);

      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("owner-secret"));
      await ekai.connect(other).setSecret(OPENAI, ethers.toUtf8Bytes("other-secret"));

      await ekai.revokeSecret(OPENAI);

      const [, , ownerExists, ] = await ekai.getSecretCiphertext(owner.address, OPENAI);
      const [, , otherExists, ] = await ekai.getSecretCiphertext(other.address, OPENAI);

      expect(ownerExists).to.equal(false);
      expect(otherExists).to.equal(true);
    });
  });

  describe("Delegate isolation", function () {
    it("delegates are isolated per owner", async function () {
      const { ekai, owner, delegate, other } = await loadFixture(deployFixture);

      await ekai.addDelegate(delegate.address);

      expect(await ekai.isDelegatePermitted(owner.address, delegate.address)).to.equal(true);
      expect(await ekai.isDelegatePermitted(other.address, delegate.address)).to.equal(false);
    });
  });

  describe("Model restrictions isolation", function () {
    it("model restrictions are isolated per owner and provider", async function () {
      const { ekai, owner, other, OPENAI, ANTHROPIC, GPT4 } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);

      await ekai.addAllowedModel(OPENAI, GPT4);

      expect(await ekai.isModelPermitted(owner.address, OPENAI, GPT4)).to.equal(true);
      expect(await ekai.isModelPermitted(owner.address, ANTHROPIC, GPT4)).to.equal(true); // No restriction on ANTHROPIC
      expect(await ekai.isModelPermitted(other.address, OPENAI, GPT4)).to.equal(true); // Other has no restrictions
    });
  });
});
