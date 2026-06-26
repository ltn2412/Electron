import React from "react";
import { Minus, X } from "lucide-react";

const TitleBar: React.FC = () => {
  return (
    <div style={styles.titleBar}>
      <div style={styles.dragRegion}>
        <span style={styles.title}>POS System</span>
      </div>
      <div style={styles.controls}>
        <button
          style={styles.controlBtn}
          onClick={() => window.api.minimize()}
          title="Minimize"
        >
          <Minus size={18} />
        </button>
        <button
          style={{ ...styles.controlBtn, ...styles.closeBtn }}
          onClick={() => window.api.close()}
          title="Close"
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#ef4444")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

const styles = {
  titleBar: {
    height: "36px",
    width: "100%",
    backgroundColor: "#1e293b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    userSelect: "none",
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 9999,
  } as React.CSSProperties,
  dragRegion: {
    // This allows dragging the window by clicking the title bar
    WebkitAppRegion: "drag",
    flex: 1,
    height: "100%",
    display: "flex",
    alignItems: "center",
    paddingLeft: "16px",
  } as React.CSSProperties & { WebkitAppRegion?: string },
  title: {
    color: "#f8fafc",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.5px",
  } as React.CSSProperties,
  controls: {
    display: "flex",
    height: "100%",
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties & { WebkitAppRegion?: string },
  controlBtn: {
    width: "46px",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,
  closeBtn: {
    color: "#f8fafc",
  } as React.CSSProperties,
};

export default TitleBar;
