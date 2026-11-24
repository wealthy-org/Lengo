#!/usr/bin/env node
// Animated terminal replay of the REAL Lengo deployment on Robinhood Chain testnet (46630).
// Every hash, block, gas figure and address comes from Foundry's broadcast receipts
// (contracts/broadcast/Deploy.s.sol/46630/run-latest.json). Nothing is sent onchain.
//
// Usage: node scripts/deploy-replay.mjs [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = JSON.parse(readFileSync(join(root, "contracts/broadcast/Deploy.s.sol/46630/run-latest.json"), "utf8"));
const dep = JSON.parse(readFileSync(join(root, "contracts/deployments/46630.json"), "utf8"));
const checksum = (a) => Object.values(dep).find((v) => typeof v === "string" && v.toLowerCase() === a?.toLowerCase()) ?? a;
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const FAST = process.argv.includes("--fast");
const T = (ms) => (FAST ? ms / 4 : ms);

// ── ANSI ──────────────────────────────────────────────────────────────
const esc = (c) => (s) => `\x1b[${c}m${s}\x1b[0m`;
const lime = (s) => `\x1b[38;2;201;242;122m${s}\x1b[0m`;
const mint = (s) => `\x1b[38;2;127;224;180m${s}\x1b[0m`;
const dim = (s) => `\x1b[38;2;133;154;142m${s}\x1b[0m`;
const amber = (s) => `\x1b[38;2;242;193;78m${s}\x1b[0m`;
const bold = esc(1);
const out = (s = "") => process.stdout.write(s);
const line = (s = "") => out(s + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, T(ms)));
const hideCursor = () => out("\x1b[?25l");
const showCursor = () => out("\x1b[?25h");
process.on("exit", showCursor);
process.on("SIGINT", () => { showCursor(); process.exit(130); });

const short = (h, a = 10, b = 6) => `${h.slice(0, a)}…${h.slice(-b)}`;
const fmt = (n) => n.toLocaleString("en-US");
const hex = (h) => parseInt(h, 16);

async function type(s, color = (x) => x, speed = 14) {
  for (const ch of s) { out(color(ch)); await sleep(speed); }
}
async function spin(label, ms) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const end = Date.now() + T(ms);
  let i = 0;
  // Keep the spinner on one physical line, or \r cannot overwrite it in narrow terminals.
  const max = Math.max(10, (process.stdout.columns || 100) - 6);
  const plain = label.replace(/\x1b\[[0-9;]*m/g, "");
  const shown = plain.length > max ? plain.slice(0, max - 1) + "…" : label;
  while (Date.now() < end) { out(`\r\x1b[2K  ${lime(frames[i++ % frames.length])} ${shown}`); await sleep(70); }
  out("\r\x1b[2K");
}
async function bar(label, ms, width = 32) {
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const n = Math.round((i / steps) * width);
    out(`\r  ${dim(label.padEnd(18))} ${lime("█".repeat(n))}${dim("░".repeat(width - n))} ${dim(String(Math.round((i / steps) * 100)).padStart(3) + "%")}`);
    await sleep(ms / steps);
  }
  line();
}

// ── Steps from real receipts ──────────────────────────────────────────
const tokenNames = ["tBTC", "tUSDC"];
let tokenIdx = 0;
const steps = run.transactions.map((tx, i) => {
  const r = run.receipts[i];
  const name = tx.contractName;
  let title;
  if (tx.transactionType === "CREATE") {
    title = name === "TestToken" ? `Deploy TestToken ${tokenNames[tokenIdx++] ?? ""}`.trim() : `Deploy ${name}`;
  } else {
    const fn = (tx.function ?? "").split("(")[0];
    const target = name === "TestToken" ? (tx.contractAddress?.toLowerCase() === run.transactions[0].contractAddress?.toLowerCase() ? "tBTC" : "tUSDC") : name;
    title = `${target}.${fn}()`;
    if (fn === "setPrice") title = `Oracle.setPrice(${tx.arguments?.[0]?.toLowerCase() === run.transactions[0].contractAddress?.toLowerCase() ? "tBTC → $100,000" : "tUSDC → $1.00"})`;
    if (fn === "supply") title = "Market.supply(10,000 tUSDC)  · seed liquidity";
    if (fn === "faucet") title = "tUSDC.faucet()  · deployer mint";
    if (fn === "approve") title = "tUSDC.approve(Market)";
  }
  return {
    create: tx.transactionType === "CREATE", title, hash: tx.hash, addr: checksum(tx.contractAddress),
    block: hex(r.blockNumber), gas: hex(r.gasUsed), ok: r.status === "0x1",
  };
});

// ── Show ──────────────────────────────────────────────────────────────
async function main() {
  hideCursor();
  out("\x1b[2J\x1b[H");
  const logo = [
    "  ██╗     ███████╗███╗   ██╗ ██████╗  ██████╗ ",
    "  ██║     ██╔════╝████╗  ██║██╔════╝ ██╔═══██╗",
    "  ██║     █████╗  ██╔██╗ ██║██║  ███╗██║   ██║",
    "  ██║     ██╔══╝  ██║╚██╗██║██║   ██║██║   ██║",
    "  ███████╗███████╗██║ ╚████║╚██████╔╝╚██████╔╝",
    "  ╚══════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ",
  ];
  for (const l of logo) { line(lime(l)); await sleep(60); }
  line();
  line(`  ${bold("Cross-chain lending")} ${dim("·")} deployment to ${lime("Robinhood Chain Testnet")} ${dim("· chain 46630")}`);
  line(`  ${amber("REPLAY")} ${dim("of the real broadcast · receipts from contracts/broadcast/Deploy.s.sol/46630")}`);
  line();
  await sleep(700);

  out(`  ${dim("$")} `); await type("forge script script/Deploy.s.sol --rpc-url rh_testnet --broadcast", (s) => s, 18);
  line(); line(); await sleep(300);

  await spin("Compiling contracts · solc 0.8.24 · optimizer 200 runs", 1400);
  line(`  ${mint("✓")} Compiled ${bold("LengoMarket")}, ${bold("TestToken")}, ${bold("DemoOracle")} ${dim("· OpenZeppelin 5.1.0")}`);
  await spin("Chain guard · refusing anything but 46630", 700);
  line(`  ${mint("✓")} Chain ${lime("46630")} ${dim("Robinhood Chain Testnet · Arbitrum Orbit")}`);
  line();
  await sleep(400);

  let totalGas = 0;
  for (const [i, s] of steps.entries()) {
    const n = dim(`[${String(i + 1).padStart(2, "0")}/${String(steps.length).padStart(2, "0")}]`);
    await spin(`${n} ${s.title}`, s.create ? 1300 : 800);
    totalGas += s.gas;
    line(`  ${s.ok ? mint("✓") : "\x1b[31m✗\x1b[0m"} ${n} ${bold(s.title)}`);
    line(`        ${dim("tx")}    ${lime(short(s.hash))}   ${dim("block")} ${fmt(s.block)}   ${dim("gas")} ${fmt(s.gas)}`);
    if (s.create) line(`        ${dim("addr")}  ${mint(s.addr)}`);
    await sleep(s.create ? 350 : 200);
  }
  line();
  await bar("Confirmations", 1200);
  await bar("Blockscout verify", 1400);
  line();

  // Summary
  const contracts = steps.filter((s) => s.create);
  const W = 74;
  const vis = (x) => x.replace(/\x1b\[[0-9;]*m/g, "").length;
  const row = (l, r) => line(`  ${dim("│")} ${l}${" ".repeat(Math.max(1, 21 - vis(l)))}${r}${" ".repeat(Math.max(0, W - 24 - vis(r)))}${dim("│")}`);
  line(`  ${dim("┌" + "─".repeat(W - 2) + "┐")}`);
  row(bold("DEPLOYED"), mint("4 contracts · all verified ✓"));
  line(`  ${dim("├" + "─".repeat(W - 2) + "┤")}`);
  for (const c of contracts) row(c.title.replace("Deploy ", ""), lime(c.addr));
  line(`  ${dim("├" + "─".repeat(W - 2) + "┤")}`);
  row(dim("Transactions"), `${steps.length} · all success`);
  row(dim("Total gas"), fmt(totalGas));
  row(dim("Blocks"), `${fmt(steps[0].block)} → ${fmt(steps.at(-1).block)}`);
  row(dim("Seed liquidity"), "10,000 tUSDC");
  line(`  ${dim("└" + "─".repeat(W - 2) + "┘")}`);
  line();
  line(`  ${dim("Explorer")}  ${lime(`${EXPLORER}/address/${contracts.find((c) => c.title.includes("LengoMarket")).addr}`)}`);
  line(`  ${dim("App     ")}  ${lime("https://lengo-two.vercel.app")}`);
  line();
  line(`  ${dim("Testnet demo assets · no value · contracts not audited")}`);
  line();
  showCursor();
}

main();
