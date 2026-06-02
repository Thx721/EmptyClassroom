// 空教室数据抓取脚本 - Node.js 版
// 供 GitHub Actions 使用，每天定时从 JWGL API 拉取数据
import crypto from "crypto";
import fs from "fs";

const LOGIN_URL = "http://jwglweixin.bupt.edu.cn/bjyddx/login";
const QUERY_URL = "http://jwglweixin.bupt.edu.cn/bjyddx/todayClassrooms?campusId=0";

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

async function main() {
  const username = process.env.JW_USERNAME;
  const password = process.env.JW_PASSWORD;
  if (!username || !password) {
    console.error("JW_USERNAME and JW_PASSWORD must be set");
    process.exit(1);
  }

  console.log("Fetching classroom data from JWGL API...");

  // 1. Login
  const params = new URLSearchParams({
    userNo: username,
    pwd: encryptPassword(password),
    encode: "1",
    captchaData: "",
    codeVal: "",
  });

  const loginResp = await fetch(`${LOGIN_URL}?${params}`, { method: "POST" });
  const loginData = await loginResp.json();
  if (loginData.code !== "1") {
    console.error("Login failed:", loginData);
    process.exit(1);
  }
  const token = loginData.data.token;
  console.log("Login success");

  // 2. Query each campus
  const campusIds = [
    { id: 1, name: "西土城" },
    { id: 4, name: "沙河" },
  ];

  const campusInfoMap = {};

  for (const campus of campusIds) {
    console.log(`Querying ${campus.name} (id=${campus.id})...`);
    const queryResp = await fetch(`${QUERY_URL}${campus.id}`, {
      headers: { token },
    });
    const queryData = await queryResp.json();

    if (queryData.code === "1") {
      // 处理教务数据，构建与 Go 后端一致的格式
      const campusInfo = processJWData(queryData.data, campus.name);
      campusInfoMap[campus.name] = campusInfo;
      console.log(`  ${campus.name}: OK`);
    } else {
      console.error(`  ${campus.name}: query failed`);
      campusInfoMap[campus.name] = {
        name: campus.name,
        building_info_map: {},
        building_id_map: {},
        max_building_id: 0,
      };
    }
  }

  // 3. 海南（无实时数据）
  campusInfoMap["海南"] = {
    name: "海南",
    building_info_map: {},
    building_id_map: {},
    max_building_id: 0,
  };

  // 4. 输出 JSON
  const output = {
    code: 0,
    data: {
      campus_info_map: campusInfoMap,
      update_at: new Date().toISOString(),
      notification: null,
      is_fallback: {},
    },
  };

  const outPath = "frontend/public/data.json";
  fs.mkdirSync("frontend/public", { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output));
  console.log(`Data saved to ${outPath} (${JSON.stringify(output).length} bytes)`);
}

function processJWData(jwData, campusName) {
  const buildingIdMap = {};
  const buildingInfoMap = {};
  let maxBuildingId = 0;

  // jwData 格式: [{CLASSROOMS: "教3-205(100)", NODENAME: "1", ...}, ...]
  for (const item of jwData || []) {
    const classrooms = item.CLASSROOMS?.split(",") || [];
    const nodeName = parseInt(item.NODENAME);

    for (const classroomRaw of classrooms) {
      // 解析: "教3-205(100)" -> building="教3", name="205", size=100
      const match = classroomRaw.match(/^(.+)-([^(]+)\((\d+)\)/);
      if (!match) continue;
      const [, buildingName, classroomName, sizeStr] = match;
      const size = parseInt(sizeStr) || 0;

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
        // 初始化为全部有课（1）
        for (let i = 0; i < 14; i++) {
          building.class_matrix[i][building.max_classroom_id] = 1;
        }
        building.max_classroom_id++;
      }

      const classroomId = building.classroom_id_map[classroomName];
      // 当前时间段设为无课（0）
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
  console.error(e);
  process.exit(1);
});
