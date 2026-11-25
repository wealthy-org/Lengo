# Robinhood Chain Mainnet — First Loan Live Proofs

**Network:** Robinhood Chain Mainnet  
**Chain ID:** `4663`  
**RPC:** `https://rpc.mainnet.chain.robinhood.com` / `https://4663.rpc.thirdweb.com`  
**Explorer:** `https://robinhoodchain.blockscout.com`  
**Verification:** Sourcify (`exact_match`)  
**Status:** ✅ **Update 1: First Loan Live — COMPLETED ONCHAIN**

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
| 2 | **Supply USDG to Pool** | `122,693,997` | [`0x04887e2d…f0d7`](https://robinhoodchain.blockscout.com/tx/0x04887e2dd03391090f3f90eb170bba562955d76122e24bdafb2fbf73f715f0d7) |

### Phase B — Full Loan Cycle (Independent Borrower: `0xb91e596ef3e1855df77bc34b2d094ef8704bb5ae`)
| Step | Action | Block | Transaction Hash |
|---|---|---|---|
| 1 | Approve WETH | `122,704,589` | [`0x3177b60f…b923`](https://robinhoodchain.blockscout.com/tx/0x3177b60ff26a549ca0063e6f26dd7df1a583c50190a4f94433080e4c635fb923) |
| 2 | **Deposit Collateral (WETH)** | `122,704,649` | [`0x4ff7f8d8…6b98`](https://robinhoodchain.blockscout.com/tx/0x4ff7f8d8c6c72ede29a11b76ffddca948c662f57d4eb220a8e34654fde9d6b98) |
| 3 | **Borrow USDG** | `122,705,021` | [`0x57356f96…5f4d`](https://robinhoodchain.blockscout.com/tx/0x57356f96ef1e9bebc9345de9530628c919faf2f9348c082f83b62cb240435f4d) |
| 4 | Approve USDG (for Repay) | `122,705,357` | [`0xde05117f…b22b`](https://robinhoodchain.blockscout.com/tx/0xde05117f6694d4dff4b946b2357c44a756f5ef879aacf89435821f34aac1b22b) |
| 5 | **Repay USDG (Full Debt)** | `122,705,471` | [`0xabdb082c…5bcb`](https://robinhoodchain.blockscout.com/tx/0xabdb082cf3c0fd5fd1875f616b0b4fa3b71bd7f3ac811157edffd4ad32725bcb) |
| 6 | **Withdraw Collateral (WETH)** | `122,705,887` | [`0x1123391f…a2f7`](https://robinhoodchain.blockscout.com/tx/0x1123391fe9d0a87e5c2146b2cb577573b022bc48dbc31f1f37ff625e0416a2f7) |

---

## 3. Public Dashboard Verification
Every metric in the Lengo terminal (`/app`) is read live from onchain contract state via Multicall3:
- **TVL:** `(totalCollateral × oraclePrice) + totalSuppliedAssets`
- **Utilization:** `(totalDebt / totalSuppliedAssets) × 100%`
- **Active Positions:** Onchain active borrower & collateral accounts
- **Remaining Cap:** `collateralCap − totalCollateral`
- **Explorer Links:** Each number is linked directly to `https://robinhoodchain.blockscout.com/address/0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900`.
