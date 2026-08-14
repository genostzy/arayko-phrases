"use client";

import { useState, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org:443";

interface NetworkStatusProps {
  walletAddress: string | null;
}

export function NetworkStatus({ walletAddress }: NetworkStatusProps) {
  const [networkOk, setNetworkOk] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkNetwork();
  }, []);

  async function checkNetwork() {
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
      await server.getHealth();
      setNetworkOk(true);
    } catch {
      setNetworkOk(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.5rem",
        fontSize: "0.65rem",
        color: "var(--text-muted)",
        letterSpacing: "0.1em",
        animation: mounted ? "fadeIn 0.5s ease-out" : "none",
        opacity: mounted ? 1 : 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background:
              networkOk === null
                ? "#666"
                : networkOk
                ? "var(--green)"
                : "var(--red)",
          }}
        />
        <span>
          {networkOk === null ? "CHECKING" : networkOk ? "TESTNET" : "OFFLINE"}
        </span>
      </div>
      {walletAddress && (
        <span style={{ color: "var(--green)", fontFamily: "monospace" }}>
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </span>
      )}
    </div>
  );
}
