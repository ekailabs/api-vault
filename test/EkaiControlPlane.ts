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

    it("rejects non-owner setting gateway", async function () {
      const { ekai, other, gateway } = await loadFixture(deployFixture);
      await expect(ekai.connect(other).setGateway(gateway.address))
        .to.be.revertedWithCustomError(ekai, "OwnableUnauthorizedAccount");
    });

    it("allows owner to set ROFL key", async function () {
      const { ekai } = await loadFixture(deployFixture);
      const pubkey = ethers.toUtf8Bytes("test-pubkey");
      await expect(ekai.setRoflKey(pubkey, 1, true))
        .to.emit(ekai, "RoflKeyUpdated")
        .withArgs(ethers.hexlify(pubkey), 1, true);

      const [storedPubkey, version, active] = await ekai.getRoflKey();
      expect(storedPubkey).to.equal(ethers.hexlify(pubkey));
      expect(version).to.equal(1);
      expect(active).to.equal(true);
    });

    it("allows owner to add and remove providers", async function () {
      const { ekai, OPENAI } = await loadFixture(deployFixture);

      expect(await ekai.isValidProvider(OPENAI)).to.equal(false);

      await expect(ekai.addProvider(OPENAI))
        .to.emit(ekai, "ProviderAdded")
        .withArgs(OPENAI);
      expect(await ekai.isValidProvider(OPENAI)).to.equal(true);

      await expect(ekai.addProvider(OPENAI))
        .to.be.revertedWith("Provider already exists");

      await expect(ekai.removeProvider(OPENAI))
        .to.emit(ekai, "ProviderRemoved")
        .withArgs(OPENAI);
      expect(await ekai.isValidProvider(OPENAI)).to.equal(false);

      await expect(ekai.removeProvider(OPENAI))
        .to.be.revertedWith("Provider not found");
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

  describe("Secrets", function () {
    it("allows owner to set secret for valid provider", async function () {
      const { ekai, owner, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), 1, true);

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
        .to.be.revertedWith("Invalid provider");
    });

    it("rejects empty ciphertext", async function () {
      const { ekai, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);

      await expect(ekai.setSecret(OPENAI, "0x"))
        .to.be.revertedWith("Empty ciphertext");
    });

    it("increments version on re-set", async function () {
      const { ekai, owner, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), 1, true);

      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("v1"));
      await expect(ekai.setSecret(OPENAI, ethers.toUtf8Bytes("v2")))
        .to.emit(ekai, "SecretSet")
        .withArgs(owner.address, OPENAI, 2);

      const [, version, ,] = await ekai.getSecretCiphertext(owner.address, OPENAI);
      expect(version).to.equal(2);
    });

    it("allows owner to revoke secret", async function () {
      const { ekai, owner, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), 1, true);
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
        .to.be.revertedWith("Secret not found");
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
        .to.be.revertedWith("Invalid delegate");
    });

    it("rejects adding duplicate delegate", async function () {
      const { ekai, delegate } = await loadFixture(deployFixture);
      await ekai.addDelegate(delegate.address);
      await expect(ekai.addDelegate(delegate.address))
        .to.be.revertedWith("Delegate already added");
    });

    it("rejects removing non-existent delegate", async function () {
      const { ekai, delegate } = await loadFixture(deployFixture);
      await expect(ekai.removeDelegate(delegate.address))
        .to.be.revertedWith("Delegate not found");
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
        .to.be.revertedWith("Invalid provider");
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
        .to.be.revertedWith("Model already allowed");
    });

    it("rejects removing non-allowed model", async function () {
      const { ekai, OPENAI, GPT4 } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await expect(ekai.removeAllowedModel(OPENAI, GPT4))
        .to.be.revertedWith("Model not allowed");
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
    it("allows gateway to log receipt", async function () {
      const { ekai, owner, gateway, delegate, OPENAI, GPT4 } = await loadFixture(deployFixture);
      await ekai.setGateway(gateway.address);

      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("request-1"));

      await expect(ekai.connect(gateway).logReceipt(
        requestHash,
        owner.address,
        delegate.address,
        OPENAI,
        GPT4,
        100,
        50,
        1,
        0
      )).to.emit(ekai, "ReceiptLogged");
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
        50,
        1,
        0
      )).to.be.revertedWith("Only gateway");
    });
  });

  describe("getSecretCiphertext access control", function () {
    it("rejects random address reading secrets", async function () {
      const { ekai, owner, other, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), 1, true);
      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret"));

      await expect(ekai.connect(other).getSecretCiphertext(owner.address, OPENAI))
        .to.be.revertedWith("Not authorized");
    });

    it("allows owner to read their own secrets", async function () {
      const { ekai, owner, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), 1, true);
      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret"));

      const [ciphertext, version, exists] = await ekai.getSecretCiphertext(owner.address, OPENAI);
      expect(exists).to.equal(true);
      expect(version).to.equal(1);
    });

    it("allows gateway to read any owner's secrets", async function () {
      const { ekai, owner, gateway, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setGateway(gateway.address);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), 1, true);
      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret"));

      const [ciphertext, version, exists] = await ekai.connect(gateway).getSecretCiphertext(owner.address, OPENAI);
      expect(exists).to.equal(true);
      expect(version).to.equal(1);
    });

    it("rejects delegate reading secrets directly", async function () {
      const { ekai, owner, delegate, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), 1, true);
      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("secret"));
      await ekai.addDelegate(delegate.address);

      // Delegate is permitted but still cannot read directly
      expect(await ekai.isDelegatePermitted(owner.address, delegate.address)).to.equal(true);
      await expect(ekai.connect(delegate).getSecretCiphertext(owner.address, OPENAI))
        .to.be.revertedWith("Not authorized");
    });
  });

  describe("Secret isolation", function () {
    it("secrets are isolated per owner", async function () {
      const { ekai, owner, gateway, other, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setGateway(gateway.address);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), 1, true);

      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("owner-secret"));
      await ekai.connect(other).setSecret(OPENAI, ethers.toUtf8Bytes("other-secret"));

      // Owner reads their own secret
      const [ownerCiphertext, , ownerExists, ] = await ekai.getSecretCiphertext(owner.address, OPENAI);
      // Other reads their own secret
      const [otherCiphertext, , otherExists, ] = await ekai.connect(other).getSecretCiphertext(other.address, OPENAI);

      expect(ethers.toUtf8String(ownerCiphertext)).to.equal("owner-secret");
      expect(ethers.toUtf8String(otherCiphertext)).to.equal("other-secret");
      expect(ownerExists).to.equal(true);
      expect(otherExists).to.equal(true);
    });

    it("revoking one owner's secret doesn't affect another", async function () {
      const { ekai, owner, gateway, other, OPENAI } = await loadFixture(deployFixture);
      await ekai.addProvider(OPENAI);
      await ekai.setGateway(gateway.address);
      await ekai.setRoflKey(ethers.toUtf8Bytes("pubkey"), 1, true);

      await ekai.setSecret(OPENAI, ethers.toUtf8Bytes("owner-secret"));
      await ekai.connect(other).setSecret(OPENAI, ethers.toUtf8Bytes("other-secret"));

      await ekai.revokeSecret(OPENAI);

      // Owner reads their own secret
      const [, , ownerExists, ] = await ekai.getSecretCiphertext(owner.address, OPENAI);
      // Other reads their own secret
      const [, , otherExists, ] = await ekai.connect(other).getSecretCiphertext(other.address, OPENAI);

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
