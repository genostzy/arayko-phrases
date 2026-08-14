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
stellar contract deploy --wasm target/wasm32v1-none/release/nft.wasm --source-account admin --network testnet --alias araykopo_phrases
```

This prints the new contract ID (starts with `C`). Save it.

## 4. Initialize it

```bash
stellar contract invoke --id <CONTRACT_ID_FROM_STEP_3> --source-account admin --network testnet -- initialize --admin <YOUR_ADMIN_ADDRESS_FROM_STEP_1> --nft_name "ArayKoPo Phrases" --nft_symbol "ARKPO" --native_token <NATIVE_TOKEN_ADDRESS_FROM_STEP_2>
```

## 5. Wire it into the frontend

Update `.env.local` in the project root:

```
NEXT_PUBLIC_CONTRACT_ID=<CONTRACT_ID_FROM_STEP_3>
```

Then connect Freighter using the admin account you imported in step 1 —
you should see "List for Sale" controls on the marketplace grid.

## Sanity-checking it worked

Before touching the browser, you can confirm the contract responds
correctly from the CLI:

```bash
stellar contract invoke --id <CONTRACT_ID_FROM_STEP_3> --source-account admin --network testnet --send=no -- admin
```

This should print your admin address back. `--send=no` runs it as a
read-only simulation, so it won't cost anything or require a second
signature.
