import TitleBar from "@/components/TitleBar";
import { POSDETAIL, POSHEADER } from "@shared/types";
import { ArrowLeft, CheckCircle, Clock, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { showAlert } from "@/utils/alert";

export default function PageOrder(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transactId = searchParams.get("id");

  const [transaction, setTransaction] = useState<POSHEADER | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchTx = async (): Promise<void> => {
      if (!transactId) {
        if (isMounted) setIsLoading(false);
        return;
      }
      try {
        const res = await window.api.getTransactionByTransact(transactId);
        if (res.success && res.data) {
          if (isMounted) setTransaction(res.data);
        } else {
          showAlert("Transaction not found!");
          navigate("/menu");
        }
      } catch (error) {
        console.error("Error fetching transaction details:", error);
        showAlert("Error loading transaction.");
        navigate("/menu");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchTx();
    return () => {
      isMounted = false;
    };
  }, [transactId, navigate]);

  const handleAction = async (action: "Out" | "Return"): Promise<void> => {
    if (!transaction || !transaction.POSDETAILS) return;
    setIsProcessing(true);

    try {
      const details = transaction.POSDETAILS.map((d: POSDETAIL) => ({
        PRODNUM: d.PRODNUM,
        QuantityOut: action === "Out" ? d.QUAN : 0,
        QuantityReturn: action === "Return" ? d.QUAN : 0,
      }));

      const payload = {
        Transact: transaction.TRANSACT,
        Status: action === "Out" ? 1 : 2, // 1 = Out, 2 = Return
        PhoneNumber: transactId, // Fallback if they searched by phone
        TransactionDetailPOSAudios: details,
      };

      const res = await window.api.createUpdatePOSAudio(payload);
      if (res.success) {
        navigate("/menu");
      } else {
        showAlert(res.error || "Failed to update transaction.");
      }
    } catch (error: unknown) {
      const err = error as Error;
      showAlert(`System error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <TitleBar />
        <h2>Loading transaction...</h2>
      </div>
    );
  }

  if (!transaction) return <></>;

  const statusName = transaction.POSAudioStatusName;
  const isNew = statusName === "New";
  const isOut = statusName === "Out";
  const isReturn = statusName === "Return";
  const isExpired = statusName === "Expired";

  const filteredItems = transaction.POSDETAILS?.filter((item: POSDETAIL) => item.REFCODE) || [];
  const filteredTotal = filteredItems.reduce((sum, item) => sum + (item.PRICE || 0) * (item.QUAN || 1), 0);

  return (
    <>
      <TitleBar />
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => navigate("/menu")}>
            <ArrowLeft size={24} />
            <span>Back</span>
          </button>
          <div style={styles.headerInfo}>
            <h1 style={styles.title}>Transaction #{transaction.TRANSACT}</h1>
            <span
              style={{
                ...styles.badge,
                backgroundColor: isNew
                  ? "#eff6ff"
                  : isOut
                    ? "#fef3c7"
                    : "#d1fae5",
                color: isNew ? "#3b82f6" : isOut ? "#d97706" : "#059669",
              }}
            >
              {statusName}
            </span>
          </div>
        </div>

        <div style={styles.content}>
          {/* Left Col: Details */}
          <div style={styles.leftCol}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Customer Info</h2>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Time:</span>
                  <span style={styles.infoValue}>
                    {new Date(transaction.TIMEEND).toLocaleString()}
                  </span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Cashier:</span>
                  <span style={styles.infoValue}>{transaction.EMPNAME}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Total:</span>
                  <span
                    style={{
                      ...styles.infoValue,
                      color: "#10b981",
                      fontWeight: 700,
                    }}
                  >
                    {filteredTotal.toLocaleString("en-US")} đ
                  </span>
                </div>
              </div>
            </div>

            <div style={{ ...styles.card, marginTop: "24px", flex: 1 }}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  Items ({filteredItems.length})
                </h2>
              </div>
              <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
                {filteredItems.map(
                  (item: POSDETAIL, idx: number) => (
                    <div key={idx} style={styles.itemRow}>
                      <div style={styles.itemLeft}>
                        <div style={styles.itemQuantity}>{item.QUAN}x</div>
                        <div style={styles.itemName}>{item.DESCRIPT}</div>
                      </div>
                      <div style={styles.itemPrice}>
                        {item.PRICE != null && item.PRICE > 0
                          ? `${item.PRICE.toLocaleString("en-US")} đ`
                          : ""}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>

          {/* Right Col: Actions */}
          <div style={styles.rightCol}>
            <div
              style={{
                ...styles.card,
                height: "100%",
                justifyContent: "center",
                alignItems: "center",
                padding: "40px",
              }}
            >
              {isNew && (
                <div style={styles.actionBlock}>
                  <Package
                    size={64}
                    color="#3b82f6"
                    style={{ marginBottom: "24px" }}
                  />
                  <h3 style={styles.actionTitle}>Ready for Handover</h3>
                  <p style={styles.actionDesc}>
                    Hand the devices to the customer and confirm below.
                  </p>
                  <button
                    style={{ ...styles.actionBtn, backgroundColor: "#3b82f6" }}
                    onClick={() => handleAction("Out")}
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Processing..." : "Confirm Handover (OUT)"}
                  </button>
                </div>
              )}

              {isOut && (
                <div style={styles.actionBlock}>
                  <Clock
                    size={64}
                    color="#f59e0b"
                    style={{ marginBottom: "24px" }}
                  />
                  <h3 style={styles.actionTitle}>Waiting for Return</h3>
                  <p style={styles.actionDesc}>
                    The customer is currently using the devices. Click below
                    when they return them.
                  </p>
                  <button
                    style={{ ...styles.actionBtn, backgroundColor: "#f59e0b" }}
                    onClick={() => handleAction("Return")}
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Processing..." : "Confirm Return"}
                  </button>
                </div>
              )}

              {isReturn && (
                <div style={styles.actionBlock}>
                  <CheckCircle
                    size={64}
                    color="#10b981"
                    style={{ marginBottom: "24px" }}
                  />
                  <h3 style={styles.actionTitle}>Completed</h3>
                  <p style={styles.actionDesc}>
                    This transaction has been successfully completed and devices
                    returned.
                  </p>
                  <button
                    style={{
                      ...styles.actionBtn,
                      backgroundColor: "#cbd5e1",
                      color: "#64748b",
                      cursor: "not-allowed",
                    }}
                    disabled
                  >
                    Returned
                  </button>
                </div>
              )}

              {isExpired && (
                <div style={styles.actionBlock}>
                  <CheckCircle
                    size={64}
                    color="#ef4444"
                    style={{ marginBottom: "24px" }}
                  />
                  <h3 style={styles.actionTitle}>Transaction Expired</h3>
                  <p style={styles.actionDesc}>
                    This ticket has expired and can no longer be processed.
                  </p>
                  <button
                    style={{
                      ...styles.actionBtn,
                      backgroundColor: "#fca5a5",
                      color: "#991b1b",
                      cursor: "not-allowed",
                    }}
                    disabled
                  >
                    Expired
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  loadingContainer: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    fontFamily: "'Inter', sans-serif",
    color: "#64748b",
  } as React.CSSProperties,
  container: {
    width: "100vw",
    height: "100vh",
    padding: "60px 32px 32px 32px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#f1f5f9",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    marginBottom: "24px",
    gap: "24px",
  } as React.CSSProperties,
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    backgroundColor: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  } as React.CSSProperties,
  headerInfo: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
    color: "#0f172a",
  } as React.CSSProperties,
  badge: {
    padding: "6px 16px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: 700,
    textTransform: "uppercase",
  } as React.CSSProperties,
  content: {
    flex: 1,
    display: "flex",
    gap: "24px",
    overflow: "hidden",
  } as React.CSSProperties,
  leftCol: {
    width: "480px",
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  rightCol: {
    flex: 1,
  } as React.CSSProperties,
  card: {
    backgroundColor: "white",
    borderRadius: "24px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  } as React.CSSProperties,
  cardHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid #f1f5f9",
  } as React.CSSProperties,
  cardTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 600,
    color: "#1e293b",
  } as React.CSSProperties,
  cardBody: {
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  } as React.CSSProperties,
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
  infoLabel: {
    color: "#64748b",
    fontSize: "15px",
  } as React.CSSProperties,
  infoValue: {
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: 500,
  } as React.CSSProperties,
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    marginBottom: "12px",
  } as React.CSSProperties,
  itemLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  } as React.CSSProperties,
  itemQuantity: {
    backgroundColor: "#e2e8f0",
    color: "#334155",
    padding: "4px 10px",
    borderRadius: "8px",
    fontWeight: 700,
    fontSize: "14px",
  } as React.CSSProperties,
  itemName: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#0f172a",
  } as React.CSSProperties,
  itemPrice: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#64748b",
  } as React.CSSProperties,
  actionBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    maxWidth: "400px",
  } as React.CSSProperties,
  actionTitle: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 12px 0",
  } as React.CSSProperties,
  actionDesc: {
    fontSize: "16px",
    color: "#64748b",
    lineHeight: "1.5",
    margin: "0 0 32px 0",
  } as React.CSSProperties,
  actionBtn: {
    width: "100%",
    height: "64px",
    color: "white",
    border: "none",
    borderRadius: "16px",
    fontSize: "20px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
    transition: "all 0.2s",
  } as React.CSSProperties,
};
