import fs from "fs";
import path from "path";
import { validateProxy } from "../server/utils/proxyValidator.js";

const PROTOCOL_FILTER = "socks4";
const INPUT_FILE = "data/proxies.txt";
const OUTPUT_FILE = "data/proxies_validated.txt";
const CONCURRENCY = 20;
const TIMEOUT = 8000;

function parseProxyLine(line) {
  line = line.trim();
  if (!line || line.startsWith("#")) return null;

  if (line.includes("://")) {
    const [protocol, rest] = line.split("://");
    if (rest.includes("@")) {
      const [auth, addr] = rest.split("@");
      const [username, password] = auth.split(":");
      const [host, port] = addr.split(":");
      return { protocol, host, port: parseInt(port), username, password };
    } else {
      const [host, port] = rest.split(":");
      return { protocol, host, port: parseInt(port) };
    }
  } else {
    const [host, port] = line.split(":");
    return { protocol: "socks4", host, port: parseInt(port || "1080") };
  }
}

async function main() {
  const inputPath = path.join(process.cwd(), INPUT_FILE);
  const outputPath = path.join(process.cwd(), OUTPUT_FILE);

  console.log(`Reading proxies from ${INPUT_FILE}...`);
  
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(inputPath, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  console.log(`Total lines in file: ${lines.length}`);

  const allProxies = lines.map(parseProxyLine).filter(p => p && p.host && !isNaN(p.port));
  console.log(`Valid proxy entries: ${allProxies.length}`);

  const filteredProxies = allProxies.filter(p => p.protocol === PROTOCOL_FILTER);
  console.log(`${PROTOCOL_FILTER.toUpperCase()} proxies found: ${filteredProxies.length}`);

  if (filteredProxies.length === 0) {
    console.log(`\nNo ${PROTOCOL_FILTER} proxies found in the file.`);
    console.log("Protocols found in file:", [...new Set(allProxies.map(p => p.protocol))].join(", "));
    process.exit(0);
  }

  console.log(`\nValidating ${filteredProxies.length} ${PROTOCOL_FILTER} proxies (concurrency: ${CONCURRENCY})...\n`);

  const validProxies = [];
  let processed = 0;

  for (let i = 0; i < filteredProxies.length; i += CONCURRENCY) {
    const batch = filteredProxies.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(proxy => validateProxy(proxy, TIMEOUT))
    );

    for (const result of results) {
      processed++;
      if (result.valid) {
        validProxies.push({ ...result.proxy, latency: result.latency });
        console.log(`[PASS] ${result.proxy.host}:${result.proxy.port} (${result.latency}ms)`);
      } else {
        console.log(`[FAIL] ${result.proxy.host}:${result.proxy.port} - ${result.error}`);
      }
    }

    console.log(`Progress: ${processed}/${filteredProxies.length} | Valid: ${validProxies.length}\n`);
  }

  console.log(`\n========== RESULTS ==========`);
  console.log(`Total ${PROTOCOL_FILTER} proxies: ${filteredProxies.length}`);
  console.log(`Working proxies: ${validProxies.length}`);
  console.log(`Dead proxies: ${filteredProxies.length - validProxies.length}`);
  console.log(`Success rate: ${((validProxies.length / filteredProxies.length) * 100).toFixed(1)}%`);

  if (validProxies.length > 0) {
    validProxies.sort((a, b) => a.latency - b.latency);
    
    const output = validProxies
      .map(p => `${p.protocol}://${p.host}:${p.port}`)
      .join("\n");

    fs.writeFileSync(outputPath, output);
    console.log(`\nValid proxies saved to: ${OUTPUT_FILE}`);
    console.log(`Top 5 fastest:`);
    validProxies.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.host}:${p.port} (${p.latency}ms)`);
    });
  } else {
    console.log(`\nNo valid proxies found.`);
  }
}

main().catch(console.error);
