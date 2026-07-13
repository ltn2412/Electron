import React from "react";

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoggingOut: boolean;
  styles: Record<string, React.CSSProperties>;
}

export default function LogoutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoggingOut,
  styles,
}: LogoutConfirmModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div style={{ ...styles.modalOverlay, zIndex: 1200 }}>
      <div style={{ ...styles.modalContent, width: "320px" }}>
        <div
          style={{
            ...styles.modalHeader,
            justifyContent: "center",
            borderBottom: "none",
            paddingBottom: 0,
          }}
        >
          <h2
            style={{
              ...styles.cardTitle,
              color: "#1e3a8a",
              textAlign: "center",
            }}
          >
            Confirm Logout
          </h2>
        </div>
        <div style={{ padding: "24px", textAlign: "center" }}>
          <p style={{ margin: "0 0 24px 0", color: "#64748b" }}>
            Are you sure you want to log out?
          </p>
          <div style={{ display: "flex", gap: "16px" }}>
            <button
              style={{
                flex: 1,
                height: "48px",
                border: "1px solid #94a3b8",
                borderRadius: "12px",
                background: "white",
                fontSize: "16px",
                fontWeight: 600,
                color: "#64748b",
                cursor: "pointer",
              }}
              onClick={onClose}
              disabled={isLoggingOut}
            >
              Cancel
            </button>
            <button
              style={{
                flex: 1,
                height: "48px",
                border: "none",
                borderRadius: "12px",
                background: "#ef4444",
                fontSize: "16px",
                fontWeight: 600,
                color: "white",
                cursor: "pointer",
              }}
              onClick={onConfirm}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "..." : "Logout"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
