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
    }

    #[test]
    #[should_panic]
    fn test_mint_fails_without_admin_authorization() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _native) = setup(&env);

        // Explicitly provide zero auth entries for this one call, overriding
        // the blanket mock_all_auths() above — mint() must panic since
        // nothing authorized the admin address for this invocation.
        client
            .set_auths(&[])
            .mint(&0u32, &String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);
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
