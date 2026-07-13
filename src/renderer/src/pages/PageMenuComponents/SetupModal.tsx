import React, { useState } from "react";
import { Settings, MinusCircle, PlusCircle } from "lucide-react";
import { ProductPOSAudio } from "@shared/types";
import KeypadControl from "@/components/KeypadControl";

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  setupProducts: ProductPOSAudio[];
  setSetupProducts: React.Dispatch<React.SetStateAction<ProductPOSAudio[]>>;
  setProducts: React.Dispatch<React.SetStateAction<ProductPOSAudio[]>>;
  fetchData: () => Promise<void>;
  styles: Record<string, React.CSSProperties>;
}

export default function SetupModal({
  isOpen,
  onClose,
  setupProducts,
  setSetupProducts,
  setProducts,
  fetchData,
  styles,
}: SetupModalProps): React.JSX.Element | null {
  const [editingProduct, setEditingProduct] = useState<ProductPOSAudio | null>(
    null,
  );
  const [editQuantity, setEditQuantity] = useState("");

  if (!isOpen) return null;

  return (
    <>
      {/* Setup Modal */}
      <div style={{ ...styles.modalOverlay, zIndex: 1100 }}>
        <div style={{ ...styles.modalContent, width: "500px" }}>
          <div style={styles.modalHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Settings size={20} color="#1e3a8a" />
              <h2 style={{ ...styles.cardTitle, color: "#1e3a8a" }}>Setup</h2>
            </div>
          </div>
          <div style={{ padding: "24px" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginBottom: "32px",
              }}
            >
              {setupProducts.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontSize: "16px",
                      color: "#1e293b",
                      fontWeight: 500,
                      width: "140px",
                    }}
                  >
                    {p.DESCRIPT}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#1e3a8a",
                        padding: 0,
                        display: "flex",
                      }}
                      onClick={() =>
                        setSetupProducts((prev) =>
                          prev.map((sp) =>
                            sp.PRODNUM === p.PRODNUM
                              ? {
                                  ...sp,
                                  STORAGE: Math.max(0, (sp.STORAGE || 0) - 1),
                                }
                              : sp,
                          ),
                        )
                      }
                    >
                      <MinusCircle size={24} />
                    </button>
                    <div
                      style={{
                        width: "80px",
                        height: "36px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "#1e293b",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setEditingProduct(p);
                        setEditQuantity(p.STORAGE?.toString() || "0");
                      }}
                    >
                      {p.STORAGE}
                    </div>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#1e3a8a",
                        padding: 0,
                        display: "flex",
                      }}
                      onClick={() =>
                        setSetupProducts((prev) =>
                          prev.map((sp) =>
                            sp.PRODNUM === p.PRODNUM
                              ? { ...sp, STORAGE: (sp.STORAGE || 0) + 1 }
                              : sp,
                          ),
                        )
                      }
                    >
                      <PlusCircle size={24} />
                    </button>
                  </div>
                  <div style={{ width: "32px" }}></div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <button
                style={{
                  flex: 1,
                  height: "48px",
                  border: "1px solid #94a3b8",
                  borderRadius: "12px",
                  background: "white",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#64748b",
                  cursor: "pointer",
                }}
                onClick={onClose}
              >
                Close
              </button>
              <button
                style={{
                  flex: 1,
                  height: "48px",
                  border: "none",
                  borderRadius: "12px",
                  background: "#1e3a8a",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "white",
                  cursor: "pointer",
                }}
                onClick={async () => {
                  if (window.api.resetProduct) {
                    await window.api.resetProduct(
                      setupProducts.map((p) => ({
                        ...p,
                        COUNT: p.STORAGE,
                      })),
                    );
                    await fetchData();
                  } else {
                    setProducts(setupProducts);
                  }
                  onClose();
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Quantity Modal */}
      {editingProduct && (
        <div style={{ ...styles.modalOverlay, zIndex: 1200 }}>
          <div style={styles.modalContent}>
            <div
              style={{
                ...styles.modalHeader,
                justifyContent: "center",
                borderBottom: "none",
                paddingBottom: 0,
              }}
            >
              <h2
                style={{
                  ...styles.cardTitle,
                  color: "#1e3a8a",
                  textAlign: "center",
                }}
              >
                {editingProduct.DESCRIPT}
              </h2>
            </div>
            <div style={{ padding: "24px" }}>
              <input
                type="text"
                value={editQuantity}
                onChange={(e) =>
                  setEditQuantity(e.target.value.replace(/[^0-9]/g, ""))
                }
                autoFocus
                style={{ ...styles.searchInput, marginBottom: "16px" }}
              />
              <KeypadControl
                onKeyPress={(key) => setEditQuantity((prev) => prev + key)}
                onBackspace={() => setEditQuantity((prev) => prev.slice(0, -1))}
                onClear={() => setEditQuantity("")}
              />
              <div style={{ display: "flex", gap: "16px", marginTop: "24px" }}>
                <button
                  style={{
                    flex: 1,
                    height: "48px",
                    border: "1px solid #94a3b8",
                    borderRadius: "12px",
                    background: "white",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                  onClick={() => setEditingProduct(null)}
                >
                  Close
                </button>
                <button
                  style={{
                    flex: 1,
                    height: "48px",
                    border: "none",
                    borderRadius: "12px",
                    background: "#1e3a8a",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "white",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    const val = parseInt(editQuantity) || 0;
                    setSetupProducts((prev) =>
                      prev.map((p) =>
                        p.PRODNUM === editingProduct.PRODNUM
                          ? { ...p, STORAGE: val }
                          : p,
                      ),
                    );
                    setEditingProduct(null);
                  }}
                >
                  Enter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
