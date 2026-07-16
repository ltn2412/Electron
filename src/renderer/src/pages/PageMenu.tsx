import AlertModal from "@/components/AlertModal";
import TitleBar from "@/components/TitleBar";
import {
  HoangVanOrder,
  HoangVanSlot,
  POSHEADER,
  ProductPOSAudio,
} from "@shared/types";
import {
  Archive,
  FileText,
  Globe,
  LogOut,
  RefreshCw,
  Search,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HoangVanSearchModal from "./PageMenuComponents/HoangVanSearchModal";
import LogoutConfirmModal from "./PageMenuComponents/LogoutConfirmModal";
import SetupModal from "./PageMenuComponents/SetupModal";
import TransactionSearchModal from "./PageMenuComponents/TransactionSearchModal";
import receiptHtml from "./receipt.html?raw";
export default function PageMenu(): React.JSX.Element {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<POSHEADER[]>([]);
  const [products, setProducts] = useState<ProductPOSAudio[]>([]);
  const [slots, setSlots] = useState<HoangVanSlot[]>([]);
  const [expiredCount, setExpiredCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [transactId, setTransactId] = useState("");
  const [transactCheckError, setTransactCheckError] = useState("");
  const [isTransactChecking, setIsTransactChecking] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHoangVanSearchOpen, setIsHoangVanSearchOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // HoangVan Search State
  const [hvOrderInfo, setHvOrderInfo] = useState<HoangVanOrder | null>(null);
  const [hvChecking, setHvChecking] = useState(false);
  const [hvCheckError, setHvCheckError] = useState("");
  const [hvUsing, setHvUsing] = useState(false);
  const [hvLocalStatus, setHvLocalStatus] = useState<string | null>(null);
  const [hvReturning, setHvReturning] = useState(false);

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [setupProducts, setSetupProducts] = useState<ProductPOSAudio[]>([]);

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info" | "confirm";
    onConfirm?: () => void;
  }>({ isOpen: false, title: "", message: "", type: "info" });
  const [isAutoConfirming, setIsAutoConfirming] = useState(false);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const [txRes, prodRes, slotRes, expiredRes] = await Promise.all([
        window.api.getTransactions(),
        window.api.getProductPOSAudio(),
        window.api.getHoangVanSlots(today),
        window.api.getExpiredOrders({ page: 1, pageSize: 1 }),
      ]);

      if (txRes.success && txRes.data) {
        setTransactions(txRes.data);
      }
      if (prodRes.success && prodRes.data) {
        setProducts(
          prodRes.data.sort((a: ProductPOSAudio, b: ProductPOSAudio) =>
            (a.DESCRIPT || "").localeCompare(b.DESCRIPT || ""),
          ),
        );
      }
      if (slotRes && slotRes.success && slotRes.data) {
        setSlots(slotRes.data);
      }
      if (expiredRes && expiredRes.success && expiredRes.data) {
        setExpiredCount(
          (expiredRes.data as { totalRecords: number }).totalRecords,
        );
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

  // Auto-confirm logic at 5:20 AM daily
  useEffect(() => {
    const executeAutoConfirm = async (): Promise<void> => {
      setIsAutoConfirming(true);
      try {
        const res = await window.api.getExpiredOrders({
          page: 1,
          pageSize: 1000,
        });
        const dataRes = (res.data as any)?.data;
        const payload = dataRes;
        if (
          res.success &&
          payload &&
          payload.items &&
          payload.items.length > 0
        ) {
          const orders = payload.items;
          const swipe = localStorage.getItem("employeeSwipe") || "";
          const orderNos: string[] = [];
          for (const order of orders) {
            orderNos.push(order.orderNo);
            const services = order.services || [];
            for (const svc of services) {
              await window.api.createOrder({
                refCode: `_F:POS_AUDIO_${svc.serviceCode}`,
                quantity: svc.quantity,
                costEach: svc.unitPrice,
                swipe: swipe,
                status: 3,
                onlineOrderId: order.orderNo,
              });
            }
          }
          const confirmRes = await window.api.confirmExpiredOrders({
            orderNos,
          });
          if (confirmRes.success) {
            setAlertConfig({
              isOpen: true,
              title: "Success",
              message: `Successfully auto-confirmed ${orderNos.length} expired orders!`,
              type: "success",
            });
          }
        }
      } catch (err: unknown) {
        console.error("Auto confirm error:", err);
      } finally {
        setIsAutoConfirming(false);
      }
    };

    const checkTime = async (): Promise<void> => {
      const now = new Date();
      const lastRunKey = "lastAutoConfirmDate_v2";
      const lastRunDate = localStorage.getItem(lastRunKey);
      const currentDate = now.toDateString();

      const isPastTrigger =
        now.getHours() > 22 ||
        (now.getHours() === 22 && now.getMinutes() >= 55);
      if (isPastTrigger) {
        if (lastRunDate !== currentDate) {
          localStorage.setItem(lastRunKey, currentDate);
          await executeAutoConfirm();
        }
      }
    };

    const intervalId = setInterval(checkTime, 20000);

    return () => clearInterval(intervalId);
  }, []);

  const handleTransactionClick = (id: string): void => {
    navigate(`/order?id=${id}`);
  };

  const handleSearchTransact = async (): Promise<void> => {
    if (transactId) {
      setIsTransactChecking(true);
      setTransactCheckError("");
      try {
        const res = await window.api.getTransactionByTransact(transactId);
        if (res.success && res.data) {
          setIsSearchOpen(false);
          handleTransactionClick(transactId);
        } else {
          setTransactCheckError(res.error || "Transaction not found!");
        }
      } catch (err: unknown) {
        setTransactCheckError((err as Error).message || "System error");
      } finally {
        setIsTransactChecking(false);
      }
    }
  };

  const handleCheckHoangVanOrder = async (
    finalOrderNo: string,
  ): Promise<void> => {
    if (!finalOrderNo || hvChecking) return;

    let orderNoToProcess = finalOrderNo.trim();

    if (orderNoToProcess.startsWith("http")) {
      const match = orderNoToProcess.match(/\/services\/([^/?]+)/i);
      if (match) {
        orderNoToProcess = match[1];
      }
    } else {
      const match = orderNoToProcess.match(/(ORDER[a-zA-Z0-9_-]+)/i);
      if (match) {
        orderNoToProcess = match[1];
      }
    }

    finalOrderNo = orderNoToProcess;

    setHvChecking(true);
    setHvCheckError("");
    setHvOrderInfo(null);
    setHvLocalStatus(null);
    try {
      const res = await window.api.checkOrder(finalOrderNo);
      if (res.success && res.data) {
        setHvOrderInfo(res.data);
        if (res.data.orderStatus === "DaSuDung") {
          const locRes = await window.api.getOnlineOrderStatus(
            res.data.orderNo,
          );
          if (locRes.success && locRes.data?.status !== undefined) {
            if (locRes.data.status === 1) setHvLocalStatus("Out");
            else if (locRes.data.status === 2 || locRes.data.status === 3)
              setHvLocalStatus("Return");
            else setHvLocalStatus("Unknown");
          } else {
            setHvLocalStatus("Unknown");
          }
        }
      } else {
        setHvCheckError(res.error || "Order not found");
      }
    } catch (err: unknown) {
      setHvCheckError((err as Error).message || "System error");
    } finally {
      setHvChecking(false);
    }
  };

  const executeUseHoangVanOrder = async (): Promise<void> => {
    if (!hvOrderInfo) return;
    setHvUsing(true);
    try {
      // 1. Extract services
      const services = hvOrderInfo.services || [];
      if (services.length === 0) {
        setAlertConfig({
          isOpen: true,
          title: "Warning",
          message: "Order has no services.",
          type: "error",
        });
        return;
      }
      const svc = services[0];

      // 2. Post to our local DB first
      const swipe = localStorage.getItem("employeeSwipe");

      const createRes = await window.api.createOrder({
        refCode: `_F:POS_AUDIO_${svc.serviceCode}`,
        quantity: svc.quantity,
        costEach: svc.unitPrice,
        swipe: swipe || "",
        onlineOrderId: hvOrderInfo.orderNo,
      });

      if (!createRes.success) {
        setAlertConfig({
          isOpen: true,
          title: "Error",
          message: "Internal billing error: " + createRes.error,
          type: "error",
        });
        return;
      }

      // 3. If local DB insert succeeds, call HoangVan Use API
      const useRes = await window.api.useOrder({
        orderNo: hvOrderInfo.orderNo,
        staffId: "NV001",
      });

      if (!useRes.success) {
        setAlertConfig({
          isOpen: true,
          title: "Error",
          message: "Hoang Van system error: " + useRes.error,
          type: "error",
        });
        return;
      }

      // Format currency
      const formatVnd = (val: number): string =>
        new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(val);

      // 4. Generate dynamic receipt HTML
      const servicesHtml =
        hvOrderInfo.services
          ?.map(
            (s) => `
        <tr>
          <td style="text-align: left;">${s.serviceName}<br><i>${s.serviceCode || ""}</i></td>
          <td style="text-align: center;">${s.quantity}</td>
          <td style="text-align: center;">${s.timeSlot?.startTime || ""}<br>${s.timeSlot?.endTime || ""}</td>
          <td style="text-align: right;">${formatVnd(s.unitPrice * s.quantity)}</td>
        </tr>
      `,
          )
          .join("") || "";

      const totalAmount = formatVnd(
        (hvOrderInfo.services || []).reduce(
          (sum, s) => sum + s.unitPrice * s.quantity,
          0,
        ),
      );

      const externalTemplate = await window.api.getReceiptTemplate();
      const templateToUse = externalTemplate || receiptHtml;

      const finalHtml = templateToUse
        .replace(/{{ORDER_NO}}/g, hvOrderInfo.orderNo || "")
        .replace(/{{CUSTOMER_NAME}}/g, hvOrderInfo.buyerName || "")
        .replace(/{{EMAIL}}/g, hvOrderInfo.buyerEmail || "")
        .replace(/{{VISIT_DATE}}/g, hvOrderInfo.visitDate || "")
        .replace(
          /{{PURCHASE_DATE}}/g,
          hvOrderInfo.createdAt
            ? new Date(hvOrderInfo.createdAt).toLocaleString("vi-VN")
            : "",
        )
        .replace("{{SERVICES_HTML}}", servicesHtml)
        .replace("{{TOTAL_AMOUNT}}", totalAmount);

      // 5. Print the receipt silently
      let printSuccess = true;
      try {
        for (let i = 0; i < 2; i++) {
          await window.api.printHtml(finalHtml);
        }
      } catch (printErr: unknown) {
        console.error("Failed to print receipt:", printErr);
        printSuccess = false;
      }

      setAlertConfig({
        isOpen: true,
        title: printSuccess ? "Success" : "Partial Success",
        message: printSuccess
          ? "Order confirmed and bill printed! Transact: " +
            createRes.data?.transact
          : "Order confirmed, but failed to print bill! Transact: " +
            createRes.data?.transact,
        type: printSuccess ? "success" : "info",
      });
      setIsHoangVanSearchOpen(false);
      fetchData(); // Refresh UI
    } catch (error: unknown) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: "Unexpected error: " + (error as Error).message,
        type: "error",
      });
    } finally {
      setHvUsing(false);
    }
  };

  const handleReturnLocalOrder = async (): Promise<void> => {
    if (!hvOrderInfo?.orderNo) return;
    setHvReturning(true);
    try {
      const res = await window.api.returnLocalOrder(hvOrderInfo.orderNo);
      if (res.success) {
        setAlertConfig({
          isOpen: true,
          title: "Success",
          message: "Successfully returned device!",
          type: "success",
        });
        setHvLocalStatus("Return");
        fetchData();
      } else {
        setAlertConfig({
          isOpen: true,
          title: "Error",
          message: "Update Error: " + res.error,
          type: "error",
        });
      }
    } catch (err: unknown) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: (err as Error).message || "System error",
        type: "error",
      });
    } finally {
      setHvReturning(false);
    }
  };

  const handleUseHoangVanOrder = async (): Promise<void> => {
    if (!hvOrderInfo) return;
    const services = hvOrderInfo.services || [];
    if (services.length === 0) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: "Order has no services.",
        type: "error",
      });
      return;
    }
    const svc = services[0];
    const visitDateStr = hvOrderInfo.visitDate;
    const startTimeStr = svc.timeSlot?.startTime || "00:00";
    const endTimeStr = svc.timeSlot?.endTime || "23:59";

    const now = new Date();
    // Parse using local time, assuming visitDateStr is YYYY-MM-DD and time is HH:mm
    const startDateTime = new Date(`${visitDateStr}T${startTimeStr}:00`);
    const endDateTime = new Date(`${visitDateStr}T${endTimeStr}:00`);

    if (now < startDateTime || now > endDateTime) {
      setAlertConfig({
        isOpen: true,
        title: "Time Frame Warning",
        message: `The current time is outside the allowed timeframe for this ticket (${visitDateStr} ${startTimeStr} - ${endTimeStr}). Are you sure you want to proceed?`,
        type: "confirm",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, isOpen: false }));
          executeUseHoangVanOrder();
        },
      });
      return;
    }

    executeUseHoangVanOrder();
  };

  const handleLogoutConfirm = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      const swipe = localStorage.getItem("employeeSwipe");
      if (swipe) {
        await window.api.logoutEmployee(swipe);
      }
      localStorage.removeItem("employeeSwipe");
      navigate("/login");
    } catch (err) {
      console.error(err);
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmOpen(false);
    }
  };

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await fetchData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getStatusColor = (statusName: string): string => {
    switch (statusName) {
      case "New":
        return "#1e3a8a";
      case "Out":
        return "#f59e0b";
      case "Return":
        return "#10b981";
      case "Expired":
        return "#ef4444";
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
            <p style={styles.subtitle}>Bảo tàng chứng tích chiến tranh</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              style={styles.iconBtn}
              onClick={() => {
                setHvOrderInfo(null);
                setHvCheckError("");
                setIsHoangVanSearchOpen(true);
              }}
              title="Online Order Search"
            >
              <Globe size={20} />
            </button>
            <button
              style={styles.iconBtn}
              onClick={() => {
                setTransactId("");
                setTransactCheckError("");
                setIsSearchOpen(true);
              }}
              title="Find Transaction"
            >
              <Search size={20} />
            </button>
            <button
              style={{ ...styles.iconBtn, position: "relative" }}
              onClick={() => navigate("/expired")}
              title="Expired Orders"
            >
              <Archive size={20} />
              {expiredCount > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "-5px",
                    right: "-5px",
                    backgroundColor: "#ef4444",
                    color: "white",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {expiredCount > 99 ? "99+" : expiredCount}
                </div>
              )}
            </button>
            <button
              style={styles.iconBtn}
              onClick={handleRefresh}
              title="Refresh"
            >
              <RefreshCw
                size={20}
                style={{
                  transform: isRefreshing ? "rotate(180deg)" : "none",
                  transition: "transform 0.5s ease",
                }}
              />
            </button>
            <button
              style={styles.iconBtn}
              onClick={() => setIsLogoutConfirmOpen(true)}
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div style={styles.content}>
          {/* Left Column: Transactions */}
          <div style={{ ...styles.card, flex: 1, minWidth: 0 }}>
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
                        <div style={styles.txId}>
                          Trans#: {tx.TRANSACT}
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: "normal",
                              color: "#64748b",
                              marginLeft: "8px",
                            }}
                          >
                            {new Date(tx.TIMEEND).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div style={styles.txTotal}>
                          Final Total:{" "}
                          {(
                            (tx as POSHEADER & { FILTERED_TOTAL?: number })
                              .FILTERED_TOTAL ?? tx.FINALTOTAL
                          ).toLocaleString("en-US")}{" "}
                          đ
                        </div>
                      </div>
                      <div
                        style={{
                          ...styles.txRight,
                          width: "100%",
                          justifyContent: "flex-start",
                          marginTop: "4px",
                        }}
                      >
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

          {/* Middle Column: Slots */}
          <div style={{ ...styles.middleColumn, minWidth: 0 }}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  Slots - {new Date().toLocaleDateString("en-GB")}
                </h2>
                <span style={styles.badge}>{slots.length}</span>
              </div>
              <div style={styles.listContainer}>
                {isLoading && slots.length === 0 ? (
                  <div style={styles.emptyState}>Loading...</div>
                ) : slots.length === 0 ? (
                  <div style={styles.emptyState}>No slots found</div>
                ) : (
                  <div style={styles.txList}>
                    {slots.map((s, idx) => (
                      <div key={idx} style={styles.txItem}>
                        <div style={styles.txLeft}>
                          <div style={styles.txId}>{s.name}</div>
                          <div style={{ ...styles.txTotal, color: "#64748b" }}>
                            {s.startTime} - {s.endTime}
                          </div>
                        </div>
                        <div style={styles.txRight}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                            }}
                          >
                            <span
                              style={{ fontSize: "14px", color: "#64748b" }}
                            >
                              Booked
                            </span>
                            <span
                              style={{
                                fontSize: "18px",
                                fontWeight: 700,
                                color:
                                  s.maxMachines - s.bookedMachines > 0
                                    ? "#10b981"
                                    : "#ef4444",
                              }}
                            >
                              {s.bookedMachines}/{s.maxMachines}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Products */}
          <div
            style={{
              ...styles.rightColumn,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                ...styles.card,
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Products</h2>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  onClick={() => {
                    setSetupProducts(products.map((p) => ({ ...p })));
                    setIsSetupOpen(true);
                  }}
                >
                  <Settings size={20} color="#64748b" />
                </button>
              </div>
              <div style={{ padding: "24px 24px", overflowY: "auto", flex: 1 }}>
                {products.length === 0 ? (
                  <div style={styles.emptyState}>No products</div>
                ) : (
                  <div style={styles.productList}>
                    {products.map((p, idx: number) => (
                      <div key={idx} style={styles.productItem}>
                        <span
                          style={{
                            fontSize: "18px",
                            fontWeight: 500,
                          }}
                        >
                          {p.DESCRIPT}
                        </span>
                        <span
                          style={{
                            fontSize: "22px",
                            fontWeight: "bold",
                            color: "#0369a1",
                          }}
                        >
                          {p.STORAGE}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ ...styles.card, marginTop: "24px" }}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Booked Today</h2>
              </div>
              <div style={{ padding: "24px 24px" }}>
                <div style={styles.productItem}>
                  <span style={{ fontSize: "18px", fontWeight: 500 }}>
                    Audio Guide Ticket
                  </span>
                  <span
                    style={{
                      fontSize: "22px",
                      fontWeight: "bold",
                      color: "#10b981",
                    }}
                  >
                    {slots.reduce((sum, slot) => sum + slot.bookedMachines, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <TransactionSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          transactId={transactId}
          setTransactId={setTransactId}
          isTransactChecking={isTransactChecking}
          transactCheckError={transactCheckError}
          onSearch={handleSearchTransact}
          styles={styles}
        />

        <HoangVanSearchModal
          isOpen={isHoangVanSearchOpen}
          onClose={() => setIsHoangVanSearchOpen(false)}
          hvOrderInfo={hvOrderInfo}
          hvChecking={hvChecking}
          hvCheckError={hvCheckError}
          hvUsing={hvUsing}
          hvLocalStatus={hvLocalStatus}
          hvReturning={hvReturning}
          handleCheckHoangVanOrder={handleCheckHoangVanOrder}
          handleUseHoangVanOrder={handleUseHoangVanOrder}
          handleReturnLocalOrder={handleReturnLocalOrder}
          styles={styles}
        />

        <SetupModal
          isOpen={isSetupOpen}
          onClose={() => setIsSetupOpen(false)}
          setupProducts={setupProducts}
          setSetupProducts={setSetupProducts}
          setProducts={setProducts}
          fetchData={fetchData}
          styles={styles}
        />
        <LogoutConfirmModal
          isOpen={isLogoutConfirmOpen}
          onClose={() => setIsLogoutConfirmOpen(false)}
          onConfirm={handleLogoutConfirm}
          isLoggingOut={isLoggingOut}
          styles={styles}
        />
      </div>
      {/* Auto Confirm Overlay */}
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
          Checking and automatically confirming expired orders...
          <style>
            {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
          </style>
        </div>
      )}

      {/* Hoang Van Checking Overlay */}
      {hvChecking && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(255, 255, 255, 0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="spinner"
            style={{
              width: "50px",
              height: "50px",
              border: "4px solid rgba(59, 130, 246, 0.2)",
              borderTop: "4px solid #3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          <style>
            {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
          </style>
        </div>
      )}

      {/* Alert */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        onConfirm={alertConfig.onConfirm}
      />
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
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    flex: 1,
  } as React.CSSProperties,
  cardHeader: {
    padding: "16px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabBtn: {
    flex: 1,
    padding: "12px",
    background: "none",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    outline: "none",
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
    padding: "16px 24px 24px 24px",
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
    flexWrap: "wrap",
    gap: "8px",
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
    flex: 1,
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  middleColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  productList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  } as React.CSSProperties,
  productItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    fontSize: "16px",
    color: "#1e293b",
    fontWeight: 600,
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
