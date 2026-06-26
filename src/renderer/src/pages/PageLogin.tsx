import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import KeypadControl from "@/components/KeypadControl";
import TitleBar from "@/components/TitleBar";

export default function PageLogin(): React.JSX.Element {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const handleLogin = useCallback(async (): Promise<void> => {
    if (!password) return;
    setIsLoading(true);

    try {
      const result = await window.api.getEmployeeBySwipe(password);

      if (result?.success && result?.data) {
        navigate("/menu");
      } else {
        alert(result?.message || result?.error || "Nhân viên không tồn tại!");
        setPassword("");
      }
    } catch (err: unknown) {
      console.error("Login process error:", err);
      if (err instanceof Error) {
        alert(`Lỗi hệ thống: ${err.message}`);
      } else {
        alert("Lỗi hệ thống không xác định.");
      }
      setPassword("");
    } finally {
      setIsLoading(false);
    }
  }, [password, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (/^[0-9]$/.test(e.key)) {
        setPassword((prev) => prev + e.key);
      } else if (e.key === "Backspace") {
        setPassword((prev) => prev.slice(0, -1));
      } else if (e.key === "Enter") {
        handleLogin();
      } else if (e.key === "Delete" || e.key === "Escape") {
        setPassword("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleLogin]);

  const btnStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "320px",
    height: "64px",
    background:
      isLoading || password.length === 0
        ? "#cbd5e1"
        : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "white",
    fontSize: "20px",
    fontWeight: 600,
    borderRadius: "16px",
    border: "none",
    cursor: isLoading || password.length === 0 ? "not-allowed" : "pointer",
    boxShadow:
      isLoading || password.length === 0
        ? "none"
        : isActive
          ? "0 2px 10px rgba(37, 99, 235, 0.3)"
          : isHovered
            ? "0 6px 20px rgba(37, 99, 235, 0.4)"
            : "0 4px 14px rgba(37, 99, 235, 0.3)",
    transform: isActive
      ? "translateY(1px)"
      : isHovered && !isLoading && password.length > 0
        ? "translateY(-2px)"
        : "none",
    transition: "all 0.2s ease",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  return (
    <>
      <TitleBar />
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>POS System</h1>
          <p style={styles.subtitle}>Please enter your PIN to continue</p>

          <div style={styles.inputWrapper}>
            <input
              type="password"
              value={password}
              readOnly
              style={styles.input}
            />
          </div>

          <div style={styles.keypadWrapper}>
            <KeypadControl
              onKeyPress={(key) => setPassword((prev) => prev + key)}
              onBackspace={() => setPassword((prev) => prev.slice(0, -1))}
              onClear={() => setPassword("")}
            />
          </div>

          <button
            style={btnStyle}
            onClick={handleLogin}
            disabled={isLoading || password.length === 0}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
              setIsHovered(false);
              setIsActive(false);
            }}
            onMouseDown={() => setIsActive(true)}
            onMouseUp={() => setIsActive(false)}
          >
            {isLoading ? "Authenticating..." : "Login"}
          </button>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #f6f8fd 0%, #f1f5f9 100%)",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  } as React.CSSProperties,
  card: {
    width: "480px",
    background: "rgba(255, 255, 255, 0.85)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderRadius: "32px",
    border: "1px solid rgba(255, 255, 255, 0.5)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "56px 40px",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0,0,0,0.05)",
  } as React.CSSProperties,
  title: {
    color: "#1e293b",
    fontSize: "36px",
    fontWeight: 800,
    marginBottom: "12px",
    letterSpacing: "-0.5px",
  } as React.CSSProperties,
  subtitle: {
    color: "#64748b",
    fontSize: "16px",
    marginBottom: "48px",
  } as React.CSSProperties,
  inputWrapper: {
    position: "relative",
    width: "100%",
    maxWidth: "320px",
    marginBottom: "36px",
  } as React.CSSProperties,
  input: {
    width: "100%",
    height: "64px",
    fontSize: "32px",
    fontWeight: 600,
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: "8px",
    borderRadius: "16px",
    border: "2px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    outline: "none",
    padding: "0 20px",
    boxSizing: "border-box",
  } as React.CSSProperties,
  keypadWrapper: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginBottom: "36px",
  } as React.CSSProperties,
};
