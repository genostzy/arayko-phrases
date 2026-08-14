"use client";

export interface Chain {
  id: string;
  name: string;
  symbol: string;
  color: string;
  icon: string;
  description: string;
  ecosystem: string;
  nftCount: string;
  volume: string;
  website: string;
  explorer: string;
  type: "evm" | "non-evm";
}

export const chains: Chain[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    color: "#627eea",
    icon: "⬡",
    description: "The original smart contract platform. Home to the largest NFT ecosystem.",
    ecosystem: "EVM",
    nftCount: "12.4M+",
    volume: "$4.2B",
    website: "https://ethereum.org",
    explorer: "https://etherscan.io",
    type: "evm",
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    color: "#00ffa3",
    icon: "◎",
    description: "High-performance blockchain with fast settlements and low fees.",
    ecosystem: "SVM",
    nftCount: "8.7M+",
    volume: "$1.8B",
    website: "https://solana.com",
    explorer: "https://solscan.io",
    type: "non-evm",
  },
  {
    id: "stellar",
    name: "Stellar",
    symbol: "XLM",
    color: "#14b6e7",
    icon: "★",
    description: "Fast, sustainable payments network with Soroban smart contracts.",
    ecosystem: "Soroban",
    nftCount: "24K+",
    volume: "$12M",
    website: "https://stellar.org",
    explorer: "https://stellar.expert",
    type: "non-evm",
  },
  {
    id: "polygon",
    name: "Polygon",
    symbol: "MATIC",
    color: "#8247e5",
    icon: "⬠",
    description: "Ethereum's scaling solution with low gas fees and fast transactions.",
    ecosystem: "EVM",
    nftCount: "3.2M+",
    volume: "$580M",
    website: "https://polygon.technology",
    explorer: "https://polygonscan.com",
    type: "evm",
  },
  {
    id: "base",
    name: "Base",
    symbol: "ETH",
    color: "#0052ff",
    icon: "◧",
    description: "Coinbase's L2 built on the OP Stack. Fast, low-cost Ethereum.",
    ecosystem: "EVM",
    nftCount: "1.8M+",
    volume: "$340M",
    website: "https://base.org",
    explorer: "https://basescan.org",
    type: "evm",
  },
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    color: "#f7931a",
    icon: "₿",
    description: "The first blockchain. Ordinals and BRC-20 bringing NFTs to BTC.",
    ecosystem: "Ordinals",
    nftCount: "680K+",
    volume: "$290M",
    website: "https://bitcoin.org",
    explorer: "https://mempool.space",
    type: "non-evm",
  },
];
