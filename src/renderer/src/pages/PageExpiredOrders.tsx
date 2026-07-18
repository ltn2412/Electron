import { HoangVanService } from "@/api/HoangVanService";
import AlertModal from "@/components/AlertModal";
import TitleBar from "@/components/TitleBar";
import { ExpiredOrder, ExpiredOrdersResponse } from "@shared/types";
import { AlertCircle, ArrowLeft, FileText, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function PageExpiredOrders(): React.JSX.Element {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ExpiredOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<ExpiredOrder | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  const fetchExpiredOrders = async (
    pageNum: number = 1,
    isLoadMore: boolean = false,
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const res: ExpiredOrdersResponse = await HoangVanService.getExpiredOrders(
        pageNum,
        50,
      );
      if (res.success && res.data) {
        if (isLoadMore) {
          setOrders((prev) => [...prev, ...res.data!.items]);
        } else {
          setOrders(res.data.items);
        }
        setPage(pageNum);
        setHasMore(res.data.items.length === 50);
      } else {
        setError(res.message || "Failed to load expired orders");
      }
    } catch (err: unknown) {
      setError(
        (err as Error).message || "An error occurred while calling the API",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExpiredOrders(1, false);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore && !loading) {
      fetchExpiredOrders(page + 1, true);
    }
  };

  const handleConfirmReturn = async (): Promise<void> => {
    if (!selectedOrder) return;
    setConfirming(true);
    let createdTransactIds: number[] = [];
    try {
      // 1. Create POS Return Transactions (status = 3 for expired)
      const services = selectedOrder.services || [];
      if (services.length === 0) {
        setAlertConfig({
          isOpen: true,
          title: "Warning",
          message: "Order has no services.",
          type: "error",
        });
        setConfirming(false);
        return;
      }

      const swipe = localStorage.getItem("employeeSwipe") || "";

      // Insert bills for each service
      for (const svc of services) {
        const createRes = await window.api.createOrder({
          refCode: `_F:POS_AUDIO_${svc.serviceCode}`,
          quantity: svc.quantity,
          costEach: svc.unitPrice,
          swipe: swipe,
          status: 3, // 3 for Expired
        });
        if (!createRes.success) {
          throw new Error(`Internal billing error: ${createRes.error}`);
        }
        if ((createRes as any).data?.transact) {
          createdTransactIds.push((createRes as any).data.transact);
        }
      }

      // 2. Call HoangVan API to confirm expired order
      const confirmRes = await HoangVanService.confirmExpiredOrders({
        orderNos: [selectedOrder.orderNo],
      });

      if (!confirmRes.success) {
        throw new Error(
          confirmRes.message || "Hoang Van order confirmation error (500)",
        );
      }

      setAlertConfig({
        isOpen: true,
        title: "Success",
        message: "Expired order successfully recovered!",
        type: "success",
      });
      setSelectedOrder(null);
      fetchExpiredOrders(1, false); // refresh list
    } catch (err: unknown) {
      // Rollback DB inserts if API call fails
      if (createdTransactIds.length > 0) {
        for (const tid of createdTransactIds) {
          await window.api.deleteOrder({ transact: tid });
        }
      }
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: "Error: " + ((err as Error).message || String(err)),
        type: "error",
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div style={styles.container}>
      <TitleBar />
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <button style={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={styles.title}>Expired Orders</h1>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.badge}>{orders.length}</span>
        </div>
      </div>

      <div style={styles.content} onScroll={handleScroll}>
        {loading && orders.length === 0 ? (
          <div style={styles.emptyState}>Loading data...</div>
        ) : error ? (
          <div style={styles.errorState}>
            <AlertCircle
              size={48}
              color="#ef4444"
              style={{ marginBottom: "16px" }}
            />
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div style={styles.emptyState}>
            <FileText
              size={48}
              color="#cbd5e1"
              style={{ marginBottom: "16px" }}
            />
            No expired orders found
          </div>
        ) : (
          <div style={styles.txList}>
            {orders.map((order) => (
              <div
                key={order.orderNo}
                style={styles.txItem}
                onClick={() => setSelectedOrder(order)}
              >
                <div style={styles.txLeft}>
                  <div style={styles.txId}>
                    Order#: {order.orderNo}
                    <span style={styles.txTime}>
                      {new Date(order.expiredAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <div style={styles.txTotal}>
                    {order.buyerName} - {order.buyerPhone || order.buyerEmail}
                  </div>
                </div>
                <div style={styles.txRight}>
                  <span
                    style={{
                      fontWeight: 600,
                      color: "#475569",
                      marginRight: "4px",
                    }}
                  >
                    Status:
                  </span>
                  <span style={{ fontWeight: 700, color: "#dc2626" }}>
                    Expired
                  </span>
                </div>
              </div>
            ))}
            {loading && orders.length > 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "12px",
                  color: "#64748b",
                }}
              >
                Loading more...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Search size={20} color="#1e3a8a" />
                <h2 style={styles.cardTitle}>Expired Order Details</h2>
              </div>
              <button
                style={{ ...styles.iconBtn, border: "none" }}
                onClick={() => setSelectedOrder(null)}
              >
                <X size={24} />
              </button>
            </div>

            <div
              className="hide-scroll"
              style={{ padding: "24px", overflowY: "auto", maxHeight: "60vh" }}
            >
              <div style={styles.detailCard}>
                {/* Header Section */}
                <div style={styles.detailHeader}>
                  <div>
                    <div style={styles.detailLabel}>Order No.</div>
                    <div style={styles.detailValue}>
                      {selectedOrder.orderNo}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={styles.detailLabel}>Status</div>
                    <div
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: "#fee2e2",
                        color: "#dc2626",
                      }}
                    >
                      Expired
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div style={styles.detailSection}>
                  <div style={styles.infoGrid}>
                    <div>
                      <div style={styles.detailLabel}>Customer Name</div>
                      <div style={styles.detailValueSmall}>
                        {selectedOrder.buyerName}
                      </div>
                    </div>
                    <div>
                      <div style={styles.detailLabel}>Phone / Email</div>
                      <div style={styles.detailValueSmall}>
                        {selectedOrder.buyerPhone || selectedOrder.buyerEmail}
                      </div>
                    </div>
                    <div>
                      <div style={styles.detailLabel}>Visit Date</div>
                      <div style={styles.detailValueSmall}>
                        {selectedOrder.visitDate}
                      </div>
                    </div>
                    <div>
                      <div style={styles.detailLabel}>Expired At</div>
                      <div style={styles.detailValueSmall}>
                        {new Date(selectedOrder.expiredAt).toLocaleDateString(
                          "vi-VN",
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Services List */}
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Services</div>
                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {(selectedOrder.services || []).map((svc, idx) => (
                      <div key={idx} style={styles.serviceItemBox}>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "#1e293b",
                              marginBottom: "4px",
                            }}
                          >
                            {svc.serviceName}
                          </div>
                          <div style={{ fontSize: "13px", color: "#64748b" }}>
                            {svc.unitPrice.toLocaleString("vi-VN")} đ x{" "}
                            {svc.quantity}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {(
                            svc.totalAmount ||
                            svc.unitPrice * svc.quantity ||
                            0
                          ).toLocaleString("vi-VN")}{" "}
                          đ
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Section */}
                <div style={styles.detailTotal}>
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "#475569",
                    }}
                  >
                    Total Amount
                  </span>
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    {selectedOrder.totalServiceAmount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              </div>

              <button
                style={{
                  ...styles.primaryBtn,
                  marginTop: "24px",
                  opacity: confirming ? 0.5 : 1,
                  cursor: confirming ? "not-allowed" : "pointer",
                  backgroundColor: "#dc2626", // red for confirm return
                }}
                onClick={handleConfirmReturn}
                disabled={confirming}
              >
                {confirming ? "Processing..." : "Confirm Return Expired Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
    </div>
  );
}

const styles = {
  container: {
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    paddingTop: "36px",
    backgroundColor: "#f1f5f9",
    fontFamily: "Inter, sans-serif",
    boxSizing: "border-box",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "24px 40px",
    backgroundColor: "white",
    borderBottom: "1px solid #e2e8f0",
  } as React.CSSProperties,
  backBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    border: "none",
    cursor: "pointer",
    color: "#64748b",
    padding: "12px",
    borderRadius: "12px",
    transition: "all 0.2s",
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.5px",
  } as React.CSSProperties,
  headerRight: {
    display: "flex",
    alignItems: "center",
  } as React.CSSProperties,
  badge: {
    backgroundColor: "#ef4444",
    color: "white",
    padding: "4px 12px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: 700,
  } as React.CSSProperties,
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 40px",
  } as React.CSSProperties,
  emptyState: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: "16px",
  } as React.CSSProperties,
  errorState: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#ef4444",
    fontSize: "18px",
    fontWeight: 500,
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
  txTime: {
    fontSize: "14px",
    fontWeight: "normal",
    color: "#64748b",
    marginLeft: "8px",
  } as React.CSSProperties,
  txTotal: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#64748b",
  } as React.CSSProperties,

  // Modal styles (identical to PageMenu)
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
    width: "480px",
    backgroundColor: "white",
    borderRadius: "24px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e2e8f0",
  } as React.CSSProperties,
  cardTitle: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  } as React.CSSProperties,
  iconBtn: {
    background: "transparent",
    cursor: "pointer",
    color: "#64748b",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    transition: "all 0.2s",
  } as React.CSSProperties,

  // Detail Card styles
  detailCard: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    boxShadow:
      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    overflow: "hidden",
  } as React.CSSProperties,
  detailHeader: {
    backgroundColor: "#f8fafc",
    padding: "16px 20px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
  detailLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  } as React.CSSProperties,
  detailValue: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f172a",
  } as React.CSSProperties,
  statusBadge: {
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: 700,
    display: "inline-block",
  } as React.CSSProperties,
  detailSection: {
    padding: "16px 20px",
    borderBottom: "1px dashed #e2e8f0",
  } as React.CSSProperties,
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  } as React.CSSProperties,
  detailValueSmall: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1e293b",
  } as React.CSSProperties,
  serviceItemBox: {
    display: "flex",
    alignItems: "center",
    padding: "12px",
    backgroundColor: "#f1f5f9",
    borderRadius: "8px",
  } as React.CSSProperties,
  detailTotal: {
    padding: "16px 20px",
    backgroundColor: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
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
