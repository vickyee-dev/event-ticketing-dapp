import deployments from "../contracts/deployments.json";
import { CHAINS } from "./chains";

export const APP_NAME = "Gatepass";

const requested = Number(import.meta.env.VITE_CHAIN_ID);

/** The one chain this build of the app talks to. Defaults to Avalanche Fuji. */
export const CHAIN = CHAINS[requested] ?? CHAINS[43113];

export const RPC_URL = import.meta.env.VITE_RPC_URL || CHAIN.rpcUrl;

/** Env var wins; otherwise use the address the deploy script recorded for this chain. */
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || deployments[String(CHAIN.id)]?.address || "";

export const SYMBOL = CHAIN.currency.symbol;

export const REFRESH_INTERVAL_MS = 15_000;
