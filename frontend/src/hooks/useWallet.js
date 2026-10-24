import { useCallback, useEffect, useState } from "react";
import { getAddress } from "ethers";
import { CHAIN } from "../lib/config";

const DISCONNECTED_KEY = "gatepass:disconnected";

const normalize = (accounts) => (accounts?.[0] ? getAddress(accounts[0]) : "");

/**
 * Injected-wallet connection (Core, MetaMask, ...). Wallets can't be
 * disconnected programmatically, so "Disconnect" just makes the app forget the
 * account until the user connects again.
 */
export function useWallet() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const hasWallet = typeof window !== "undefined" && Boolean(window.ethereum);

  // Restore an existing session and follow wallet changes.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return undefined;

    let alive = true;
    const forgotten = () => localStorage.getItem(DISCONNECTED_KEY) === "1";

    (async () => {
      try {
        const [accounts, hexChain] = await Promise.all([
          eth.request({ method: "eth_accounts" }),
          eth.request({ method: "eth_chainId" }),
        ]);
        if (!alive) return;
        setChainId(Number(hexChain));
        if (!forgotten()) setAccount(normalize(accounts));
      } catch (error) {
        console.error("Could not read wallet state", error);
      }
    })();

    const onAccounts = (accounts) => {
      if (!forgotten()) setAccount(normalize(accounts));
    };
    const onChain = (hexChain) => setChainId(Number(hexChain));

    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      alive = false;
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error("No wallet found. Install Core or MetaMask.");
    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const hexChain = await window.ethereum.request({ method: "eth_chainId" });
      localStorage.removeItem(DISCONNECTED_KEY);
      setAccount(normalize(accounts));
      setChainId(Number(hexChain));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.setItem(DISCONNECTED_KEY, "1");
    setAccount("");
  }, []);

  const switchChain = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN.hexId }],
      });
    } catch (error) {
      // 4902: the wallet doesn't know this chain yet, so add it.
      if (error?.code === 4902 || error?.data?.originalError?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CHAIN.hexId,
              chainName: CHAIN.name,
              nativeCurrency: CHAIN.currency,
              rpcUrls: [CHAIN.rpcUrl],
              blockExplorerUrls: CHAIN.explorer ? [CHAIN.explorer] : undefined,
            },
          ],
        });
      } else {
        throw error;
      }
    }
  }, []);

  return {
    account,
    chainId,
    connecting,
    hasWallet,
    wrongNetwork: Boolean(account) && chainId !== CHAIN.id,
    connect,
    disconnect,
    switchChain,
  };
}
