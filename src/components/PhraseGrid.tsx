"use client";

import { useEffect, useState, useCallback } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

const RPC_URL = "https://soroban-testnet.stellar.org:443";
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
const STROOPS_PER_XLM = 10_000_000;

const PHRASES = [
  { id: 0, uri: "/images/Phrase%231.jpg", title: "Phrase #1" },
  { id: 1, uri: "/images/Phrase%232.jpg", title: "Phrase #2" },
  { id: 2, uri: "/images/Phrase%233.jpg", title: "Phrase #3" },
  { id: 3, uri: "/images/Phrase%234.jpg", title: "Phrase #4" },
  { id: 4, uri: "/images/Phrase%235.jpg", title: "Phrase #5" },
  { id: 5, uri: "/images/Phrase%236.jpg", title: "Phrase #6" },
];

interface PhraseState {
  id: number;
  owner: string | null;
  price: number | null; // whole XLM, null if never minted
  forSale: boolean;
}

interface PhraseGridProps {
  walletAddress: string | null;
}

function dummyAccount() {
  return new StellarSdk.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
}

function buildSimTx(fn: string, args: StellarSdk.xdr.ScVal[]) {
  const contract = new StellarSdk.Contract(CONTRACT_ID);
  return new StellarSdk.TransactionBuilder(dummyAccount(), {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(30)
    .build();
}

export default function PhraseGrid({ walletAddress }: PhraseGridProps) {
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [phrases, setPhrases] = useState<PhraseState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [priceInputs, setPriceInputs] = useState<Record<number, string>>({});
  const [status, setStatus] = useState("");

  const isConfigured = !!CONTRACT_ID;

  const refresh = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);

      const adminTx = buildSimTx("admin", []);
      const adminResult = await server.simulateTransaction(adminTx);
      let admin: string | null = null;
      if ("result" in adminResult && adminResult.result) {
        const val = StellarSdk.scValToNative(adminResult.result.retval);
        if (typeof val === "string") admin = val;
      }
      setAdminAddress(admin);

      const results = await Promise.all(
        PHRASES.map(async (p) => {
          const [ownerRes, priceRes, forSaleRes] = await Promise.all([
            server.simulateTransaction(
              buildSimTx("owner_of", [StellarSdk.nativeToScVal(p.id, { type: "u32" })])
            ),
            server.simulateTransaction(
              buildSimTx("price_of", [StellarSdk.nativeToScVal(p.id, { type: "u32" })])
            ),
            server.simulateTransaction(
              buildSimTx("is_for_sale", [StellarSdk.nativeToScVal(p.id, { type: "u32" })])
            ),
          ]);

          let owner: string | null = null;
          if ("result" in ownerRes && ownerRes.result) {
            const val = StellarSdk.scValToNative(ownerRes.result.retval);
            if (typeof val === "string") owner = val;
          }

          let price: number | null = null;
          if ("result" in priceRes && priceRes.result) {
            const val = StellarSdk.scValToNative(priceRes.result.retval);
            if (val !== null && val !== undefined) price = Number(val) / STROOPS_PER_XLM;
          }

          let forSale = false;
          if ("result" in forSaleRes && forSaleRes.result) {
            forSale = Boolean(StellarSdk.scValToNative(forSaleRes.result.retval));
          }

          return { id: p.id, owner, price, forSale };
        })
      );

      setPhrases(results);
    } catch (error) {
      console.error("Failed to load phrases:", error);
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleList(phraseId: number) {
    if (!walletAddress) return;
    const priceXlm = parseFloat(priceInputs[phraseId] || "");
    if (!priceXlm || priceXlm <= 0) {
      setStatus("Enter a price above 0");
      return;
    }
    const phrase = PHRASES.find((p) => p.id === phraseId)!;
    setBusyId(phraseId);
    setStatus("Building...");
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
      const account = await server.getAccount(walletAddress);
      const contract = new StellarSdk.Contract(CONTRACT_ID);
      const priceStroops = Math.round(priceXlm * STROOPS_PER_XLM);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "mint",
            StellarSdk.nativeToScVal(phraseId, { type: "u32" }),
            StellarSdk.nativeToScVal(phrase.uri, { type: "string" }),
            StellarSdk.nativeToScVal(priceStroops, { type: "i128" })
          )
        )
        .setTimeout(30)
        .build();

      const simulated = await server.simulateTransaction(tx);
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(simulated.error);
      }
      const prepared = StellarSdk.SorobanRpc.assembleTransaction(tx, simulated).build();

      setStatus("Sign in Freighter...");
      const signResult = await signTransaction(prepared.toXDR(), {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        address: walletAddress,
      });
      if (signResult.error) throw new Error(signResult.error.message);

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, StellarSdk.Networks.TESTNET);

      setStatus("Submitting...");
      const result = await server.sendTransaction(signedTx);
      if (result.status === "ERROR") throw new Error(`Failed: ${result.status}`);

      setStatus("Listed!");
      await refresh();
      setTimeout(() => setStatus(""), 2000);
    } catch (error: any) {
      setStatus(error.message?.slice(0, 80) || "Failed to list");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBuy(phraseId: number) {
    if (!walletAddress) return;
    setBusyId(phraseId);
    setStatus("Building...");
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
      const account = await server.getAccount(walletAddress);
      const contract = new StellarSdk.Contract(CONTRACT_ID);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "buy",
            StellarSdk.Address.fromString(walletAddress).toScVal(),
            StellarSdk.nativeToScVal(phraseId, { type: "u32" })
          )
        )
        .setTimeout(30)
        .build();

      const simulated = await server.simulateTransaction(tx);
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(simulated.error);
      }
      const prepared = StellarSdk.SorobanRpc.assembleTransaction(tx, simulated).build();

      setStatus("Sign in Freighter...");
      const signResult = await signTransaction(prepared.toXDR(), {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        address: walletAddress,
      });
      if (signResult.error) throw new Error(signResult.error.message);

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, StellarSdk.Networks.TESTNET);

      setStatus("Submitting...");
      const result = await server.sendTransaction(signedTx);
      if (result.status === "ERROR") throw new Error(`Failed: ${result.status}`);

      setStatus("Purchased!");
      await refresh();
      setTimeout(() => setStatus(""), 2000);
    } catch (error: any) {
      setStatus(error.message?.slice(0, 80) || "Failed to buy");
    } finally {
      setBusyId(null);
    }
  }

  const isAdmin = !!walletAddress && !!adminAddress && walletAddress === adminAddress;

  if (!isConfigured) {
    return (
      <p className="text-center text-white/50 text-sm">
        Marketplace contract not configured.
      </p>
    );
  }

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PHRASES.map((phrase) => {
          const state = phrases.find((p) => p.id === phrase.id);
          const minted = !!state?.owner;
          const ownedByMe = !!walletAddress && state?.owner === walletAddress;

          return (
            <div key={phrase.id} className="border border-white/10 bg-[#0a0a0a]/60 overflow-hidden">
              <div className="aspect-square">
                <img src={phrase.uri} alt={phrase.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-4">
                <h3 className="text-base font-bold tracking-[0.05em] mb-2">{phrase.title}</h3>

                {loading && <p className="text-sm text-white/40">Loading...</p>}

                {!loading && !minted && isAdmin && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="XLM"
                      value={priceInputs[phrase.id] || ""}
                      onChange={(e) =>
                        setPriceInputs((prev) => ({ ...prev, [phrase.id]: e.target.value }))
                      }
                      className="w-20 px-2 py-2 bg-transparent border border-white/20 text-sm text-white outline-none"
                    />
                    <button
                      onClick={() => handleList(phrase.id)}
                      disabled={busyId === phrase.id}
                      className="flex-1 px-3 py-2 bg-white text-black text-sm font-bold tracking-[0.1em] disabled:opacity-40"
                    >
                      {busyId === phrase.id ? "..." : "LIST FOR SALE"}
                    </button>
                  </div>
                )}

                {!loading && !minted && !isAdmin && (
                  <p className="text-sm text-white/40">Not available yet</p>
                )}

                {!loading && minted && state?.forSale && ownedByMe && (
                  <p className="text-sm text-green-500">Listed — {state.price} XLM</p>
                )}

                {!loading && minted && state?.forSale && !ownedByMe && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white/70">{state.price} XLM</span>
                    <button
                      onClick={() => handleBuy(phrase.id)}
                      disabled={!walletAddress || busyId === phrase.id}
                      className="px-3 py-2 bg-white text-black text-sm font-bold tracking-[0.1em] disabled:opacity-40"
                    >
                      {busyId === phrase.id ? "..." : !walletAddress ? "CONNECT WALLET" : "BUY"}
                    </button>
                  </div>
                )}

                {!loading && minted && !state?.forSale && (
                  <p className="text-sm text-white/40">
                    {ownedByMe ? "Owned by you" : "Sold"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {status && <p className="text-center text-sm text-white/50 mt-6">{status.toUpperCase()}</p>}
    </div>
  );
}
