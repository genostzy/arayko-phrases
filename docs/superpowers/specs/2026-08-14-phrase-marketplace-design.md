# ArayKoPo Phrase Marketplace — Design

## Problem

The site currently brands itself as "Six Phrases. One Collection." but the
actual mint flow is a generic, unrestricted NFT minter: anyone with a funded
testnet account can call `mint()` directly against the deployed contract
(bypassing the UI entirely) and create unlimited tokens with arbitrary
image URLs, for free. There's no connection between the six curated
`Phrase#1.jpg`–`Phrase#6.jpg` images and what's actually mintable, no
pricing, and no buy/sell mechanism despite "Marketplace" branding.

## Goal

A primary-sale storefront for exactly six 1-of-1 NFTs, one per Phrase
image:

- Only the admin (whoever deploys and initializes the contract) can mint.
  Minting a phrase and listing it for sale happen in the same call — the
  admin sets a price at mint time.
- Anyone else can only buy. Buying pays the admin in XLM and transfers
  the NFT to the buyer atomically — both happen or neither does.
- Once a phrase is minted it can never be minted again (fixed 6-slot
  model, contract-enforced, not just hidden in the UI).
- Owners (including buyers, after purchase) can still do a plain
  wallet-to-wallet `transfer`, but can't re-list through this contract —
  resale/secondary listings are out of scope.

## Non-goals

- Secondary market / resale listings by non-admin owners.
- Multiple editions per phrase (each phrase is unique, 1-of-1).
- Non-XLM payment methods.
- Off-chain payment coordination (rejected approach — see chat history:
  atomic on-chain buy was chosen over an off-chain-trust or honor-system
  model).
- IPFS upload UI / Pinata integration — the six phrase images are local
  static assets (`/public/images/Phrase%23N.jpg`), no user-supplied
  arbitrary URLs anymore, so this is dropped along with the (already
  unused) Pinata keys in `.env.local`.

## Contract (`contracts/nft/src/lib.rs`)

Replace the open counter-based mint with a fixed 6-slot model. Token ID
== phrase ID (0–5), so no separate counter is needed for minting, though
`total_supply` is still tracked for the UI's convenience.

### Storage

- `ADMIN: Address` — set once in `initialize`.
- `NATIVE_TOKEN: Address` — the native XLM Stellar Asset Contract address
  for whichever network this is deployed to, set once in `initialize` so
  `buy()` always pays in real XLM regardless of what a caller might try
  to pass in.
- `NAME`, `SYMBOL`, `COUNTER` — as before.
- `TokenOwner(phrase_id)`, `TokenURI(phrase_id)`, `Balance(address)` — as
  before, keyed by phrase_id (0–5) instead of an arbitrary counter.
- `Price(phrase_id) -> i128` — set at mint time.
- `ForSale(phrase_id) -> bool` — true after mint, false after `buy`.

### Interface

```
initialize(admin: Address, nft_name: String, nft_symbol: String, native_token: Address)
mint(phrase_id: u32, uri: String, price: i128) -> u32
  - admin.require_auth()
  - panics if phrase_id >= 6
  - panics if phrase_id already minted (TokenOwner already set)
  - sets owner = admin, price = price, for_sale = true
buy(buyer: Address, token_id: u32)
  - buyer.require_auth()
  - panics if token doesn't exist / isn't for sale
  - panics if buyer == current owner
  - token::Client(native_token).transfer(&buyer, &admin, &price)
  - sets owner = buyer, for_sale = false, adjusts balances
transfer(from: Address, to: Address, token_id: u32)  — unchanged, existing owner-only move
admin(env) -> Address
owner_of(env, token_id) -> Option<Address>            — unchanged
token_uri(env, token_id) -> Option<String>             — unchanged
price_of(env, token_id) -> Option<i128>
is_for_sale(env, token_id) -> bool
balance_of(env, owner) -> u32                          — unchanged
total_supply(env) -> u32                                — unchanged
```

### Security model

`admin.require_auth()` and `buyer.require_auth()` are Soroban's
cryptographic authorization primitive — the transaction must carry a
signature from that specific address, or the call panics before any state
changes. This means the admin-only mint restriction holds even if someone
calls the contract directly, bypassing the frontend entirely. The
frontend's admin-check (comparing the connected wallet to `admin()`) is
purely a UX convenience — hide buttons that would fail — not the actual
security boundary.

The atomic buy is possible because Soroban contracts can invoke other
contracts synchronously within one transaction, including the native XLM
Stellar Asset Contract. If the `token::Client.transfer` call fails (e.g.
insufficient buyer balance), the whole transaction — including the
ownership change — reverts. There's no intermediate state where payment
happened but ownership didn't, or vice versa.

## Frontend

Replace the three-tab dashboard (`MarketplaceSection.tsx`'s
Mint/My&nbsp;NFTs/Browse tabs backed by `NFTMinter.tsx`, `NFTGallery.tsx`,
`BrowseNFTs.tsx`) with a single grid of exactly 6 cards, one per phrase.
Delete those three components — their unbounded-scan-and-filter logic no
longer applies to a fixed 6-item catalog.

New component (`PhraseGrid.tsx` or similar) reads all 6 phrases' state in
parallel (`owner_of`, `price_of`, `is_for_sale`, `token_uri` for IDs 0–5)
and the contract's `admin()`, compares against the connected wallet, and
renders each card in one of these states:

| Connected wallet | Phrase state | Card shows |
|---|---|---|
| admin | not minted | price input + "List for Sale" (calls `mint`) |
| not admin | not minted | "Not available yet" |
| admin | for sale (their own listing) | "Listed — X XLM" badge |
| not admin | for sale | price + "Buy" button (calls `buy`) |
| anyone | sold, owned by connected wallet | "Owned by you" badge |
| anyone | sold, owned by someone else | "Sold" badge |
| not connected | any | same as "not admin" states, buy/list disabled with a connect-wallet prompt |

`WalletConnect.tsx` and `NetworkStatus.tsx` are unchanged.
`AboutSection.tsx` already shows the 6 phrase images and doesn't need
changes.

Price entry in the admin's "List for Sale" flow is in whole XLM
(human-friendly); converted to stroops (× 10,000,000) before calling
`mint`. Prices read back from the contract are converted back to XLM for
display.

## Deployment & migration

The existing testnet contract (`CAVCYVZCZFFFTEL52Q7QCMYBHEJMDRT4BSUW7PBR7WWENZBBCGFWOE7L`)
cannot be patched in place — Soroban contracts are immutable and this one
has no upgrade mechanism — so this ships as a new contract with a new ID.

1. Update `contracts/nft/src/lib.rs` with the new interface above.
2. User builds and deploys via `stellar contract build` /
   `stellar contract deploy` (their own signing key — not something
   Claude has or should ask for).
3. User runs `initialize` with their own admin address, name/symbol, and
   the testnet native XLM SAC address, resolved via
   `stellar contract id asset --asset native --network testnet` at
   implementation time rather than hardcoded here from memory.
4. User reports the new contract ID back; `.env.local`'s
   `NEXT_PUBLIC_CONTRACT_ID` is updated to it.
5. `NEXT_PUBLIC_PINATA_API_KEY` / `NEXT_PUBLIC_PINATA_SECRET` are removed
   from `.env.local` (no longer used, and were already flagged as leaked
   in git history in an earlier session — this doesn't retroactively fix
   that, only stops them being live-configured going forward).
6. The old contract and anything minted against it is abandoned — testnet,
   no real value at stake.

## Testing

- Rust unit tests (`soroban-sdk` testutils, mocking the native token
  client) covering: non-admin mint attempt panics, duplicate phrase_id
  mint panics, out-of-range phrase_id panics, successful buy moves both
  payment and ownership atomically, buying a not-for-sale token panics,
  buyer buying their own listing panics.
- Frontend: build/typecheck verification and UI-state review (which is
  what's actually checkable without a funded testnet wallet in this
  environment) — the live "click Buy in Freighter and watch the atomic
  swap" needs to be done by the user, since Claude has no signing key or
  funded testnet account.
