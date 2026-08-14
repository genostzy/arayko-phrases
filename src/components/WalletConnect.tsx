"use client";

import { useState, useEffect } from "react";
import { isConnected, requestAccess } from "@stellar/freighter-api";

interface WalletConnectProps {
  onConnect: (address: string | null) => void;
}

export function WalletConnect({ onConnect }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    try {
      const result = await isConnected();
      if (result.isConnected) {
        const access = await requestAccess();
        if (!access.error) {
          setAddress(access.address);
          onConnect(access.address);
        }
      }
    } catch {}
  }

  async function connectWallet() {
    setLoading(true);
    try {
      const result = await isConnected();
      if (!result.isConnected) {
        alert("Please install Freighter extension");
        setLoading(false);
        return;
      }
      const access = await requestAccess();
      if (access.error) {
        alert(access.error.message);
      } else {
        setAddress(access.address);
        onConnect(access.address);
      }
    } catch (err: any) {
      alert(err?.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    setAddress(null);
    onConnect(null);
  }

  if (address) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span
          style={{
            fontSize: "0.85rem",
            fontFamily: "monospace",
            color: "var(--green)",
            letterSpacing: "0.05em",
          }}
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={disconnect}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 0,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "var(--text-muted)",
            fontWeight: 600,
            fontSize: "0.8rem",
            letterSpacing: "0.15em",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--red)";
            e.currentTarget.style.color = "var(--red)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          DISCONNECT
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      disabled={loading}
      style={{
        padding: "0.6rem 1.5rem",
        borderRadius: 0,
        border: "2px solid white",
        background: "transparent",
        color: "white",
        fontWeight: 800,
        fontSize: "0.85rem",
        letterSpacing: "0.15em",
        cursor: "pointer",
        transition: "all 0.3s",
        opacity: loading ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.background = "white";
          e.currentTarget.style.color = "black";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "white";
      }}
    >
      {loading ? "..." : "CONNECT"}
    </button>
  );
}
