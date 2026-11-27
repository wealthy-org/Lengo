# Robinhood Chain Mainnet — First Loan Live Proofs

**Network:** Robinhood Chain Mainnet  
**Chain ID:** `4663`  
**RPC:** `https://rpc.mainnet.chain.robinhood.com` / `https://4663.rpc.thirdweb.com`  
**Explorer:** `https://robinhoodchain.blockscout.com`  
**Verification:** Sourcify (`exact_match`)  
**Status:** ✅ **Mainnet Live — Verified Onchain (Chain 4663)**

---

## 1. Verified Core Contracts

| Contract | Address | Explorer Link | Sourcify Status |
|---|---|---|---|
| **LengoMarket (WETH / USDG)** | `0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900` | [View on Explorer](https://robinhoodchain.blockscout.com/address/0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900) | `exact_match` ✅ |
| **ChainlinkOracle Adapter** | `0xAc892397986B84ff42894739F05fE884D1D4c6da` | [View on Explorer](https://robinhoodchain.blockscout.com/address/0xAc892397986B84ff42894739F05fE884D1D4c6da) | `exact_match` ✅ |
| **WETH Collateral Token** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | [View on Explorer](https://robinhoodchain.blockscout.com/address/0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73) | Verified ERC-20 |
| **USDG Debt Token** | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | [View on Explorer](https://robinhoodchain.blockscout.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) | Verified ERC-20 |

---

## 2. Milestone 1: First Loan Live Lifecycle (All Confirmed on Chain 4663)

### Phase A — Pool Seeding (Deployer / Lender: `0x9178b573219c55586bbaf51ecb24acfb27bb7681`)
| Step | Action | Block | Transaction Hash |
|---|---|---|---|
| 1 | Approve USDG | `122,693,914` | [`0x517795eb…cb6b`](https://robinhoodchain.blockscout.com/tx/0x517795eb1976f237c4fbf95ffd5b4924b1db9672154ca8def901858c2a20cb6b) |
| 2 | **Supply `2.00 USDG` to Pool** | `122,693,997` | [`0x04887e2d…f0d7`](https://robinhoodchain.blockscout.com/tx/0x04887e2dd03391090f3f90eb170bba562955d76122e24bdafb2fbf73f715f0d7) |
| 3 | **Supply `2.00 USDG` Top-Up** | `123,423,315` | [`0xc183664b…115d`](https://robinhoodchain.blockscout.com/tx/0xc183664bdcbcf7ea5eb6b638407e79f3285e210f34f9f5927c5ccf69571c115d) |

### Phase B — Full Loan Cycle (Independent Borrower: `0xb91e596ef3e1855df77bc34b2d094ef8704bb5ae`)
| Step | Action | Block | Transaction Hash |
|---|---|---|---|
| 1 | Approve WETH | `122,704,589` | [`0x3177b60f…b923`](https://robinhoodchain.blockscout.com/tx/0x3177b60ff26a549ca0063e6f26dd7df1a583c50190a4f94433080e4c635fb923) |
| 2 | **Deposit Collateral (`0.0001 WETH`)** | `122,704,649` | [`0x4ff7f8d8…6b98`](https://robinhoodchain.blockscout.com/tx/0x4ff7f8d8c6c72ede29a11b76ffddca948c662f57d4eb220a8e34654fde9d6b98) |
| 3 | **Borrow USDG (`0.005 USDG`)** | `122,705,021` | [`0x57356f96…5f4d`](https://robinhoodchain.blockscout.com/tx/0x57356f96ef1e9bebc9345de9530628c919faf2f9348c082f83b62cb240435f4d) |
| 4 | Approve USDG (for Repay) | `122,705,357` | [`0xde05117f…b22b`](https://robinhoodchain.blockscout.com/tx/0xde05117f6694d4dff4b946b2357c44a756f5ef879aacf89435821f34aac1b22b) |
| 5 | **Repay USDG (`0.05 USDG` Full Debt)** | `122,705,471` | [`0xabdb082c…5bcb`](https://robinhoodchain.blockscout.com/tx/0xabdb082cf3c0fd5fd1875f616b0b4fa3b71bd7f3ac811157edffd4ad32725bcb) |
| 6 | **Withdraw Collateral (`0.0001 WETH`)** | `122,705,887` | [`0x1123391f…a2f7`](https://robinhoodchain.blockscout.com/tx/0x1123391fe9d0a87e5c2146b2cb577573b022bc48dbc31f1f37ff625e0416a2f7) |

### Phase C — Cross-Chain NEAR Intents Multi-Chain Payout (`USDG` Robinhood Chain → `USDC` Solana & Base)
- **Sender (Robinhood Chain `4663`):** `0xb91E596EF3E1855df77bC34b2d094eF8704bB5AE`
- **1Click Deposit Address:** `0x0D650Ee3D0961B376a9b90fB12e5fE0BD9D46283`
- **Recipient (Solana Mainnet):** `HZXty2J7GcbFzfyRqY2x2WBMss7AMhA1K7EjJS8gBKiY`
- **Settlement Status:** `SUCCESS` (`1.000000 USDG` in → `0.806257 USDC` settled on Solana in ~42s)

| Leg | Chain | Block / Details | Explorer Proof |
|---|---|---|---|
| 1 | Robinhood Chain (`4663`) | Block `123,473,713` · `USDG.transfer(1,000,000)` (`0 ETH` value) | [`0xc6684d36…9644`](https://robinhoodchain.blockscout.com/tx/0xc6684d3643a3d0378129c7b2ed80de1f44851e8ae71d4dcbb520b52016d09644) |
| 2 | NEAR Intents 1Click | Correlation `670286ba-01c0-4122-82bd-e4b0949a5cb8` · `SUCCESS` | [`0x0D650Ee3…6283`](https://explorer.near-intents.org/transactions/0x0D650Ee3D0961B376a9b90fB12e5fE0BD9D46283) |
| 3 | Solana Mainnet | `0.806257 USDC` delivered to `HZXty2…BKiY` | [`PWUk1xC3…7RUwV`](https://solscan.io/tx/PWUk1xC3DdzyGvPZu9rVviDkj1EpNapzftXxjWPWwpfdFf6PyRMAWkmZqWbp8oCgk4jhuJFDgqz8pRzZV77RUwV) |
| 4 | Robinhood Chain (`4663`) | Block `123,532,715` · `0.30 USDG` transfer (`RH → Base`) | [`0xa484f312…a7f0`](https://robinhoodchain.blockscout.com/tx/0xa484f312f7419d09f0d64fd85bcaff29394ed072d53603c510f2d523cf77a7f0) |
| 5 | NEAR Intents 1Click | Correlation `da9d3f29-ff04-41ed-8225-66e584e2e515` · `SUCCESS` | [`0x0cC24E33…2E3d`](https://explorer.near-intents.org/transactions/0x0cC24E339540688717D23c86fE2783e3DD7C2E3d) |
| 6 | Base Mainnet | `0.296513 USDC` delivered on Base (`0xb91E…B5AE`) | [`0x7e4f2eb4…cd0d`](https://basescan.org/tx/0x7e4f2eb4a67b2e083993793c4154ce34a23781d6f03e1b866b5e3e78b4c2cd0d) |

### Phase D — Isolated RWA Equity Markets (`NVDA`, `TSLA`, `AAPL` / `USDG`)
- **Lender (`0xb91E596EF3E1855df77bC34b2d094eF8704bB5AE`):**

| Market | Contract | Action | Block | Supply Tx Hash (Blockscout) | Approve Tx Hash |
|---|---|---|---|---|---|
| **NVDA / USDG** | `0x7D81A78F6a52264E0064764b2b1250385E5e193A` | `supply(0.01 USDG)` | `123,528,008` | [`0xef3a519a…8cfe`](https://robinhoodchain.blockscout.com/tx/0xef3a519afa18f8c11b68ff13348a11bbbffe3dd2255f83cdaa96d6befed58cfe) | [`0x24536122…2262`](https://robinhoodchain.blockscout.com/tx/0x245361221f98aa51774a1fe3f375510ebfd18283b8971c302ab41ea2d93b2262) |
| **TSLA / USDG** | `0xa4CaCae0e5221d6B5a2B1630f7F6f36e6b9eF99a` | `supply(0.01 USDG)` | `123,528,282` | [`0x3ba93b61…352b`](https://robinhoodchain.blockscout.com/tx/0x3ba93b6139f3be8c253c9b3a678bfaa2f084dbbb617bfa01980aeec24f24352b) | [`0x252a…`](https://robinhoodchain.blockscout.com/address/0xa4CaCae0e5221d6B5a2B1630f7F6f36e6b9eF99a) |
| **AAPL / USDG** | `0xDF97819e82A634ff82689c282067b74D574467A3` | `supply(0.01 USDG)` | `123,528,546` | [`0xefce4d41…5ec7`](https://robinhoodchain.blockscout.com/tx/0xefce4d41320bf3d7175043d6dbfbe0720c7f18390bd3b36db2b08922bed05ec7) | [`0x75d8767c…8fa3`](https://robinhoodchain.blockscout.com/tx/0x75d8767c5968f05b5893d96cd5ab5ae78f1938f11a0cadc2332eb6525cc58fa3) |
| **cbBTC / USDG** | `0x75ae697448233142Ca295262b25B55e65856352E` | `supply(0.01 USDG)` | `124,065,539` | [`0xdb808435…e0fa`](https://robinhoodchain.blockscout.com/tx/0xdb808435bd3f9dac585e9658ba6c0cc331902b9e515f29a605e574de9853e0fa) | [`0x4fc4e106…e3da`](https://robinhoodchain.blockscout.com/tx/0x4fc4e106aa658c624941abca80c50f20bfdc1b854efb4c88035bb2e4ccbce3da) |
| **WBTC / USDG** | `0xC11B5cEd0A906aF856937ea64aBEeEfF04ACfAd3` | `supply(0.01 USDG)` | `124,065,612` | [`0x5d55c1ad…b81f`](https://robinhoodchain.blockscout.com/tx/0x5d55c1ad35e0986b3e7db7b0e648f037823b0eac714faa3376af039f7cc1b81f) | [`0x30c76523…c29c`](https://robinhoodchain.blockscout.com/tx/0x30c765234f889da650efdec16f26d06bb07fc371a642b4324d13105a47a4c29c) |
| **USDe / USDG** | `0x781435104117c5583c6D175784007Ca171d47f30` | `supply(0.01 USDG)` | `124,065,694` | [`0xb035a9c2…8b63`](https://robinhoodchain.blockscout.com/tx/0xb035a9c29b5ac2906007f2a05cf6822d3845de29e92e145d78d5f2db15748b63) | [`0xf3c641bb…1722`](https://robinhoodchain.blockscout.com/tx/0xf3c641bbd6a0e3a9c48431d2d76055e29d3ed90327829422584a3879c4581722) |

### Phase E — Cross-Chain Debt Repayment & Collateral Exit (`WETH / USDG` on Chain `4663`)
- **Borrower (`0xb91E596EF3E1855df77bC34b2d094eF8704bB5AE`):**

| Step | Action | Block | Transaction Hash |
|---|---|---|---|
| 1 | Approve `USDG` for Cross-Chain Repay (`0.005008 USDG`) | `123,537,352` | [`0x7ba90b10…8be3`](https://robinhoodchain.blockscout.com/tx/0x7ba90b1015824c8088bdcd7e8b5608302aefa4438953b781d4b9c081f61a8be3) |
| 2 | **Full Debt Repay (`LengoMarket.repay(max)` — `0.005003 USDG`, `5,001` shares → `0` Debt)** | `123,537,392` | [`0x88a0e4bf…44c8`](https://robinhoodchain.blockscout.com/tx/0x88a0e4bfdfa2b444d205b3f8b125afab714346d86a864451e5a36aa8e55844c8) |
| 3 | **Post-Repay Collateral Exit (`LengoMarket.withdrawCollateral(0.0010 WETH)`)** | `123,542,369` | [`0x563d35bd…b41f`](https://robinhoodchain.blockscout.com/tx/0x563d35bd6f8dbb8e56c1029e04dda04f164b2ba1bdd893e216d22195b6aab41f) |

---

## 3. Public Dashboard Verification
Every metric in the Lengo terminal (`/app`) is read live from onchain contract state via Multicall3:
- **TVL:** `(totalCollateral × oraclePrice) + totalSuppliedAssets`
- **Utilization:** `(totalDebt / totalSuppliedAssets) × 100%`
- **Active Positions:** Onchain active borrower & collateral accounts
- **Remaining Cap:** `collateralCap − totalCollateral`
- **Explorer Links:** Each number is linked directly to `https://robinhoodchain.blockscout.com/address/0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900`.
