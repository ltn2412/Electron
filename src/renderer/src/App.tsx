import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import PageLogin from "./pages/PageLogin";
import PageMenu from "./pages/PageMenu";
import PageOrder from "./pages/PageOrder";
import PageExpiredOrders from "./pages/PageExpiredOrders";
import AlertModal from "./components/AlertModal";

function App(): React.JSX.Element {
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  useEffect(() => {
    const handleGlobalAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      setAlertConfig({
        isOpen: true,
        title: customEvent.detail.title || "Error",
        message: customEvent.detail.message,
        type: customEvent.detail.type || "error",
      });
    };
    window.addEventListener("app-alert", handleGlobalAlert);
    return () => window.removeEventListener("app-alert", handleGlobalAlert);
  }, []);

  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<PageLogin />} />
          <Route path="/menu" element={<PageMenu />} />
          <Route path="/order" element={<PageOrder />} />
          <Route path="/expired" element={<PageExpiredOrders />} />
        </Routes>
      </HashRouter>
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
    </>
  );
}

export default App;
