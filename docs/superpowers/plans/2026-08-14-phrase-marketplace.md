# Phrase Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the open, unrestricted NFT minter into a 6-slot admin-only mint + atomic-buy marketplace for the ArayKoPo Phrases collection.

**Architecture:** Rewrite the Soroban contract around a fixed 6-slot model (token ID = phrase ID 0-5) with `admin.require_auth()`-gated minting and a `buy()` that atomically swaps native XLM payment for NFT ownership via the native Stellar Asset Contract. Replace the frontend's 3-tab dashboard with a single 6-card grid driven by the new interface.

**Tech Stack:** Rust / soroban-sdk 21.7.7 (contract), Next.js 14 / `@stellar/stellar-sdk` / `@stellar/freighter-api` (frontend).

**Spec:** `docs/superpowers/specs/2026-08-14-phrase-marketplace-design.md`

## Global Constraints

- Exactly 6 phrases, 1-of-1 each, token ID == phrase ID (0-5).
- Individual XLM price per phrase, set by admin at mint time.
- `mint` and `transfer`'s `from` must be enforced via real `require_auth()` — not just UI gating.
- `buy` must be atomic: native XLM payment and NFT ownership change happen in the same contract call, no intermediate state.
- No secondary listings by non-admin owners (out of scope per spec).
- No Pinata/IPFS upload UI — the 6 phrase images are local static assets.

---

### Task 1: Contract state model, initialize, and admin-gated mint

**Files:**
- Modify: `contracts/nft/src/lib.rs`

**Interfaces:**
- Produces: `PhraseMarketplace::initialize(admin: Address, nft_name: String, nft_symbol: String, native_token: Address)`, `::admin(env) -> Address`, `::mint(phrase_id: u32, uri: String, price: i128) -> u32`, `::owner_of(token_id: u32) -> Option<Address>`, `::token_uri(token_id: u32) -> Option<String>`, `::price_of(token_id: u32) -> Option<i128>`, `::is_for_sale(token_id: u32) -> bool`, `::balance_of(owner: Address) -> u32`, `::name(env) -> String`, `::symbol(env) -> String`, `::total_supply(env) -> u32`
- `PHRASE_COUNT: u32 = 6` — public const later tasks reference

- [ ] **Step 1: Replace the whole contract body (state + storage keys + initialize/admin/mint/views) up through `total_supply`, keeping `transfer` for Task 3 to fix**

Replace everything in `contracts/nft/src/lib.rs` above the `#[cfg(test)]` module with:

```rust
#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol};

pub const PHRASE_COUNT: u32 = 6;

const ADMIN: Symbol = symbol_short!("ADMIN");
const NATIVE: Symbol = symbol_short!("NATIVE");
const NAME: Symbol = symbol_short!("NAME");
const SYMBOL: Symbol = symbol_short!("SYMBOL");
const COUNTER: Symbol = symbol_short!("COUNTER");

#[contracttype]
pub enum DataKey {
    TokenOwner(u32),
    TokenURI(u32),
    TokenPrice(u32),
    ForSale(u32),
    Balance(Address),
}

#[contract]
pub struct PhraseMarketplace;

#[contractimpl]
impl PhraseMarketplace {
    pub fn initialize(env: Env, admin: Address, nft_name: String, nft_symbol: String, native_token: Address) {
        env.storage().instance().set(&NAME, &nft_name);
        env.storage().instance().set(&SYMBOL, &nft_symbol);
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&NATIVE, &native_token);
        env.storage().instance().set(&COUNTER, &0u32);
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&NAME).unwrap_or(String::from_str(&env, "NFT"))
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&SYMBOL).unwrap_or(String::from_str(&env, "NFT"))
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&ADMIN).expect("Not initialized")
    }

    pub fn mint(env: Env, phrase_id: u32, uri: String, price: i128) -> u32 {
        let admin: Address = env.storage().instance().get(&ADMIN).expect("Not initialized");
        admin.require_auth();

        if phrase_id >= PHRASE_COUNT {
            panic!("Invalid phrase id");
        }
        if price <= 0 {
            panic!("Price must be positive");
        }
        if env.storage().instance().has(&DataKey::TokenOwner(phrase_id)) {
            panic!("Phrase already minted");
        }

        env.storage().instance().set(&DataKey::TokenOwner(phrase_id), &admin);
        env.storage().instance().set(&DataKey::TokenURI(phrase_id), &uri);
        env.storage().instance().set(&DataKey::TokenPrice(phrase_id), &price);
        env.storage().instance().set(&DataKey::ForSale(phrase_id), &true);

        let balance: u32 = env.storage().instance().get(&DataKey::Balance(admin.clone())).unwrap_or(0u32);
        env.storage().instance().set(&DataKey::Balance(admin.clone()), &(balance + 1));

        let counter: u32 = env.storage().instance().get(&COUNTER).unwrap_or(0u32);
        env.storage().instance().set(&COUNTER, &(counter + 1));

        phrase_id
    }

    pub fn owner_of(env: Env, token_id: u32) -> Option<Address> {
        env.storage().instance().get(&DataKey::TokenOwner(token_id))
    }

    pub fn token_uri(env: Env, token_id: u32) -> Option<String> {
        env.storage().instance().get(&DataKey::TokenURI(token_id))
    }

    pub fn price_of(env: Env, token_id: u32) -> Option<i128> {
        env.storage().instance().get(&DataKey::TokenPrice(token_id))
    }

    pub fn is_for_sale(env: Env, token_id: u32) -> bool {
        env.storage().instance().get(&DataKey::ForSale(token_id)).unwrap_or(false)
    }

    pub fn balance_of(env: Env, owner: Address) -> u32 {
        env.storage().instance().get(&DataKey::Balance(owner)).unwrap_or(0u32)
    }

    pub fn transfer(env: Env, from: Address, to: Address, token_id: u32) {
        let current_owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenOwner(token_id))
            .expect("Token does not exist");

        if current_owner != from {
            panic!("Not token owner");
        }

        env.storage().instance().set(&DataKey::TokenOwner(token_id), &to);

        let from_balance: u32 = env.storage().instance().get(&DataKey::Balance(from.clone())).unwrap_or(0u32);
        env.storage().instance().set(&DataKey::Balance(from), &(from_balance - 1));

        let to_balance: u32 = env.storage().instance().get(&DataKey::Balance(to.clone())).unwrap_or(0u32);
        env.storage().instance().set(&DataKey::Balance(to), &(to_balance + 1));
    }

    pub fn total_supply(env: Env) -> u32 {
        env.storage().instance().get(&COUNTER).unwrap_or(0u32)
    }
}
```

Note: `transfer` above is left as the *old* buggy version (no `require_auth`, doesn't clear a stale `for_sale` flag) — Task 3 fixes it deliberately as its own reviewable step. `buy` doesn't exist yet — Task 2 adds it.

- [ ] **Step 2: Replace the existing `#[cfg(test)] mod tests` block with**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn setup(env: &Env) -> (PhraseMarketplaceClient<'_>, Address, Address) {
        let contract_id = env.register_contract(None, PhraseMarketplace);
        let client = PhraseMarketplaceClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let native = Address::generate(env);
        client.initialize(
            &admin,
            &String::from_str(env, "ArayKoPo Phrases"),
            &String::from_str(env, "ARKPO"),
            &native,
        );
        (client, admin, native)
    }

    #[test]
    fn test_initialize_sets_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _native) = setup(&env);
        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn test_mint_requires_admin_authorization() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _native) = setup(&env);

        let token_id = client.mint(&0u32, &String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);

        assert_eq!(token_id, 0);
        assert_eq!(client.owner_of(&0u32), Some(admin.clone()));
        assert!(client.is_for_sale(&0u32));
        assert_eq!(client.price_of(&0u32), Some(500_0000000i128));
        assert_eq!(client.balance_of(&admin), 1);
        assert_eq!(client.total_supply(), 1);

        let auths = env.auths();
        assert_eq!(auths.len(), 1);
        assert_eq!(auths[0].0, admin);
    }

    #[test]
    #[should_panic(expected = "Phrase already minted")]
    fn test_mint_rejects_duplicate_phrase() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _native) = setup(&env);

        client.mint(&0u32, &String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);
        client.mint(&0u32, &String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);
    }

    #[test]
    #[should_panic(expected = "Invalid phrase id")]
    fn test_mint_rejects_out_of_range_phrase_id() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _native) = setup(&env);

        client.mint(&6u32, &String::from_str(&env, "/images/Phrase%237.jpg"), &500_0000000i128);
    }

    #[test]
    #[should_panic(expected = "Price must be positive")]
    fn test_mint_rejects_zero_price() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _native) = setup(&env);

        client.mint(&0u32, &String::from_str(&env, "/images/Phrase%231.jpg"), &0i128);
    }
}
```

- [ ] **Step 3: Run the tests, verify the new ones pass**

Run: `cd contracts/nft && cargo test`
Expected: all tests pass (including the pre-existing `test_transfer` — it still works since `transfer`'s behavior hasn't changed yet).

- [ ] **Step 4: Commit**

```bash
git add contracts/nft/src/lib.rs
git commit -m "Rewrite mint as admin-gated, 6-slot phrase model"
```

---

### Task 2: Atomic `buy()`

**Files:**
- Modify: `contracts/nft/src/lib.rs`

**Interfaces:**
- Consumes: `DataKey::{TokenOwner, ForSale, TokenPrice, Balance}` from Task 1; `NATIVE` storage key from Task 1's `initialize`
- Produces: `PhraseMarketplace::buy(buyer: Address, token_id: u32)`

- [ ] **Step 1: Add failing tests to the `tests` module (append inside `mod tests { ... }`, after the Task 1 tests)**

```rust
    #[test]
    fn test_buy_transfers_ownership_and_payment() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PhraseMarketplace);
        let client = PhraseMarketplaceClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);

        let sac_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(sac_admin);
        let native = sac.address();
        let native_client = token::StellarAssetClient::new(&env, &native);
        native_client.mint(&buyer, &1_000_0000000i128);

        client.initialize(
            &admin,
            &String::from_str(&env, "ArayKoPo Phrases"),
            &String::from_str(&env, "ARKPO"),
            &native,
        );
        let price = 500_0000000i128;
        client.mint(&0u32, &String::from_str(&env, "/images/Phrase%231.jpg"), &price);

        client.buy(&buyer, &0u32);

        assert_eq!(client.owner_of(&0u32), Some(buyer.clone()));
        assert!(!client.is_for_sale(&0u32));
        assert_eq!(client.balance_of(&buyer), 1);
        assert_eq!(client.balance_of(&admin), 0);

        let native_view = token::TokenClient::new(&env, &native);
        assert_eq!(native_view.balance(&buyer), 1_000_0000000i128 - price);
        assert_eq!(native_view.balance(&admin), price);
    }

    #[test]
    #[should_panic(expected = "Token is not for sale")]
    fn test_buy_rejects_not_for_sale() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PhraseMarketplace);
        let client = PhraseMarketplaceClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let native = sac.address();

        client.initialize(
            &admin,
            &String::from_str(&env, "ArayKoPo Phrases"),
            &String::from_str(&env, "ARKPO"),
            &native,
        );
        // phrase_id 0 was never minted, so it's not for sale.
        client.buy(&buyer, &0u32);
    }

    #[test]
    #[should_panic(expected = "Already own this token")]
    fn test_buy_rejects_self_purchase() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PhraseMarketplace);
        let client = PhraseMarketplaceClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let native = sac.address();

        client.initialize(
            &admin,
            &String::from_str(&env, "ArayKoPo Phrases"),
            &String::from_str(&env, "ARKPO"),
            &native,
        );
        client.mint(&0u32, &String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);

        client.buy(&admin, &0u32);
    }
```

- [ ] **Step 2: Run tests, verify the three new ones fail**

Run: `cd contracts/nft && cargo test buy`
Expected: FAIL — `buy` doesn't exist yet (compile error).

- [ ] **Step 3: Add `buy` to the `impl PhraseMarketplace` block, directly after `mint`**

```rust
    pub fn buy(env: Env, buyer: Address, token_id: u32) {
        buyer.require_auth();

        let owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenOwner(token_id))
            .expect("Token does not exist");

        if owner == buyer {
            panic!("Already own this token");
        }

        let for_sale: bool = env.storage().instance().get(&DataKey::ForSale(token_id)).unwrap_or(false);
        if !for_sale {
            panic!("Token is not for sale");
        }

        let price: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TokenPrice(token_id))
            .expect("Price not set");

        let native_token: Address = env.storage().instance().get(&NATIVE).expect("Not initialized");
        let token_client = token::TokenClient::new(&env, &native_token);
        token_client.transfer(&buyer, &owner, &price);

        env.storage().instance().set(&DataKey::TokenOwner(token_id), &buyer);
        env.storage().instance().set(&DataKey::ForSale(token_id), &false);

        let seller_balance: u32 = env.storage().instance().get(&DataKey::Balance(owner.clone())).unwrap_or(0u32);
        env.storage().instance().set(&DataKey::Balance(owner), &seller_balance.saturating_sub(1));

        let buyer_balance: u32 = env.storage().instance().get(&DataKey::Balance(buyer.clone())).unwrap_or(0u32);
        env.storage().instance().set(&DataKey::Balance(buyer), &(buyer_balance + 1));
    }
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `cd contracts/nft && cargo test`
Expected: PASS (all tests, including Task 1's).

- [ ] **Step 5: Commit**

```bash
git add contracts/nft/src/lib.rs
git commit -m "Add atomic buy() paying the seller in native XLM"
```

---

### Task 3: Fix `transfer()`'s missing authorization check

**Why this matters:** the *current deployed* contract's `transfer(from, to, token_id)` never calls `from.require_auth()`. Anyone can call it naming any existing owner as `from` and steal that token — owners are public via `owner_of`, so this is fully exploitable, not theoretical. This must be fixed in the rewrite regardless of the marketplace feature.

**Files:**
- Modify: `contracts/nft/src/lib.rs`

**Interfaces:**
- Consumes: `DataKey::{TokenOwner, ForSale, Balance}` from Task 1
- Produces: `PhraseMarketplace::transfer(from: Address, to: Address, token_id: u32)` (same signature, now actually secure)

- [ ] **Step 1: Add failing tests, appended inside `mod tests { ... }`**

```rust
    #[test]
    fn test_transfer_requires_from_authorization() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _native) = setup(&env);
        client.mint(&0u32, &String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);

        let recipient = Address::generate(&env);
        client.transfer(&admin, &recipient, &0u32);

        assert_eq!(client.owner_of(&0u32), Some(recipient.clone()));

        let auths = env.auths();
        assert_eq!(auths.len(), 1);
        assert_eq!(auths[0].0, admin);
    }

    #[test]
    fn test_transfer_clears_stale_for_sale_flag() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _native) = setup(&env);
        client.mint(&0u32, &String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);
        assert!(client.is_for_sale(&0u32));

        let recipient = Address::generate(&env);
        client.transfer(&admin, &recipient, &0u32);

        // Gifted directly instead of bought — must not still look purchasable.
        assert!(!client.is_for_sale(&0u32));
    }
```

- [ ] **Step 2: Run tests, verify `test_transfer_clears_stale_for_sale_flag` fails**

Run: `cd contracts/nft && cargo test transfer`
Expected: `test_transfer_requires_from_authorization` passes already (the existing code happens to produce the right *result*, just without checking auth — this test alone can't tell the difference, which is exactly why the `env.auths()` assertion matters: it will currently fail because nothing required `admin`'s auth). `test_transfer_clears_stale_for_sale_flag` fails because `ForSale` is never cleared today.

- [ ] **Step 3: Update `transfer` in the `impl PhraseMarketplace` block**

Replace the existing `transfer` function with:

```rust
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u32) {
        from.require_auth();

        let current_owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenOwner(token_id))
            .expect("Token does not exist");

        if current_owner != from {
            panic!("Not token owner");
        }

        env.storage().instance().set(&DataKey::TokenOwner(token_id), &to);
        env.storage().instance().set(&DataKey::ForSale(token_id), &false);

        let from_balance: u32 = env.storage().instance().get(&DataKey::Balance(from.clone())).unwrap_or(0u32);
        env.storage().instance().set(&DataKey::Balance(from), &from_balance.saturating_sub(1));

        let to_balance: u32 = env.storage().instance().get(&DataKey::Balance(to.clone())).unwrap_or(0u32);
        env.storage().instance().set(&DataKey::Balance(to), &(to_balance + 1));
    }
```

- [ ] **Step 4: Run the full test suite, verify everything passes**

Run: `cd contracts/nft && cargo test`
Expected: PASS — every test in the file, Task 1 through 3.

- [ ] **Step 5: Commit**

```bash
git add contracts/nft/src/lib.rs
git commit -m "Fix transfer() missing require_auth and stale for-sale flag"
```

---

### Task 4: Build the deployable WASM

**Files:** none changed — verification only.

- [ ] **Step 1: Build the contract**

Run: `cd contracts/nft && stellar contract build`
Expected: succeeds, produces `contracts/nft/target/wasm32v1-none/release/nft.wasm`.

- [ ] **Step 2: Confirm the wasm artifact exists**

Run: `ls -la contracts/nft/target/wasm32v1-none/release/nft.wasm`
Expected: file present, non-zero size.

- [ ] **Step 3: Run the full test suite one more time as a final gate**

Run: `cd contracts/nft && cargo test`
Expected: PASS.

No commit needed (build output isn't tracked; `.gitignore` should already exclude `contracts/nft/target` — if it doesn't, that's a pre-existing repo hygiene issue, not part of this task).

---

### Task 5: Deployment guide

**Files:**
- Create: `contracts/nft/DEPLOY.md`

- [ ] **Step 1: Write the guide**

```markdown
# Deploying the Phrase Marketplace contract

You need one Stellar account that will become the contract's admin — the
only account that can list phrases for sale. You'll use it both from the
CLI (to deploy) and later from Freighter in the browser (to actually list
phrases), so the cleanest path is to generate a fresh one here and import
it into Freighter afterward, rather than exporting an existing wallet's
secret key into the CLI.

## 1. Create and fund your admin identity

```bash
stellar keys generate admin --network testnet --fund
stellar keys public-key admin
```

The second command prints your admin's public address (starts with `G`).
Save it — you'll need it below and when importing into Freighter.

To use this same account in Freighter: `stellar keys secret admin` prints
the secret key (starts with `S`) — import that into Freighter as an
existing account. Treat that output like a password.

## 2. Get the native XLM asset contract address for testnet

```bash
stellar contract id asset --asset native --network testnet
```

Save this address — it's the `--native_token` argument below.

## 3. Build and deploy the contract

From `contracts/nft/`:

```bash
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/nft.wasm \
  --source-account admin \
  --network testnet \
  --alias araykopo_phrases
```

This prints the new contract ID (starts with `C`). Save it.

## 4. Initialize it

```bash
stellar contract invoke \
  --id <CONTRACT_ID_FROM_STEP_3> \
  --source-account admin \
  --network testnet \
  -- initialize \
  --admin <YOUR_ADMIN_ADDRESS_FROM_STEP_1> \
  --nft_name "ArayKoPo Phrases" \
  --nft_symbol "ARKPO" \
  --native_token <NATIVE_TOKEN_ADDRESS_FROM_STEP_2>
```

## 5. Wire it into the frontend

Update `.env.local` in the project root:

```
NEXT_PUBLIC_CONTRACT_ID=<CONTRACT_ID_FROM_STEP_3>
```

Then connect Freighter using the admin account you imported in step 1 —
you should see "List for Sale" controls on the marketplace grid.
```

- [ ] **Step 2: Commit**

```bash
git add contracts/nft/DEPLOY.md
git commit -m "Add contract deployment guide"
```

---

### Task 6: `PhraseGrid.tsx` — the marketplace UI

**Files:**
- Create: `src/components/PhraseGrid.tsx`

**Interfaces:**
- Consumes: `walletAddress: string | null` (from `WalletConnect`'s `onConnect` callback, same as the old dashboard)
- Consumes contract reads: `admin()`, `owner_of(u32)`, `token_uri(u32)`, `price_of(u32)`, `is_for_sale(u32)` — all read via `StellarSdk.SorobanRpc.Server.simulateTransaction` against `NEXT_PUBLIC_CONTRACT_ID`, matching the existing RPC pattern already used in the codebase (see the file being replaced, `BrowseNFTs.tsx`, for the established dummy-account/simulate pattern)
- Consumes contract writes: `mint(phrase_id, uri, price)`, `buy(buyer, token_id)` — built/signed/submitted via `@stellar/freighter-api`'s `signTransaction`, matching the existing pattern in the components this replaces
- Produces: default export `PhraseGrid` component, rendered by `MarketplaceSection.tsx` (Task 7)

There's no frontend test runner in this project (`package.json` has no test script and no test files exist anywhere in `src/`) — this matches the existing codebase convention, so this task is verified via TypeScript compilation (`npm run build`) and manual/programmatic browser checks, not automated tests. Don't introduce a new test framework as part of this task — that's out of scope.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

const RPC_URL = "https://soroban-testnet.stellar.org:443";
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
const STROOPS_PER_XLM = 10_000_000;

const PHRASES = [
  { id: 0, uri: "/images/Phrase%231.jpg", title: "Phrase #1" },
  { id: 1, uri: "/images/Phrase%232.jpg", title: "Phrase #2" },
  { id: 2, uri: "/images/Phrase%233.jpg", title: "Phrase #3" },
  { id: 3, uri: "/images/Phrase%234.jpg", title: "Phrase #4" },
  { id: 4, uri: "/images/Phrase%235.jpg", title: "Phrase #5" },
  { id: 5, uri: "/images/Phrase%236.jpg", title: "Phrase #6" },
];

interface PhraseState {
  id: number;
  owner: string | null;
  price: number | null; // whole XLM, null if never minted
  forSale: boolean;
}

interface PhraseGridProps {
  walletAddress: string | null;
}

function dummyAccount() {
  return new StellarSdk.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
}

function buildSimTx(fn: string, args: StellarSdk.xdr.ScVal[]) {
  const contract = new StellarSdk.Contract(CONTRACT_ID);
  return new StellarSdk.TransactionBuilder(dummyAccount(), {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(30)
    .build();
}

export default function PhraseGrid({ walletAddress }: PhraseGridProps) {
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [phrases, setPhrases] = useState<PhraseState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [priceInputs, setPriceInputs] = useState<Record<number, string>>({});
  const [status, setStatus] = useState("");

  const isConfigured = !!CONTRACT_ID;

  const refresh = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);

      const adminTx = buildSimTx("admin", []);
      const adminResult = await server.simulateTransaction(adminTx);
      let admin: string | null = null;
      if ("result" in adminResult && adminResult.result) {
        const val = StellarSdk.scValToNative(adminResult.result.retval);
        if (val && typeof val === "object" && "toString" in val) admin = val.toString();
      }
      setAdminAddress(admin);

      const results = await Promise.all(
        PHRASES.map(async (p) => {
          const [ownerRes, priceRes, forSaleRes] = await Promise.all([
            server.simulateTransaction(
              buildSimTx("owner_of", [StellarSdk.nativeToScVal(p.id, { type: "u32" })])
            ),
            server.simulateTransaction(
              buildSimTx("price_of", [StellarSdk.nativeToScVal(p.id, { type: "u32" })])
            ),
            server.simulateTransaction(
              buildSimTx("is_for_sale", [StellarSdk.nativeToScVal(p.id, { type: "u32" })])
            ),
          ]);

          let owner: string | null = null;
          if ("result" in ownerRes && ownerRes.result) {
            const val = StellarSdk.scValToNative(ownerRes.result.retval);
            if (val && typeof val === "object" && "toString" in val) owner = val.toString();
          }

          let price: number | null = null;
          if ("result" in priceRes && priceRes.result) {
            const val = StellarSdk.scValToNative(priceRes.result.retval);
            if (val !== null && val !== undefined) price = Number(val) / STROOPS_PER_XLM;
          }

          let forSale = false;
          if ("result" in forSaleRes && forSaleRes.result) {
            forSale = Boolean(StellarSdk.scValToNative(forSaleRes.result.retval));
          }

          return { id: p.id, owner, price, forSale };
        })
      );

      setPhrases(results);
    } catch (error) {
      console.error("Failed to load phrases:", error);
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleList(phraseId: number) {
    if (!walletAddress) return;
    const priceXlm = parseFloat(priceInputs[phraseId] || "");
    if (!priceXlm || priceXlm <= 0) {
      setStatus("Enter a price above 0");
      return;
    }
    const phrase = PHRASES.find((p) => p.id === phraseId)!;
    setBusyId(phraseId);
    setStatus("Building...");
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
      const account = await server.getAccount(walletAddress);
      const contract = new StellarSdk.Contract(CONTRACT_ID);
      const priceStroops = Math.round(priceXlm * STROOPS_PER_XLM);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "mint",
            StellarSdk.nativeToScVal(phraseId, { type: "u32" }),
            StellarSdk.nativeToScVal(phrase.uri, { type: "string" }),
            StellarSdk.nativeToScVal(priceStroops, { type: "i128" })
          )
        )
        .setTimeout(30)
        .build();

      const simulated = await server.simulateTransaction(tx);
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(simulated.error);
      }
      const prepared = StellarSdk.SorobanRpc.assembleTransaction(tx, simulated).build();

      setStatus("Sign in Freighter...");
      const signResult = await signTransaction(prepared.toXDR(), {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        address: walletAddress,
      });
      if (signResult.error) throw new Error(signResult.error.message);

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, StellarSdk.Networks.TESTNET);

      setStatus("Submitting...");
      const result = await server.sendTransaction(signedTx);
      if (result.status === "ERROR") throw new Error(`Failed: ${result.status}`);

      setStatus("Listed!");
      await refresh();
      setTimeout(() => setStatus(""), 2000);
    } catch (error: any) {
      setStatus(error.message?.slice(0, 80) || "Failed to list");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBuy(phraseId: number) {
    if (!walletAddress) return;
    setBusyId(phraseId);
    setStatus("Building...");
    try {
      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
      const account = await server.getAccount(walletAddress);
      const contract = new StellarSdk.Contract(CONTRACT_ID);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "buy",
            StellarSdk.Address.fromString(walletAddress).toScVal(),
            StellarSdk.nativeToScVal(phraseId, { type: "u32" })
          )
        )
        .setTimeout(30)
        .build();

      const simulated = await server.simulateTransaction(tx);
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(simulated.error);
      }
      const prepared = StellarSdk.SorobanRpc.assembleTransaction(tx, simulated).build();

      setStatus("Sign in Freighter...");
      const signResult = await signTransaction(prepared.toXDR(), {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        address: walletAddress,
      });
      if (signResult.error) throw new Error(signResult.error.message);

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, StellarSdk.Networks.TESTNET);

      setStatus("Submitting...");
      const result = await server.sendTransaction(signedTx);
      if (result.status === "ERROR") throw new Error(`Failed: ${result.status}`);

      setStatus("Purchased!");
      await refresh();
      setTimeout(() => setStatus(""), 2000);
    } catch (error: any) {
      setStatus(error.message?.slice(0, 80) || "Failed to buy");
    } finally {
      setBusyId(null);
    }
  }

  const isAdmin = !!walletAddress && !!adminAddress && walletAddress === adminAddress;

  if (!isConfigured) {
    return (
      <p className="text-center text-white/50 text-sm">
        Marketplace contract not configured.
      </p>
    );
  }

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PHRASES.map((phrase) => {
          const state = phrases.find((p) => p.id === phrase.id);
          const minted = !!state?.owner;
          const ownedByMe = !!walletAddress && state?.owner === walletAddress;

          return (
            <div key={phrase.id} className="border border-white/10 bg-[#0a0a0a]/60 overflow-hidden">
              <div className="aspect-square">
                <img src={phrase.uri} alt={phrase.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-4">
                <h3 className="text-base font-bold tracking-[0.05em] mb-2">{phrase.title}</h3>

                {loading && <p className="text-sm text-white/40">Loading...</p>}

                {!loading && !minted && isAdmin && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="XLM"
                      value={priceInputs[phrase.id] || ""}
                      onChange={(e) =>
                        setPriceInputs((prev) => ({ ...prev, [phrase.id]: e.target.value }))
                      }
                      className="w-20 px-2 py-2 bg-transparent border border-white/20 text-sm text-white outline-none"
                    />
                    <button
                      onClick={() => handleList(phrase.id)}
                      disabled={busyId === phrase.id}
                      className="flex-1 px-3 py-2 bg-white text-black text-sm font-bold tracking-[0.1em] disabled:opacity-40"
                    >
                      {busyId === phrase.id ? "..." : "LIST FOR SALE"}
                    </button>
                  </div>
                )}

                {!loading && !minted && !isAdmin && (
                  <p className="text-sm text-white/40">Not available yet</p>
                )}

                {!loading && minted && state?.forSale && ownedByMe && (
                  <p className="text-sm text-green-500">Listed — {state.price} XLM</p>
                )}

                {!loading && minted && state?.forSale && !ownedByMe && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white/70">{state.price} XLM</span>
                    <button
                      onClick={() => handleBuy(phrase.id)}
                      disabled={!walletAddress || busyId === phrase.id}
                      className="px-3 py-2 bg-white text-black text-sm font-bold tracking-[0.1em] disabled:opacity-40"
                    >
                      {busyId === phrase.id ? "..." : !walletAddress ? "CONNECT WALLET" : "BUY"}
                    </button>
                  </div>
                )}

                {!loading && minted && !state?.forSale && (
                  <p className="text-sm text-white/40">
                    {ownedByMe ? "Owned by you" : "Sold"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {status && <p className="text-center text-sm text-white/50 mt-6">{status.toUpperCase()}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: succeeds (this also builds `MarketplaceSection.tsx` — if Task 7 hasn't happened yet, `PhraseGrid` will just be an unused export at this point, which is fine for this checkpoint; if it fails on something *inside* `PhraseGrid.tsx` itself, fix that before moving on).

- [ ] **Step 3: Commit**

```bash
git add src/components/PhraseGrid.tsx
git commit -m "Add PhraseGrid marketplace component"
```

---

### Task 7: Wire `PhraseGrid` into `MarketplaceSection.tsx`

**Files:**
- Modify: `src/components/sections/MarketplaceSection.tsx`

**Interfaces:**
- Consumes: `PhraseGrid` (Task 6), `WalletConnect` and `NetworkStatus` (unchanged, existing)

- [ ] **Step 1: Replace the file contents**

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/MarketplaceSection.tsx
git commit -m "Wire PhraseGrid into MarketplaceSection, drop the old tab UI"
```

---

### Task 8: Delete the old dashboard components

**Files:**
- Delete: `src/components/NFTMinter.tsx`
- Delete: `src/components/NFTGallery.tsx`
- Delete: `src/components/BrowseNFTs.tsx`
- Delete: `src/lib/useWeb3.ts`

- [ ] **Step 1: Confirm nothing still imports them**

Run: `grep -rn "NFTMinter\|NFTGallery\|BrowseNFTs\|useWeb3" src/`
Expected: no matches (Task 7 already removed `MarketplaceSection.tsx`'s only references to the first three; `useWeb3.ts` was already unused before this plan).

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/NFTMinter.tsx src/components/NFTGallery.tsx src/components/BrowseNFTs.tsx src/lib/useWeb3.ts
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git commit -m "Remove old free-mint dashboard components, replaced by PhraseGrid"
```

---

### Task 9: Update `.env.local`

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Remove the unused Pinata keys, leave a placeholder comment for the new contract ID**

Replace the file contents with:

```
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
# Replace after running contracts/nft/DEPLOY.md
NEXT_PUBLIC_CONTRACT_ID=YOUR_CONTRACT_ID_HERE
```

- [ ] **Step 2: No commit** — `.env.local` isn't tracked in git (confirmed untracked as of the last session in this project); this step only matters locally. Skip the commit step for this task.

---

### Task 10: Final verification

**Files:** none changed — verification only.

- [ ] **Step 1: Full contract test suite**

Run: `cd contracts/nft && cargo test`
Expected: PASS, all tests from Tasks 1-3.

- [ ] **Step 2: Full frontend build**

Run: `npm run build`
Expected: succeeds with no type errors.

- [ ] **Step 3: Manual smoke check (needs `NEXT_PUBLIC_CONTRACT_ID` pointed at a real deployed+initialized contract from Task 5 — this step can't be automated, since it needs a real Freighter wallet and funded testnet accounts for both the admin and a test buyer)**

- Connect Freighter as the admin account → confirm "LIST FOR SALE" controls appear on unminted phrase cards, and nothing else can list.
- List one phrase at a small price (e.g. 1 XLM) → confirm it flips to "Listed — 1 XLM".
- Switch Freighter to a different funded testnet account → confirm that account sees a "BUY" button on the listed phrase, and reconnecting as admin does *not* show a buy button on their own listing.
- Buy it → confirm both the XLM balance moved and the card now says "Sold" (or "Owned by you" from the buyer's wallet).
