import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PageMenu(): React.JSX.Element {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      {/* Giả lập TitleBarControl */}
      <div style={styles.titleBar}>
        <h2>POS System</h2>
        <button onClick={() => navigate("/login")} style={styles.logoutBtn}>
          Logout
        </button>
      </div>

      <div style={styles.content}>
        {/* Cột trái: Transactions */}
        <div style={styles.transactionCard}>
          <h2 style={styles.heading}>Transactions</h2>
          <div style={styles.emptyState}>
            <p>No transaction</p>
          </div>
        </div>

        {/* Cột phải: Products */}
        <div style={styles.productSection}>
          <div style={styles.productCard}>
            <div style={styles.cardHeader}>
              <h2 style={styles.heading}>Products</h2>
              <button style={styles.iconBtn} onClick={() => navigate("/order")}>
                <Settings size={24} color="#3b82f6" />
              </button>
            </div>
            <div style={styles.productList}>
              {/* Render danh sách sản phẩm ở đây */}
              <p
                style={{
                  color: "#888",
                  textAlign: "center",
                  marginTop: "20px",
                }}
              >
                No products loaded
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#ffffff",
  },
  titleBar: {
    height: "48px",
    backgroundColor: "#1e293b",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
  },
  logoutBtn: {
    background: "none",
    color: "#ff4757",
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    paddingTop: "48px",
    gap: "40px",
  },
  transactionCard: {
    width: "650px",
    height: "640px",
    backgroundColor: "#f2f2f3",
    borderRadius: "15px",
    border: "1px solid #d1d5db",
    padding: "24px",
    display: "flex",
    flexDirection: "column" as const,
  },
  heading: {
    color: "#3b82f6",
    fontSize: "22px",
    fontWeight: "bold",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "#656e81",
    fontSize: "18px",
  },
  productSection: {
    width: "500px",
    height: "640px",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "flex-end",
  },
  productCard: {
    width: "490px",
    height: "185px",
    backgroundColor: "#f2f2f3",
    borderRadius: "15px",
    border: "1px solid #d1d5db",
    padding: "24px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconBtn: {
    background: "transparent",
    padding: "8px",
    borderRadius: "50%",
  },
  productList: {
    marginTop: "10px",
    height: "100px",
    overflowY: "auto" as const,
  },
};
