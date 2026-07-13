import { HoangVanOrder } from "@shared/types";
import { Globe, X, ScanLine } from "lucide-react";
import { useState } from "react";

interface HoangVanSearchModalProps {
  isOpen: boolean;
  onClose: () => void;

  hvOrderInfo: HoangVanOrder | null;
  hvChecking: boolean;
  hvCheckError: string;
  hvUsing: boolean;
  hvLocalStatus: string | null;
  hvReturning: boolean;
  handleCheckHoangVanOrder: (orderNo: string) => void;
  handleUseHoangVanOrder: () => void;
  handleReturnLocalOrder: () => void;
  styles: Record<string, React.CSSProperties>;
}

export default function HoangVanSearchModal({
  isOpen,
  onClose,

  hvOrderInfo,
  hvChecking,
  hvCheckError,
  hvUsing,
  hvLocalStatus,
  hvReturning,
  handleCheckHoangVanOrder,
  handleUseHoangVanOrder,
  handleReturnLocalOrder,
  styles,
}: HoangVanSearchModalProps): React.JSX.Element | null {
  const [localOrderNo, setLocalOrderNo] = useState("");
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const isScanning =
    localOrderNo.startsWith("http") || localOrderNo.length > 25;

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setLocalOrderNo("");
    }
  }

  if (!isOpen) return null;

  return (
    <div style={styles.modalOverlay}>
      <div
        style={{
          ...styles.modalContent,
          width: "650px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          margin: "auto",
        }}
      >
        <style>
          {`
            .hide-scroll::-webkit-scrollbar {
              display: none;
            }
          `}
        </style>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "white",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Globe size={20} color="#1e3a8a" />
            <h2 style={styles.cardTitle}>Online Order Search</h2>
          </div>
          <button
            style={{ ...styles.iconBtn, border: "none" }}
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </div>

        <div
          className="hide-scroll"
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {!hvOrderInfo && (
            <>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type="text"
                  value={localOrderNo}
                  onChange={(e) => setLocalOrderNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && localOrderNo) {
                      handleCheckHoangVanOrder(localOrderNo);
                    }
                  }}
                  autoFocus
                  style={{
                    ...styles.searchInput,
                    color: isScanning ? "transparent" : "#1e293b",
                    caretColor: "#1e293b",
                    paddingLeft: isScanning ? "48px" : "16px",
                    transition: "all 0.2s ease-in-out",
                  }}
                />
                {isScanning && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "16px",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontWeight: 500,
                    }}
                  >
                    <ScanLine size={20} /> Scanning barcode...
                  </div>
                )}
              </div>
              <button
                style={{
                  ...styles.primaryBtn,
                  marginTop: "16px",
                  opacity: localOrderNo && !hvChecking ? 1 : 0.5,
                  cursor:
                    localOrderNo && !hvChecking ? "pointer" : "not-allowed",
                  transition: "opacity 0.2s",
                }}
                onClick={() => handleCheckHoangVanOrder(localOrderNo)}
                disabled={!localOrderNo || hvChecking}
              >
                {hvChecking ? "Checking..." : "Check Online Order"}
              </button>
            </>
          )}

          {hvCheckError && (
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
              {hvCheckError}
            </div>
          )}

          {hvOrderInfo && (
            <div
              style={{
                marginTop: "24px",
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow:
                  "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                overflow: "hidden",
              }}
            >
              {/* Header Section */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  padding: "16px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#64748b",
                      marginBottom: "4px",
                    }}
                  >
                    Order No.
                  </div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: "#0f172a",
                    }}
                  >
                    {hvOrderInfo.orderNo}
                  </div>
                </div>
                {(() => {
                  const statusMap: Record<
                    string,
                    { text: string; color: string; bg: string }
                  > = {
                    ChuaSuDung: {
                      text: "Unused",
                      color: "#059669",
                      bg: "#d1fae5",
                    },
                    DaSuDung: {
                      text: "Used",
                      color: "#2563eb",
                      bg: "#dbeafe",
                    },
                    HetHan: {
                      text: "Expired",
                      color: "#dc2626",
                      bg: "#fee2e2",
                    },
                    DaHuy: {
                      text: "Cancelled",
                      color: "#475569",
                      bg: "#f1f5f9",
                    },
                  };
                  const st = statusMap[hvOrderInfo.orderStatus] || {
                    text: hvOrderInfo.orderStatus,
                    color: "#475569",
                    bg: "#f1f5f9",
                  };
                  return (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <div
                        style={{
                          backgroundColor: st.bg,
                          color: st.color,
                          padding: "6px 12px",
                          borderRadius: "999px",
                          fontWeight: 600,
                          fontSize: "14px",
                        }}
                      >
                        {st.text}
                      </div>
                      {hvOrderInfo.orderStatus === "DaSuDung" &&
                        hvLocalStatus && (
                          <div
                            style={{
                              backgroundColor:
                                hvLocalStatus === "Out"
                                  ? "#fef3c7"
                                  : hvLocalStatus === "Return"
                                    ? "#dcfce3"
                                    : "#e2e8f0",
                              color:
                                hvLocalStatus === "Out"
                                  ? "#d97706"
                                  : hvLocalStatus === "Return"
                                    ? "#16a34a"
                                    : "#334155",
                              padding: "6px 12px",
                              borderRadius: "999px",
                              fontWeight: 600,
                              fontSize: "14px",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            {hvLocalStatus}
                          </div>
                        )}
                    </div>
                  );
                })()}
              </div>

              {/* Body Section */}
              <div style={{ padding: "20px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#64748b",
                        marginBottom: "4px",
                      }}
                    >
                      Customer Name
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        color: "#1e293b",
                        fontWeight: 500,
                      }}
                    >
                      {hvOrderInfo.buyerName || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#64748b",
                        marginBottom: "4px",
                      }}
                    >
                      Phone Number
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        color: "#1e293b",
                        fontWeight: 500,
                      }}
                    >
                      {hvOrderInfo.buyerPhone || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#64748b",
                        marginBottom: "4px",
                      }}
                    >
                      Visit Date
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        color: "#1e293b",
                        fontWeight: 500,
                      }}
                    >
                      {hvOrderInfo.visitDate}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#64748b",
                        marginBottom: "4px",
                      }}
                    >
                      Total Amount
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        color: "#1e293b",
                        fontWeight: 500,
                      }}
                    >
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(
                        (hvOrderInfo.services || []).reduce(
                          (sum, svc) => sum + svc.unitPrice * svc.quantity,
                          0,
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {/* Services Section */}
                <div
                  style={{
                    borderTop: "1px dashed #cbd5e1",
                    paddingTop: "16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "bold",
                      color: "#334155",
                      marginBottom: "12px",
                    }}
                  >
                    Purchased Services
                  </div>
                  {hvOrderInfo.services?.map((svc, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: "#f8fafc",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: 500,
                            color: "#0f172a",
                          }}
                        >
                          {svc.serviceName}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#64748b",
                            marginTop: "4px",
                          }}
                        >
                          Time: {svc.timeSlot?.name}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: "bold",
                            color: "#0f172a",
                          }}
                        >
                          x{svc.quantity}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#64748b",
                            marginTop: "4px",
                          }}
                        >
                          {new Intl.NumberFormat("vi-VN", {
                            style: "currency",
                            currency: "VND",
                          }).format(svc.unitPrice)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {hvOrderInfo.orderStatus === "ChuaSuDung" && (
                <div style={{ padding: "0 20px 20px 20px" }}>
                  <button
                    style={{
                      ...styles.primaryBtn,
                      backgroundColor: "#10b981",
                      opacity: hvUsing ? 0.5 : 1,
                    }}
                    onClick={handleUseHoangVanOrder}
                    disabled={hvUsing}
                  >
                    {hvUsing ? "Processing..." : "Confirm Usage & Print Bill"}
                  </button>
                </div>
              )}
              {hvOrderInfo.orderStatus === "DaSuDung" &&
                hvLocalStatus === "Out" && (
                  <div style={{ padding: "0 20px 20px 20px" }}>
                    <button
                      onClick={handleReturnLocalOrder}
                      disabled={hvReturning}
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: hvReturning ? "#94a3b8" : "#f59e0b",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "16px",
                        cursor: hvReturning ? "not-allowed" : "pointer",
                        transition: "background-color 0.2s",
                      }}
                    >
                      {hvReturning ? "Processing..." : "Confirm Return"}
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
