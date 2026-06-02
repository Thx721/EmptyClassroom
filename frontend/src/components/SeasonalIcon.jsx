import "./SeasonalIcon.css";

// 四季装饰元素：春樱、夏竹、秋枫、冬雪（静态展示，无飘落动画）
function SeasonalIcon({ season }) {
  const seasonConfig = {
    spring: { emoji: "🌸", color: "#f8bbd0", label: "春日" },
    summer: { emoji: "🎋", color: "#81c784", label: "夏日" },
    autumn: { emoji: "🍁", color: "#ffab40", label: "秋日" },
    winter: { emoji: "❄️", color: "#90caf9", label: "冬日" },
  };

  const config = seasonConfig[season] || seasonConfig.spring;

  return (
    <div className="seasonal-icon-container">
      <div className="seasonal-center" style={{ color: config.color }}>
        <span className="seasonal-center-emoji">{config.emoji}</span>
        <span className="seasonal-center-label">{config.label}</span>
      </div>
    </div>
  );
}

export default SeasonalIcon;
