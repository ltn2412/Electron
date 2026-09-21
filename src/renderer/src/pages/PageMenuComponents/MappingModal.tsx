import { ProductMapping, SchemaStatus } from "@shared/types";
import {
  Link2,
  Loader2,
  MinusCircle,
  Pencil,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  styles: Record<string, React.CSSProperties>;
}

interface DraftMapping {
  prodnum: number;
  descript: string;
  prodnumLink: number | "";
  quantity: number;
  skipSelfCountdown: boolean;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px 16px",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  backgroundColor: "white",
};

const badgeStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  color: "#1e3a8a",
};

const footerBtnStyle: React.CSSProperties = {
  flex: 1,
  height: "48px",
  borderRadius: "12px",
  fontSize: "16px",
  fontWeight: 600,
  cursor: "pointer",
};

export default function MappingModal({
  isOpen,
  onClose,
  onSaved,
  styles,
}: MappingModalProps): React.JSX.Element | null {
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<DraftMapping | null>(null);
  const [schema, setSchema] = useState<SchemaStatus | null>(null);

  const loadMappings = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    setDraft(null);
    try {
      const res = await window.api.getProductMappings();
      setSchema(res.schema ?? null);
      if (res.success && res.data) setMappings(res.data);
      else setError(res.error || "Could not load the product list.");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadMappings();
  }, [isOpen, loadMappings]);

  if (!isOpen) return null;

  // Only products that carry real stock can be deducted from.
  const stockProducts = mappings.filter((m) => m.ISPRIMARY === 1);

  const describe = (m: ProductMapping): { text: string; color: string } => {
    if (m.ISPRIMARY === 1)
      return { text: `Stock: ${m.STORAGE ?? 0}`, color: "#0f766e" };
    if (m.PRODNUMLINK)
      return {
        text: `→ ${m.LINKDESCRIPT || m.PRODNUMLINK} × ${m.QUANTITY || 1}`,
        color: "#1e3a8a",
      };
    return { text: "Not mapped", color: "#b45309" };
  };

  const startEdit = (m: ProductMapping): void => {
    setError("");
    setDraft({
      prodnum: m.PRODNUM,
      descript: m.DESCRIPT,
      prodnumLink: m.PRODNUMLINK ?? "",
      quantity: m.QUANTITY || 1,
      skipSelfCountdown: m.SKIPSELFCOUNTDOWN === 1,
    });
  };

  const saveDraft = async (): Promise<void> => {
    if (!draft) return;
    if (!draft.prodnumLink) {
      setError("Pick the product to deduct from.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await window.api.saveProductMapping({
        PRODNUM: draft.prodnum,
        PRODNUMLINK: Number(draft.prodnumLink),
        QUANTITY: draft.quantity,
        SKIPSELFCOUNTDOWN: draft.skipSelfCountdown ? 1 : 0,
      });
      if (!res.success) {
        setError(res.error || "Could not save the mapping.");
        return;
      }
      setDraft(null);
      await loadMappings();
      onSaved();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeMapping = async (prodnum: number): Promise<void> => {
    setSaving(true);
    setError("");
    try {
      const res = await window.api.deleteProductMapping(prodnum);
      if (!res.success) {
        setError(res.error || "Could not remove the mapping.");
        return;
      }
      await loadMappings();
      onSaved();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...styles.modalOverlay, zIndex: 1100 }}>
      <div
        style={{
          ...styles.modalContent,
          width: "760px",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link2 size={20} color="#1e3a8a" />
            <h2 style={{ ...styles.cardTitle, color: "#1e3a8a" }}>
              Product Mapping
            </h2>
          </div>
        </div>

        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          {schema && !schema.ready && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px 16px",
                borderRadius: "12px",
                backgroundColor: "#fffbeb",
                border: "1px solid #fcd34d",
                color: "#92400e",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              <b>Column SKIPSELFCOUNTDOWN is missing.</b>
              {schema.error ? ` ${schema.error}` : ""} Run this, then reopen:
              <pre
                style={{
                  margin: "8px 0 0 0",
                  padding: "8px",
                  backgroundColor: "#fef3c7",
                  borderRadius: "8px",
                  whiteSpace: "pre-wrap",
                  fontSize: "12px",
                }}
              >
                {schema.sql}
              </pre>
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px 16px",
                borderRadius: "12px",
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "40px",
                color: "#64748b",
              }}
            >
              <Loader2
                size={28}
                style={{ animation: "spin 1s linear infinite" }}
              />
              <style>
                {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
              </style>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {mappings.map((m) => {
                const badge = describe(m);
                const isEditing = draft?.prodnum === m.PRODNUM;
                return (
                  <div
                    key={m.PRODNUM}
                    style={{
                      ...rowStyle,
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: "12px",
                      ...(isEditing ? { borderColor: "#1e3a8a" } : {}),
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 600,
                            color: "#1e293b",
                          }}
                        >
                          {m.DESCRIPT}
                        </div>
                        <div style={{ fontSize: "13px", color: "#94a3b8" }}>
                          {m.REFCODE} · {m.COUNTDOWN}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                        }}
                      >
                        <span
                          style={{
                            ...badgeStyle,
                            color: badge.color,
                            backgroundColor: "#f1f5f9",
                          }}
                        >
                          {badge.text}
                        </span>
                        {m.SKIPSELFCOUNTDOWN === 1 && (
                          <span
                            style={{
                              ...badgeStyle,
                              color: "#7c3aed",
                              backgroundColor: "#f5f3ff",
                            }}
                          >
                            Unlimited
                          </span>
                        )}
                        {m.ISPRIMARY === 1 ? (
                          <span style={{ width: "44px" }} />
                        ) : (
                          <div style={{ display: "flex", gap: "12px" }}>
                            <button
                              style={iconBtnStyle}
                              disabled={saving}
                              onClick={() => startEdit(m)}
                            >
                              <Pencil size={20} />
                            </button>
                            <button
                              style={{
                                ...iconBtnStyle,
                                color: m.PRODNUMLINK ? "#dc2626" : "#cbd5e1",
                              }}
                              disabled={saving || !m.PRODNUMLINK}
                              onClick={() => removeMapping(m.PRODNUM)}
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isEditing && draft && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          paddingTop: "12px",
                          borderTop: "1px dashed #cbd5e1",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            fontSize: "14px",
                            color: "#475569",
                          }}
                        >
                          <span style={{ width: "150px" }}>Deducts from</span>
                          <select
                            value={draft.prodnumLink}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                prodnumLink: e.target.value
                                  ? Number(e.target.value)
                                  : "",
                              })
                            }
                            style={{
                              flex: 1,
                              height: "40px",
                              borderRadius: "10px",
                              border: "1px solid #cbd5e1",
                              padding: "0 10px",
                              fontSize: "15px",
                              backgroundColor: "white",
                              color: "#1e293b",
                            }}
                          >
                            <option value="">— pick a product —</option>
                            {stockProducts.map((sp) => (
                              <option key={sp.PRODNUM} value={sp.PRODNUM}>
                                {sp.DESCRIPT} (stock {sp.STORAGE ?? 0})
                              </option>
                            ))}
                          </select>
                        </label>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            fontSize: "14px",
                            color: "#475569",
                          }}
                        >
                          <span style={{ width: "150px" }}>
                            Units per ticket
                          </span>
                          <button
                            style={iconBtnStyle}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                quantity: Math.max(1, draft.quantity - 1),
                              })
                            }
                          >
                            <MinusCircle size={24} />
                          </button>
                          <div
                            style={{
                              width: "64px",
                              height: "40px",
                              border: "1px solid #cbd5e1",
                              borderRadius: "10px",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              fontSize: "16px",
                              fontWeight: 600,
                              color: "#1e293b",
                            }}
                          >
                            {draft.quantity}
                          </div>
                          <button
                            style={iconBtnStyle}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                quantity: draft.quantity + 1,
                              })
                            }
                          >
                            <PlusCircle size={24} />
                          </button>
                        </div>

                        <label
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "10px",
                            fontSize: "14px",
                            color: "#475569",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={draft.skipSelfCountdown}
                            disabled={!schema?.ready}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                skipSelfCountdown: e.target.checked,
                              })
                            }
                            style={{
                              width: "18px",
                              height: "18px",
                              marginTop: "2px",
                            }}
                          />
                          <span>Unlimited in POS (countdown 0)</span>
                        </label>

                        <div style={{ display: "flex", gap: "12px" }}>
                          <button
                            style={{
                              ...footerBtnStyle,
                              height: "42px",
                              border: "1px solid #94a3b8",
                              background: "white",
                              color: "#64748b",
                            }}
                            disabled={saving}
                            onClick={() => setDraft(null)}
                          >
                            Cancel
                          </button>
                          <button
                            style={{
                              ...footerBtnStyle,
                              height: "42px",
                              border: "none",
                              background: saving ? "#94a3b8" : "#1e3a8a",
                              color: "white",
                            }}
                            disabled={saving}
                            onClick={saveDraft}
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {mappings.length === 0 && (
                <div
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  No POS Audio product found.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0" }}>
          <button
            style={{
              ...footerBtnStyle,
              width: "100%",
              border: "1px solid #94a3b8",
              background: "white",
              color: "#64748b",
            }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
