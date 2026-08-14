import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArayKoPo NFT | Multi-Chain NFT Explorer",
  description: "Explore, mint, and trade NFTs across Ethereum, Solana, Stellar, and more. One interface, every chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full overflow-x-hidden scroll-smooth snap-y snap-mandatory">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
