"use client";

import { useEffect, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { NetworkStatus } from "@/components/NetworkStatus";
import PhraseGrid from "@/components/PhraseGrid";

export default function MarketplaceSection() {
  const [mounted, setMounted] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section
      id="marketplace"
      className="relative py-24 md:py-32 border-t border-white/5 scroll-mt-16"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 text-center">
        <span className="text-sm tracking-[0.3em] text-green-500 font-bold block mb-4">
          02 / MARKETPLACE
        </span>
        <h2 className="text-4xl md:text-6xl font-black tracking-[-0.03em] mb-8">
          OWN A
          <br />
          PHRASE
        </h2>
        <p className="text-base text-white/50 max-w-lg mx-auto mb-12 leading-relaxed">
          Six unique Phrase NFTs. Connect your Stellar wallet to buy one, or
          — if you're the collection owner — list them for sale.
        </p>

        <div
          className="inline-flex flex-col items-center gap-4 mb-12"
          style={{
            opacity: mounted ? 1 : 0,
            animation: mounted ? "fadeInUp 0.6s ease-out forwards" : "none",
          }}
        >
          <WalletConnect onConnect={setWalletAddress} />
          <NetworkStatus walletAddress={walletAddress} />
        </div>

        <PhraseGrid walletAddress={walletAddress} />
      </div>
    </section>
  );
}
