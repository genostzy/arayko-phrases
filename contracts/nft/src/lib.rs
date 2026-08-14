#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol};

const COUNTER: Symbol = symbol_short!("COUNTER");
const OWNER: Symbol = symbol_short!("OWNER");
const NAME: Symbol = symbol_short!("NAME");
const SYMBOL: Symbol = symbol_short!("SYMBOL");

#[contracttype]
pub enum DataKey {
    TokenOwner(u32),
    TokenURI(u32),
    Balance(Address),
    Approval(Address),
}

#[contract]
pub struct SimpleNFT;

#[contractimpl]
impl SimpleNFT {
    pub fn initialize(env: Env, admin: Address, nft_name: String, nft_symbol: String) {
        env.storage().instance().set(&NAME, &nft_name);
        env.storage().instance().set(&SYMBOL, &nft_symbol);
        env.storage().instance().set(&OWNER, &admin);
        env.storage().instance().set(&COUNTER, &0u32);
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&NAME).unwrap_or(String::from_str(&env, "NFT"))
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&SYMBOL).unwrap_or(String::from_str(&env, "NFT"))
    }

    pub fn mint(env: Env, to: Address, uri: String) -> u32 {
        let token_id: u32 = env.storage().instance().get(&COUNTER).unwrap_or(0u32);
        env.storage().instance().set(&COUNTER, &(token_id + 1));

        env.storage()
            .instance()
            .set(&DataKey::TokenOwner(token_id), &to);
        env.storage()
            .instance()
            .set(&DataKey::TokenURI(token_id), &uri);

        let balance: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0u32);
        env.storage()
            .instance()
            .set(&DataKey::Balance(to), &(balance + 1));

        token_id
    }

    pub fn owner_of(env: Env, token_id: u32) -> Option<Address> {
        env.storage()
            .instance()
            .get(&DataKey::TokenOwner(token_id))
    }

    pub fn token_uri(env: Env, token_id: u32) -> Option<String> {
        env.storage()
            .instance()
            .get(&DataKey::TokenURI(token_id))
    }

    pub fn balance_of(env: Env, owner: Address) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(owner))
            .unwrap_or(0u32)
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

        env.storage()
            .instance()
            .set(&DataKey::TokenOwner(token_id), &to);

        let from_balance: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0u32);
        env.storage()
            .instance()
            .set(&DataKey::Balance(from), &(from_balance - 1));

        let to_balance: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0u32);
        env.storage()
            .instance()
            .set(&DataKey::Balance(to), &(to_balance + 1));
    }

    pub fn total_supply(env: Env) -> u32 {
        env.storage().instance().get(&COUNTER).unwrap_or(0u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mint_and_owner() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SimpleNFT);
        let client = SimpleNFTClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(&admin, &String::from_str(&env, "TestNFT"), &String::from_str(&env, "TNFT"));

        let token_id = client.mint(&user, &String::from_str(&env, "ipfs://token0"));
        assert_eq!(token_id, 0);
        assert_eq!(client.owner_of(&token_id), Some(user.clone()));
        assert_eq!(client.balance_of(&user), 1);
        assert_eq!(client.total_supply(), 1);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SimpleNFT);
        let client = SimpleNFTClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.initialize(&admin, &String::from_str(&env, "TestNFT"), &String::from_str(&env, "TNFT"));
        let token_id = client.mint(&alice, &String::from_str(&env, "ipfs://token0"));

        client.transfer(&alice, &bob, &token_id);

        assert_eq!(client.owner_of(&token_id), Some(bob.clone()));
        assert_eq!(client.balance_of(&alice), 0);
        assert_eq!(client.balance_of(&bob), 1);
    }
}
