import { Bot, Wand2, Wifi, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

function isHostLocal(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("::1") ||
    host.startsWith("192.168") ||
    host.startsWith("10.") ||
    host.startsWith("172.")
  );
}

function getSocketURL() {
  const host = window.location.host.split(":")[0];
  const isLocal = isHostLocal(host);
  const socketURL = isLocal ? `http://${host}:3000` : "/";
  return socketURL;
}

const socket = io(getSocketURL());

function App() {
  const [isAttacking, setIsAttacking] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState("");
  const [attackMethod, setAttackMethod] = useState("http_slowloris");
  const [packetSize, setPacketSize] = useState(64);
  const [duration, setDuration] = useState(60);
  const [packetDelay, setPacketDelay] = useState(100);
  const [stats, setStats] = useState({
    pps: 0,
    bots: 0,
    totalPackets: 0,
  });
  const [lastUpdatedPPS, setLastUpdatedPPS] = useState(Date.now());
  const [lastTotalPackets, setLastTotalPackets] = useState(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdatedPPS >= 500) {
      setLastUpdatedPPS(now);
      setStats((old) => ({
        pps: (old.totalPackets - lastTotalPackets) / (now - lastUpdatedPPS),
        bots: old.bots,
        totalPackets: old.totalPackets,
      }));
      setLastTotalPackets(stats.totalPackets);
    }
  }, [lastUpdatedPPS, lastTotalPackets, stats.totalPackets]);

  useEffect(() => {
    socket.on("stats", (data) => {
      setStats((old) => ({
        pps: data.pps || old.pps,
        bots: data.bots || old.bots,
        totalPackets: data.totalPackets || old.totalPackets,
      }));
      if (data.log) addLog(data.log);
      setProgress((prev) => (prev + 10) % 100);
    });

    socket.on("attackEnd", () => {
      setIsAttacking(false);
    });

    return () => {
      socket.off("stats");
      socket.off("attackEnd");
    };
  }, []);

  const addLog = (message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 12));
  };

  const startAttack = () => {
    if (!target.trim()) {
      alert("Please enter a target!");
      return;
    }

    setIsAttacking(true);
    setStats((old) => ({
      pps: 0,
      bots: old.bots,
      totalPackets: 0,
    }));
    addLog("Initializing attack sequence...");

    socket.emit("startAttack", {
      target,
      packetSize,
      duration,
      packetDelay,
      attackMethod,
    });
  };

  const stopAttack = () => {
    socket.emit("stopAttack");
    setIsAttacking(false);
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-12">
        <header className="pt-8 text-center">
          <p className="mb-3 text-xs tracking-[0.3em] uppercase text-[#6C6863]">Network Stress Testing</p>
                    <div className="w-12 h-px mx-auto mt-6 bg-[#1A1A1A]/20" />
        </header>

        <div className="relative p-8 bg-[#F9F8F6] border border-[#1A1A1A]/10 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          
          <div className="mb-8 space-y-6">
            <div className="flex gap-4">
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Enter target URL or IP"
                className="flex-1 px-4 py-3 bg-transparent border border-[#1A1A1A]/10 text-[#1A1A1A] placeholder:text-[#6C6863]/60 focus:border-[#1A1A1A]/40 focus:outline-none"
                disabled={isAttacking}
              />
              <button
                onClick={() => (isAttacking ? stopAttack() : startAttack())}
                className={`px-6 py-3 text-xs tracking-[0.2em] uppercase font-medium transition-all flex items-center gap-3 ${
                  isAttacking
                    ? "bg-[#1A1A1A] text-[#F9F8F6] hover:bg-[#1A1A1A]/80"
                    : "bg-[#1A1A1A] text-[#F9F8F6] hover:bg-[#1A1A1A]/90 shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
                }`}
              >
                <Wand2 className="w-4 h-4" />
                {isAttacking ? "Stop" : "Execute"}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block mb-2 text-xs tracking-[0.25em] uppercase text-[#6C6863]">
                  Method
                </label>
                <select
                  value={attackMethod}
                  onChange={(e) => setAttackMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-transparent border border-[#1A1A1A]/10 text-[#1A1A1A] focus:border-[#1A1A1A]/40 focus:outline-none appearance-none cursor-pointer"
                  disabled={isAttacking}
                >
                  <option value="http_slowloris">Slowloris</option>
                  <option value="http_flood">HTTP Flood</option>
                  <option value="http_rudy">RUDY (Slow POST)</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 text-xs tracking-[0.25em] uppercase text-[#6C6863]">
                  Packet Size
                </label>
                <input
                  type="number"
                  value={packetSize}
                  onChange={(e) => setPacketSize(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-transparent border border-[#1A1A1A]/10 text-[#1A1A1A] focus:border-[#1A1A1A]/40 focus:outline-none"
                  disabled={isAttacking}
                  min="1"
                  max="1500"
                />
              </div>
              <div>
                <label className="block mb-2 text-xs tracking-[0.25em] uppercase text-[#6C6863]">
                  Duration
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-transparent border border-[#1A1A1A]/10 text-[#1A1A1A] focus:border-[#1A1A1A]/40 focus:outline-none"
                  disabled={isAttacking}
                  min="1"
                  max="300"
                />
              </div>
              <div>
                <label className="block mb-2 text-xs tracking-[0.25em] uppercase text-[#6C6863]">
                  Delay (ms)
                </label>
                <input
                  type="number"
                  value={packetDelay}
                  onChange={(e) => setPacketDelay(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-transparent border border-[#1A1A1A]/10 text-[#1A1A1A] focus:border-[#1A1A1A]/40 focus:outline-none"
                  disabled={isAttacking}
                  min="1"
                  max="1000"
                />
              </div>
            </div>

          </div>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="p-6 border border-[#1A1A1A]/10 transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-[#6C6863]" />
                <span className="text-xs tracking-[0.25em] uppercase text-[#6C6863]">Packets/sec</span>
              </div>
              <div className="font-serif text-3xl font-light text-[#1A1A1A]">
                {stats.pps.toLocaleString()}
              </div>
            </div>
            <div className="p-6 border border-[#1A1A1A]/10 transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-[#6C6863]" />
                <span className="text-xs tracking-[0.25em] uppercase text-[#6C6863]">Active Bots</span>
              </div>
              <div className="font-serif text-3xl font-light text-[#1A1A1A]">
                {stats.bots.toLocaleString()}
              </div>
            </div>
            <div className="p-6 border border-[#1A1A1A]/10 transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="w-4 h-4 text-[#6C6863]" />
                <span className="text-xs tracking-[0.25em] uppercase text-[#6C6863]">Total Packets</span>
              </div>
              <div className="font-serif text-3xl font-light text-[#1A1A1A]">
                {stats.totalPackets.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="h-1 mb-8 overflow-hidden bg-[#EBE5DE]">
            <div
              className="h-full transition-all duration-500 bg-[#1A1A1A]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-6 font-mono text-sm bg-[#1A1A1A] text-[#F9F8F6]/80">
            {logs.map((log, index) => (
              <div key={index} className="py-1 border-b border-[#F9F8F6]/5 last:border-0">
                <span className="text-[#6C6863] mr-2">&gt;</span>{log}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-[#6C6863]">
                <span className="mr-2">&gt;</span>Awaiting command...
              </div>
            )}
          </div>

          {isAttacking && (
            <div className="absolute top-4 right-4">
              <div className="w-2 h-2 bg-[#1A1A1A] animate-pulse" />
            </div>
          )}
        </div>

              </div>
    </div>
  );
}

export default App;
