import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  RefreshCw,
  FileText,
  Search,
  X,
  MinusCircle,
  PlusCircle,
  LogOut,
  Globe,
  Archive,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import TitleBar from "@/components/TitleBar";
import AlertModal from "@/components/AlertModal";
import KeypadControl from "@/components/KeypadControl";
import {
  POSHEADER,
  ProductPOSAudio,
  HoangVanSlot,
  HoangVanOrder,
} from "@shared/types";

export default function PageMenu(): React.JSX.Element {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<POSHEADER[]>([]);
  const [products, setProducts] = useState<ProductPOSAudio[]>([]);
  const [slots, setSlots] = useState<HoangVanSlot[]>([]);
  const [expiredCount, setExpiredCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [transactId, setTransactId] = useState("");
  const [transactCheckError, setTransactCheckError] = useState("");
  const [isTransactChecking, setIsTransactChecking] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHoangVanSearchOpen, setIsHoangVanSearchOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // HoangVan Search State
  const [hvOrderNo, setHvOrderNo] = useState("");
  const [hvOrderInfo, setHvOrderInfo] = useState<HoangVanOrder | null>(null);
  const [hvChecking, setHvChecking] = useState(false);
  const [hvCheckError, setHvCheckError] = useState("");
  const [hvUsing, setHvUsing] = useState(false);

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [setupProducts, setSetupProducts] = useState<ProductPOSAudio[]>([]);
  const [editingProduct, setEditingProduct] = useState<ProductPOSAudio | null>(
    null,
  );
  const [editQuantity, setEditQuantity] = useState("");
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const [txRes, prodRes, slotRes, expiredRes] = await Promise.all([
        window.api.getTransactions(),
        window.api.getProductPOSAudio(),
        window.api.getHoangVanSlots(today),
        window.api.getExpiredOrders({ page: 1, pageSize: 1 }),
      ]);

      if (txRes.success && txRes.data) {
        setTransactions(txRes.data);
      }
      if (prodRes.success && prodRes.data) {
        setProducts(prodRes.data);
      }
      if (slotRes && slotRes.success && slotRes.data) {
        setSlots(slotRes.data);
      }
      if (expiredRes && expiredRes.success && expiredRes.data) {
        const innerData = (
          expiredRes.data as unknown as {
            data?: { total?: number; totalCount?: number };
          }
        ).data;
        setExpiredCount(innerData?.totalCount || innerData?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    // Polling every 5 seconds
    const intervalId = setInterval(fetchData, 5000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const handleTransactionClick = (id: string): void => {
    navigate(`/order?id=${id}`);
  };

  const handleSearchTransact = async (): Promise<void> => {
    if (transactId) {
      setIsTransactChecking(true);
      setTransactCheckError("");
      try {
        const res = await window.api.getTransactionByTransact(transactId);
        if (res.success && res.data) {
          setIsSearchOpen(false);
          handleTransactionClick(transactId);
        } else {
          setTransactCheckError(res.error || "Transaction not found!");
        }
      } catch (err: unknown) {
        setTransactCheckError((err as Error).message || "Lỗi hệ thống");
      } finally {
        setIsTransactChecking(false);
      }
    }
  };

  const handleCheckHoangVanOrder = async (): Promise<void> => {
    if (!hvOrderNo) return;
    setHvChecking(true);
    setHvCheckError("");
    setHvOrderInfo(null);
    try {
      const res = await window.api.checkOrder(hvOrderNo);
      if (res.success && res.data) {
        setHvOrderInfo(res.data);
      } else {
        setHvCheckError(res.error || "Không tìm thấy đơn hàng");
      }
    } catch (err: unknown) {
      setHvCheckError((err as Error).message || "Lỗi hệ thống");
    } finally {
      setHvChecking(false);
    }
  };

  const handleUseHoangVanOrder = async (): Promise<void> => {
    if (!hvOrderInfo) return;
    setHvUsing(true);
    try {
      // 1. Extract services
      const services = hvOrderInfo.services || [];
      if (services.length === 0) {
        setAlertConfig({
          isOpen: true,
          title: "Warning",
          message: "Order has no services.",
          type: "error",
        });
        return;
      }
      const svc = services[0];

      // 2. Post to our local DB first
      const swipe = localStorage.getItem("employeeSwipe") || "221278";

      const createRes = await window.api.createOrder({
        refCode: `_F:POS_AUDIO_${svc.serviceCode}`,
        quantity: svc.quantity,
        costEach: svc.unitPrice,
        swipe: swipe,
      });

      if (!createRes.success) {
        setAlertConfig({
          isOpen: true,
          title: "Error",
          message: "Internal billing error: " + createRes.error,
          type: "error",
        });
        return;
      }

      // 3. If local DB insert succeeds, call HoangVan Use API
      const useRes = await window.api.useOrder({
        orderNo: hvOrderInfo.orderNo,
        staffId: "NV001",
      });

      if (!useRes.success) {
        setAlertConfig({
          isOpen: true,
          title: "Error",
          message: "Hoang Van system error: " + useRes.error,
          type: "error",
        });
        return;
      }

      setAlertConfig({
        isOpen: true,
        title: "Success",
        message: "Bill created successfully! Transact: " + createRes.transact,
        type: "success",
      });
      setIsHoangVanSearchOpen(false);
      fetchData(); // Refresh UI
    } catch (err: unknown) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: "Error: " + (err instanceof Error ? err.message : String(err)),
        type: "error",
      });
    } finally {
      setHvUsing(false);
    }
  };

  const handleLogoutConfirm = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      const swipe = localStorage.getItem("employeeSwipe");
      if (swipe) {
        await window.api.logoutEmployee(swipe);
      }
      localStorage.removeItem("employeeSwipe");
      navigate("/login");
    } catch (err) {
      console.error(err);
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmOpen(false);
    }
  };

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await fetchData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getStatusColor = (statusName: string): string => {
    switch (statusName) {
      case "New":
        return "#1e3a8a";
      case "Out":
        return "#f59e0b";
      case "Return":
        return "#10b981";
      default:
        return "#64748b";
    }
  };

  return (
    <>
      <TitleBar />
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Dashboard</h1>
            <p style={styles.subtitle}>Bảo tàng chứng tích chiến tranh</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              style={styles.iconBtn}
              onClick={() => {
                setHvOrderNo("");
                setHvOrderInfo(null);
                setHvCheckError("");
                setIsHoangVanSearchOpen(true);
              }}
              title="Online Order Search"
            >
              <Globe size={20} />
            </button>
            <button
              style={styles.iconBtn}
              onClick={() => {
                setTransactId("");
                setTransactCheckError("");
                setIsSearchOpen(true);
              }}
              title="Find Transaction"
            >
              <Search size={20} />
            </button>
            <button
              style={{ ...styles.iconBtn, position: "relative" }}
              onClick={() => navigate("/expired")}
              title="Expired Orders"
            >
              <Archive size={20} />
              {expiredCount > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "-5px",
                    right: "-5px",
                    backgroundColor: "#ef4444",
                    color: "white",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {expiredCount > 99 ? "99+" : expiredCount}
                </div>
              )}
            </button>
            <button
              style={styles.iconBtn}
              onClick={handleRefresh}
              title="Refresh"
            >
              <RefreshCw
                size={20}
                style={{
                  transform: isRefreshing ? "rotate(180deg)" : "none",
                  transition: "transform 0.5s ease",
                }}
              />
            </button>
            <button
              style={styles.iconBtn}
              onClick={() => setIsLogoutConfirmOpen(true)}
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div style={styles.content}>
          {/* Left Column: Transactions */}
          <div style={{ ...styles.card, flex: 1, minWidth: 0 }}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Transactions</h2>
              <span style={styles.badge}>{transactions.length}</span>
            </div>

            <div style={styles.listContainer}>
              {isLoading && transactions.length === 0 ? (
                <div style={styles.emptyState}>Loading...</div>
              ) : transactions.length === 0 ? (
                <div style={styles.emptyState}>
                  <FileText
                    size={48}
                    color="#cbd5e1"
                    style={{ marginBottom: "16px" }}
                  />
                  No active transactions
                </div>
              ) : (
                <div style={styles.txList}>
                  {transactions.map((tx, idx: number) => (
                    <div
                      key={idx}
                      style={styles.txItem}
                      onClick={() =>
                        handleTransactionClick(tx.TRANSACT.toString())
                      }
                    >
                      <div style={styles.txLeft}>
                        <div style={styles.txId}>
                          Trans#: {tx.TRANSACT}
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: "normal",
                              color: "#64748b",
                              marginLeft: "8px",
                            }}
                          >
                            {new Date(tx.TIMEEND).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div style={styles.txTotal}>
                          Final Total: {tx.FINALTOTAL.toLocaleString("en-US")} đ
                        </div>
                      </div>
                      <div
                        style={{
                          ...styles.txRight,
                          width: "100%",
                          justifyContent: "flex-start",
                          marginTop: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color: "#475569",
                            marginRight: "4px",
                          }}
                        >
                          Status:
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: getStatusColor(tx.POSAudioStatusName),
                          }}
                        >
                          {tx.POSAudioStatusName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Middle Column: Slots */}
          <div style={{ ...styles.middleColumn, minWidth: 0 }}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  Slots - {new Date().toLocaleDateString("en-GB")}
                </h2>
                <span style={styles.badge}>{slots.length}</span>
              </div>
              <div style={styles.listContainer}>
                {isLoading && slots.length === 0 ? (
                  <div style={styles.emptyState}>Loading...</div>
                ) : slots.length === 0 ? (
                  <div style={styles.emptyState}>No slots found</div>
                ) : (
                  <div style={styles.txList}>
                    {slots.map((s, idx) => (
                      <div key={idx} style={styles.txItem}>
                        <div style={styles.txLeft}>
                          <div style={styles.txId}>{s.name}</div>
                          <div style={{ ...styles.txTotal, color: "#64748b" }}>
                            {s.startTime} - {s.endTime}
                          </div>
                        </div>
                        <div style={styles.txRight}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                            }}
                          >
                            <span
                              style={{ fontSize: "14px", color: "#64748b" }}
                            >
                              Available
                            </span>
                            <span
                              style={{
                                fontSize: "18px",
                                fontWeight: 700,
                                color:
                                  s.availableMachines > 0
                                    ? "#10b981"
                                    : "#ef4444",
                              }}
                            >
                              {s.availableMachines}/{s.maxMachines}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Products */}
          <div style={{ ...styles.rightColumn, minWidth: 0 }}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Products</h2>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  onClick={() => {
                    setSetupProducts(products.map((p) => ({ ...p })));
                    setIsSetupOpen(true);
                  }}
                >
                  <Settings size={20} color="#64748b" />
                </button>
              </div>
              <div style={{ padding: "24px 24px" }}>
                {products.length === 0 ? (
                  <div style={styles.emptyState}>No products</div>
                ) : (
                  <div style={styles.productList}>
                    {products.map((p, idx: number) => (
                      <div key={idx} style={styles.productItem}>
                        <span
                          style={{
                            fontSize: "18px",
                            fontWeight: 500,
                          }}
                        >
                          {p.DESCRIPT}
                        </span>
                        <span
                          style={{
                            fontSize: "22px",
                            fontWeight: "bold",
                            color: "#0369a1",
                          }}
                        >
                          {p.STORAGE}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search Modal (POS) */}
        {isSearchOpen && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <h2 style={styles.cardTitle}>Find Transaction</h2>
                <button
                  style={{ ...styles.iconBtn, border: "none" }}
                  onClick={() => setIsSearchOpen(false)}
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
                      transactId && !isTransactChecking
                        ? "pointer"
                        : "not-allowed",
                  }}
                  onClick={handleSearchTransact}
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
        )}

        {/* HoangVan Search Modal */}
        {isHoangVanSearchOpen && (
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
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Globe size={20} color="#1e3a8a" />
                  <h2 style={styles.cardTitle}>Online Order Search</h2>
                </div>
                <button
                  style={{ ...styles.iconBtn, border: "none" }}
                  onClick={() => setIsHoangVanSearchOpen(false)}
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
                    <input
                      type="text"
                      value={hvOrderNo}
                      onChange={(e) => setHvOrderNo(e.target.value)}
                      autoFocus
                      style={styles.searchInput}
                    />
                    <button
                      style={{
                        ...styles.primaryBtn,
                        marginTop: "16px",
                        opacity: hvOrderNo && !hvChecking ? 1 : 0.5,
                        cursor:
                          hvOrderNo && !hvChecking ? "pointer" : "not-allowed",
                      }}
                      onClick={handleCheckHoangVanOrder}
                      disabled={!hvOrderNo || hvChecking}
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
                            }).format(hvOrderInfo.totalAmount)}
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
                          {hvUsing
                            ? "Processing..."
                            : "Confirm Usage & Print Bill"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Setup Modal */}
        {isSetupOpen && (
          <div style={{ ...styles.modalOverlay, zIndex: 1100 }}>
            <div style={{ ...styles.modalContent, width: "500px" }}>
              <div style={styles.modalHeader}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Settings size={20} color="#1e3a8a" />
                  <h2 style={{ ...styles.cardTitle, color: "#1e3a8a" }}>
                    Setup
                  </h2>
                </div>
              </div>
              <div style={{ padding: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    marginBottom: "32px",
                  }}
                >
                  {setupProducts.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "16px",
                          color: "#1e293b",
                          fontWeight: 500,
                          width: "140px",
                        }}
                      >
                        {p.DESCRIPT}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#1e3a8a",
                            padding: 0,
                            display: "flex",
                          }}
                          onClick={() =>
                            setSetupProducts((prev) =>
                              prev.map((sp) =>
                                sp.PRODNUM === p.PRODNUM
                                  ? {
                                      ...sp,
                                      STORAGE: Math.max(
                                        0,
                                        (sp.STORAGE || 0) - 1,
                                      ),
                                    }
                                  : sp,
                              ),
                            )
                          }
                        >
                          <MinusCircle size={24} />
                        </button>
                        <div
                          style={{
                            width: "80px",
                            height: "36px",
                            border: "1px solid #cbd5e1",
                            borderRadius: "8px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontSize: "16px",
                            fontWeight: 600,
                            color: "#1e293b",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setEditingProduct(p);
                            setEditQuantity(p.STORAGE?.toString() || "0");
                          }}
                        >
                          {p.STORAGE}
                        </div>
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#1e3a8a",
                            padding: 0,
                            display: "flex",
                          }}
                          onClick={() =>
                            setSetupProducts((prev) =>
                              prev.map((sp) =>
                                sp.PRODNUM === p.PRODNUM
                                  ? { ...sp, STORAGE: (sp.STORAGE || 0) + 1 }
                                  : sp,
                              ),
                            )
                          }
                        >
                          <PlusCircle size={24} />
                        </button>
                      </div>
                      <div style={{ width: "32px" }}></div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                  }}
                >
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
                    onClick={() => setIsSetupOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    style={{
                      flex: 1,
                      height: "48px",
                      border: "none",
                      borderRadius: "12px",
                      background: "#1e3a8a",
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "white",
                      cursor: "pointer",
                    }}
                    onClick={async () => {
                      if (window.api.resetProduct) {
                        await window.api.resetProduct(
                          setupProducts.map((p) => ({
                            ...p,
                            COUNT: p.STORAGE,
                          })),
                        );
                        fetchData();
                      } else {
                        setProducts(setupProducts);
                      }
                      setIsSetupOpen(false);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Quantity Modal */}
        {editingProduct && (
          <div style={{ ...styles.modalOverlay, zIndex: 1200 }}>
            <div style={styles.modalContent}>
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
                  {editingProduct.DESCRIPT}
                </h2>
              </div>
              <div style={{ padding: "24px" }}>
                <input
                  type="text"
                  value={editQuantity}
                  onChange={(e) =>
                    setEditQuantity(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  autoFocus
                  style={{ ...styles.searchInput, marginBottom: "16px" }}
                />
                <KeypadControl
                  onKeyPress={(key) => setEditQuantity((prev) => prev + key)}
                  onBackspace={() =>
                    setEditQuantity((prev) => prev.slice(0, -1))
                  }
                  onClear={() => setEditQuantity("")}
                />
                <div
                  style={{ display: "flex", gap: "16px", marginTop: "24px" }}
                >
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
                    onClick={() => setEditingProduct(null)}
                  >
                    Close
                  </button>
                  <button
                    style={{
                      flex: 1,
                      height: "48px",
                      border: "none",
                      borderRadius: "12px",
                      background: "#1e3a8a",
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "white",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      const val = parseInt(editQuantity) || 0;
                      setSetupProducts((prev) =>
                        prev.map((p) =>
                          p.PRODNUM === editingProduct.PRODNUM
                            ? { ...p, STORAGE: val }
                            : p,
                        ),
                      );
                      setEditingProduct(null);
                    }}
                  >
                    Enter
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Logout Confirm Modal */}
        {isLogoutConfirmOpen && (
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
                    onClick={() => setIsLogoutConfirmOpen(false)}
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
                    onClick={handleLogoutConfirm}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? "..." : "Logout"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Alert Modal */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
    </>
  );
}

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    padding: "60px 32px 32px 32px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#ffffff",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
    color: "#0f172a",
  } as React.CSSProperties,
  subtitle: {
    margin: "4px 0 0 0",
    fontSize: "15px",
    color: "#64748b",
  } as React.CSSProperties,
  iconBtn: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    backgroundColor: "white",
    color: "#64748b",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,
  content: {
    flex: 1,
    display: "flex",
    gap: "24px",
    overflow: "hidden",
  } as React.CSSProperties,
  card: {
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    flex: 1,
  } as React.CSSProperties,
  cardHeader: {
    padding: "16px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabBtn: {
    flex: 1,
    padding: "12px",
    background: "none",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    outline: "none",
  } as React.CSSProperties,
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
    color: "#1e293b",
  } as React.CSSProperties,
  badge: {
    backgroundColor: "#e2e8f0",
    color: "#475569",
    padding: "4px 12px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: 600,
  } as React.CSSProperties,
  listContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 24px 24px 24px",
  } as React.CSSProperties,
  emptyState: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: "#94a3b8",
    fontSize: "16px",
  } as React.CSSProperties,
  txList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  } as React.CSSProperties,
  txItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    backgroundColor: "white",
    cursor: "pointer",
    transition: "all 0.2s",
    flexWrap: "wrap",
    gap: "8px",
  } as React.CSSProperties,
  txLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  } as React.CSSProperties,
  txRight: {
    display: "flex",
    alignItems: "center",
    fontSize: "16px",
  } as React.CSSProperties,
  txId: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#0f172a",
  } as React.CSSProperties,
  txTotal: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#0f172a",
  } as React.CSSProperties,
  rightColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  middleColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  productList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  } as React.CSSProperties,
  productItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    fontSize: "16px",
    color: "#1e293b",
    fontWeight: 600,
  } as React.CSSProperties,
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  } as React.CSSProperties,
  modalContent: {
    width: "400px",
    backgroundColor: "white",
    borderRadius: "24px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    overflow: "hidden",
  } as React.CSSProperties,
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e2e8f0",
  } as React.CSSProperties,
  searchInput: {
    width: "100%",
    height: "56px",
    fontSize: "24px",
    fontWeight: 600,
    textAlign: "center",
    letterSpacing: "4px",
    borderRadius: "12px",
    border: "2px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    outline: "none",
    marginBottom: "24px",
    boxSizing: "border-box",
  } as React.CSSProperties,
  primaryBtn: {
    width: "100%",
    height: "56px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "18px",
    fontWeight: 600,
    transition: "all 0.2s",
  } as React.CSSProperties,
};
