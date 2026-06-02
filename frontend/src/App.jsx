import "./App.css";
import { Typography, Spin, ConfigProvider, theme } from "antd";
import { useState, useEffect } from "react";
import Notification from "./components/Notification";
import CampusButtonGroup from "./components/CampusButtonGroup";
import BuildingPicker from "./components/BuildingPicker";
import ClassTimePicker from "./components/ClassTimePicker";
import EmptyClassroomTable from "./components/EmptyClassroomTable";
import GlobalEmpty from "./components/GlobalEmpty";
import Footer from "./components/Footer";
import SeasonalIcon from "./components/SeasonalIcon";

function App() {
  const [spining, setSpining] = useState(true);
  const [isError, setIsError] = useState(false);
  const [resp, setResp] = useState({ code: 1 });
  const [selectedCampus, setSelectedCampus] = useState("");
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [selectedClassTimes, setSelectedClassTimes] = useState([]);
  const [showClassTime, setShowClassTime] = useState(false);
  const [canSelectAllDay, setCanSelectAllDay] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [devMode, setDevMode] = useState(false);

  // 开发者模式：模拟月份（用于预览四季效果）
  const [devMonth, setDevMonth] = useState(() => {
    const saved = localStorage.getItem("devMonth");
    return saved ? parseInt(saved) : new Date().getMonth() + 1;
  });

  const { Title } = Typography;

  // 季节判定（开发者模式下使用模拟月份）
  const month = devMode ? devMonth : new Date().getMonth() + 1;
  let season = "spring";
  if (month >= 6 && month <= 8) season = "summer";
  else if (month >= 9 && month <= 11) season = "autumn";
  else if (month === 12 || month <= 2) season = "winter";

  // 时间段判定
  const hour = new Date().getHours();
  let timeOfDay = "morning";
  if (hour >= 12 && hour < 18) timeOfDay = "afternoon";
  else if (hour >= 18 || hour < 6) timeOfDay = "evening";

  useEffect(() => {
    // 暗黑模式
    const savedDark = localStorage.getItem("darkMode");
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    function matchMode(e) {
      const body = document.body;
      if (e.matches) {
        body.classList.add("dark");
        setIsDark(true);
        localStorage.setItem("darkMode", "true");
      } else {
        body.classList.remove("dark");
        setIsDark(false);
        localStorage.setItem("darkMode", "false");
      }
    }

    mql.addEventListener("change", matchMode);
    if (savedDark === "true") {
      document.body.classList.add("dark");
      setIsDark(true);
    } else if (savedDark === "false") {
      document.body.classList.remove("dark");
      setIsDark(false);
    } else {
      matchMode(mql);
    }

    // 开发者模式
    setDevMode(localStorage.getItem("devMode") === "true");

    // 数据获取：先尝试后端 API（本地开发），失败则回退到静态 JSON（云端部署）
    fetch("/api/get_data")
      .then((resp) => {
        if (!resp.ok) throw new Error("API not available");
        return resp.json();
      })
      .then((resp) => {
        setResp(resp);
        setIsError(false);
        setSpining(false);
      })
      .catch(() => {
        fetch("/data.json")
          .then((resp) => resp.json())
          .then((resp) => {
            setResp(resp);
            setIsError(false);
            setSpining(false);
          })
          .catch(() => {
            setIsError(true);
            setSpining(false);
          });
      });

    setShowClassTime(localStorage.getItem("showClassTime") !== "false");
    setCanSelectAllDay(localStorage.getItem("canSelectAllDay") === "true");
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm:
          localStorage.getItem("darkMode") === "true"
            ? theme.darkAlgorithm
            : theme.defaultAlgorithm,
      }}
    >
      <Spin spinning={spining}>
        <div className={`App season-${season} time-${timeOfDay}`}>
          <div className="season-bg" />
          <SeasonalIcon season={season} />
          <Title
            level={3}
            style={{
              marginBottom: "15px",
            }}
          >
            BUPT 空教室查询
          </Title>
          <Notification todayData={resp} />
          <CampusButtonGroup
            todayData={resp}
            selectedCampus={selectedCampus}
            setSelectedCampus={setSelectedCampus}
            setSelectedBuildings={setSelectedBuildings}
            showClassTime={showClassTime}
            setShowClassTime={setShowClassTime}
            canSelectAllDay={canSelectAllDay}
            setCanSelectAllDay={setCanSelectAllDay}
            devMode={devMode}
            setDevMode={setDevMode}
            devMonth={devMonth}
            setDevMonth={setDevMonth}
          />
          <BuildingPicker
            todayData={resp}
            selectedBuildings={selectedBuildings}
            setSelectedBuildings={setSelectedBuildings}
            selectedCampus={selectedCampus}
          />
          <ClassTimePicker
            todayData={resp}
            selectedClassTimes={selectedClassTimes}
            setSelectedClassTimes={setSelectedClassTimes}
            selectedCampus={selectedCampus}
            showClassTime={showClassTime}
            canSelectAllDay={canSelectAllDay}
            isDark={isDark}
            devMode={devMode}
          />
          <EmptyClassroomTable
            todayData={resp}
            selectedCampus={selectedCampus}
            selectedBuildings={selectedBuildings}
            selectedClassTimes={selectedClassTimes}
            setIsError={setIsError}
            devMode={devMode}
          />
          <GlobalEmpty todayData={resp} isError={isError} />
          <Footer />
        </div>
      </Spin>
    </ConfigProvider>
  );
}

export default App;
