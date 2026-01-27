import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function deployVaultFixture() {
  const [owner, allowed, other] = await ethers.getSigners();
  const APIKeyVault = await ethers.getContractFactory("APIKeyVault");
  const vault = await APIKeyVault.deploy();
  await vault.waitForDeployment();

  const OPENAI_API_KEY = await vault.OPENAI_API_KEY();

  return { vault, owner, allowed, other, OPENAI_API_KEY };
}

describe("APIKeyVault", function () {
  it("rejects registration with an invalid provider", async function () {
    const { vault } = await loadFixture(deployVaultFixture);
    const invalidProvider = ethers.keccak256(ethers.toUtf8Bytes("INVALID"));

    await expect(
      vault.registerSecret(invalidProvider, ethers.toUtf8Bytes("secret"))
    ).to.be.revertedWith("Invalid provider ID");
  });

  it("enforces allowlist for secret reads", async function () {
    const { vault, owner, allowed, other, OPENAI_API_KEY } = await loadFixture(deployVaultFixture);

    await vault.registerSecret(OPENAI_API_KEY, ethers.toUtf8Bytes("sk-test-1"));

    await expect(vault.connect(allowed).getSecret(owner.address, OPENAI_API_KEY)).to.be.revertedWith(
      "Not in allowlist"
    );

    await vault.addToAllowlist(OPENAI_API_KEY, allowed.address);

    const ciphertext = await vault.connect(allowed).getSecret(owner.address, OPENAI_API_KEY);
    expect(ethers.toUtf8String(ciphertext)).to.equal("sk-test-1");

    await vault.removeFromAllowlist(OPENAI_API_KEY, allowed.address);
    await expect(vault.connect(allowed).getSecret(owner.address, OPENAI_API_KEY)).to.be.revertedWith(
      "Not in allowlist"
    );

    await expect(vault.connect(other).getSecret(owner.address, OPENAI_API_KEY)).to.be.revertedWith(
      "Not in allowlist"
    );
  });

  it("isolates ownership; others cannot manage or revoke another owner's secret", async function () {
    const { vault, owner, other, OPENAI_API_KEY } = await loadFixture(deployVaultFixture);

    await vault.registerSecret(OPENAI_API_KEY, ethers.toUtf8Bytes("owner-secret"));

    await expect(
      vault.connect(other).addToAllowlist(OPENAI_API_KEY, other.address)
    ).to.be.revertedWith("Secret not found");

    await expect(vault.connect(other).revokeSecret(OPENAI_API_KEY)).to.be.revertedWith("Secret not found");
  });

  it("allows owner self-access when self-allowlisted", async function () {
    const { vault, owner, OPENAI_API_KEY } = await loadFixture(deployVaultFixture);

    await vault.registerSecret(OPENAI_API_KEY, ethers.toUtf8Bytes("self-secret"));
    await vault.addToAllowlist(OPENAI_API_KEY, owner.address);

    const ciphertext = await vault.getSecret(owner.address, OPENAI_API_KEY);
    expect(ethers.toUtf8String(ciphertext)).to.equal("self-secret");
  });

  it("invalidates allowlists on revoke and re-register", async function () {
    const { vault, owner, allowed, OPENAI_API_KEY } = await loadFixture(deployVaultFixture);

    await vault.registerSecret(OPENAI_API_KEY, ethers.toUtf8Bytes("sk-v1"));
    await vault.addToAllowlist(OPENAI_API_KEY, allowed.address);

    const first = await vault.connect(allowed).getSecret(owner.address, OPENAI_API_KEY);
    expect(ethers.toUtf8String(first)).to.equal("sk-v1");

    await vault.revokeSecret(OPENAI_API_KEY);
    await vault.registerSecret(OPENAI_API_KEY, ethers.toUtf8Bytes("sk-v2"));

    await expect(vault.connect(allowed).getSecret(owner.address, OPENAI_API_KEY)).to.be.revertedWith(
      "Not in allowlist"
    );

    await vault.addToAllowlist(OPENAI_API_KEY, allowed.address);
    const second = await vault.connect(allowed).getSecret(owner.address, OPENAI_API_KEY);
    expect(ethers.toUtf8String(second)).to.equal("sk-v2");
  });
});
