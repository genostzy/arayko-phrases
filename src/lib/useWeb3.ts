"use client";

import { useState, useEffect, useCallback } from "react";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org:443";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || "";
const PINATA_SECRET = process.env.NEXT_PUBLIC_PINATA_SECRET || "";

export interface OnChainNFT {
  tokenId: number;
  uri: string;
  owner: string;
}

export interface TxRecord {
  hash: string;
  type: "mint" | "transfer";
  timestamp: number;
  tokenId?: number;
}

function getServer() {
  return new StellarSdk.SorobanRpc.Server(RPC_URL);
}

function dummyAccount() {
  return new StellarSdk.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
}

// Display balance - for demo, show "0" placeholder
// In a production app, fetch via Stellar SDK server
function getBalance(address: string): Promise<string> {
  return Promise.resolve("0");
}

export function useWeb3() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [totalSupply, setTotalSupply] = useState(0);
  const [balance, setBalance] = useState("0");
  const [allNfts, setAllNfts] = useState<OnChainNFT[]>([]);
  const [myNfts, setMyNfts] = useState<OnChainNFT[]>([]);
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [txStatus, setTxStatus] = useState("");
  const [lastTx, setLastTx] = useState<TxRecord | null>(null);
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");

  const isConfigured = !!CONTRACT_ID && CONTRACT_ID !== "YOUR_CONTRACT_ID_HERE";
  const hasPinata = !!PINATA_API_KEY && !!PINATA_SECRET;

  useEffect(() => {
    (async () => {
      try {
        const result = await isConnected();
        if (result.isConnected) {
          const access = await requestAccess();
          if (!access.error) setAddress(access.address);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (isConfigured) {
      fetchAllNfts();
      (async () => {
        if (address) {
          const b = await getBalance(address);
          setBalance(b);
        }
      })();
    }
  }, [address, isConfigured]);

  useEffect(() => {
    setNetwork(NETWORK_PASSPHRASE === StellarSdk.Networks.TESTNET ? "testnet" : "mainnet");
  }, [NETWORK_PASSPHRASE]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const result = await isConnected();
      if (!result.isConnected) {
        alert("Please install the Freighter wallet extension");
        return;
      }
      const access = await requestAccess();
      if (access.error) {
        alert(access.error.message);
      } else {
        setAddress(access.address);
      }
    } catch (err: any) {
      alert(err?.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setMyNfts([]);
  }, []);

  const fetchAllNfts = useCallback(async () => {
    if (!isConfigured) return;
    setLoadingNfts(true);
    try {
      const server = getServer();
      const contract = new StellarSdk.Contract(CONTRACT_ID);

      const supplyTx = new StellarSdk.TransactionBuilder(dummyAccount(), {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call("total_supply"))
        .setTimeout(30)
        .build();

      const supplyResult = await server.simulateTransaction(supplyTx);
      let supply = 0;
      if ("result" in supplyResult && supplyResult.result) {
        supply = Number(StellarSdk.scValToNative(supplyResult.result.retval));
      }
      setTotalSupply(supply);

      if (supply === 0) {
        setAllNfts([]);
        setMyNfts([]);
        return;
      }

      const tokens: OnChainNFT[] = [];
      const batchSize = 5;

      for (let batch = 0; batch < supply; batch += batchSize) {
        const batchIds = Array.from(
          { length: Math.min(batchSize, supply - batch) },
          (_, i) => batch + i
        );

        const results = await Promise.all(
          batchIds.map(async (tokenId) => {
            const [ownerTx, uriTx] = await Promise.all([
              (() => {
                const d = dummyAccount();
                return new StellarSdk.TransactionBuilder(d, {
                  fee: StellarSdk.BASE_FEE,
                  networkPassphrase: NETWORK_PASSPHRASE,
                })
                  .addOperation(contract.call("owner_of", StellarSdk.nativeToScVal(tokenId, { type: "u32" })))
                  .setTimeout(30)
                  .build();
              })(),
              (() => {
                const d = dummyAccount();
                return new StellarSdk.TransactionBuilder(d, {
                  fee: StellarSdk.BASE_FEE,
                  networkPassphrase: NETWORK_PASSPHRASE,
                })
                  .addOperation(contract.call("token_uri", StellarSdk.nativeToScVal(tokenId, { type: "u32" })))
                  .setTimeout(30)
                  .build();
              })(),
            ]);

            const [ownerResult, uriResult] = await Promise.all([
              server.simulateTransaction(ownerTx),
              server.simulateTransaction(uriTx),
            ]);

            let owner = "";
            let uri = "";

            if ("result" in ownerResult && ownerResult.result) {
              const val = StellarSdk.scValToNative(ownerResult.result.retval);
              if (val && typeof val === "object" && "toString" in val) owner = val.toString();
            }
            if ("result" in uriResult && uriResult.result) {
              const val = StellarSdk.scValToNative(uriResult.result.retval);
              if (typeof val === "string") uri = val;
              else if (val && typeof val === "object" && "toString" in val) uri = val.toString();
            }

            return { tokenId, uri, owner };
          })
        );

        tokens.push(...results);
      }

      setAllNfts(tokens);
      if (address) setMyNfts(tokens.filter((t) => t.owner === address));
    } catch (error) {
      console.error("Failed to fetch NFTs:", error);
    } finally {
      setLoadingNfts(false);
    }
  }, [isConfigured, address]);

  const uploadToIPFS = useCallback(async (file: File): Promise<string | null> => {
    if (!hasPinata) {
      throw new Error("Pinata not configured. Add API keys to .env.local");
    }
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Pinata upload failed: ${err}`);
    }

    const data = await res.json();
    return `ipfs://${data.IpfsHash}`;
  }, [hasPinata]);

  const mint = useCallback(async (uri: string): Promise<boolean> => {
    if (!address || !isConfigured || !uri.trim()) return false;
    setTxStatus("Building transaction...");
    try {
      const server = getServer();
      const account = await server.getAccount(address);
      const contract = new StellarSdk.Contract(CONTRACT_ID);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "mint",
            StellarSdk.Address.fromString(address).toScVal(),
            StellarSdk.nativeToScVal(uri.trim(), { type: "string" })
          )
        )
        .setTimeout(30)
        .build();

      setTxStatus("Simulating...");
      const simulated = await server.simulateTransaction(transaction);
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(simulated.error);
      }

      setTxStatus("Sign in Freighter...");
      const signResult = await signTransaction(transaction.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: address,
      });
      if (signResult.error) throw new Error(signResult.error.message);

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      setTxStatus("Submitting to Stellar...");
      const result = await server.sendTransaction(signedTx);

      if (result.status !== "ERROR") {
        setTxStatus("Minted successfully!");
        setLastTx({
          hash: result.hash,
          type: "mint",
          timestamp: Date.now(),
        });
        fetchAllNfts();
        setTimeout(() => setTxStatus(""), 5000);
        return true;
      } else {
        throw new Error(`Transaction failed: ${result.status}`);
      }
    } catch (error: any) {
      setTxStatus(error.message?.slice(0, 80) || "Mint failed");
      setTimeout(() => setTxStatus(""), 5000);
      return false;
    }
  }, [address, isConfigured, fetchAllNfts]);

  const transfer = useCallback(async (tokenId: number, toAddress: string): Promise<boolean> => {
    if (!address || !isConfigured || !toAddress.trim()) return false;
    setTxStatus("Building transfer...");
    try {
      const server = getServer();
      const account = await server.getAccount(address);
      const contract = new StellarSdk.Contract(CONTRACT_ID);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "transfer",
            StellarSdk.Address.fromString(address).toScVal(),
            StellarSdk.Address.fromString(toAddress.trim()).toScVal(),
            StellarSdk.nativeToScVal(tokenId, { type: "u32" })
          )
        )
        .setTimeout(30)
        .build();

      setTxStatus("Simulating...");
      const simulated = await server.simulateTransaction(transaction);
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(simulated.error);
      }

      setTxStatus("Sign in Freighter...");
      const signResult = await signTransaction(transaction.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: address,
      });
      if (signResult.error) throw new Error(signResult.error.message);

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      setTxStatus("Submitting transfer...");
      const result = await server.sendTransaction(signedTx);

      if (result.status !== "ERROR") {
        setTxStatus("Transfer complete!");
        setLastTx({
          hash: result.hash,
          type: "transfer",
          timestamp: Date.now(),
          tokenId,
        });
        fetchAllNfts();
        setTimeout(() => setTxStatus(""), 5000);
        return true;
      } else {
        throw new Error(`Transfer failed: ${result.status}`);
      }
    } catch (error: any) {
      setTxStatus(error.message?.slice(0, 80) || "Transfer failed");
      setTimeout(() => setTxStatus(""), 5000);
      return false;
    }
  }, [address, isConfigured, fetchAllNfts]);

  const makeOffer = useCallback(async (tokenId: number, priceXlm: number): Promise<boolean> => {
    if (!address || priceXlm <= 0) return false;
    setTxStatus("Creating offer...");
    try {
      const server = getServer();
      const account = await server.getAccount(address);

      // Send XLM to a holding address (seller for demo)
      // In a real marketplace, this would escrow via contract
      const offerTx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: address,
            asset: StellarSdk.Asset.native(),
            amount: priceXlm.toFixed(7),
          })
        )
        .setTimeout(30)
        .build();

      setTxStatus("Sign in Freighter...");
      const signResult = await signTransaction(offerTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: address,
      });
      if (signResult.error) throw new Error(signResult.error.message);

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      setTxStatus("Submitting offer...");
      const result = await server.sendTransaction(signedTx);

      if (result.status !== "ERROR") {
        setTxStatus(`Offer for ${priceXlm} XLM placed!`);
        setLastTx({
          hash: result.hash,
          type: "transfer",
          timestamp: Date.now(),
          tokenId,
        });
        setTimeout(() => setTxStatus(""), 5000);
        return true;
      } else {
        throw new Error("Offer failed");
      }
    } catch (error: any) {
      setTxStatus(error.message?.slice(0, 80) || "Offer failed");
      setTimeout(() => setTxStatus(""), 5000);
      return false;
    }
  }, [address]);

  return {
    address,
    connecting,
    connect,
    disconnect,
    isConfigured,
    hasPinata,
    totalSupply,
    allNfts,
    myNfts,
    loadingNfts,
    txStatus,
    lastTx,
    mint,
    transfer,
    makeOffer,
    uploadToIPFS,
    refresh: fetchAllNfts,
    clearStatus: () => setTxStatus(""),
    clearLastTx: () => setLastTx(null),
  };
}
