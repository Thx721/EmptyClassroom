import PropTypes from "prop-types";
import {
  Radio,
  Button,
  Switch,
  Typography,
  Divider,
  Tooltip,
  Slider,
  Modal,
} from "antd";
import { useEffect, useState } from "react";
import {
  SettingOutlined,
  GithubOutlined,
  HeartFilled,
  BugOutlined,
} from "@ant-design/icons";
import "./CampusButtonGroup.css";

function CampusButtonGroup(props) {
  const [campusList, setCampusList] = useState([]);

  useEffect(() => {
    if (props.todayData.code == 0) {
      let list = [];
      for (let campus in props.todayData.data.campus_info_map) {
        list.push(campus);
      }
      const order = ["西土城", "沙河"];
      list.sort((a, b) => {
        if (order.indexOf(a) == -1) {
          if (order.indexOf(b) == -1) {
            return a.localeCompare(b);
          } else {
            return 1;
          }
        } else {
          if (order.indexOf(b) == -1) {
            return -1;
          }
          return order.indexOf(a) - order.indexOf(b);
        }
      });
      setCampusList(list);
      if (props.selectedCampus == "" && list.length > 0) {
        props.setSelectedCampus(list[0]);
      }
    }
  }, [props, props.todayData.code, props.todayData.data?.campus_info_map]);

  const [openSettingModal, setOpenSettingModal] = useState(false);

  function OpenSettingModal() {
    setOpenSettingModal(true);
  }

  // 三击小虫图标切换开发者模式
  const [bugClickCount, setBugClickCount] = useState(0);
  function handleDevToggle() {
    const newDevMode = !props.devMode;
    localStorage.setItem("devMode", newDevMode ? "true" : "false");
    props.setDevMode(newDevMode);
  }

  const seasonLabels = {
    1: "冬", 2: "冬", 3: "春", 4: "春", 5: "春",
    6: "夏", 7: "夏", 8: "夏", 9: "秋", 10: "秋", 11: "秋", 12: "冬",
  };
  const seasonEmojis = {
    1: "❄️", 2: "❄️", 3: "🌸", 4: "🌸", 5: "🌸",
    6: "🎋", 7: "🎋", 8: "🎋", 9: "🍁", 10: "🍁", 11: "🍁", 12: "❄️",
  };

  return (
    <div className="campus-button-group">
      <Radio.Group
        value={props.selectedCampus}
        onChange={(e) => {
          props.setSelectedCampus(e.target.value);
          props.setSelectedBuildings([]);
        }}
        buttonStyle="solid"
        size="middle"
      >
        {campusList.map((campus) => {
          return (
            <Radio.Button value={campus} key={campus}>
              {campus}
            </Radio.Button>
          );
        })}
      </Radio.Group>
      <Button
        style={{
          marginLeft: "10px",
        }}
        icon={<SettingOutlined />}
        onClick={OpenSettingModal}
      />
      <Modal
        title="设置"
        open={openSettingModal}
        closable={true}
        footer={null}
        onCancel={() => {
          setOpenSettingModal(false);
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Switch
              defaultChecked={props.showClassTime}
              onChange={(v) => {
                localStorage.setItem("showClassTime", v ? "true" : "false");
                props.setShowClassTime(v);
              }}
              size="small"
            />
            <Typography.Title level={5} style={{ margin: 8 }}>
              显示课程时间
            </Typography.Title>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Switch
              defaultChecked={props.canSelectAllDay}
              onChange={(v) => {
                localStorage.setItem("canSelectAllDay", v ? "true" : "false");
                props.setCanSelectAllDay(v);
              }}
              size="small"
            />
            <Typography.Title level={5} style={{ margin: 8 }}>
              全选时选全天
            </Typography.Title>
          </div>
          <Divider plain>
            <HeartFilled />
          </Divider>
          <div style={{ lineHeight: "2em" }}>
            当前数据刷新时间：
            {props.todayData.data?.update_at
              ? new Date(props.todayData.data.update_at).toLocaleString()
              : "加载中"}
          </div>
          <div style={{ lineHeight: "2em" }}>
            项目已开源：
            <Button
              onClick={() =>
                window.open("https://github.com/Jraaay/EmptyClassroom")
              }
              icon={<GithubOutlined />}
              size="small"
            >
              GitHub
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {" "}
              （原作者 Jraaay，已停止维护）
            </Typography.Text>
          </div>

          {/* 开发者模式 */}
          <Divider plain>
            <Tooltip title="三击切换开发者模式">
              <BugOutlined
                onClick={() => {
                  const c = bugClickCount + 1;
                  setBugClickCount(c);
                  if (c >= 3) {
                    setBugClickCount(0);
                    handleDevToggle();
                  }
                }}
                style={{
                  cursor: "pointer",
                  color: props.devMode ? "#1677ff" : "#999",
                  fontSize: 16,
                }}
              />
            </Tooltip>
          </Divider>

          {props.devMode && (
            <div
              style={{
                background: "#f6ffed",
                border: "1px solid #b7eb8f",
                borderRadius: 8,
                padding: 12,
                marginTop: 4,
              }}
            >
              <Typography.Text strong style={{ color: "#52c41a" }}>
                🔧 开发者模式
              </Typography.Text>
              <div style={{ marginTop: 8 }}>
                <Typography.Text style={{ fontSize: 12 }}>
                  模拟月份（预览四季）：
                  <Typography.Text strong>
                    {" "}{props.devMonth}月 {seasonEmojis[props.devMonth]} {seasonLabels[props.devMonth]}
                  </Typography.Text>
                </Typography.Text>
                <Slider
                  min={1}
                  max={12}
                  value={props.devMonth}
                  onChange={(v) => {
                    props.setDevMonth(v);
                    localStorage.setItem("devMonth", v.toString());
                  }}
                  marks={{
                    1: "1月", 3: "🌸", 6: "🎋", 9: "🍁", 12: "❄️",
                  }}
                  style={{ marginTop: 4, marginBottom: 4 }}
                />
                <Typography.Text style={{ fontSize: 11 }} type="secondary">
                  拖动滑块切换月份，预览不同季节的主题效果。下方课程时间选择区也可以模拟小时/分钟。
                </Typography.Text>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

CampusButtonGroup.propTypes = {
  todayData: PropTypes.object.isRequired,
  isDataStale: PropTypes.bool,
  selectedCampus: PropTypes.string,
  setSelectedCampus: PropTypes.func,
  setSelectedBuildings: PropTypes.func,
  showClassTime: PropTypes.bool,
  setShowClassTime: PropTypes.func,
  canSelectAllDay: PropTypes.bool,
  setCanSelectAllDay: PropTypes.func,
  devMode: PropTypes.bool,
  setDevMode: PropTypes.func,
  devMonth: PropTypes.number,
  setDevMonth: PropTypes.func,
};

export default CampusButtonGroup;
