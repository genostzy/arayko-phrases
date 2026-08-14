"use client";

import { useState, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

const RPC_URL = "https://soroban-testnet.stellar.org:443";

interface NFTGalleryProps {
  walletAddress: string | null;
  refreshKey: number;
}

interface NFT {
  tokenId: number;
  uri: string;
  owner: string;
}

export function NFTGallery({ walletAddress, refreshKey }: NFTGalleryProps) {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalSupply, setTotalSupply] = useState(0);
  const [transferId, setTransferId] = useState<number | null>(null);
  const [transferAddr, setTransferAddr] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferStatus, setTransferStatus] = useState("");

  const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID;
  const isConfigured = CONTRACT_ID && CONTRACT_ID !== "YOUR_CONTRACT_ID_HERE";

  useEffect(() => {
    if (isConfigured && walletAddress) fetchNFTs();
  }, [walletAddress, refreshKey, CONTRACT_ID]);

  async function fetchNFTs() {
    if (!isConfigured || !walletAddress) return;
    setLoading(true);
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
      const contract = new StellarSdk.Contract(CONTRACT_ID!);
      const dummy = () =>
        new StellarSdk.Account(
          "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          "0"
        );

      const supplyTx = new StellarSdk.TransactionBuilder(dummy(), {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
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

      const tokens: NFT[] = [];
      for (let i = 0; i < supply; i++) {
        const [ownerTx, uriTx] = await Promise.all([
          (() => {
            const d = dummy();
            return new StellarSdk.TransactionBuilder(d, {
              fee: StellarSdk.BASE_FEE,
              networkPassphrase: StellarSdk.Networks.TESTNET,
            })
              .addOperation(contract.call("owner_of", StellarSdk.nativeToScVal(i, { type: "u32" })))
              .setTimeout(30)
              .build();
          })(),
          (() => {
            const d = dummy();
            return new StellarSdk.TransactionBuilder(d, {
              fee: StellarSdk.BASE_FEE,
              networkPassphrase: StellarSdk.Networks.TESTNET,
            })
              .addOperation(contract.call("token_uri", StellarSdk.nativeToScVal(i, { type: "u32" })))
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

        if (owner === walletAddress) {
          tokens.push({ tokenId: i, uri, owner });
        }
      }

      setNfts(tokens);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTransfer(tokenId: number) {
    if (!walletAddress || !transferAddr.trim()) return;
    setTransferLoading(true);
    setTransferStatus("Building...");
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
            "transfer",
            StellarSdk.Address.fromString(walletAddress).toScVal(),
            StellarSdk.Address.fromString(transferAddr.trim()).toScVal(),
            StellarSdk.nativeToScVal(tokenId, { type: "u32" })
          )
        )
        .setTimeout(30)
        .build();

      const simulated = await server.simulateTransaction(transaction);
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(simulated.error);
      }

      setTransferStatus("Signing...");
      const signResult = await signTransaction(transaction.toXDR(), {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        address: walletAddress,
      });
      if (signResult.error) throw new Error(signResult.error.message);

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        StellarSdk.Networks.TESTNET
      );

      setTransferStatus("Submitting...");
      const result = await server.sendTransaction(signedTx);

      if (result.status !== "ERROR") {
        setTransferStatus("Done!");
        setTransferId(null);
        setTransferAddr("");
        fetchNFTs();
        setTimeout(() => setTransferStatus(""), 2000);
      } else {
        throw new Error(`Failed: ${result.status}`);
      }
    } catch (error: any) {
      setTransferStatus(error.message?.slice(0, 50) || "Failed");
    } finally {
      setTransferLoading(false);
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
        MY NFTS
      </h2>

      <p
        style={{
          fontSize: "0.7rem",
          color: "var(--text-muted)",
          textAlign: "center",
          marginBottom: "2rem",
          letterSpacing: "0.1em",
        }}
      >
        {totalSupply} TOTAL &middot; {nfts.length} OWNED
      </p>

      {!walletAddress ? (
        <div
          style={{
            padding: "4rem 1rem",
            textAlign: "center",
            border: "2px solid rgba(255,255,255,0.1)",
          }}
        >
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", letterSpacing: "0.1em" }}>
            CONNECT WALLET TO VIEW
          </p>
        </div>
      ) : loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
          {[1, 2].map((i) => (
            <div key={i} className="loading-shimmer" style={{ aspectRatio: "1" }} />
          ))}
        </div>
      ) : nfts.length === 0 ? (
        <div
          style={{
            padding: "4rem 1rem",
            textAlign: "center",
            border: "2px solid rgba(255,255,255,0.1)",
          }}
        >
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", letterSpacing: "0.1em" }}>
            NO NFTS YET
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {nfts.map((nft) => (
            <div
              key={nft.tokenId}
              style={{
                border: "2px solid rgba(255,255,255,0.1)",
                background: "var(--bg-light)",
                animation: "scaleIn 0.3s ease-out",
              }}
            >
              <div style={{ display: "flex" }}>
                {/* Image */}
                <div
                  style={{
                    width: 120,
                    height: 120,
                    flexShrink: 0,
                    background: nft.uri
                      ? `url(${nft.uri}) center/cover no-repeat`
                      : "var(--bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {!nft.uri && (
                    <span style={{ fontSize: "1.5rem", opacity: 0.1 }}>&#x2726;</span>
                  )}
                </div>

                {/* Info */}
                <div
                  style={{
                    flex: 1,
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.05em" }}>
                        #{nft.tokenId}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6rem",
                          padding: "0.2rem 0.5rem",
                          border: "1px solid var(--green)",
                          color: "var(--green)",
                          letterSpacing: "0.1em",
                        }}
                      >
                        OWNED
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: "0.6rem",
                        color: "var(--text-muted)",
                        fontFamily: "monospace",
                      }}
                    >
                      {nft.owner.slice(0, 16)}...
                    </p>
                  </div>

                  <button
                    onClick={() => setTransferId(transferId === nft.tokenId ? null : nft.tokenId)}
                    style={{
                      padding: "0.4rem",
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "transparent",
                      color: "var(--text-muted)",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      marginTop: "0.5rem",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "white";
                      e.currentTarget.style.color = "white";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                      e.currentTarget.style.color = "var(--text-muted)";
                    }}
                  >
                    TRANSFER
                  </button>
                </div>
              </div>

              {/* Transfer Form */}
              {transferId === nft.tokenId && (
                <div
                  style={{
                    padding: "1rem",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    gap: "0.5rem",
                    animation: "slideUp 0.2s ease-out",
                  }}
                >
                  <input
                    type="text"
                    value={transferAddr}
                    onChange={(e) => setTransferAddr(e.target.value)}
                    placeholder="G... ADDRESS"
                    style={{
                      flex: 1,
                      padding: "0.6rem",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "transparent",
                      color: "white",
                      fontSize: "0.7rem",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => handleTransfer(nft.tokenId)}
                    disabled={transferLoading || !transferAddr.trim()}
                    style={{
                      padding: "0.6rem 1rem",
                      border: "1px solid white",
                      background: transferLoading || !transferAddr.trim() ? "transparent" : "white",
                      color: transferLoading || !transferAddr.trim() ? "rgba(255,255,255,0.3)" : "black",
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      letterSpacing: "0.1em",
                      cursor: transferLoading || !transferAddr.trim() ? "not-allowed" : "pointer",
                    }}
                  >
                    {transferLoading ? "..." : "SEND"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {transferStatus && (
        <p
          style={{
            marginTop: "1rem",
            fontSize: "0.65rem",
            textAlign: "center",
            color: transferStatus.includes("Done") ? "var(--green)" : "var(--text-muted)",
            letterSpacing: "0.05em",
          }}
        >
          {transferStatus.toUpperCase()}
        </p>
      )}
    </div>
  );
}
