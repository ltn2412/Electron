import { useState } from "react";
import { useNavigate } from "react-router-dom";
import KeypadControl from "../components/KeypadControl";

export default function PageOrder(): React.JSX.Element {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("0");

  return (
    <div style={styles.container}>
      <div style={styles.titleBar}>
        <h2>Order View</h2>
        <button onClick={() => navigate("/menu")} style={styles.logoutBtn}>
          Back
        </button>
      </div>

      <div style={styles.content}>
        {/* Left Column */}
        <div style={styles.leftCol}>
          <div style={styles.ticketList}>{/* List products */}</div>
          <div style={styles.divider} />
          <div style={styles.storageList}>{/* List storage */}</div>
        </div>

        {/* Right Column: Keypad & Actions */}
        <div style={styles.rightCol}>
          <div style={styles.actionPanel}>
            <input
              type="text"
              value={inputValue}
              readOnly
              style={styles.inputBox}
            />

            <div style={{ margin: "20px 0" }}>
              <KeypadControl
                onKeyPress={(key) =>
                  setInputValue((prev) => (prev === "0" ? key : prev + key))
                }
                onBackspace={() =>
                  setInputValue((prev) =>
                    prev.length > 1 ? prev.slice(0, -1) : "0",
                  )
                }
                onClear={() => setInputValue("0")}
              />
            </div>

            <div style={styles.buttonGroup}>
              <button
                style={styles.cancelBtn}
                onClick={() => setInputValue("0")}
              >
                Cancel
              </button>
              <button style={styles.confirmBtn}>Confirm</button>
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
    color: "#fff",
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    display: "flex",
  },
  leftCol: {
    width: "850px",
    padding: "24px",
    display: "flex",
    flexDirection: "column" as const,
  },
  ticketList: {
    height: "400px",
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
    marginBottom: "20px",
  },
  divider: {
    height: "2px",
    backgroundColor: "#000",
    width: "600px",
    marginLeft: "12px",
    marginBottom: "20px",
  },
  storageList: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
  },
  rightCol: {
    width: "430px",
    backgroundColor: "#f1f2f6",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  actionPanel: {
    width: "100%",
    padding: "20px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
  },
  inputBox: {
    width: "310px",
    height: "48px",
    fontSize: "24px",
    textAlign: "center" as const,
    borderRadius: "8px",
    border: "2px solid #3b82f6",
    marginBottom: "20px",
  },
  buttonGroup: {
    display: "flex",
    gap: "20px",
    marginTop: "20px",
  },
  cancelBtn: {
    width: "125px",
    height: "60px",
    border: "2px solid #3b82f6",
    backgroundColor: "transparent",
    color: "#3b82f6",
    fontSize: "18px",
    fontWeight: "bold",
    borderRadius: "8px",
  },
  confirmBtn: {
    width: "125px",
    height: "60px",
    backgroundColor: "#3b82f6",
    color: "white",
    fontSize: "18px",
    fontWeight: "bold",
    borderRadius: "8px",
  },
};
