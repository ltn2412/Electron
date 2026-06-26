import { useState, useEffect, useCallback } from "react";
import { Settings, RefreshCw, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TitleBar from "@/components/TitleBar";
import KeypadControl from "@/components/KeypadControl";
import { POSHEADER, ProductPOSAudio } from "@shared/types";

export default function PageMenu(): React.JSX.Element {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<POSHEADER[]>([]);
  const [products, setProducts] = useState<ProductPOSAudio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [transactId, setTransactId] = useState("");

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [txRes, prodRes] = await Promise.all([
        window.api.getTransactions(),
        window.api.getProductPOSAudio(),
      ]);

      if (txRes.success && txRes.data) {
        setTransactions(txRes.data);
      }
      if (prodRes.success && prodRes.data) {
        setProducts(prodRes.data);
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
    // Polling every 10 seconds
    const intervalId = setInterval(fetchData, 10000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const handleTransactionClick = (id: string): void => {
    navigate(`/order?id=${id}`);
  };

  const handleSearchTransact = (): void => {
    if (transactId) {
      handleTransactionClick(transactId);
    }
  };

  const getStatusColor = (statusName: string): string => {
    switch (statusName) {
      case "New":
        return "#3b82f6";
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
            <p style={styles.subtitle}>Manage your audio rentals</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button style={styles.iconBtn} onClick={fetchData} title="Refresh">
              <RefreshCw size={20} />
            </button>
            <button
              style={styles.iconBtn}
              onClick={() => navigate("/login")}
              title="Logout"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        <div style={styles.content}>
          {/* Left Column: Transactions */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Recent Transactions</h2>
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
                <div style={styles.grid}>
                  {transactions.map((tx, idx: number) => (
                    <div
                      key={idx}
                      style={styles.txItem}
                      onClick={() =>
                        handleTransactionClick(tx.TRANSACT.toString())
                      }
                    >
                      <div style={styles.txHeader}>
                        <span style={styles.txId}>#{tx.TRANSACT}</span>
                        <span
                          style={{
                            ...styles.statusBadge,
                            backgroundColor:
                              getStatusColor(tx.POSAudioStatusName) + "20",
                            color: getStatusColor(tx.POSAudioStatusName),
                          }}
                        >
                          {tx.POSAudioStatusName}
                        </span>
                      </div>
                      <div style={styles.txBody}>
                        <div>{new Date(tx.TIMEEND).toLocaleString()}</div>
                        <div style={styles.txTotal}>${tx.FINALTOTAL}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Keypad & Products */}
          <div style={styles.rightColumn}>
            {/* Search Card */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Find Transaction</h2>
              </div>
              <div style={{ padding: "20px" }}>
                <input
                  type="text"
                  value={transactId}
                  readOnly
                  placeholder="Enter ID / Phone"
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
                    marginTop: "20px",
                    opacity: transactId ? 1 : 0.5,
                    cursor: transactId ? "pointer" : "not-allowed",
                  }}
                  onClick={handleSearchTransact}
                  disabled={!transactId}
                >
                  Search
                </button>
              </div>
            </div>

            {/* Inventory Card */}
            <div style={{ ...styles.card, flex: 1, marginTop: "20px" }}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Inventory Status</h2>
              </div>
              <div style={styles.listContainer}>
                {products.length === 0 ? (
                  <div style={styles.emptyState}>No products</div>
                ) : (
                  <div style={styles.productList}>
                    {products.map((p, idx: number) => (
                      <div key={idx} style={styles.productItem}>
                        <div style={styles.prodInfo}>
                          <div style={styles.prodName}>{p.DESCRIPT}</div>
                          <div style={styles.prodRef}>{p.REFCODE}</div>
                        </div>
                        <div style={styles.prodStats}>
                          <div style={styles.statBox}>
                            <div style={styles.statLabel}>Available</div>
                            <div style={styles.statValue}>{p.STORAGE}</div>
                          </div>
                          <div style={styles.statBox}>
                            <div style={styles.statLabel}>Total</div>
                            <div style={styles.statValue}>{p.QUANTITY}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    padding: "60px 32px 32px 32px", // padding top for titlebar
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#f1f5f9",
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
    backgroundColor: "white",
    borderRadius: "24px",
    boxShadow:
      "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  } as React.CSSProperties,
  cardHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
  cardTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 600,
    color: "#1e293b",
  } as React.CSSProperties,
  badge: {
    backgroundColor: "#eff6ff",
    color: "#3b82f6",
    padding: "4px 12px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: 600,
  } as React.CSSProperties,
  listContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px",
  } as React.CSSProperties,
  txItem: {
    padding: "20px",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,
  txHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  } as React.CSSProperties,
  txId: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#0f172a",
  } as React.CSSProperties,
  statusBadge: {
    padding: "4px 10px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
  } as React.CSSProperties,
  txBody: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#64748b",
    fontSize: "14px",
  } as React.CSSProperties,
  txTotal: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#10b981",
  } as React.CSSProperties,
  rightColumn: {
    width: "380px",
    display: "flex",
    flexDirection: "column",
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
    marginBottom: "20px",
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
  productList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  } as React.CSSProperties,
  productItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  } as React.CSSProperties,
  prodInfo: {
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  prodName: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: "4px",
  } as React.CSSProperties,
  prodRef: {
    fontSize: "12px",
    color: "#64748b",
  } as React.CSSProperties,
  prodStats: {
    display: "flex",
    gap: "12px",
  } as React.CSSProperties,
  statBox: {
    textAlign: "center",
  } as React.CSSProperties,
  statLabel: {
    fontSize: "11px",
    color: "#94a3b8",
    textTransform: "uppercase",
    fontWeight: 600,
    marginBottom: "2px",
  } as React.CSSProperties,
  statValue: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#0f172a",
  } as React.CSSProperties,
};
