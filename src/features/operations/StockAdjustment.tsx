import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Modal } from "../../components";
import {
  useOperation,
  OperationForm,
  actor,
  options,
  Empty,
} from "./OperationsUI";
import { adjustStock } from "./services";
import type { StockMovement } from "./model";
export function StockAdjustment({
  productId,
  sessionId,
  type = "Stock out",
  onClose,
}: {
  productId?: string;
  sessionId?: string;
  type?: "Stock in" | "Stock out" | "Session usage";
  onClose: () => void;
}) {
  const { state, commit } = useOperation(),
    [id] = useState(() => crypto.randomUUID());
  const products = state.records["Inventory"];
  return (
    <OperationForm
      title="Record stock adjustment"
      fields={[
        {
          key: "productId",
          label: "Product / batch",
          required: true,
          options: [
            { value: "", label: "Select product" },
            ...products.map((p) => ({
              value: p.id,
              label: `${p.name} · ${p.inventory?.batch} · ${p.inventory?.quantity} ${p.inventory?.unit}`,
            })),
          ],
        },
        {
          key: "type",
          label: "Movement type",
          options: options(
            sessionId
              ? ["Session usage"]
              : ["Stock in", "Stock out", "Session usage"],
          ),
        },
        { key: "quantity", label: "Quantity", type: "number", required: true },
        {
          key: "sessionId",
          label: "Session (required for session usage)",
          options: [
            { value: "", label: "No session" },
            ...state.records["Sittings & Sessions"]
              .filter(
                (r) =>
                  r.session &&
                  ["In Progress", "Awaiting Review", "Completed"].includes(
                    r.status,
                  ) &&
                  (!sessionId || r.id === sessionId),
              )
              .map((r) => ({
                value: r.id,
                label: `${r.id} · ${state.patients.find((p) => p.id === r.patientId)?.name} · ${r.status}`,
              })),
          ],
        },
        {
          key: "reason",
          label: "Reason / consumable documentation",
          type: "textarea",
          required: true,
        },
      ]}
      initial={{
        productId: productId || "",
        type: sessionId ? "Session usage" : type,
        quantity: "",
        sessionId: sessionId || "",
        reason: "",
      }}
      confirmation="I confirm the quantity and batch. This immediately changes stock and adds a permanent movement record. Session completion will not deduct this usage again."
      onClose={onClose}
      onSave={(v, c) =>
        commit(
          (s) =>
            adjustStock(
              s,
              {
                id,
                productId: v.productId,
                type: v.type as "Stock in" | "Stock out" | "Session usage",
                quantity: Number(v.quantity),
                reason: v.reason,
                actor,
                sessionId:
                  v.type === "Session usage"
                    ? sessionId || v.sessionId
                    : undefined,
              },
              c,
            ),
          "Stock adjusted and movement retained",
        )
      }
    >
      {(v) => {
        const p = state.records.Inventory.find(
          (p) => p.id === v.productId,
        )?.inventory;
        if (!p) return null;
        const after =
          p.quantity +
          (v.type === "Stock in" ? Number(v.quantity) : -Number(v.quantity));
        return (
          <p className="operations-confirm" aria-live="polite">
            Current: {p.quantity} {p.unit} ? After adjustment:{" "}
            {Number.isFinite(after) ? after : "Invalid quantity"} {p.unit}
            {after < 0
              ? " ? insufficient stock; adjustment will be rejected"
              : ""}
          </p>
        );
      }}
    </OperationForm>
  );
}
export function MovementRows({ movements }: { movements: StockMovement[] }) {
  const { state } = useOperation();
  return (
    <>
      {movements.map((m) => (
        <article className="operations-movement" key={m.id}>
          <div className="operations-split">
            <strong>
              {
                state.records["Inventory"].find((p) => p.id === m.productId)
                  ?.name
              }
            </strong>
            <Badge>{m.type}</Badge>
          </div>
          <p>
            {m.type === "Stock in" || m.type === "Opening" ? "+" : "−"}
            {m.quantity} · {m.before} → {m.after} remaining
          </p>
          <small>
            {new Date(m.at).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}{" "}
            IST · {m.actor}
          </small>
          <p>{m.reason}</p>
          {m.sessionId && (
            <Link
              className="text-link"
              to={"/sittings-sessions/" + m.sessionId}
            >
              Open linked session{" "}
            </Link>
          )}
          {m.patientId && (
            <Link className="text-link" to={"/patients/" + m.patientId}>
              Patient profile
            </Link>
          )}
        </article>
      ))}
      {!movements.length && <Empty>No stock movements recorded.</Empty>}
    </>
  );
}
export function StockHistory({
  productId,
  onClose,
}: {
  productId?: string;
  onClose: () => void;
}) {
  const { state } = useOperation();
  return (
    <Modal
      title="Stock movement history"
      className="operations-modal"
      onClose={onClose}
    >
      <p>
        Accepted movements are retained, including opening stock and session
        usage.
      </p>
      <MovementRows
        movements={(state.stockMovements || [])
          .filter((m) => !productId || m.productId === productId)
          .slice()
          .sort((a, b) => b.at.localeCompare(a.at))}
      />
    </Modal>
  );
}
export function SessionInventory({ sessionId }: { sessionId: string }) {
  const { state } = useOperation(),
    [open, setOpen] = useState(false),
    session = state.records["Sittings & Sessions"].find(
      (r) => r.id === sessionId,
    ),
    movements = (state.stockMovements || []).filter(
      (m) => m.sessionId === sessionId,
    );
  return (
    <section className="card session-section">
      <h2>Recorded inventory usage</h2>
      <p>
        Record actual consumables by batch. Each confirmed entry immediately
        reduces shared stock; saving or completing the sitting does not deduct
        it again.
      </p>
      <MovementRows movements={movements} />
      {session &&
      ["In Progress", "Awaiting Review", "Completed"].includes(
        session.status,
      ) ? (
        <button type="button" className="button" onClick={() => setOpen(true)}>
          Record consumable usage
        </button>
      ) : (
        <small>Begin the sitting before recording consumable usage.</small>
      )}
      {open && (
        <StockAdjustment sessionId={sessionId} onClose={() => setOpen(false)} />
      )}
    </section>
  );
}
