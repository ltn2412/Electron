import { useState, useEffect, useCallback } from "react";
import { Settings, RefreshCw, FileText, Search, X } from "lucide-react";
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
      setIsSearchOpen(false);
      handleTransactionClick(transactId);
    }
  };

  const getStatusColor = (statusName: string): string => {
    switch (statusName) {
      case "New":
        return "#1e3a8a"; // Darker blue to match WPF
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
            <button
              style={styles.iconBtn}
              onClick={() => setIsSearchOpen(true)}
              title="Find Transaction"
            >
              <Search size={20} />
            </button>
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
                        <div style={styles.txId}>Trans#: {tx.TRANSACT}</div>
                        <div style={styles.txTotal}>
                          Final Total: {tx.FINALTOTAL.toLocaleString()}
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

          {/* Right Column: Products */}
          <div style={styles.rightColumn}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Products</h2>
                <Settings size={20} color="#64748b" />
              </div>
              <div style={{ padding: "24px 24px" }}>
                {products.length === 0 ? (
                  <div style={styles.emptyState}>No products</div>
                ) : (
                  <div style={styles.productList}>
                    {products.map((p, idx: number) => (
                      <div key={idx} style={styles.productItem}>
                        {p.DESCRIPT} :{" "}
                        <span style={{ marginLeft: "4px" }}>{p.STORAGE}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search Modal */}
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
                    marginTop: "24px",
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
          </div>
        )}
      </div>
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
    backgroundColor: "#f8fafc", // Light grey background like WPF
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    flex: 1,
  } as React.CSSProperties,
  cardHeader: {
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
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
    padding: "0 24px 24px 24px",
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
    width: "340px",
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  productList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  } as React.CSSProperties,
  productItem: {
    fontSize: "18px",
    color: "#1e293b",
    fontWeight: 500,
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
