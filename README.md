# Network Stresser

Network Stresser is a web-based network stress testing tool with a React frontend and a Node.js/Express backend. It lets you configure a target and method in the UI and view live statistics via Socket.IO.

**Disclaimer**
This project is for educational purposes only and should not be used for malicious purposes. Use it only on systems you own or have explicit permission to test.

**Features**
- Web UI for configuring target, method, duration, packet size, and delay
- Live stats streaming over Socket.IO
- Worker-thread execution to keep the server responsive

**Attack Methods**
- HTTP Flood
- HTTP Slowloris
- HTTP RUDY (slow POST)

**Project Structure**
- `src/` React frontend (Vite)
- `server/` Express server and Socket.IO handlers
- `server/workers/` worker-based attack implementations
- `scripts/` helper utilities
- `data/` runtime data files
- `dist/` build output

**Requirements**
- Node.js 18+ recommended
- npm

**Development**
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `data/uas.txt` with one user agent per line. Lines starting with `#` are ignored.
3. Start the dev servers:
   ```bash
   npm run dev
   ```
4. Open the UI at `http://localhost:5173`. The API server runs at `http://localhost:3000`.

**Production**
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the client and server:
   ```bash
   npm run build
   ```
3. Start the server:
   ```bash
   npm run start
   ```
4. Open `http://localhost:3000`.

**Configuration**
- `PORT` sets the server port (default `3000`).
- `NODE_ENV=production` enables production behavior and serves the built UI from `dist/public`.
- `data/uas.txt` is loaded on server startup. If it is missing, the server continues with an empty list and logs an error.

**Scripts**
| Script | Description |
| --- | --- |
| `npm run dev` | Run client and server in watch mode |
| `npm run dev:client` | Run the Vite dev server |
| `npm run dev:server` | Run the backend with tsx watch |
| `npm run build` | Build client and server outputs |
| `npm run build:client` | Build the frontend only |
| `npm run build:server` | Build the backend only |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run clean` | Remove `dist/` |
| `npm run preview` | Preview the Vite build |
| `npm run validate-proxies` | Validate proxies (see notes) |
| `npm run filter-proxies` | Filter and validate proxies (see notes) |

**Notes**
- `npm run validate-proxies` points to `scripts/validateProxies.js`, which is not present.
- `npm run filter-proxies` imports `server/utils/proxyValidator.js`, which is not present.
- `data/proxies.txt` is only used by the proxy helper scripts and is not required for core functionality.

**License**
 See `LICENSE`.
