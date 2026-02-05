import express from "express";
import { createServer } from "http";
import { dirname, join } from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { Worker } from "worker_threads";

import { loadUserAgents } from "./fileLoader";
import { AttackMethod } from "./lib";

const attackWorkers: Record<AttackMethod, string> = {
  http_flood: "./workers/httpFloodAttack.js",
  http_slowloris: "./workers/httpSlowlorisAttack.js",
  http_rudy: "./workers/httpRudyAttack.js",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __prod = process.env.NODE_ENV === "production";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: __prod ? "" : "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const userAgents = loadUserAgents();
console.log("User agents loaded:", userAgents.length);

app.use(express.static(join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.emit("stats", {
    totalPackets: 0,
    log: "Connected to server.",
  });

  socket.on("startAttack", (params: {
    target: string;
    duration: number;
    packetDelay: number;
    attackMethod: AttackMethod;
    packetSize: number;
  }) => {
    const { target, duration, packetDelay, attackMethod, packetSize } = params;
    const attackWorkerFile = attackWorkers[attackMethod];

    if (!attackWorkerFile) {
      socket.emit("stats", { log: `Unsupported attack type: ${attackMethod}` });
      return;
    }

    socket.emit("stats", { log: `Starting ${attackMethod} attack on ${target}` });

    const worker = new Worker(join(__dirname, attackWorkerFile), {
      workerData: {
        target,
        userAgents,
        duration,
        packetDelay,
        packetSize,
      },
    });

    worker.on("message", (message) => socket.emit("stats", message));

    worker.on("error", (error: Error) => {
      console.error(`Worker error: ${error.message}`);
      socket.emit("stats", { log: `Worker error: ${error.message}` });
    });

    worker.on("exit", (code) => {
      console.log(`Worker exited with code ${code}`);
      socket.emit("attackEnd");
    });

    (socket as any).worker = worker;
  });

  socket.on("stopAttack", () => {
    const worker = (socket as any).worker;
    if (worker) {
      worker.terminate();
      socket.emit("attackEnd");
    }
  });

  socket.on("disconnect", () => {
    const worker = (socket as any).worker;
    if (worker) {
      worker.terminate();
    }
    console.log("Client disconnected");
  });
});

const PORT = parseInt(process.env.PORT || "3000");
httpServer.listen(PORT, () => {
  if (__prod) {
    console.log(`Server running at http://localhost:${PORT}`);
  } else {
    console.log(`Development server running on port ${PORT}`);
  }
});
