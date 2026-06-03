import PropTypes from "prop-types";
import { Card, Button, Slider, Typography } from "antd";
import { useState } from "react";
import "./ClassTimePicker.css";

function ClassTimePicker(props) {
  if (props.todayData.code != 0) {
    return null;
  }

  if (props.selectedCampus == "") {
    return null;
  }

  const classes = [
    "01", "02", "03", "04", "05", "06", "07",
    "08", "09", "10", "11", "12", "13", "14",
  ];

  const class_time = [
    "08:45", "09:35", "10:35", "11:25", "12:15", "13:45", "14:35",
    "15:30", "16:25", "17:20", "18:10", "19:15", "20:05", "20:55",
  ];

  const class_start_time = [
    "08:00", "08:50", "09:50", "10:40", "11:30", "13:00", "13:50",
    "14:45", "15:40", "16:35", "17:25", "18:30", "19:20", "20:10",
  ];

  function fillZero(x) {
    if (x < 10) return "0" + x;
    return x;
  }

  // 开发者模式：模拟时间
  const [devHour, setDevHour] = useState(() => {
    const saved = localStorage.getItem("devHour");
    return saved ? parseInt(saved) : new Date().getHours();
  });
  const [devMinute, setDevMinute] = useState(() => {
    const saved = localStorage.getItem("devMinute");
    return saved ? parseInt(saved) : new Date().getMinutes();
  });

  const now = new Date();
  const now_hour = props.devMode ? fillZero(devHour) : fillZero(now.getHours());
  const now_minute = props.devMode ? fillZero(devMinute) : fillZero(now.getMinutes());

  const options = [];
  for (let i = 0; i <= 13; i++) {
    // 过去的时间段变灰：当前时间已超过该节课结束时间
    // 数据过期时，所有时间段也禁用
    options.push({
      label: classes[i],
      value: i,
      disabled:
        props.isDataStale ||
        (class_time[i].localeCompare(`${now_hour}:${now_minute}`) < 0 &&
          !props.canSelectAllDay),
    });
  }

  for (let i = 0; i <= 13; i++) {
    if (options[i].disabled && props.selectedClassTimes.includes(i)) {
      props.setSelectedClassTimes(
        props.selectedClassTimes.filter((x) => x != i)
      );
    }
  }

  function onCheckAllChange() {
    if (!isAllChecked()) {
      let newSelectedClassTimes = [];
      for (let i = 0; i <= 13; i++) {
        if (options[i].disabled) continue;
        newSelectedClassTimes.push(i);
      }
      props.setSelectedClassTimes(newSelectedClassTimes);
    } else {
      props.setSelectedClassTimes([]);
    }
  }

  function isAllChecked() {
    for (let i = 0; i <= 13; i++) {
      if (options[i].disabled) continue;
      if (!props.selectedClassTimes.includes(i)) return false;
    }
    return true;
  }

  const devTimeMarks = {
    0: "00:00", 2: "02:00", 4: "04:00", 6: "06:00",
    8: "08:00", 10: "10:00", 12: "12:00", 14: "14:00",
    16: "16:00", 18: "18:00", 20: "20:00", 22: "22:00",
  };

  return (
    <Card
      className="class-time-picker"
      style={{
        maxWidth: 400,
        width: "90%",
        boxShadow: "0 12px 32px 4px #0000000a, 0 8px 20px #00000014",
      }}
      bodyStyle={{
        maxWidth: "300px",
      }}
    >
      {props.devMode && (
        <div style={{ marginBottom: 12, padding: "0 4px" }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            🔧 模拟时间: {now_hour}:{now_minute}
          </Typography.Text>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>时</span>
            <Slider
              min={0} max={23}
              value={devHour}
              onChange={(v) => {
                setDevHour(v);
                localStorage.setItem("devHour", v.toString());
              }}
              style={{ flex: 1 }}
              marks={{ 0: "0", 6: "6", 12: "12", 18: "18", 23: "23" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>分</span>
            <Slider
              min={0} max={59}
              value={devMinute}
              onChange={(v) => {
                setDevMinute(v);
                localStorage.setItem("devMinute", v.toString());
              }}
              style={{ flex: 1 }}
              marks={{ 0: "0", 15: "15", 30: "30", 45: "45", 59: "59" }}
            />
          </div>
        </div>
      )}
      {props.isDataStale && (
        <div
          style={{
            textAlign: "center",
            marginBottom: 8,
            padding: "4px 8px",
            background: props.isDark ? "#2a2a1a" : "#fffbe6",
            borderRadius: 4,
          }}
        >
          <Typography.Text
            style={{ fontSize: 12, color: "#d48806" }}
          >
            ⏳ 数据尚未更新，请等待获取今天的数据
          </Typography.Text>
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {options.map((x) => (
          <Button
            key={x.value}
            type={
              props.selectedClassTimes.includes(x.value) ? "primary" : "outline"
            }
            onClick={() => {
              if (props.selectedClassTimes.includes(x.value)) {
                props.setSelectedClassTimes(
                  props.selectedClassTimes.filter((y) => y != x.value)
                );
              } else {
                props.setSelectedClassTimes([
                  ...props.selectedClassTimes,
                  x.value,
                ]);
              }
            }}
            style={{
              borderRadius: "0px",
              width: "45px",
              margin: "2px",
              height: props.showClassTime ? "45px" : "30px",
              padding: "0px",
              color: x.disabled
                ? props.isDark
                  ? "#ffffff4d"
                  : "#00000040"
                : props.selectedClassTimes.includes(x.value)
                ? undefined
                : props.isDark
                ? "#ffffffd9"
                : "#000000d9",
              borderColor: x.disabled
                ? undefined
                : props.isDark
                ? "#434343"
                : "#d9d9d9",
            }}
            disabled={x.disabled}
          >
            <div>
              {props.showClassTime ? (
                <div
                  style={{
                    fontSize: "0.7em",
                    marginBottom: "-0.5em",
                  }}
                >
                  {class_start_time[x.label - 1]}
                </div>
              ) : null}
              {x.label}
              {props.showClassTime ? (
                <div
                  style={{
                    fontSize: "0.7em",
                    marginTop: "-0.5em",
                  }}
                >
                  {class_time[x.label - 1]}
                </div>
              ) : null}
            </div>
          </Button>
        ))}
        <Button
          type={isAllChecked() ? "primary" : "outline"}
          onClick={onCheckAllChange}
          disabled={props.isDataStale}
          style={{
            borderRadius: "0px",
            width: "45px",
            margin: "2px",
            height: props.showClassTime ? "45px" : "30px",
            padding: "0px",
            color: props.isDataStale
              ? props.isDark
                ? "#ffffff4d"
                : "#00000040"
              : isAllChecked()
              ? undefined
              : props.isDark
              ? "#ffffffd9"
              : "#000000d9",
            borderColor: props.isDataStale
              ? undefined
              : isAllChecked()
              ? undefined
              : props.isDark
              ? "#434343"
              : "#d9d9d9",
          }}
        >
          {isAllChecked() ? "全不选" : "全选"}
        </Button>
      </div>
    </Card>
  );
}

ClassTimePicker.propTypes = {
  todayData: PropTypes.object,
  isDataStale: PropTypes.bool,
  selectedClassTimes: PropTypes.array,
  setSelectedClassTimes: PropTypes.func,
  selectedCampus: PropTypes.string,
  showClassTime: PropTypes.bool,
  canSelectAllDay: PropTypes.bool,
  isDark: PropTypes.bool,
  devMode: PropTypes.bool,
};

export default ClassTimePicker;
