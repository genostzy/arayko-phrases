"use client";

import { useEffect, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { NetworkStatus } from "@/components/NetworkStatus";
import { NFTMinter } from "@/components/NFTMinter";
import { NFTGallery } from "@/components/NFTGallery";
import { BrowseNFTs } from "@/components/BrowseNFTs";

const TABS = ["MINT", "MY NFTS", "BROWSE"] as const;
type Tab = (typeof TABS)[number];

export default function MarketplaceSection() {
  const [mounted, setMounted] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<Tab>("MINT");

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section
      id="marketplace"
      className="relative py-24 md:py-32 border-t border-white/5 scroll-mt-16"
    >
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <span className="text-sm tracking-[0.3em] text-green-500 font-bold block mb-4">
          02 / MARKETPLACE
        </span>
        <h2 className="text-4xl md:text-6xl font-black tracking-[-0.03em] mb-8">
          MINT &amp;
          <br />
          COLLECT
        </h2>
        <p className="text-base text-white/50 max-w-lg mx-auto mb-12 leading-relaxed">
          Connect your Stellar wallet to mint, browse, and manage your
          ArayKoPo Phrase NFTs.
        </p>

        <div
          className="inline-flex flex-col items-center gap-4 mb-8"
          style={{
            opacity: mounted ? 1 : 0,
            animation: mounted ? "fadeInUp 0.6s ease-out forwards" : "none",
          }}
        >
          <WalletConnect onConnect={setWalletAddress} />
          <NetworkStatus walletAddress={walletAddress} />
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-4 mb-16">
          {[
            "Non-Custodial",
            "Secure Signing",
            "On-Chain Provenance",
            "Soroban Smart Contracts",
          ].map((feature) => (
            <span
              key={feature}
              className="px-4 py-2 border border-white/10 text-sm tracking-[0.15em] text-white/50"
            >
              {feature.toUpperCase()}
            </span>
          ))}
        </div>

        {/* NFT dashboard */}
        <div className="text-left border border-white/10 bg-[#0a0a0a]/60 backdrop-blur-sm p-6 md:p-10">
          <div className="flex gap-2 mb-8 justify-center flex-wrap">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm tracking-[0.15em] font-bold border transition-all ${
                  tab === t
                    ? "border-white bg-white text-black"
                    : "border-white/10 text-white/50 hover:border-white/30"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "MINT" && (
            <NFTMinter
              walletAddress={walletAddress}
              onMinted={() => setRefreshKey((k) => k + 1)}
            />
          )}
          {tab === "MY NFTS" && (
            <NFTGallery walletAddress={walletAddress} refreshKey={refreshKey} />
          )}
          {tab === "BROWSE" && (
            <BrowseNFTs walletAddress={walletAddress} refreshKey={refreshKey} />
          )}
        </div>
      </div>
    </section>
  );
}
