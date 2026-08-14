import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArayKoPo NFT | Phrases Marketplace",
  description: "Mint, own, and trade ArayKoPo Phrase NFTs, fully on-chain on the Stellar blockchain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full overflow-x-hidden scroll-smooth">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
