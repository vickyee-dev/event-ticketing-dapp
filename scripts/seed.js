// Creates a few demo events (and a couple of purchases on local networks)
// against the contract recorded in frontend/src/contracts/deployments.json.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const DEPLOYMENTS_FILE = path.join(
  __dirname,
  "..",
  "frontend",
  "src",
  "contracts",
  "deployments.json",
);

const DAY = 24 * 60 * 60;

async function main() {
  const { ethers, network } = hre;
  const chainId = String((await ethers.provider.getNetwork()).chainId);

  const deployments = fs.existsSync(DEPLOYMENTS_FILE)
    ? JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf8"))
    : {};
  const entry = deployments[chainId];
  if (!entry) {
    throw new Error(
      `No deployment for chain ${chainId}. Run the deploy script first.`,
    );
  }

  const signers = await ethers.getSigners();
  const organizer = signers[0];
  const contract = await ethers.getContractAt(
    "EventTicketing",
    entry.address,
    organizer,
  );

  const latest = await ethers.provider.getBlock("latest");
  const now = latest.timestamp;

  const demoEvents = [
    {
      name: "Avalanche Builders Summit",
      venue: "KICC, Nairobi",
      startTime: now + 21 * DAY,
      price: ethers.parseEther("0.1"),
      capacity: 200,
      maxPerWallet: 4,
    },
    {
      name: "Sunset Rooftop Sessions",
      venue: "Westlands Skyline Deck",
      startTime: now + 9 * DAY,
      price: ethers.parseEther("0.05"),
      capacity: 60,
      maxPerWallet: 2,
    },
    {
      name: "Open Source Meetup",
      venue: "iHub, Ngong Road",
      startTime: now + 4 * DAY,
      price: 0n,
      capacity: 120,
      maxPerWallet: 1,
    },
  ];

  for (const e of demoEvents) {
    const tx = await contract.createEvent(
      e.name,
      e.venue,
      e.startTime,
      e.price,
      e.capacity,
      e.maxPerWallet,
    );
    await tx.wait();
    console.log(`Created: ${e.name}`);
  }

  // On local networks, simulate a few buyers so the UI has data to show.
  if (["localhost", "hardhat"].includes(network.name) && signers.length > 3) {
    const firstId = Number(await contract.eventCount()) - demoEvents.length + 1;
    const buys = [
      { signer: signers[1], eventId: firstId, qty: 2 },
      { signer: signers[2], eventId: firstId + 1, qty: 1 },
      { signer: signers[3], eventId: firstId + 2, qty: 1 },
    ];
    for (const b of buys) {
      // const ev = await contract.getEvent(b.eventId);
      const event = await contract["getEvent(uint256)"](b.eventId);
      const tx = await contract
        .connect(b.signer)
        .buyTickets(b.eventId, b.qty, { value: event.price * BigInt(b.qty) });
      await tx.wait();
    }
    console.log("Simulated a few ticket purchases from other accounts.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
