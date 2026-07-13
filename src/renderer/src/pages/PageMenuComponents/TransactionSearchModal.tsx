import React from "react";
import { X } from "lucide-react";
import KeypadControl from "@/components/KeypadControl";

interface TransactionSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactId: string;
  setTransactId: React.Dispatch<React.SetStateAction<string>>;
  isTransactChecking: boolean;
  transactCheckError: string;
  onSearch: () => void;
  styles: Record<string, React.CSSProperties>;
}

export default function TransactionSearchModal({
  isOpen,
  onClose,
  transactId,
  setTransactId,
  isTransactChecking,
  transactCheckError,
  onSearch,
  styles,
}: TransactionSearchModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.cardTitle}>Find Transaction</h2>
          <button
            style={{ ...styles.iconBtn, border: "none" }}
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </div>
        <div style={{ padding: "24px" }}>
          <input
            type="text"
            value={transactId}
            onChange={(e) =>
              setTransactId(e.target.value.replace(/[^0-9]/g, ""))
            }
            autoFocus
            style={styles.searchInput}
          />
          <KeypadControl
            onKeyPress={(key) => setTransactId((prev) => prev + key)}
            onBackspace={() => setTransactId((prev) => prev.slice(0, -1))}
            onClear={() => setTransactId("")}
          />
          <button
            style={{
              ...styles.primaryBtn,
              marginTop: "24px",
              opacity: transactId && !isTransactChecking ? 1 : 0.5,
              cursor:
                transactId && !isTransactChecking ? "pointer" : "not-allowed",
            }}
            onClick={onSearch}
            disabled={!transactId || isTransactChecking}
          >
            {isTransactChecking ? "Searching..." : "Search"}
          </button>

          {transactCheckError && (
            <div
              style={{
                color: "#dc2626",
                marginTop: "16px",
                textAlign: "center",
                fontWeight: 500,
                padding: "16px",
                backgroundColor: "#fee2e2",
                borderRadius: "8px",
                border: "1px solid #f87171",
              }}
            >
              {transactCheckError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
