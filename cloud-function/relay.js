// Teaching-affairs API relay.
//
// GitHub Actions cannot reach the BUPT teaching-affairs API directly: the
// hostname resolves to 10.3.19.2, an address that only exists inside the
// campus network. This process runs on a machine that sits on that network
// and forwards the two calls the fetcher needs.
//
// Run: node relay.js   ->   listens on BIND_HOST:BIND_PORT

const http = require("http");
const os = require("os");

const JW_HOST = "jwglweixin.bupt.edu.cn";
const LOGIN_URL = `http://${JW_HOST}/bjyddx/login`;
const QUERY_URL = `http://${JW_HOST}/bjyddx/todayClassrooms`;

const PORT = process.env.PORT || 3000;
const HOST = process.env.BIND_HOST || "0.0.0.0";
const SECRET = process.env.RELAY_SECRET || "emptyclassroom";

// ============================================================
// Plain HTTP forwarding, no third-party dependencies
// ============================================================

function jwRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method,
      headers: { ...headers, Host: JW_HOST },
      timeout: 30000,
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const data = Buffer.concat(chunks).toString("utf-8");
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (body) req.write(body);
    req.end();
  });
}

// Non-loopback addresses of this machine. Used to locate the box on the
// campus LAN when its DHCP address has changed.
function localAddresses() {
  const out = {};
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.internal) continue;
      (out[name] = out[name] || []).push(a.address);
    }
  }
  return out;
}

// ============================================================
// HTTP server
// ============================================================

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  const u = new URL(req.url, "http://localhost");
  const path = u.pathname;
  const secret = u.searchParams.get("secret");

  if (secret !== SECRET) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: "forbidden" }));
  }

  try {
    // Build the query string without "secret" — the teaching API does not
    // know that field.
    const fwd = new URLSearchParams(u.searchParams);
    fwd.delete("secret");
    const fwdQS = fwd.toString();

    // -- POST /login --
    if (req.method === "POST" && path === "/login") {
      const target = LOGIN_URL + (fwdQS ? "?" + fwdQS : "");
      const data = await jwRequest(target, "POST", {});
      // Never log the body: a successful login response carries a token.
      const code = data && typeof data === "object" ? data.code : "?";
      console.log(`[login] code=${code}`);
      res.statusCode = 200;
      return res.end(JSON.stringify(data));
    }

    // -- GET /query --
    if (req.method === "GET" && path === "/query") {
      const campusId = u.searchParams.get("campusId") || "1";
      const token = req.headers["token"] || u.searchParams.get("token") || "";
      const target = `${QUERY_URL}?campusId=${campusId}`;
      const data = await jwRequest(target, "GET", { token });
      const items = (data && data.data) || [];
      console.log(`[query] campusId=${campusId} items=${items.length}`);
      res.statusCode = 200;
      return res.end(JSON.stringify(data));
    }

    // -- GET /health --
    if (req.method === "GET" && path === "/health") {
      return res.end(JSON.stringify({ ok: true, time: new Date().toISOString() }));
    }

    // -- GET /lanip --
    // Reports where this box currently sits on the LAN. The tunnel URL is
    // fixed, so this is how to rediscover the address after a DHCP change.
    if (req.method === "GET" && path === "/lanip") {
      return res.end(JSON.stringify({ hostname: os.hostname(), addresses: localAddresses() }));
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  } catch (e) {
    console.error(`[error] ${path}: ${e.message}`);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Relay listening on ${HOST}:${PORT}`);
});
