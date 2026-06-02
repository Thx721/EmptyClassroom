import { Typography, Button } from "antd";
import { GithubOutlined } from "@ant-design/icons";

function Footer() {
  const { Text } = Typography;
  return (
    <div style={{ textAlign: "center", marginTop: 24, padding: 16 }}>
      <Text>
        © 2022-2026 Jray（原作者，已停止维护） · Continued by _Thx
        <Button
          onClick={() => window.open("https://github.com/Jraaay/EmptyClassroom")}
          type="text"
          icon={<GithubOutlined />}
          title="原作者仓库（已归档）"
        ></Button>
      </Text>
    </div>
  );
}

export default Footer;
