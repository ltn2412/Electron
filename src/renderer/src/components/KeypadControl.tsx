import React, { useState } from "react";
import { Delete } from "lucide-react";

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
    let baseColor = "#1e293b";
    let baseBorder = "transparent";
    let baseShadow = "0 2px 10px rgba(0,0,0,0.05), inset 0 -2px 0 rgba(0,0,0,0.05)";

    if (key === "C") {
      baseBg = isHovered || isActive ? "#fee2e2" : "#fef2f2";
      baseColor = "#ef4444";
      baseShadow = "0 2px 10px rgba(239,68,68,0.1), inset 0 -2px 0 rgba(239,68,68,0.05)";
    } else if (key === "⌫") {
      baseBg = isHovered || isActive ? "#fef3c7" : "#fffbeb";
      baseColor = "#d97706";
      baseShadow = "0 2px 10px rgba(217,119,6,0.1), inset 0 -2px 0 rgba(217,119,6,0.05)";
    } else {
      if (isActive) baseBg = "#f1f5f9";
      else if (isHovered) baseBg = "#f8fafc";
    }

    if (isActive) {
      baseShadow = "inset 0 2px 4px rgba(0,0,0,0.1)";
    }

    return {
      width: "84px",
      height: "84px",
      fontSize: "32px",
      fontWeight: 500,
      borderRadius: "50%", // Circular buttons
      border: `1px solid ${baseBorder}`,
      backgroundColor: baseBg,
      color: baseColor,
      cursor: "pointer",
      boxShadow: baseShadow,
      transform: isActive ? "scale(0.96)" : isHovered ? "translateY(-2px)" : "none",
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      margin: "0 auto",
      userSelect: "none"
    };
  };

  return (
    <div style={styles.grid}>
      {keys.map((key, index) => (
        <div key={index} style={styles.keyWrapper}>
          <button
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
            {key === "⌫" ? <Delete size={32} strokeWidth={2.5} /> : key}
          </button>
        </div>
      ))}
    </div>
  );
};

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px 24px",
    width: "100%",
    maxWidth: "340px",
    margin: "0 auto",
  } as React.CSSProperties,
  keyWrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  } as React.CSSProperties
};

export default KeypadControl;
