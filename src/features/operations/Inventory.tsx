import { addDays } from "../../services";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "../../components";
import { DEMO_DATE, type RecordItem } from "../../data";
import {
  OperationHeader,
  Metrics,
  OperationForm,
  Empty,
  useOperation,
  actor,
  type Field,
} from "./OperationsUI";
import { stockStatus } from "./selectors";
import { saveProduct } from "./services";
import { StockAdjustment, StockHistory } from "./StockAdjustment";
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
export function ProductEditor({
  record,
  onClose,
}: {
  record?: RecordItem;
  onClose: () => void;
}) {
  const { commit } = useOperation(),
    p = record?.inventory;
  const fields: Field[] = [
    { key: "name", label: "Product name", required: true },
    { key: "category", label: "Category", required: true },
    { key: "sku", label: "SKU", required: true },
    { key: "batch", label: "Batch number", required: true },
    {
      key: "expiry",
      label: "Expiry date",
      type: "date",
      help: "Leave blank only when no expiry is recorded.",
    },
    {
      key: "quantity",
      label: record
        ? "Current quantity (use stock adjustment)"
        : "Opening quantity",
      type: "number",
      required: true,
      readOnly: !!record,
    },
    { key: "unit", label: "Unit", required: true },
    {
      key: "purchaseCost",
      label: "Purchase cost per unit (INR)",
      type: "number",
      required: true,
    },
    {
      key: "sellingPrice",
      label: "Selling price per unit (INR)",
      type: "number",
      required: true,
    },
    { key: "supplier", label: "Supplier", required: true },
    {
      key: "minimumStock",
      label: "Minimum stock / reorder level",
      type: "number",
      required: true,
    },
  ];
  return (
    <OperationForm
      title={record ? "Edit product" : "Add inventory product"}
      fields={fields}
      initial={{
        name: record?.name || "",
        category: p?.category || "",
        sku: p?.sku || "",
        batch: p?.batch || "",
        expiry: p?.expiry || "",
        quantity: String(p?.quantity || 0),
        unit: p?.unit || "",
        purchaseCost: String(p?.purchaseCost || 0),
        sellingPrice: String(p?.sellingPrice || 0),
        supplier: p?.supplier || "",
        minimumStock: String(p?.minimumStock || 0),
      }}
      confirmation={
        !record
          ? "I confirm the opening quantity. It will create the opening stock movement."
          : undefined
      }
      onClose={onClose}
      onSave={(v) =>
        commit(
          (s) =>
            saveProduct(
              s,
              {
                ...record,
                id: record?.id || "inventory-" + crypto.randomUUID(),
                name: v.name,
                status: record?.status || "In stock",
                detail: "Manually maintained fictional batch",
                amount: Number(v.purchaseCost),
                inventory: {
                  category: v.category,
                  sku: v.sku,
                  batch: v.batch,
                  expiry: v.expiry,
                  quantity: Number(v.quantity),
                  unit: v.unit,
                  purchaseCost: Number(v.purchaseCost),
                  sellingPrice: Number(v.sellingPrice),
                  supplier: v.supplier,
                  minimumStock: Number(v.minimumStock),
                },
              },
              actor,
            ),
          "Inventory product saved",
        )
      }
    />
  );
}
export default function Inventory() {
  const { state } = useOperation(),
    [params] = useSearchParams(),
    [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState(params.get("status") || ""),
    [expiry, setExpiry] = useState(""),
    [sort, setSort] = useState("name"),
    [edit, setEdit] = useState<RecordItem | null | undefined>(),
    [adjust, setAdjust] = useState<{
      productId?: string;
      type: "Stock in" | "Stock out" | "Session usage";
    }>(),
    [history, setHistory] = useState<string | null | undefined>(
      params.get("record") || undefined,
    );
  const products = state.records["Inventory"],
    soon = addDays(DEMO_DATE, 30);
  const rows = products
    .filter(
      (r) =>
        (
          r.name +
          " " +
          r.inventory?.sku +
          " " +
          r.inventory?.batch +
          " " +
          r.inventory?.supplier
        )
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (!category || r.inventory?.category === category) &&
        (!status || stockStatus(r).toLowerCase() === status.toLowerCase()) &&
        (!expiry ||
          (expiry === "expired"
            ? !!r.inventory?.expiry && r.inventory.expiry < DEMO_DATE
            : !!r.inventory?.expiry &&
              r.inventory.expiry >= DEMO_DATE &&
              r.inventory.expiry <= soon)),
    )
    .sort((a, b) =>
      sort === "quantity"
        ? a.inventory!.quantity - b.inventory!.quantity
        : sort === "expiry"
          ? (a.inventory!.expiry || "9999").localeCompare(
              b.inventory!.expiry || "9999",
            )
          : a.name.localeCompare(b.name),
    );
  return (
    <div className="operations-page">
      <OperationHeader
        title="Inventory"
        description="Batch-level stock, session consumables and an accountable movement history."
        action={
          <div className="operations-actions">
            <button className="button" onClick={() => setHistory(null)}>
              Movement history
            </button>
            <button className="button primary" onClick={() => setEdit(null)}>
              + Add product
            </button>
          </div>
        }
      />
      <Metrics
        items={[
          ["Stocked products", products.length],
          [
            "Low-stock alerts",
            products.filter(
              (r) => r.inventory!.quantity <= r.inventory!.minimumStock,
            ).length,
          ],
          [
            "Expired batches",
            products.filter((r) => stockStatus(r) === "Expired").length,
          ],
          [
            "Expiring within 30 days",
            products.filter(
              (r) =>
                r.inventory!.expiry >= DEMO_DATE && r.inventory!.expiry <= soon,
            ).length,
          ],
        ]}
      />
      <section className="card">
        <div className="operations-filters">
          <label>
            Search inventory
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Product, SKU, batch or supplier"
            />
          </label>
          <label>
            Category
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {[...new Set(products.map((r) => r.inventory!.category))].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Stock status
            <select
              aria-label="Stock status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All stock</option>
              {["In stock", "Low stock", "Expired"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Expiry
            <select
              aria-label="Expiry"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            >
              <option value="">All dates</option>
              <option value="expired">Expired</option>
              <option value="soon">Within 30 days</option>
            </select>
          </label>
          <label>
            Sort
            <select
              aria-label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name">Name</option>
              <option value="quantity">Quantity</option>
              <option value="expiry">Expiry</option>
            </select>
          </label>
          <button
            className="button"
            onClick={() => {
              setQ("");
              setCategory("");
              setStatus("");
              setExpiry("");
              setSort("name");
            }}
          >
            Reset
          </button>
        </div>
        <p className="operations-caption">
          Alerts as of demo operating day {DEMO_DATE}. Prices are per displayed
          unit, in INR.
        </p>
        <div className="operations-row inventory-row operations-table-head">
          <span>Product / batch</span>
          <span>Stock / expiry</span>
          <span>Pricing / supplier</span>
          <span>Actions</span>
        </div>
        {rows.map((r) => (
          <article className="operations-row inventory-row" key={r.id}>
            <div>
              <strong>{r.name}</strong>
              <small>{r.inventory!.category}</small>
              <small>
                SKU {r.inventory!.sku} · Batch {r.inventory!.batch}
              </small>
            </div>
            <div>
              <strong>
                {r.inventory!.quantity} {r.inventory!.unit}
              </strong>
              <Badge>{stockStatus(r)}</Badge>
              <small>
                Minimum {r.inventory!.minimumStock} · Expiry{" "}
                {r.inventory!.expiry || "Not recorded"}
              </small>
            </div>
            <div>
              <span>
                Cost {money(r.inventory!.purchaseCost)} · Sale{" "}
                {money(r.inventory!.sellingPrice)}
              </span>
              <small>{r.inventory!.supplier}</small>
            </div>
            <div className="operations-actions">
              <button
                className="button"
                onClick={() => setAdjust({ productId: r.id, type: "Stock in" })}
              >
                Stock in
              </button>
              <button
                className="button"
                onClick={() =>
                  setAdjust({ productId: r.id, type: "Stock out" })
                }
              >
                Stock out
              </button>
              <button
                className="button"
                onClick={() =>
                  setAdjust({ productId: r.id, type: "Session usage" })
                }
              >
                Session usage
              </button>
              <button className="button" onClick={() => setEdit(r)}>
                Edit
              </button>
              <button className="button" onClick={() => setHistory(r.id)}>
                History
              </button>
            </div>
          </article>
        ))}
        {!rows.length && (
          <Empty>
            No products match these filters. Reset filters or add a product.
          </Empty>
        )}
      </section>
      {edit !== undefined && (
        <ProductEditor
          record={edit || undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
      {adjust && (
        <StockAdjustment {...adjust} onClose={() => setAdjust(undefined)} />
      )}
      {history !== undefined && (
        <StockHistory
          productId={history || undefined}
          onClose={() => setHistory(undefined)}
        />
      )}
    </div>
  );
}
