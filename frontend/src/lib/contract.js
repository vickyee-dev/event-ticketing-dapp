import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { ABI } from "./abi";
import { CONTRACT_ADDRESS, RPC_URL, CHAIN } from "./config";

/** Read-only contract that works without a wallet. Null until an address is configured. */
export const readContract = CONTRACT_ADDRESS
  ? new Contract(
      CONTRACT_ADDRESS,
      ABI,
      new JsonRpcProvider(RPC_URL, CHAIN.id, { staticNetwork: true })
    )
  : null;

/** Contract connected to the user's wallet, for sending transactions. */
export async function getWriteContract() {
  if (!window.ethereum) throw new Error("No wallet found. Install Core or MetaMask.");
  const signer = await new BrowserProvider(window.ethereum).getSigner();
  return new Contract(CONTRACT_ADDRESS, ABI, signer);
}

// Convert ethers Result objects into plain objects the UI can use freely.
export function toEvent(id, r) {
  return {
    id,
    organizer: r.organizer,
    startTime: Number(r.startTime),
    price: r.price,
    capacity: Number(r.capacity),
    sold: Number(r.sold),
    maxPerWallet: Number(r.maxPerWallet),
    cancelled: r.cancelled,
    name: r.name,
    venue: r.venue,
  };
}

export function toTicket(id, r) {
  return {
    id,
    eventId: Number(r.eventId),
    owner: r.owner,
    purchasedAt: Number(r.purchasedAt),
    checkedIn: r.checkedIn,
  };
}
