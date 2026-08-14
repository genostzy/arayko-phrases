"use client";

import { useState } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

const RPC_URL = "https://soroban-testnet.stellar.org:443";

interface NFTMinterProps {
  walletAddress: string | null;
  onMinted: () => void;
}

export function NFTMinter({ walletAddress, onMinted }: NFTMinterProps) {
  const [uri, setUri] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID;
  const isConfigured = CONTRACT_ID && CONTRACT_ID !== "YOUR_CONTRACT_ID_HERE";

  async function handleMint() {
    if (!walletAddress || !isConfigured || !uri.trim()) return;

    setLoading(true);
    setStatus("Building...");
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
      const account = await server.getAccount(walletAddress);
      const contract = new StellarSdk.Contract(CONTRACT_ID!);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "mint",
            StellarSdk.Address.fromString(walletAddress).toScVal(),
            StellarSdk.nativeToScVal(uri.trim(), { type: "string" })
          )
        )
        .setTimeout(30)
        .build();

      setStatus("Simulating...");
      const simulated = await server.simulateTransaction(transaction);
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(simulated.error);
      }

      setStatus("Sign in Freighter...");
      const signResult = await signTransaction(transaction.toXDR(), {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        address: walletAddress,
      });
      if (signResult.error) throw new Error(signResult.error.message);

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        StellarSdk.Networks.TESTNET
      );

      setStatus("Submitting...");
      const result = await server.sendTransaction(signedTx);

      if (result.status !== "ERROR") {
        setUri("");
        setStatus("Minted!");
        onMinted();
        setTimeout(() => setStatus(""), 3000);
      } else {
        throw new Error(`Failed: ${result.status}`);
      }
    } catch (error: any) {
      setStatus(error.message?.slice(0, 60) || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ width: "100%" }}>
      <h2
        style={{
          fontSize: "0.75rem",
          fontWeight: 800,
          letterSpacing: "0.2em",
          marginBottom: "2rem",
          textAlign: "center",
        }}
      >
        MINT
      </h2>

      {/* Preview */}
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          border: "2px solid rgba(255,255,255,0.1)",
          marginBottom: "1.5rem",
          background: uri
            ? `url(${uri}) center/cover no-repeat, var(--bg-light)`
            : "var(--bg-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!uri && (
          <span style={{ fontSize: "3rem", opacity: 0.1 }}>&#x2726;</span>
        )}
      </div>

      {/* Input */}
      <input
        type="text"
        value={uri}
        onChange={(e) => setUri(e.target.value)}
        placeholder="IMAGE URL"
        style={{
          width: "100%",
          padding: "1rem",
          border: "2px solid rgba(255,255,255,0.1)",
          background: "transparent",
          color: "white",
          fontSize: "0.8rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          outline: "none",
          marginBottom: "1rem",
          fontFamily: "'Inter', monospace",
        }}
        onFocus={(e) => (e.target.style.borderColor = "white")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
      />

      {/* Button */}
      <button
        onClick={handleMint}
        disabled={loading || !isConfigured || !walletAddress || !uri.trim()}
        style={{
          width: "100%",
          padding: "1rem",
          border: "2px solid white",
          background:
            loading || !isConfigured || !walletAddress || !uri.trim()
              ? "transparent"
              : "white",
          color:
            loading || !isConfigured || !walletAddress || !uri.trim()
              ? "rgba(255,255,255,0.3)"
              : "black",
          fontWeight: 800,
          fontSize: "0.8rem",
          letterSpacing: "0.2em",
          cursor:
            loading || !isConfigured || !walletAddress || !uri.trim()
              ? "not-allowed"
              : "pointer",
          transition: "all 0.3s",
        }}
        onMouseEnter={(e) => {
          if (!loading && isConfigured && walletAddress && uri.trim()) {
            e.currentTarget.style.background = "var(--accent)";
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "white";
          }
        }}
        onMouseLeave={(e) => {
          if (!loading && isConfigured && walletAddress && uri.trim()) {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.borderColor = "white";
            e.currentTarget.style.color = "black";
          }
        }}
      >
        {loading
          ? status.toUpperCase()
          : !walletAddress
          ? "CONNECT WALLET"
          : !isConfigured
          ? "CONTRACT NOT DEPLOYED"
          : "MINT"}
      </button>

      {status && !loading && (
        <p
          style={{
            marginTop: "1rem",
            fontSize: "0.7rem",
            textAlign: "center",
            color: status.includes("Minted") ? "var(--green)" : "var(--text-muted)",
            letterSpacing: "0.05em",
          }}
        >
          {status.toUpperCase()}
        </p>
      )}
    </div>
  );
}
