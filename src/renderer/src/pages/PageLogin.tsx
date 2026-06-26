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
    background: "radial-gradient(circle at 50% -20%, #eff6ff 0%, #f1f5f9 100%)",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: "40px",
    boxSizing: "border-box",
  } as React.CSSProperties,
  card: {
    width: "100%",
    maxWidth: "460px",
    background: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: "40px",
    border: "1px solid rgba(255, 255, 255, 1)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "60px 48px",
    boxShadow:
      "0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0,0,0,0.02)",
    boxSizing: "border-box",
  } as React.CSSProperties,
  title: {
    color: "#0f172a",
    fontSize: "32px",
    fontWeight: 800,
    marginBottom: "12px",
    letterSpacing: "-0.5px",
  } as React.CSSProperties,
  subtitle: {
    color: "#64748b",
    fontSize: "15px",
    marginBottom: "40px",
    textAlign: "center",
  } as React.CSSProperties,
  inputWrapper: {
    position: "relative",
    width: "100%",
    maxWidth: "340px",
    marginBottom: "40px",
  } as React.CSSProperties,
  input: {
    width: "100%",
    height: "68px",
    fontSize: "40px",
    fontWeight: 700,
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: "12px",
    borderRadius: "20px",
    border: "none",
    backgroundColor: "#f1f5f9",
    outline: "none",
    padding: "0 20px",
    boxSizing: "border-box",
    boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.05)",
    fontFamily: "monospace",
  } as React.CSSProperties,
  keypadWrapper: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginBottom: "40px",
  } as React.CSSProperties,
};
