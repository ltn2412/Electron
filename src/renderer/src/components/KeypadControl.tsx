import { Delete } from "lucide-react";
import React, { useState } from "react";

interface KeypadControlProps {
  onKeyPress: (key: string) => void;
  onClear?: () => void;
  onBackspace?: () => void;
}

const KeypadControl: React.FC<KeypadControlProps> = ({
  onKeyPress,
  onClear,
  onBackspace,
}) => {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const handleKeyClick = (key: string): void => {
    if (key === "C") {
      onClear && onClear();
    } else if (key === "⌫") {
      onBackspace && onBackspace();
    } else {
      onKeyPress(key);
    }
  };

  const getButtonStyle = (key: string): React.CSSProperties => {
    const isHovered = hoverKey === key;
    const isActive = activeKey === key;

    let baseBg = "#ffffff";
    let baseColor = "#334155";
    let baseBorder = "#e2e8f0";

    if (key === "C") {
      baseBg = isHovered || isActive ? "#fecaca" : "#fee2e2";
      baseColor = "#ef4444";
      baseBorder = "#fecaca";
    } else if (key === "⌫") {
      baseBg = isHovered || isActive ? "#fef08a" : "#fef9c3";
      baseColor = "#ca8a04";
      baseBorder = "#fef08a";
    } else {
      if (isActive) baseBg = "#f1f5f9";
      else if (isHovered) baseBg = "#f8fafc";
    }

    return {
      height: "56px",
      fontSize: "24px",
      fontWeight: 600,
      borderRadius: "16px",
      border: `1px solid ${baseBorder}`,
      backgroundColor: baseBg,
      color: baseColor,
      cursor: "pointer",
      boxShadow: isActive
        ? "0 2px 4px rgba(0, 0, 0, 0.02)"
        : isHovered
          ? "0 6px 12px rgba(0, 0, 0, 0.05)"
          : "0 4px 6px rgba(0, 0, 0, 0.02), 0 1px 3px rgba(0,0,0,0.05)",
      transform: isActive
        ? "translateY(1px)"
        : isHovered
          ? "translateY(-2px)"
          : "none",
      transition: "all 0.15s ease",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      userSelect: "none",
    };
  };

  return (
    <div style={styles.grid}>
      {keys.map((key, index) => (
        <button
          key={index}
          style={getButtonStyle(key)}
          onClick={() => handleKeyClick(key)}
          onMouseEnter={() => setHoverKey(key)}
          onMouseLeave={() => {
            setHoverKey(null);
            setActiveKey(null);
          }}
          onMouseDown={() => setActiveKey(key)}
          onMouseUp={() => setActiveKey(null)}
        >
          {key === "⌫" ? <Delete size={28} /> : key}
        </button>
      ))}
    </div>
  );
};

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
    width: "100%",
    maxWidth: "320px",
    margin: "0 auto",
  } as React.CSSProperties,
};

export default KeypadControl;
