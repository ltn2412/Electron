import { useState } from "react";
import { useNavigate } from "react-router-dom";
import KeypadControl from "../components/KeypadControl";

export default function PageLogin(): React.JSX.Element {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");

  // Trích xuất trong PageLogin.tsx:
  const handleLogin = async (): Promise<void> => {
    if (password) {
      // ở đây giả lập password là swipe card code
      const result = await window.api.getEmployeeBySwipe(password);

      if (result.success && result.data) {
        console.log("Đăng nhập thành công, nhân viên:", result.data.EMPNAME);
        navigate("/menu");
      } else {
        alert("Đăng nhập thất bại hoặc không tìm thấy nhân viên!");
      }
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>POS Login</h1>

        <input
          type="password"
          value={password}
          readOnly
          placeholder="Enter Password"
          style={styles.input}
        />

        <div style={styles.keypadWrapper}>
          <KeypadControl
            onKeyPress={(key) => setPassword((prev) => prev + key)}
            onBackspace={() => setPassword((prev) => prev.slice(0, -1))}
            onClear={() => setPassword("")}
          />
        </div>

        <button style={styles.loginBtn} onClick={handleLogin}>
          Login to POS System
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  card: {
    width: "450px",
    height: "640px",
    backgroundColor: "#f2f2f3",
    borderRadius: "15px",
    border: "1px solid #d1d5db",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "40px 20px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
  },
  title: {
    color: "#3b82f6", // ThemePrimaryBrush
    fontSize: "28px",
    fontWeight: "bold",
    marginBottom: "40px",
  },
  input: {
    width: "320px",
    height: "50px",
    fontSize: "24px",
    textAlign: "center" as const,
    letterSpacing: "5px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    marginBottom: "30px",
  },
  keypadWrapper: {
    flex: 1,
    width: "100%",
    display: "flex",
    alignItems: "center",
  },
  loginBtn: {
    width: "320px",
    height: "60px",
    backgroundColor: "#3b82f6",
    color: "white",
    fontSize: "18px",
    fontWeight: "bold",
    borderRadius: "10px",
    marginTop: "20px",
  },
};
