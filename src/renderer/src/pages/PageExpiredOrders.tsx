import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SpeedPosService } from "@/api/SpeedPosService";
import TitleBar from "@/components/TitleBar";
import { ExpiredOrder, ExpiredOrdersResponse } from "@/shared/apiTypes";
import { ArrowLeft, Clock, AlertTriangle, AlertCircle } from "lucide-react";

export default function PageExpiredOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ExpiredOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExpiredOrders();
  }, []);

  const fetchExpiredOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res: ExpiredOrdersResponse = await SpeedPosService.getExpiredOrders(1, 50);
      if (res.success && res.data) {
        setOrders(res.data.items);
      } else {
        setError(res.message || "Không thể lấy danh sách đơn hết hạn");
      }
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra khi gọi API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <TitleBar />
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
          Back to Dashboard
        </button>
        <h1 style={styles.title}>Expired Orders</h1>
      </div>

      <div style={styles.content}>
        {loading ? (
          <div style={styles.emptyState}>Loading expired orders...</div>
        ) : error ? (
          <div style={styles.errorState}>
            <AlertCircle size={48} color="#ef4444" style={{ marginBottom: "16px" }} />
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div style={styles.emptyState}>
            <Clock size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
            No expired orders found
          </div>
        ) : (
          <div style={styles.grid}>
            {orders.map((order) => (
              <div key={order.orderNo} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={styles.orderNo}>{order.orderNo}</span>
                    <span style={styles.buyerName}>{order.buyerName} - {order.buyerEmail}</span>
                  </div>
                  <span style={styles.expiredBadge}>
                    <AlertTriangle size={14} style={{ marginRight: "4px" }} />
                    Expired
                  </span>
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.infoRow}>
                    <span style={styles.label}>Visit Date:</span>
                    <span style={styles.value}>{order.visitDate}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.label}>Expired At:</span>
                    <span style={styles.value}>{new Date(order.expiredAt).toLocaleString()}</span>
                  </div>
                  <div style={styles.servicesBox}>
                    <div style={styles.servicesTitle}>Services</div>
                    {order.services.map((svc, i) => (
                      <div key={i} style={styles.serviceItem}>
                        <span>{svc.serviceName}</span>
                        <span style={styles.serviceQty}>x{svc.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#f1f5f9",
    fontFamily: "Inter, sans-serif",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    padding: "24px 40px",
    backgroundColor: "white",
    borderBottom: "1px solid #e2e8f0",
  } as React.CSSProperties,
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 600,
    color: "#64748b",
    padding: "8px 16px",
    borderRadius: "8px",
    transition: "all 0.2s",
  } as React.CSSProperties,
  title: {
    margin: 0,
    marginLeft: "24px",
    fontSize: "24px",
    fontWeight: 800,
    color: "#0f172a",
  } as React.CSSProperties,
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "32px 40px",
  } as React.CSSProperties,
  emptyState: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontSize: "18px",
    fontWeight: 500,
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
    gap: "24px",
  } as React.CSSProperties,
  card: {
    backgroundColor: "white",
    borderRadius: "16px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  cardHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  } as React.CSSProperties,
  orderNo: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#0f172a",
  } as React.CSSProperties,
  buyerName: {
    fontSize: "13px",
    color: "#64748b",
  } as React.CSSProperties,
  expiredBadge: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
  } as React.CSSProperties,
  cardBody: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  } as React.CSSProperties,
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
  label: {
    fontSize: "14px",
    color: "#64748b",
    fontWeight: 500,
  } as React.CSSProperties,
  value: {
    fontSize: "14px",
    color: "#0f172a",
    fontWeight: 600,
  } as React.CSSProperties,
  servicesBox: {
    marginTop: "8px",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    padding: "12px",
    border: "1px solid #e2e8f0",
  } as React.CSSProperties,
  servicesTitle: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "8px",
  } as React.CSSProperties,
  serviceItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    color: "#0f172a",
    marginBottom: "4px",
  } as React.CSSProperties,
  serviceQty: {
    fontWeight: 700,
    color: "#3b82f6",
  } as React.CSSProperties,
};
