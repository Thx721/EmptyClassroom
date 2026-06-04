// 教务 API Relay — 阿里云 ECS 中转
// 接收 GitHub Actions 请求，转发到北邮教务服务器
// 部署: node relay.js  →  监听 0.0.0.0:3000

const http = require("http");

const JW_HOST = "jwglweixin.bupt.edu.cn";
const LOGIN_URL = `http://${JW_HOST}/bjyddx/login`;
const QUERY_URL = `http://${JW_HOST}/bjyddx/todayClassrooms`;

const PORT = process.env.PORT || 3000;
const SECRET = process.env.RELAY_SECRET || "emptyclassroom";

// ============================================================
// 简易 HTTP 转发（不使用第三方依赖）
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
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (body) req.write(body);
    req.end();
  });
}

// ============================================================
// HTTP Server
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
    // 构建不含 secret 的查询参数（教务不认识这个字段）
    const fwd = new URLSearchParams(u.searchParams);
    fwd.delete("secret");
    const fwdQS = fwd.toString();

    // ── POST /login ──
    if (req.method === "POST" && path === "/login") {
      const target = LOGIN_URL + (fwdQS ? "?" + fwdQS : "");
      console.log(`[login] -> ${target.substring(0, 80)}...`);
      const data = await jwRequest(target, "POST", {});
      console.log(`[login] <- ${JSON.stringify(data).substring(0, 100)}`);
      res.statusCode = 200;
      return res.end(JSON.stringify(data));
    }

    // ── GET /query ──
    if (req.method === "GET" && path === "/query") {
      const campusId = u.searchParams.get("campusId") || "1";
      const token = req.headers["token"] || u.searchParams.get("token") || "";
      const target = `${QUERY_URL}?campusId=${campusId}`;
      console.log(`[query] -> campusId=${campusId}`);
      const data = await jwRequest(target, "GET", { token });
      console.log(`[query] <- ${JSON.stringify(data).substring(0, 100)}`);
      res.statusCode = 200;
      return res.end(JSON.stringify(data));
    }

    // ── GET /health ──
    if (req.method === "GET" && path === "/health") {
      return res.end(JSON.stringify({ ok: true, time: new Date().toISOString() }));
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  } catch (e) {
    console.error(`[error] ${path}: ${e.message}`);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Relay listening on port ${PORT}, secret=${SECRET}`);
});
