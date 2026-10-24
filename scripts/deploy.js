const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

// The frontend reads contract addresses from this file, keyed by chain id.
const DEPLOYMENTS_FILE = path.join(
  __dirname,
  "..",
  "frontend",
  "src",
  "contracts",
  "deployments.json"
);

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      `No deployer account for network "${network.name}". Set PRIVATE_KEY in .env.`
    );
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network:  ${network.name} (chain ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)}`);

  const factory = await ethers.getContractFactory("EventTicketing");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`EventTicketing deployed to: ${address}`);

  // The in-process "hardhat" network disappears when the script ends,
  // so only persist addresses for real or long-running networks.
  if (network.name === "hardhat") return;

  let deployments = {};
  if (fs.existsSync(DEPLOYMENTS_FILE)) {
    deployments = JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf8"));
  }
  deployments[String(chainId)] = {
    address,
    network: network.name,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(deployments, null, 2) + "\n");
  console.log(`Saved to ${path.relative(process.cwd(), DEPLOYMENTS_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
