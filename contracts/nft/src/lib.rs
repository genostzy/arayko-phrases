#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol};

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

    pub fn mint(env: Env, uri: String, price: i128) -> u32 {
        let admin: Address = env.storage().instance().get(&ADMIN).expect("Not initialized");
        admin.require_auth();

        if price <= 0 {
            panic!("Price must be positive");
        }

        let token_id: u32 = env.storage().instance().get(&COUNTER).unwrap_or(0u32);
        env.storage().instance().set(&COUNTER, &(token_id + 1));

        env.storage().instance().set(&DataKey::TokenOwner(token_id), &admin);
        env.storage().instance().set(&DataKey::TokenURI(token_id), &uri);
        env.storage().instance().set(&DataKey::TokenPrice(token_id), &price);
        env.storage().instance().set(&DataKey::ForSale(token_id), &true);

        let balance: u32 = env.storage().instance().get(&DataKey::Balance(admin.clone())).unwrap_or(0u32);
        env.storage().instance().set(&DataKey::Balance(admin.clone()), &(balance + 1));

        token_id
    }

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

        let token_id = client.mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);

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
            .mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);
    }

    #[test]
    fn test_mint_assigns_sequential_ids() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _native) = setup(&env);

        let first = client.mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);
        let second = client.mint(&String::from_str(&env, "https://example.com/custom.png"), &900_0000000i128);

        assert_eq!(first, 0);
        assert_eq!(second, 1);
        assert_eq!(client.owner_of(&1u32), Some(admin.clone()));
        assert_eq!(client.price_of(&1u32), Some(900_0000000i128));
        assert_eq!(client.balance_of(&admin), 2);
        assert_eq!(client.total_supply(), 2);
    }

    #[test]
    #[should_panic(expected = "Price must be positive")]
    fn test_mint_rejects_zero_price() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _native) = setup(&env);

        client.mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &0i128);
    }

    #[test]
    fn test_buy_transfers_ownership_and_payment() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PhraseMarketplace);
        let client = PhraseMarketplaceClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);

        let sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let native = sac.address();
        let native_asset_client = token::StellarAssetClient::new(&env, &native);
        native_asset_client.mint(&buyer, &1_000_0000000i128);

        client.initialize(
            &admin,
            &String::from_str(&env, "ArayKoPo Phrases"),
            &String::from_str(&env, "ARKPO"),
            &native,
        );
        let price = 500_0000000i128;
        client.mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &price);

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
        let first_buyer = Address::generate(&env);
        let second_buyer = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let native = sac.address();
        let native_asset_client = token::StellarAssetClient::new(&env, &native);
        native_asset_client.mint(&first_buyer, &1_000_0000000i128);
        native_asset_client.mint(&second_buyer, &1_000_0000000i128);

        client.initialize(
            &admin,
            &String::from_str(&env, "ArayKoPo Phrases"),
            &String::from_str(&env, "ARKPO"),
            &native,
        );
        client.mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);

        // Once bought, the phrase is no longer for sale — a second buyer
        // trying to buy the same already-owned token must be rejected.
        client.buy(&first_buyer, &0u32);
        client.buy(&second_buyer, &0u32);
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
        client.mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);

        client.buy(&admin, &0u32);
    }

    #[test]
    #[should_panic]
    fn test_buy_fails_without_buyer_authorization() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PhraseMarketplace);
        let client = PhraseMarketplaceClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let native = sac.address();
        token::StellarAssetClient::new(&env, &native).mint(&buyer, &1_000_0000000i128);

        client.initialize(
            &admin,
            &String::from_str(&env, "ArayKoPo Phrases"),
            &String::from_str(&env, "ARKPO"),
            &native,
        );
        client.mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);

        // No auth provided for the buyer on this call — must panic.
        client.set_auths(&[]).buy(&buyer, &0u32);
    }

    #[test]
    fn test_transfer_moves_ownership() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _native) = setup(&env);
        client.mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);

        let recipient = Address::generate(&env);
        client.transfer(&admin, &recipient, &0u32);

        assert_eq!(client.owner_of(&0u32), Some(recipient.clone()));
        assert_eq!(client.balance_of(&admin), 0);
        assert_eq!(client.balance_of(&recipient), 1);
    }

    #[test]
    #[should_panic]
    fn test_transfer_fails_without_from_authorization() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _native) = setup(&env);
        client.mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);

        let recipient = Address::generate(&env);
        // No auth provided for `from` on this call — must panic.
        client.set_auths(&[]).transfer(&admin, &recipient, &0u32);
    }

    #[test]
    fn test_transfer_clears_stale_for_sale_flag() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _native) = setup(&env);
        client.mint(&String::from_str(&env, "/images/Phrase%231.jpg"), &500_0000000i128);
        assert!(client.is_for_sale(&0u32));

        let recipient = Address::generate(&env);
        client.transfer(&admin, &recipient, &0u32);

        // Gifted directly instead of bought — must not still look purchasable.
        assert!(!client.is_for_sale(&0u32));
    }
}
