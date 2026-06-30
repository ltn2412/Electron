import { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import PageLogin from "./pages/PageLogin";
import PageMenu from "./pages/PageMenu";
import PageOrder from "./pages/PageOrder";
import PageExpiredOrders from "./pages/PageExpiredOrders";
import { ExpiredOrdersResponse } from "@shared/apiTypes";

function App(): React.JSX.Element {
  const [isAutoConfirming, setIsAutoConfirming] = useState(false);
  const hasRunToday = useRef(false);

  useEffect(() => {
    const checkTime = async (): Promise<void> => {
      const now = new Date();
      // Auto run at 17:30
      if (
        now.getHours() === 17 &&
        now.getMinutes() >= 30 &&
        !hasRunToday.current
      ) {
        hasRunToday.current = true;
        setIsAutoConfirming(true);
        try {
          const res = (await window.api.getExpiredOrders({
            page: 1,
            pageSize: 1000,
          })) as ExpiredOrdersResponse;
          if (
            res.success &&
            res.data &&
            res.data.items &&
            res.data.items.length > 0
          ) {
            const orders = res.data.items;
            const swipe = localStorage.getItem("employeeSwipe") || "221278";

            const orderNos: string[] = [];
            for (const order of orders) {
              orderNos.push(order.orderNo);
              const services = order.services || [];
              for (const svc of services) {
                const createRes = await window.api.createOrder({
                  refCode: `_F:POS_AUDIO_${svc.serviceCode}`,
                  quantity: svc.quantity,
                  costEach: svc.unitPrice,
                  swipe: swipe,
                  status: 3, // 3 for Expired
                });
                if (!createRes.success) {
                  console.error(`Lỗi tạo bill nội bộ: ${createRes.error}`);
                }
              }
            }

            const confirmRes = await window.api.confirmExpiredOrders({
              orderNos,
            });
            if (!confirmRes.success) {
              throw new Error(confirmRes.error || "Lỗi xác nhận đơn Hoàng Vân");
            }
            alert(
              `Đã tự động xác nhận ${orderNos.length} đơn hết hạn thành công!`,
            );
          }
        } catch (err: unknown) {
          console.error("Auto confirm error:", err);
        } finally {
          setIsAutoConfirming(false);
        }
      } else if (now.getHours() === 0) {
        // Reset at midnight
        hasRunToday.current = false;
      }
    };

    const interval = setInterval(checkTime, 60000);
    checkTime();
    return () => clearInterval(interval);
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

      {isAutoConfirming && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.7)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
            fontFamily: "Inter, sans-serif",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            className="spinner"
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #3498db",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          Đang kiểm tra và tự động xác nhận các đơn hết hạn...
          <style>
            {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
          </style>
        </div>
      )}
    </>
  );
}

export default App;
