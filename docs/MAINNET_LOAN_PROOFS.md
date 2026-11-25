# Robinhood Chain Mainnet — First Loan Live Proofs

**Network:** Robinhood Chain Mainnet  
**Chain ID:** `4663`  
**RPC:** `https://rpc.mainnet.chain.robinhood.com` / `https://4663.rpc.thirdweb.com`  
**Explorer:** `https://explorer.mainnet.chain.robinhood.com`  
**Verification:** Sourcify (`exact_match`)  

---

## 1. Verified Core Contracts

| Contract | Address | Explorer Link | Sourcify Status |
|---|---|---|---|
| **LengoMarket (WETH / USDG)** | `0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900) | `exact_match` ✅ |
| **ChainlinkOracle Adapter** | `0xAc892397986B84ff42894739F05fE884D1D4c6da` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0xAc892397986B84ff42894739F05fE884D1D4c6da) | `exact_match` ✅ |
| **WETH Collateral Token** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73) | Verified ERC-20 |
| **USDG Debt Token** | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) | Verified ERC-20 |

---

## 2. Milestone 1: First Loan Live Lifecycle

### Step 1: First Collateral Deposit (Live on Chain 4663)
- **Action:** `LengoMarket.depositCollateral(0.001 WETH)`
- **Transaction Hash:** `0x3fe623a1df58f27027d14fe409074092b3bc9197cbeafc558c4c7980ee987244`
- **Deposited Collateral:** `0.001 WETH` (~$1.67 USD at Chainlink oracle price ~$1,670)
- **Explorer Proof:** [Tx 0x3fe623a1…7244 on Explorer](https://explorer.mainnet.chain.robinhood.com/tx/0x3fe623a1df58f27027d14fe409074092b3bc9197cbeafc558c4c7980ee987244)
- **Onchain State Verification:**
  - `totalCollateral()`: `0.001 WETH` (`1000000000000000` wei)
  - `getPosition(account)`: `coll = 0.001 WETH`, `debt = 0`, `hf = Infinity`

### Step 2: USDG Pool Seeding (Pending Bos decision)
- **Action:** `LengoMarket.supply(amount)`
- **Purpose:** Fund the pool with USDG liquidity so borrowers can borrow against their deposited collateral.
- **Status:** Pending decision on seeding allocation amount.

### Step 3: Full Borrow Cycle (Independent Borrower Wallet)
- **Wallet:** Dedicated borrower account (separated from deployer `0x9178..7681`).
- **Action:**
  1. `depositCollateral(WETH)`
  2. `borrow(USDG)`
  3. `repay(USDG)`
  4. `withdrawCollateral(WETH)`
- **Status:** Automated script & UI flow ready to execute once Step 2 is funded.

---

## 3. Public Dashboard Verification
Every metric in the Lengo terminal (`/app`) is read live from onchain contract state via Multicall3:
- **TVL:** `(totalCollateral × oraclePrice) + totalSuppliedAssets`
- **Utilization:** `(totalDebt / totalSuppliedAssets) × 100%`
- **Active Positions:** Onchain active borrower & collateral accounts
- **Remaining Cap:** `collateralCap − totalCollateral`
- **Explorer Links:** Each number is linked to verified contract read functions on Blockscout / Sourcify.
