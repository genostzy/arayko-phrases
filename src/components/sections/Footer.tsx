"use client";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="48" stroke="white" strokeWidth="1.5" />
                <path d="M30 65 L50 30 L70 65" stroke="white" strokeWidth="2.5" fill="none" />
                <circle cx="50" cy="50" r="5" fill="white" />
              </svg>
              <span className="text-sm font-bold tracking-[0.15em]">STELLAR NFT</span>
            </div>
            <p className="text-xs text-white/30 leading-relaxed max-w-sm">
              A multi-chain NFT explorer. Browse, mint, and trade digital
              assets across Ethereum, Solana, Stellar, and more.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-[0.65rem] tracking-[0.2em] text-white/50 font-bold mb-4">
              EXPLORE
            </h4>
            <ul className="space-y-2">
              {["Ethereum", "Solana", "Stellar", "Polygon", "Base", "Bitcoin"].map(
                (chain) => (
                  <li key={chain}>
                    <a
                      href="#chains"
                      className="text-xs text-white/30 hover:text-white transition-colors"
                    >
                      {chain}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-[0.65rem] tracking-[0.2em] text-white/50 font-bold mb-4">
              RESOURCES
            </h4>
            <ul className="space-y-2">
              {[
                { label: "Stellar Docs", href: "https://developers.stellar.org" },
                { label: "Freighter", href: "https://www.freighter.app" },
                { label: "Stellar Lab", href: "https://lab.stellar.org" },
                { label: "Testnet Explorer", href: "https://stellar.expert" },
              ].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/30 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[0.6rem] tracking-[0.15em] text-white/20">
            STELLAR NFT &copy; 2026. ALL RIGHTS RESERVED.
          </p>
          <div className="flex gap-6">
            {["Twitter", "Discord", "GitHub"].map((social) => (
              <a
                key={social}
                href="#"
                className="text-[0.6rem] tracking-[0.15em] text-white/20 hover:text-white transition-colors"
              >
                {social.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
