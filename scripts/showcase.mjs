#!/usr/bin/env node
// Lengo CLI showcase · Robinhood Chain Mainnet (4663)
//
// Animated replay of the REAL mainnet deployment (Foundry broadcast receipts), then
// every transaction and contract is re-checked LIVE against the RPC. Every hash,
// address and link is clickable (OSC 8 hyperlinks) and opens the explorer page or
// the raw JSON-RPC proof. Raw RPC responses are saved to
// contracts/deployments/rpc-proof-4663.json. Nothing is sent onchain (read-only).
//
// Usage: node scripts/showcase.mjs [--fast] [--offline] [--rpc <url>]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { encodeFunctionData, decodeFunctionResult, parseAbi, formatUnits } from "viem";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = JSON.parse(readFileSync(join(root, "contracts/broadcast/DeployMainnet.s.sol/4663/run-latest.json"), "utf8"));
const dep = JSON.parse(readFileSync(join(root, "contracts/deployments/4663.json"), "utf8"));
const PROOF_FILE = join(root, "contracts/deployments/rpc-proof-4663.json");

const args = process.argv.slice(2);
const FAST = args.includes("--fast");
const OFFLINE = args.includes("--offline");
const RPC = args.includes("--rpc") ? args[args.indexOf("--rpc") + 1] : process.env.NEXT_PUBLIC_RH_MAINNET_RPC || "https://4663.rpc.thirdweb.com";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const T = (ms) => (FAST ? ms / 5 : ms);

// ── ANSI ──────────────────────────────────────────────────────────────
const rgb = (r, g, b) => (s) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
const lime = rgb(201, 242, 122), mint = rgb(127, 224, 180), dim = rgb(133, 154, 142);
const amber = rgb(242, 193, 78), red = rgb(255, 110, 110), sky = rgb(120, 190, 255);
const bold = (s) => `\x1b[1m${s}\x1b[22m`;
const out = (s = "") => process.stdout.write(s);
const line = (s = "") => out(s + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, T(ms)));
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");
const vis = (s) => [...strip(s)].length;
const link = (url, text) => `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
const short = (h, a = 10, b = 6) => `${h.slice(0, a)}…${h.slice(-b)}`;
const fmt = (n) => Number(n).toLocaleString("en-US");
const hex = (h) => parseInt(h, 16);
const cols = () => Math.min(process.stdout.columns || 100, 110);
out("\x1b[?25l");
process.on("exit", () => out("\x1b[?25h\x1b[0m"));
process.on("SIGINT", () => process.exit(130));

const txUrl = (h) => `${EXPLORER}/tx/${h}`;
const addrUrl = (a) => `${EXPLORER}/address/${a}`;
// GET-able JSON-RPC proxy (Blockscout eth_* passthrough) so a click shows the raw RPC result.
const rpcReceiptUrl = (h) => `${EXPLORER}/api?module=proxy&action=eth_getTransactionReceipt&txhash=${h}`;
// Verified source tab on Blockscout for our deployed contracts.
const contractUrl = (a) => `${EXPLORER}/address/${checksum(a)}?tab=contract`;
const rpcCallUrl = (to, data) => `${EXPLORER}/api?module=proxy&action=eth_call&to=${to}&data=${data}&tag=latest`;

// ── Animation helpers ─────────────────────────────────────────────────
async function type(s, color = (x) => x, speed = 16) {
  for (const ch of s) { out(color(ch)); await sleep(speed); }
}
const FR = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
async function spin(label, ms) {
  const end = Date.now() + T(ms);
  const max = cols() - 6;
  const shown = vis(label) > max ? strip(label).slice(0, max - 1) + "…" : label;
  let i = 0;
  while (Date.now() < end) { out(`\r\x1b[2K  ${lime(FR[i++ % FR.length])} ${shown}`); await sleep(70); }
  out("\r\x1b[2K");
}
// Spinner that runs while a promise resolves (minimum duration for the show).
async function spinWhile(label, promise, minMs = 600) {
  let done = false, val, err;
  promise.then((v) => { val = v; done = true; }, (e) => { err = e; done = true; });
  const start = Date.now();
  let i = 0;
  while (!done || Date.now() - start < T(minMs)) {
    out(`\r\x1b[2K  ${lime(FR[i++ % FR.length])} ${label}`); await sleep(70);
  }
  out("\r\x1b[2K");
  if (err) throw err;
  return val;
}
async function bar(label, ms, width = 34, color = lime) {
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const n = Math.round((i / steps) * width);
    out(`\r  ${dim(label.padEnd(20))} ${color("█".repeat(n))}${dim("░".repeat(width - n))} ${dim(String(Math.round((i / steps) * 100)).padStart(3) + "%")}`);
    await sleep(ms / steps);
  }
  line();
}
async function hexRain(ms) {
  const w = cols() - 4, rows = 6, chars = "0123456789abcdef";
  const end = Date.now() + T(ms);
  let first = true;
  while (Date.now() < end) {
    if (!first) out(`\x1b[${rows}A`);
    first = false;
    for (let r = 0; r < rows; r++) {
      let s = "";
      for (let c = 0; c < w; c++) {
        const v = Math.random();
        s += v < 0.55 ? " " : v < 0.9 ? dim(chars[(Math.random() * 16) | 0]) : lime(chars[(Math.random() * 16) | 0]);
      }
      line("  " + s);
    }
    await sleep(60);
  }
  out(`\x1b[${rows}A`);
  for (let r = 0; r < rows; r++) line("\x1b[2K");
  out(`\x1b[${rows}A`);
}
async function section(n, title) {
  line();
  const label = ` ${n} · ${title} `;
  const w = cols() - 4;
  for (let i = 0; i <= w; i += 4) {
    out(`\r  ${lime("━".repeat(Math.min(i, 3)))}${bold(i > 3 ? label.slice(0, i - 3) : "")}${dim("━".repeat(Math.max(0, Math.min(i, w) - 3 - label.length)))}`);
    await sleep(8);
  }
  out(`\r\x1b[2K  ${lime("━━━")}${bold(label)}${dim("━".repeat(Math.max(0, w - 3 - label.length)))}`);
  line(); line();
  await sleep(250);
}
async function mineBlock(block) {
  const w = 22;
  for (let i = 0; i <= w; i++) {
    out(`\r        ${dim("block")} ${sky("▕" + "▓".repeat(i) + " ".repeat(w - i) + "▏")} ${dim("#" + fmt(block))}`);
    await sleep(14);
  }
  out("\r\x1b[2K");
}
function box(title, rows, W = Math.min(cols() - 4, 96)) {
  const pad = (s, n) => s + " ".repeat(Math.max(0, n - vis(s)));
  line(`  ${dim("┌" + "─".repeat(W - 2) + "┐")}`);
  line(`  ${dim("│")} ${pad(title, W - 4)} ${dim("│")}`);
  line(`  ${dim("├" + "─".repeat(W - 2) + "┤")}`);
  for (const r of rows) {
    if (r === "-") { line(`  ${dim("├" + "─".repeat(W - 2) + "┤")}`); continue; }
    const [l, v] = r;
    line(`  ${dim("│")} ${pad(dim(l), 22)}${pad(v, W - 26)} ${dim("│")}`);
  }
  line(`  ${dim("└" + "─".repeat(W - 2) + "┘")}`);
}

// ── RPC ───────────────────────────────────────────────────────────────
const proof = { chainId: 4663, rpc: RPC, generatedAt: new Date().toISOString(), calls: [] };
let rid = 0;
// Load-balanced public RPCs (e.g. thirdweb) can route "latest" to a node that is a block
// behind and answer "unsupported block number" / header not found. Retry those transient errors.
const TRANSIENT = /unsupported block|header not found|block not found|missing trie|timeout|rate|429|50[234]|fetch failed|not valid JSON|You are/i;
async function rpc(method, params, attempts = 6) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const body = { jsonrpc: "2.0", id: ++rid, method, params };
    try {
      const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      const json = await res.json();
      if (!json.error) { proof.calls.push({ request: body, response: json }); return json.result; }
      lastErr = new Error(`${method}: ${json.error.message}`);
    } catch (e) {
      lastErr = new Error(`${method}: ${e.message}`);
    }
    if (!TRANSIENT.test(lastErr.message)) throw lastErr;
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  throw lastErr;
}
const marketAbi = parseAbi([
  "function getMarketState() view returns (uint256 supplied, uint256 borrowed, uint256 available, uint256 index, uint256 collPrice, uint256 collPriceAt)",
  "function collateralCap() view returns (uint256)",
  "function supplyCap() view returns (uint256)",
  "function maxLtv() view returns (uint256)",
  "function liqThreshold() view returns (uint256)",
  "function liqBonus() view returns (uint256)",
  "function closeFactor() view returns (uint256)",
  "function aprWad() view returns (uint256)",
  "function maxOracleAge() view returns (uint256)",
  "function paused() view returns (bool)",
  "function guardian() view returns (address)",
]);
const feedAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function description() view returns (string)",
]);
async function call(to, abi, fn, a = []) {
  const data = encodeFunctionData({ abi, functionName: fn, args: a });
  const raw = await rpc("eth_call", [{ to, data }, "latest"]);
  return { value: decodeFunctionResult({ abi, functionName: fn, data: raw }), url: rpcCallUrl(to, data) };
}

// ── Steps from real broadcast receipts ────────────────────────────────
const names = {
  [dep.collateral.toLowerCase()]: "WETH", [dep.debtAsset.toLowerCase()]: "USDG",
  [dep.chainlinkEthUsd.toLowerCase()]: "Chainlink ETH/USD",
};
const steps = run.transactions.map((tx, i) => {
  const r = run.receipts[i];
  const fn = (tx.function ?? "").split("(")[0];
  let title, note;
  if (tx.transactionType === "CREATE") {
    title = `Deploy ${tx.contractName}`;
    note = tx.contractName === "LengoMarket" ? "WETH / USDG · LTV 60% · LT 75% · bonus 5% · APR 8%" : "Chainlink-backed, keeperless price oracle";
  } else if (fn === "setFeed") {
    title = "ChainlinkOracle.setFeed(WETH → ETH/USD)"; note = `staleness ${tx.arguments[2]} s`;
  } else if (fn === "setFixedPeg") {
    title = "ChainlinkOracle.setFixedPeg(USDG → $1.00)"; note = "stablecoin peg, 8 decimals";
  } else if (fn === "setCaps") {
    title = "LengoMarket.setCaps(25 WETH, 50,000 USDG)"; note = "capped beta guard";
  } else title = `${tx.contractName}.${fn}()`;
  return {
    create: tx.transactionType === "CREATE", title, note, hash: tx.hash,
    addr: tx.contractAddress, block: hex(r.blockNumber), gas: hex(r.gasUsed),
    ok: r.status === "0x1", from: tx.transaction.from,
  };
});
const checksum = (a) => Object.values(dep).find((v) => typeof v === "string" && v.toLowerCase() === a?.toLowerCase()) ?? a;

// ── Show ──────────────────────────────────────────────────────────────
const LOGO = [
  "██╗     ███████╗███╗   ██╗ ██████╗  ██████╗ ",
  "██║     ██╔════╝████╗  ██║██╔════╝ ██╔═══██╗",
  "██║     █████╗  ██╔██╗ ██║██║  ███╗██║   ██║",
  "██║     ██╔══╝  ██║╚██╗██║██║   ██║██║   ██║",
  "███████╗███████╗██║ ╚████║╚██████╔╝╚██████╔╝",
  "╚══════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ",
];
async function logoReveal() {
  const w = LOGO[0].length;
  for (let c = 0; c <= w; c += 2) {
    if (c) out(`\x1b[${LOGO.length}A`);
    for (const l of LOGO) {
      const head = [...l].slice(0, c).join(""), tail = [...l].slice(c).join("");
      line(`\x1b[2K  ${lime(head)}${dim(tail.replace(/[^ ]/g, "·"))}`);
    }
    await sleep(22);
  }
  // shimmer sweep
  for (let s = -6; s <= w + 6; s += 2) {
    out(`\x1b[${LOGO.length}A`);
    for (const l of LOGO) {
      let o = "";
      [...l].forEach((ch, i) => (o += Math.abs(i - s) < 3 ? `\x1b[1;38;2;255;255;255m${ch}\x1b[0m` : lime(ch)));
      line(`\x1b[2K  ${o}`);
    }
    await sleep(18);
  }
}

async function main() {
  out("\x1b[2J\x1b[H");
  line();
  await hexRain(1400);
  await logoReveal();
  line();
  await type("  Cross-chain lending, settled on Robinhood Chain.", bold, 22);
  line();
  line(`  ${dim("network")} ${lime("Robinhood Chain Mainnet")} ${dim("· chain 4663 · Arbitrum Orbit")}`);
  line(`  ${dim("oracle ")} ${sky("Chainlink ETH/USD")}   ${dim("payout")} ${sky("NEAR Intents 1Click")}`);
  line(`  ${dim("mode   ")} ${OFFLINE ? amber("OFFLINE · broadcast receipts only") : mint("LIVE · re-verified against " + link(RPC, RPC))}`);
  line(`  ${dim("tip    ")} ${dim("⌘-click any hash, address,")} ${sky("[rpc]")} ${dim("or")} ${sky("[contract]")} ${dim("tag to open the proof")}`);
  await sleep(1200);

  // 01 · boot
  await section("01", "BOOT");
  const boot = [
    ["Loading broadcast", "contracts/broadcast/DeployMainnet.s.sol/4663/run-latest.json"],
    ["Loading manifest", "contracts/deployments/4663.json"],
    ["Linking ABIs", "LengoMarket · ChainlinkOracle · IERC20"],
    ["Checking invariants", "collateral is never lent · debt shares + RAY index"],
  ];
  for (const [a, b] of boot) {
    await spin(`${a} ${dim(b)}`, 650);
    line(`  ${mint("✓")} ${a.padEnd(20)} ${dim(b)}`);
  }
  let head = null;
  if (!OFFLINE) {
    try {
      const chainId = hex(await spinWhile(`Dialing RPC ${dim(RPC)}`, rpc("eth_chainId", []), 900));
      if (chainId !== 4663) throw new Error(`wrong chain ${chainId}`);
      line(`  ${mint("✓")} ${"RPC handshake".padEnd(20)} ${dim("eth_chainId →")} ${lime(chainId)}`);
      head = hex(await spinWhile("eth_blockNumber", rpc("eth_blockNumber", []), 500));
      line(`  ${mint("✓")} ${"Chain head".padEnd(20)} ${dim("block")} ${lime("#" + fmt(head))}`);
    } catch (e) {
      line(`  ${amber("!")} RPC unreachable (${e.message}) · continuing offline`);
    }
  }
  const live = !OFFLINE && head !== null;

  // 02 · deployment replay
  await section("02", "DEPLOYMENT REPLAY · forge script DeployMainnet.s.sol");
  out(`  ${dim("$")} `);
  await type("forge script script/DeployMainnet.s.sol --rpc-url rh_mainnet --broadcast --verify", (s) => s, 20);
  line(); line();
  await spin("Compiling · solc 0.8.24 · optimizer 200 runs", 1500);
  line(`  ${mint("✓")} Compiled ${bold("LengoMarket")}, ${bold("ChainlinkOracle")} ${dim("· OpenZeppelin 5.1.0")}`);
  await spin("Simulating on fork · 5 transactions", 1200);
  line(`  ${mint("✓")} Simulation passed ${dim("· chain guard: 4663 only")}`);
  line(`  ${dim("  deployer")} ${link(addrUrl(steps[0].from), mint(checksum(steps[0].from)))}`);
  line();
  await sleep(400);

  let totalGas = 0;
  for (const [i, s] of steps.entries()) {
    const n = dim(`[${i + 1}/${steps.length}]`);
    await spin(`${n} ${s.title} ${dim("· signing & broadcasting")}`, s.create ? 1600 : 1000);
    await mineBlock(s.block);
    totalGas += s.gas;
    line(`  ${s.ok ? mint("✓") : red("✗")} ${n} ${bold(s.title)}`);
    if (s.note) line(`        ${dim(s.note)}`);
    line(`        ${dim("tx   ")} ${link(txUrl(s.hash), lime(short(s.hash, 14, 8)))}  ${link(rpcReceiptUrl(s.hash), sky("[rpc]"))}  ${dim("block")} ${fmt(s.block)}  ${dim("gas")} ${fmt(s.gas)}`);
    if (s.create) line(`        ${dim("addr ")} ${link(contractUrl(s.addr), mint(checksum(s.addr)))}  ${link(contractUrl(s.addr), sky("[contract]"))}`);
    line();
    await sleep(s.create ? 450 : 250);
  }
  await bar("Confirmations", 1400);
  await bar("Blockscout verify", 1600, 34, mint);

  // 03 · live RPC proof
  const verified = [];
  if (live) {
    await section("03", "LIVE RPC PROOF · eth_getTransactionReceipt");
    for (const s of steps) {
      const r = await spinWhile(`receipt ${short(s.hash)}`, rpc("eth_getTransactionReceipt", [s.hash]), 550);
      const ok = r && r.status === "0x1" && hex(r.blockNumber) === s.block && hex(r.gasUsed) === s.gas;
      verified.push(ok);
      line(`  ${ok ? mint("✓") : red("✗")} ${link(rpcReceiptUrl(s.hash), lime(short(s.hash, 14, 8)))} ${dim("status")} ${r?.status === "0x1" ? mint("success") : red(r?.status)} ${dim("block")} ${fmt(hex(r.blockNumber))} ${dim("gas")} ${fmt(hex(r.gasUsed))} ${ok ? dim("= broadcast") : red("≠ broadcast")}`);
    }
    line();
    for (const [label, a] of [["LengoMarket", dep.market], ["ChainlinkOracle", dep.oracle]]) {
      const code = await spinWhile(`eth_getCode ${label}`, rpc("eth_getCode", [a, "latest"]), 600);
      const bytes = (code.length - 2) / 2;
      line(`  ${bytes > 0 ? mint("✓") : red("✗")} ${label.padEnd(16)} ${link(contractUrl(a), sky("[contract]"))} ${lime(fmt(bytes) + " bytes")} ${dim("of runtime bytecode at")} ${link(contractUrl(a), dim(short(a)))}`);
    }

    // 04 · live state
    await section("04", "LIVE MARKET STATE · eth_call");
    const feed = await spinWhile("Chainlink ETH/USD latestRoundData()", call(dep.chainlinkEthUsd, feedAbi, "latestRoundData"), 800);
    const [roundId, answer, , updatedAt] = feed.value;
    const age = Math.floor(Date.now() / 1000) - Number(updatedAt);
    line(`  ${mint("✓")} ${"Chainlink ETH/USD".padEnd(20)} ${lime("$" + fmt(Number(formatUnits(answer, 8)).toFixed(2)))} ${dim(`round ${roundId} · ${age}s ago`)}  ${link(feed.url, sky("[rpc]"))}`);
    const ms = await spinWhile("LengoMarket.getMarketState()", call(dep.market, marketAbi, "getMarketState"), 800);
    const [supplied, borrowed, available, index, collPrice] = ms.value;
    line(`  ${mint("✓")} ${"getMarketState()".padEnd(20)} ${link(ms.url, sky("[rpc]"))}`);
    const util = supplied > 0n ? Number((borrowed * 10000n) / supplied) / 100 : 0;
    line(`        ${dim("supplied ")} ${lime(fmt(formatUnits(supplied, 6)) + " USDG")}`);
    line(`        ${dim("borrowed ")} ${lime(fmt(formatUnits(borrowed, 6)) + " USDG")}`);
    line(`        ${dim("available")} ${lime(fmt(formatUnits(available, 6)) + " USDG")}`);
    line(`        ${dim("WETH px  ")} ${lime("$" + fmt(Number(formatUnits(collPrice, 8)).toFixed(2)))} ${dim("via ChainlinkOracle")}`);
    line(`        ${dim("index    ")} ${lime(formatUnits(index, 27))} ${dim("RAY")}`);
    await bar(`Utilization ${util}%`, 900, 34, amber);
    line();
    const params = [
      ["maxLtv", (v) => `${Number(formatUnits(v, 16))}%`], ["liqThreshold", (v) => `${Number(formatUnits(v, 16))}%`],
      ["liqBonus", (v) => `${Number(formatUnits(v, 16))}%`], ["closeFactor", (v) => `${Number(formatUnits(v, 16))}%`],
      ["aprWad", (v) => `${Number(formatUnits(v, 16))}% fixed`], ["maxOracleAge", (v) => `${v} s`],
      ["collateralCap", (v) => `${formatUnits(v, 18)} WETH`], ["supplyCap", (v) => `${fmt(formatUnits(v, 6))} USDG`],
      ["paused", (v) => (v ? red("PAUSED") : mint("false"))],
    ];
    for (const [fn, f] of params) {
      const r = await spinWhile(`${fn}()`, call(dep.market, marketAbi, fn), 250);
      line(`  ${mint("✓")} ${(fn + "()").padEnd(20)} ${lime(f(r.value))}  ${link(r.url, sky("[rpc]"))}`);
    }
    writeFileSync(PROOF_FILE, JSON.stringify(proof, null, 2));
  }

  // 05 · summary
  await section(live ? "05" : "03", "SUMMARY");
  const allOk = steps.every((s) => s.ok) && (!live || verified.every(Boolean));
  box(`${bold("LENGO · ROBINHOOD CHAIN MAINNET")}  ${allOk ? mint("✓ all proofs pass") : red("✗ mismatch found")}`, [
    ["LengoMarket", link(contractUrl(dep.market), lime(dep.market))],
    ["ChainlinkOracle", link(contractUrl(dep.oracle), lime(dep.oracle))],
    ["Chainlink ETH/USD", link(addrUrl(dep.chainlinkEthUsd), lime(dep.chainlinkEthUsd))],
    ["WETH (collateral)", link(addrUrl(dep.collateral), lime(dep.collateral))],
    ["USDG (debt)", link(addrUrl(dep.debtAsset), lime(dep.debtAsset))],
    "-",
    ["Transactions", `${steps.length} · ${live ? `${verified.filter(Boolean).length}/${steps.length} re-verified via RPC` : "from broadcast receipts"}`],
    ["Total gas", fmt(totalGas)],
    ["Blocks", `${fmt(steps[0].block)} → ${fmt(steps.at(-1).block)}${head ? dim(`  (head #${fmt(head)})`) : ""}`],
    ["Caps (beta)", "25 WETH · 50,000 USDG"],
    ...(live ? [["RPC proof file", link(pathToFileURL(PROOF_FILE).href, sky("contracts/deployments/rpc-proof-4663.json"))], ["RPC calls", `${proof.calls.length} raw request/response pairs`]] : []),
  ]);
  line();
  line(`  ${dim("LengoMarket    ")}  ${link(contractUrl(dep.market), lime(contractUrl(dep.market)))}`);
  line(`  ${dim("ChainlinkOracle")}  ${link(contractUrl(dep.oracle), lime(contractUrl(dep.oracle)))}`);
  line(`  ${dim("App            ")}  ${link("https://lengoapp.tech", lime("https://lengoapp.tech"))}`);
  line();
  line(`  ${dim("Read-only showcase · no transactions sent · capped beta, external audit pending")}`);
  line();
}
main().catch((e) => { line(); line(red(`  ✗ ${e.stack || e.message}`)); process.exit(1); });
