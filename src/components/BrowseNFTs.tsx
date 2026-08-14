"use client";

import { useState, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org:443";

interface BrowseNFTsProps {
  walletAddress: string | null;
  refreshKey: number;
}

interface NFT {
  tokenId: number;
  uri: string;
  owner: string;
}

export function BrowseNFTs({ walletAddress, refreshKey }: BrowseNFTsProps) {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalSupply, setTotalSupply] = useState(0);
  const [searchId, setSearchId] = useState("");
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

  const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID;
  const isConfigured = CONTRACT_ID && CONTRACT_ID !== "YOUR_CONTRACT_ID_HERE";

  useEffect(() => {
    if (isConfigured) fetchAllNFTs();
  }, [refreshKey, CONTRACT_ID]);

  async function fetchAllNFTs() {
    if (!isConfigured) return;
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

      if (supply === 0) {
        setNfts([]);
        setLoading(false);
        return;
      }

      const tokens: NFT[] = [];
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
                const d = dummy();
                return new StellarSdk.TransactionBuilder(d, {
                  fee: StellarSdk.BASE_FEE,
                  networkPassphrase: StellarSdk.Networks.TESTNET,
                })
                  .addOperation(contract.call("owner_of", StellarSdk.nativeToScVal(tokenId, { type: "u32" })))
                  .setTimeout(30)
                  .build();
              })(),
              (() => {
                const d = dummy();
                return new StellarSdk.TransactionBuilder(d, {
                  fee: StellarSdk.BASE_FEE,
                  networkPassphrase: StellarSdk.Networks.TESTNET,
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

      setNfts(tokens);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function searchToken() {
    const id = parseInt(searchId);
    if (isNaN(id) || id < 0 || !isConfigured) return;

    setLoading(true);
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
      const contract = new StellarSdk.Contract(CONTRACT_ID!);
      const dummy = () =>
        new StellarSdk.Account(
          "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          "0"
        );

      const [ownerTx, uriTx] = await Promise.all([
        (() => {
          const d = dummy();
          return new StellarSdk.TransactionBuilder(d, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET,
          })
            .addOperation(contract.call("owner_of", StellarSdk.nativeToScVal(id, { type: "u32" })))
            .setTimeout(30)
            .build();
        })(),
        (() => {
          const d = dummy();
          return new StellarSdk.TransactionBuilder(d, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET,
          })
            .addOperation(contract.call("token_uri", StellarSdk.nativeToScVal(id, { type: "u32" })))
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

      setSelectedNFT(owner ? { tokenId: id, uri, owner } : null);
    } catch {
      setSelectedNFT(null);
    } finally {
      setLoading(false);
    }
  }

  const paginatedNFTs = nfts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(nfts.length / PAGE_SIZE);

  return (
    <>
      <div style={{ width: "100%" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "0.9rem",
                fontWeight: 800,
                letterSpacing: "0.2em",
                marginBottom: "0.5rem",
              }}
            >
              BROWSE
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              {totalSupply} NFT{totalSupply !== 1 ? "S" : ""} MINTED
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="number"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="#"
              min="0"
              style={{
                width: "70px",
                padding: "0.6rem",
                border: "2px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "white",
                fontSize: "0.95rem",
                fontFamily: "monospace",
                outline: "none",
              }}
              onKeyDown={(e) => e.key === "Enter" && searchToken()}
              onFocus={(e) => (e.target.style.borderColor = "white")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <button
              onClick={searchToken}
              disabled={loading || searchId === ""}
              style={{
                padding: "0.6rem 1rem",
                border: "2px solid white",
                background: "transparent",
                color: "white",
                fontSize: "0.8rem",
                fontWeight: 800,
                letterSpacing: "0.15em",
                cursor: "pointer",
                transition: "all 0.3s",
                opacity: loading || searchId === "" ? 0.3 : 1,
              }}
              onMouseEnter={(e) => {
                if (searchId && !loading) {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.color = "black";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "white";
              }}
            >
              GO
            </button>
          </div>
        </div>

        {/* Search Result */}
        {selectedNFT && (
          <div
            style={{
              marginBottom: "2rem",
              border: "2px solid var(--accent)",
              animation: "slideUp 0.3s ease-out",
            }}
          >
            <div style={{ display: "flex" }}>
              {selectedNFT.uri && (
                <div
                  style={{
                    width: 150,
                    height: 150,
                    flexShrink: 0,
                    background: `url(${selectedNFT.uri}) center/cover no-repeat`,
                  }}
                />
              )}
              <div style={{ flex: 1, padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "1rem", fontWeight: 800 }}>#{selectedNFT.tokenId}</span>
                  <button
                    onClick={() => setSelectedNFT(null)}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1rem" }}
                  >
                    x
                  </button>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace", wordBreak: "break-all" }}>
                  {selectedNFT.owner}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Grid */}
        {loading && nfts.length === 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.5rem" }}>
            {Array.from({ length: 6 }).map((_, i) => (
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
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              {isConfigured ? "NO NFTS YET" : "DEPLOY CONTRACT FIRST"}
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: "0.5rem",
              }}
            >
              {paginatedNFTs.map((nft) => (
                <div
                  key={nft.tokenId}
                  onClick={() => setSelectedNFT(nft)}
                  style={{
                    border: walletAddress && nft.owner === walletAddress ? "2px solid var(--green)" : "2px solid rgba(255,255,255,0.1)",
                    background: "var(--bg-light)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                    animation: "scaleIn 0.3s ease-out",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "white";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor =
                      walletAddress && nft.owner === walletAddress ? "var(--green)" : "rgba(255,255,255,0.1)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "1",
                      background: nft.uri ? `url(${nft.uri}) center/cover no-repeat` : "var(--bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {!nft.uri && <span style={{ fontSize: "1.5rem", opacity: 0.1 }}>&#x2726;</span>}
                  </div>
                  <div style={{ padding: "0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 800 }}>#{nft.tokenId}</span>
                      {walletAddress && nft.owner === walletAddress && (
                        <span style={{ fontSize: "0.7rem", color: "var(--green)", letterSpacing: "0.1em" }}>YOURS</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "1rem",
                  marginTop: "2rem",
                }}
              >
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "transparent",
                    color: page === 0 ? "rgba(255,255,255,0.2)" : "white",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    letterSpacing: "0.1em",
                    cursor: page === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  PREV
                </button>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", letterSpacing: "0.1em" }}>
                  {page + 1}/{totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "transparent",
                    color: page >= totalPages - 1 ? "rgba(255,255,255,0.2)" : "white",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    letterSpacing: "0.1em",
                    cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                  }}
                >
                  NEXT
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {selectedNFT && (
        <div
          onClick={() => setSelectedNFT(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 400,
              width: "100%",
              border: "2px solid rgba(255,255,255,0.1)",
              background: "var(--bg)",
              animation: "scaleIn 0.3s ease-out",
            }}
          >
            {selectedNFT.uri && (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  background: `url(${selectedNFT.uri}) center/cover no-repeat`,
                }}
              />
            )}
            <div style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
                  #{selectedNFT.tokenId}
                </h3>
                <button
                  onClick={() => setSelectedNFT(null)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}
                >
                  x
                </button>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: "0.3rem" }}>
                  OWNER
                </p>
                <p style={{ fontSize: "0.9rem", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.5 }}>
                  {selectedNFT.owner}
                </p>
              </div>

              {selectedNFT.uri && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: "0.3rem" }}>
                    METADATA
                  </p>
                  <a
                    href={selectedNFT.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "0.85rem", color: "var(--accent)", textDecoration: "none", wordBreak: "break-all" }}
                  >
                    {selectedNFT.uri}
                  </a>
                </div>
              )}

              <a
                href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "0.8rem",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textDecoration: "none",
                  transition: "all 0.2s",
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
                VIEW ON STELLAR EXPERT
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
