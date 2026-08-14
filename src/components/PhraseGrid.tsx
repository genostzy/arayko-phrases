"use client";

import { useEffect, useState, useCallback } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

const RPC_URL = "https://soroban-testnet.stellar.org:443";
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
const STROOPS_PER_XLM = 10_000_000;

// Convenience quick-picks for the admin's "Add Phrase" panel — not a fixed
// catalog, just the original 6 local images alongside the option to add
// anything else via a custom URL.
const KNOWN_IMAGES = [
  "/images/Phrase%231.jpg",
  "/images/Phrase%232.jpg",
  "/images/Phrase%233.jpg",
  "/images/Phrase%234.jpg",
  "/images/Phrase%235.jpg",
  "/images/Phrase%236.jpg",
];

interface PhraseState {
  id: number;
  owner: string | null;
  price: number | null; // whole XLM
  forSale: boolean;
  uri: string | null;
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

function isUserRejection(message: string) {
  return message.toLowerCase().includes("reject");
}

// Soroban wraps contract panics in a generic "HostError: Error(WasmVm,
// InvalidAction)" envelope with the real reason buried in an event log,
// e.g. `caught panic 'Token is not for sale' from contract function 'buy'`.
// Pull that out instead of showing the generic wrapper.
function describeError(message: string): string {
  const panicMatch = message.match(/caught panic '([^']*)'/);
  if (panicMatch) return panicMatch[1];
  if (message.includes("InvalidAction")) return "Transaction rejected by the contract";
  return message;
}

export default function PhraseGrid({ walletAddress }: PhraseGridProps) {
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [phrases, setPhrases] = useState<PhraseState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | "add" | null>(null);
  const [newUri, setNewUri] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [status, setStatus] = useState("");
  const [verifying, setVerifying] = useState<PhraseState | null>(null);

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

      const supplyTx = buildSimTx("total_supply", []);
      const supplyResult = await server.simulateTransaction(supplyTx);
      let totalSupply = 0;
      if ("result" in supplyResult && supplyResult.result) {
        const val = StellarSdk.scValToNative(supplyResult.result.retval);
        if (val !== null && val !== undefined) totalSupply = Number(val);
      }

      const ids = Array.from({ length: totalSupply }, (_, i) => i);
      const results = await Promise.all(
        ids.map(async (id) => {
          const [ownerRes, priceRes, forSaleRes, uriRes] = await Promise.all([
            server.simulateTransaction(buildSimTx("owner_of", [StellarSdk.nativeToScVal(id, { type: "u32" })])),
            server.simulateTransaction(buildSimTx("price_of", [StellarSdk.nativeToScVal(id, { type: "u32" })])),
            server.simulateTransaction(buildSimTx("is_for_sale", [StellarSdk.nativeToScVal(id, { type: "u32" })])),
            server.simulateTransaction(buildSimTx("token_uri", [StellarSdk.nativeToScVal(id, { type: "u32" })])),
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

          let uri: string | null = null;
          if ("result" in uriRes && uriRes.result) {
            const val = StellarSdk.scValToNative(uriRes.result.retval);
            if (typeof val === "string") uri = val;
          }

          return { id, owner, price, forSale, uri };
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

  async function signAndSubmit(
    operation: StellarSdk.xdr.Operation,
    successMessage: string,
    failureMessage: string
  ) {
    if (!walletAddress) return;
    setStatus("Building...");
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
      const account = await server.getAccount(walletAddress);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(operation)
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

      setStatus(successMessage);
      await refresh();
      setTimeout(() => setStatus(""), 2000);
    } catch (error: any) {
      const message: string = error.message || failureMessage;
      setStatus(isUserRejection(message) ? "" : describeError(message).slice(0, 100));
    }
  }

  async function handleAddPhrase() {
    if (!walletAddress) return;
    const priceXlm = parseFloat(newPrice);
    if (!newUri.trim()) {
      setStatus("Enter an image URL");
      return;
    }
    if (!priceXlm || priceXlm <= 0) {
      setStatus("Enter a price above 0");
      return;
    }
    const priceStroops = Math.round(priceXlm * STROOPS_PER_XLM);
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    setBusyId("add");
    await signAndSubmit(
      contract.call(
        "mint",
        StellarSdk.nativeToScVal(newUri.trim(), { type: "string" }),
        StellarSdk.nativeToScVal(priceStroops, { type: "i128" })
      ),
      "Added!",
      "Failed to add phrase"
    );
    setNewUri("");
    setNewPrice("");
    setBusyId(null);
  }

  async function handleBuy(phraseId: number) {
    if (!walletAddress) return;
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    setBusyId(phraseId);
    await signAndSubmit(
      contract.call(
        "buy",
        StellarSdk.Address.fromString(walletAddress).toScVal(),
        StellarSdk.nativeToScVal(phraseId, { type: "u32" })
      ),
      "Purchased!",
      "Failed to buy"
    );
    setBusyId(null);
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
      {isAdmin && (
        <div className="text-left border border-white/10 bg-[#0a0a0a]/60 p-6 mb-8">
          <h3 className="text-base font-bold tracking-[0.05em] mb-4">ADD PHRASE</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {KNOWN_IMAGES.map((src) => (
              <button
                key={src}
                onClick={() => setNewUri(src)}
                className={`w-14 h-14 overflow-hidden border ${
                  newUri === src ? "border-white" : "border-white/20"
                }`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Image URL"
              value={newUri}
              onChange={(e) => setNewUri(e.target.value)}
              className="flex-1 min-w-[160px] px-3 py-2 bg-transparent border border-white/20 text-sm text-white outline-none"
            />
            <input
              type="number"
              min="0"
              step="1"
              placeholder="XLM"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-24 px-3 py-2 bg-transparent border border-white/20 text-sm text-white outline-none"
            />
            <button
              onClick={handleAddPhrase}
              disabled={busyId === "add"}
              className="px-4 py-2 bg-white text-black text-sm font-bold tracking-[0.1em] disabled:opacity-40"
            >
              {busyId === "add" ? "..." : "ADD PHRASE"}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-center text-sm text-white/40">Loading...</p>}

      {!loading && phrases.length === 0 && (
        <p className="text-center text-sm text-white/40">No phrases listed yet.</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {phrases.map((phrase) => {
          const ownedByMe = !!walletAddress && phrase.owner === walletAddress;

          return (
            <div key={phrase.id} className="border border-white/10 bg-[#0a0a0a]/60 overflow-hidden">
              <button
                onClick={() => setVerifying(phrase)}
                className="block w-full aspect-square cursor-pointer"
                title="Click to verify on-chain"
              >
                {phrase.uri && (
                  <img src={phrase.uri} alt={`Phrase #${phrase.id + 1}`} className="w-full h-full object-cover" />
                )}
              </button>
              <div className="p-4">
                <h3 className="text-base font-bold tracking-[0.05em] mb-2">Phrase #{phrase.id + 1}</h3>

                {phrase.forSale && ownedByMe && (
                  <p className="text-sm text-green-500">Listed for {phrase.price} XLM</p>
                )}

                {phrase.forSale && !ownedByMe && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white/70">{phrase.price} XLM</span>
                    <button
                      onClick={() => handleBuy(phrase.id)}
                      disabled={!walletAddress || busyId === phrase.id}
                      className="px-3 py-2 bg-white text-black text-sm font-bold tracking-[0.1em] disabled:opacity-40"
                    >
                      {busyId === phrase.id ? "..." : !walletAddress ? "CONNECT WALLET" : "BUY"}
                    </button>
                  </div>
                )}

                {!phrase.forSale && (
                  <p className="text-sm text-white/40">{ownedByMe ? "Owned by you" : "Sold"}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {status && <p className="text-center text-sm text-white/50 mt-6">{status.toUpperCase()}</p>}

      {verifying && (
        <div
          onClick={() => setVerifying(null)}
          className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full border border-white/10 bg-[#0a0a0a]"
          >
            {verifying.uri && (
              <div className="aspect-square">
                <img src={verifying.uri} alt={`Phrase #${verifying.id + 1}`} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-black tracking-[-0.02em]">Phrase #{verifying.id + 1}</h3>
                <button onClick={() => setVerifying(null)} className="text-white/40 hover:text-white text-lg">
                  ✕
                </button>
              </div>

              <p className="text-xs tracking-[0.15em] text-white/40 mb-1">OWNER</p>
              <p className="text-sm font-mono break-all mb-4">{verifying.owner}</p>

              <p className="text-xs tracking-[0.15em] text-white/40 mb-1">STATUS</p>
              <p className="text-sm mb-6">{verifying.forSale ? `For sale, ${verifying.price} XLM` : "Sold"}</p>

              <a
                href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center py-3 border border-white/20 text-sm text-white/60 hover:text-white hover:border-white transition-colors"
              >
                VERIFY ON STELLAR EXPERT
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
