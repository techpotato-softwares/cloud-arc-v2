import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const dist = resolve("dist");
const source = await readFile(resolve(dist, "index.html"), "utf8");

const pricingDescription = "Compare ForgeArc Node, Python, and AI source-kit licenses in INR or USD, with clear modules, updates, and entitlements.";
const pricingBody = `<div id="app"><main><h1>ForgeArc pricing</h1><p>Compare one-time source-kit licenses for ForgeArc Node, ForgeArc Python, bundles, and available ForgeArc AI modules.</p><p>India checkout uses Razorpay and international checkout uses Stripe. Live prices and availability are loaded from the ForgeArc commerce catalog.</p><p><a href="/">Explore ForgeArc</a> or <a href="https://docs.forgearc.dev">review the documentation</a>.</p></main></div>`;

const pricing = source
  .replace(/<title>.*?<\/title>/, "<title>Pricing — ForgeArc</title>")
  .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${pricingDescription}" />`)
  .replace(/<link rel="canonical" href=".*?" \/>/, '<link rel="canonical" href="https://forgearc.dev/pricing" />')
  .replace(/<meta property="og:url" content=".*?" \/>/, '<meta property="og:url" content="https://forgearc.dev/pricing" />')
  .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Pricing — ForgeArc" />')
  .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${pricingDescription}" />`)
  .replace(/<meta name="twitter:title" content=".*?" \/>/, '<meta name="twitter:title" content="Pricing — ForgeArc" />')
  .replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${pricingDescription}" />`)
  .replace(/<div id="app">[\s\S]*?<\/div>/, pricingBody);

await mkdir(resolve(dist, "pricing"), { recursive: true });
await writeFile(resolve(dist, "pricing", "index.html"), pricing);

console.log("Prerendered / and /pricing");
