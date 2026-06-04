// 空教室数据抓取脚本 - Node.js 版
// 供 GitHub Actions 使用，每天定时从 JWGL API 拉取数据
import crypto from "crypto";
import dns from "node:dns/promises";
import fs from "fs";

const LOGIN_URL = "http://jwglweixin.bupt.edu.cn/bjyddx/login";
const QUERY_URL = "http://jwglweixin.bupt.edu.cn/bjyddx/todayClassrooms?campusId=0";

const CAMPUS_LIST = [
  { id: 1, name: "西土城" },
  { id: 4, name: "沙河" },
];

const MAX_RETRIES = 30;        // 最多重试 30 次，超过就认命走降级
const MAX_RETRY_DELAY_MS = 30_000; // 随机延迟上限 30 秒，避免固定间隔被限流

// ============================================================
// 工具函数
// ============================================================

/** 获取北京时间今天的日期字符串 YYYY-MM-DD */
function getBeijingToday() {
  const now = new Date();
  const beijing = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" })
  );
  const y = beijing.getFullYear();
  const m = String(beijing.getMonth() + 1).padStart(2, "0");
  const d = String(beijing.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 延迟 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// AES-128-ECB + 双重 Base64 加密
function encryptPassword(pwd) {
  const key = Buffer.from("qzkj1kjghd=876&*");
  const data = Buffer.from(`"${pwd}"`);

  // PKCS7 padding
  const blockSize = 16;
  const padding = blockSize - (data.length % blockSize);
  const padded = Buffer.concat([data, Buffer.alloc(padding, padding)]);

  // AES-128-ECB
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);

  // Double base64
  const first = encrypted.toString("base64");
  return Buffer.from(first).toString("base64");
}

// ============================================================
// 数据新鲜度检查
// ============================================================

/**
 * 检查 JWGL 返回的数据是否属于"今天"
 * 从每条数据的 NODETIME 字段提取日期，与北京今天对比
 *
 * @param {Array} jwData - API 返回的原始数据 [{NODETIME, NODENAME, CLASSROOMS}, ...]
 * @returns {{ fresh: boolean, dataDate: string, matchCount: number, totalCount: number }}
 */
function checkDataFreshness(jwData) {
  const today = getBeijingToday();
  const dateCounts = {}; // { "2026-06-04": 5, "2026-06-03": 2 }

  for (const item of jwData || []) {
    const dt = item.NODETIME;
    if (dt) {
      // 统一格式化为 YYYY-MM-DD，防止 API 返回不同格式
      const parsed = normalizeDate(dt);
      if (parsed) {
        dateCounts[parsed] = (dateCounts[parsed] || 0) + 1;
      }
    }
  }

  const dates = Object.keys(dateCounts);
  if (dates.length === 0) {
    return {
      fresh: false,
      dataDate: "unknown",
      matchCount: 0,
      totalCount: (jwData || []).length,
    };
  }

  // 取出现次数最多的日期
  dates.sort((a, b) => dateCounts[b] - dateCounts[a]);
  const dominantDate = dates[0];
  const matchCount = dateCounts[today] || 0;
  const totalCount = (jwData || []).length;

  return {
    fresh: dominantDate === today,
    dataDate: dominantDate,
    matchCount,
    totalCount,
  };
}

/** 把各种日期格式统一成 YYYY-MM-DD */
function normalizeDate(raw) {
  if (!raw) return null;
  // 尝试直接解析
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ============================================================
// 带重试的网络请求
// ============================================================

/**
 * 教务服务器 DNS 只配了内网 IPv4 (10.3.19.2) + 教育网 IPv6
 * GitHub Actions 走 IPv4 会直接撞墙 → 手动解析 IPv6 直连
 */
async function resolveIPv6OrNull(hostname) {
  try {
    const { address } = await dns.lookup(hostname, { family: 6 });
    console.log(`  DNS: ${hostname} → IPv6 ${address}`);
    return address;
  } catch {
    console.warn(`  DNS: ${hostname} IPv6 resolve failed, fallback to default`);
    return null;
  }
}

async function fetchWithRetry(url, options, label) {
  // 尝试 IPv6 解析，应用到本次及后续所有重试
  const urlObj = new URL(url);
  const originalHost = urlObj.hostname;
  const ipv6 = await resolveIPv6OrNull(originalHost);

  let attempt = 0;
  let lastError;
  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      // 如果拿到了 IPv6，用括号包裹直连，同时补上 Host 头
      const fetchUrl = ipv6
        ? url.replace(originalHost, `[${ipv6}]`)
        : url;
      const fetchOptions = ipv6
        ? { ...options, headers: { ...(options?.headers || {}), Host: originalHost } }
        : options;

      console.log(`  ${label}: attempt ${attempt}/${MAX_RETRIES}`);
      const resp = await fetch(fetchUrl, fetchOptions);
      const data = await resp.json();
      console.log(`  ${label}: success on attempt ${attempt}`);
      return { ok: true, data, attempts: attempt };
    } catch (err) {
      lastError = err;
      const delay = Math.floor(Math.random() * MAX_RETRY_DELAY_MS);
      console.error(`  ${label}: attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      console.log(`  ${label}: retrying in ${(delay / 1000).toFixed(1)}s...`);
      await sleep(delay);
    }
  }
  console.error(`  ${label}: EXHAUSTED after ${MAX_RETRIES} attempts, giving up`);
  return { ok: false, error: lastError, attempts: attempt };
}

// ============================================================
// 主逻辑
// ============================================================

async function main() {
  const username = process.env.JW_USERNAME;
  const password = process.env.JW_PASSWORD;
  if (!username || !password) {
    console.error("JW_USERNAME and JW_PASSWORD must be set");
    process.exit(1);
  }

  const beijingToday = getBeijingToday();
  console.log(`=== Fetch started | Beijing date: ${beijingToday} ===`);

  // ----------------------------------------------------------
  // 0. 读取已有数据（用于降级：API 失败时保留旧数据）
  // ----------------------------------------------------------
  const existingPath = "frontend/public/data.json";
  let existingData = null;
  try {
    if (fs.existsSync(existingPath)) {
      existingData = JSON.parse(fs.readFileSync(existingPath, "utf-8"));
      console.log(`Existing data found, update_at: ${existingData.data?.update_at || "unknown"}`);
    }
  } catch (err) {
    console.warn(`Failed to read existing data: ${err.message}`);
  }

  // ----------------------------------------------------------
  // 1. 登录
  // ----------------------------------------------------------
  console.log("Logging in...");
  const loginParams = new URLSearchParams({
    userNo: username,
    pwd: encryptPassword(password),
    encode: "1",
    captchaData: "",
    codeVal: "",
  });

  const loginResult = await fetchWithRetry(
    `${LOGIN_URL}?${loginParams}`,
    { method: "POST" },
    "Login"
  );

  if (!loginResult.ok || loginResult.data.code !== "1") {
    console.error("Login failed after all retries:", loginResult.data || loginResult.error);
    // 降级：保留旧数据 + 加警告
    writeFallbackData(existingData, beijingToday, "login_failed");
    // 输出给 GitHub Actions 用的标记
    outputGitHubActionsState({ data_fresh: "false", reason: "login_failed" });
    process.exit(0); // 不 exit(1)，让 workflow 继续部署降级数据
  }

  const token = loginResult.data.data.token;
  console.log("Login success");

  // ----------------------------------------------------------
  // 2. 查询各校区（冗余设计：单个校区失败不影响其他校区）
  // ----------------------------------------------------------
  const campusInfoMap = {};
  const isFallback = {};
  let allFresh = true;
  let globalDataDate = null;
  let anySuccess = false;

  for (const campus of CAMPUS_LIST) {
    console.log(`Querying ${campus.name} (id=${campus.id})...`);

    const queryResult = await fetchWithRetry(
      `${QUERY_URL}${campus.id}`,
      { headers: { token } },
      `${campus.name} query`
    );

    if (!queryResult.ok || queryResult.data.code !== "1") {
      console.error(`  ${campus.name}: query FAILED — using fallback`);
      isFallback[campus.name] = true;
      allFresh = false;

      // 尝试从旧数据中保留该校区数据
      if (existingData?.data?.campus_info_map?.[campus.name]) {
        campusInfoMap[campus.name] =
          existingData.data.campus_info_map[campus.name];
        console.log(`  ${campus.name}: restored from existing data`);
      } else {
        campusInfoMap[campus.name] = emptyCampusInfo(campus.name);
      }
      continue;
    }

    const jwData = queryResult.data.data;
    console.log(`  ${campus.name}: got ${jwData?.length || 0} records`);

    // 新鲜度检查
    const freshness = checkDataFreshness(jwData);
    console.log(
      `  ${campus.name}: NODETIME analysis → dominant=${freshness.dataDate}, ` +
      `today=${beijingToday}, match=${freshness.matchCount}/${freshness.totalCount}, ` +
      `fresh=${freshness.fresh}`
    );

    if (!freshness.fresh) {
      isFallback[campus.name] = true;
      allFresh = false;
      // 即使数据是旧的，仍然处理（总比没有好），但标记为降级
      console.warn(
        `  ${campus.name}: DATA IS STALE (API returned ${freshness.dataDate}, ` +
        `expected ${beijingToday})`
      );
    }

    globalDataDate = freshness.dataDate;
    const campusInfo = processJWData(jwData, campus.name);
    campusInfoMap[campus.name] = campusInfo;
    anySuccess = true;
    console.log(`  ${campus.name}: processed OK`);
  }

  // ----------------------------------------------------------
  // 3. 海南（无实时数据）
  // ----------------------------------------------------------
  campusInfoMap["海南"] = emptyCampusInfo("海南");
  isFallback["海南"] = true; // 永远走降级

  // ----------------------------------------------------------
  // 4. 判断整体新鲜度 & 决定是否部署
  // ----------------------------------------------------------
  const dataIsFresh = anySuccess && allFresh;

  if (!anySuccess) {
    console.error("ALL campuses failed to fetch — keeping existing data");
    writeFallbackData(existingData, beijingToday, "all_failed");
    outputGitHubActionsState({ data_fresh: "false", reason: "all_failed" });
    process.exit(0);
  }

  // 构建输出数据
  const output = {
    code: 0,
    data: {
      campus_info_map: campusInfoMap,
      update_at: new Date().toISOString(),
      data_date: globalDataDate || beijingToday,
      is_fallback: isFallback,
      // 当数据不是今天的时，推送通知提醒
      notification: dataIsFresh
        ? null
        : {
            title: "数据提醒",
            content: `当前显示数据日期为 ${globalDataDate}，教务系统尚未更新今日数据，将在下次刷新时自动更新`,
            duration: 0,
            type: "warning",
            showNotification: true,
            start: new Date().toISOString(),
            end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
    },
  };

  // 写入文件
  const outDir = "frontend/public";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(existingPath, JSON.stringify(output));
  console.log(
    `Data saved to ${existingPath} ` +
    `(fresh=${dataIsFresh}, data_date=${globalDataDate}, ` +
    `fallback_campuses=[${Object.keys(isFallback).filter(k => isFallback[k]).join(",")}])`
  );

  // 输出给 GitHub Actions 的状态
  outputGitHubActionsState({
    data_fresh: dataIsFresh ? "true" : "false",
    data_date: globalDataDate,
  });
}

// ============================================================
// 辅助函数
// ============================================================

function emptyCampusInfo(name) {
  return {
    name,
    building_info_map: {},
    building_id_map: {},
    max_building_id: 0,
  };
}

/**
 * API 失败或数据陈旧时，保留旧数据 + 加降级标记
 */
function writeFallbackData(existingData, beijingToday, reason) {
  const outDir = "frontend/public";
  fs.mkdirSync(outDir, { recursive: true });

  if (existingData?.data) {
    // 在旧数据上加降级通知
    existingData.data.is_fallback = {
      ...(existingData.data.is_fallback || {}),
      global: true,
    };
    existingData.data.notification = {
      title: "数据未更新",
      content: `教务系统数据获取失败 (${reason})，当前显示的是历史数据，系统将在下次刷新时自动重试`,
      duration: 0,
      type: "error",
      showNotification: true,
      start: new Date().toISOString(),
      end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    existingData.data.data_date =
      existingData.data.data_date || beijingToday;
    fs.writeFileSync(
      "frontend/public/data.json",
      JSON.stringify(existingData)
    );
    console.log(`Fallback: kept existing data with warning (reason=${reason})`);
  } else {
    // 没有任何旧数据，生成一个空壳
    const empty = {
      code: 0,
      data: {
        campus_info_map: {
          西土城: emptyCampusInfo("西土城"),
          沙河: emptyCampusInfo("沙河"),
          海南: emptyCampusInfo("海南"),
        },
        update_at: new Date().toISOString(),
        data_date: beijingToday,
        is_fallback: {
          西土城: true,
          沙河: true,
          海南: true,
          global: true,
        },
        notification: {
          title: "数据不可用",
          content: `无法连接到教务系统 (${reason})，请稍后重试`,
          duration: 0,
          type: "error",
          showNotification: true,
          start: new Date().toISOString(),
          end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    };
    fs.writeFileSync(
      "frontend/public/data.json",
      JSON.stringify(empty)
    );
    console.log(`Fallback: generated empty data shell (reason=${reason})`);
  }
}

/**
 * 输出 GitHub Actions 可读取的状态变量
 */
function outputGitHubActionsState(map) {
  const ghaEnvFile = process.env.GITHUB_OUTPUT;
  if (ghaEnvFile) {
    let content = "";
    for (const [k, v] of Object.entries(map)) {
      content += `${k}=${v}\n`;
    }
    fs.appendFileSync(ghaEnvFile, content);
  }
}

// ============================================================
// 教务数据处理（与 Go 版逻辑一致）
// ============================================================

function processJWData(jwData, campusName) {
  const buildingIdMap = {};
  const buildingInfoMap = {};
  let maxBuildingId = 0;

  for (const item of jwData || []) {
    const classrooms = item.CLASSROOMS?.split(",") || [];
    const nodeName = parseInt(item.NODENAME);

    for (const classroomRaw of classrooms) {
      const withoutParens = classroomRaw.split("(")[0];
      const dashIdx = withoutParens.indexOf("-");
      if (dashIdx < 0) continue;
      const buildingName = withoutParens.substring(0, dashIdx);
      const classroomName = withoutParens.substring(dashIdx + 1);
      const sizeMatch = classroomRaw.match(/\((\d+)\)/);
      const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;

      if (!buildingIdMap.hasOwnProperty(buildingName)) {
        buildingIdMap[buildingName] = maxBuildingId;
        buildingInfoMap[maxBuildingId] = {
          name: buildingName,
          classroom_info_map: {},
          classroom_id_map: {},
          class_matrix: Array.from({ length: 14 }, () => []),
          max_classroom_id: 0,
        };
        maxBuildingId++;
      }

      const buildingId = buildingIdMap[buildingName];
      const building = buildingInfoMap[buildingId];

      if (!building.classroom_id_map.hasOwnProperty(classroomName)) {
        building.classroom_id_map[classroomName] = building.max_classroom_id;
        building.classroom_info_map[building.max_classroom_id] = {
          name: classroomName,
          size: size,
          can_trust: true,
          building_id: buildingId,
          type: "",
        };
        for (let i = 0; i < 14; i++) {
          building.class_matrix[i][building.max_classroom_id] = 1;
        }
        building.max_classroom_id++;
      }

      const classroomId = building.classroom_id_map[classroomName];
      if (nodeName >= 1 && nodeName <= 14) {
        building.class_matrix[nodeName - 1][classroomId] = 0;
      }
    }
  }

  return {
    name: campusName,
    building_info_map: buildingInfoMap,
    building_id_map: buildingIdMap,
    max_building_id: maxBuildingId,
  };
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
