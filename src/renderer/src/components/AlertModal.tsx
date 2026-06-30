import React from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: "success" | "error" | "info" | "confirm";
  onClose: () => void;
  onConfirm?: () => void;
}

export default function AlertModal({
  isOpen,
  title,
  message,
  type = "info",
  onClose,
  onConfirm,
}: AlertModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

  const getIcon = (): React.JSX.Element => {
    switch (type) {
      case "success":
        return <CheckCircle size={48} color="#22c55e" />;
      case "error":
        return <AlertCircle size={48} color="#ef4444" />;
      case "confirm":
        return <AlertCircle size={48} color="#f59e0b" />;
      case "info":
      default:
        return <Info size={48} color="#3b82f6" />;
    }
  };

  const getButtonColor = (): string => {
    switch (type) {
      case "success":
        return "#22c55e";
      case "error":
        return "#ef4444";
      case "confirm":
        return "#f59e0b";
      case "info":
      default:
        return "#3b82f6";
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="alert-modal-animation">
        <button
          style={styles.closeBtn}
          onClick={onClose}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#f1f5f9")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <X size={24} />
        </button>
        <div style={styles.iconContainer}>{getIcon()}</div>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.message}>{message}</p>
        <div style={{ display: "flex", gap: "12px", width: "100%", maxWidth: "300px" }}>
          {type === "confirm" && (
            <button
              style={{
                ...styles.actionBtn,
                backgroundColor: "#cbd5e1",
                color: "#475569",
              }}
              onClick={onClose}
            >
              Cancel
            </button>
          )}
          <button
            style={{ ...styles.actionBtn, backgroundColor: getButtonColor(), flex: 1 }}
            onClick={type === "confirm" && onConfirm ? onConfirm : onClose}
          >
            {type === "confirm" ? "Confirm" : "OK"}
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(-20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .alert-modal-animation {
            animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}
      </style>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999999,
  } as React.CSSProperties,
  modal: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "32px 24px 24px",
    width: "90%",
    maxWidth: "400px",
    boxShadow:
      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
    fontFamily: "Inter, sans-serif",
  } as React.CSSProperties,
  closeBtn: {
    position: "absolute",
    top: "16px",
    right: "16px",
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    transition: "background-color 0.2s, color 0.2s",
  } as React.CSSProperties,
  iconContainer: {
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  title: {
    margin: "0 0 12px 0",
    fontSize: "20px",
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
  } as React.CSSProperties,
  message: {
    margin: "0 0 24px 0",
    fontSize: "15px",
    color: "#475569",
    textAlign: "center",
    lineHeight: "1.5",
  } as React.CSSProperties,
  actionBtn: {
    width: "100%",
    padding: "12px",
    border: "none",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "opacity 0.2s, transform 0.1s",
  } as React.CSSProperties,
};
