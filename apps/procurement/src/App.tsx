import { useLocale } from "@atlas/shared";
import { useState } from "react";
import { Routes, Route, Link, useParams, useLocation } from "react-router-dom";
import { MenuItem } from "@mui/material";
import {
  AppShell,
  Card,
  DataTable,
  FormField,
  StatusBadge,
  EmptyState,
} from "@atlas/design-system";
import { purchaseOrders, money, total } from "@atlas/shared";
function Orders() {
  const { t, demoHref, label: translateLabel } = useLocale();
  const [status, setStatus] = useState("All statuses");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("ATLAS PROCUREMENT")}</div>
          <h1>{t("Purchase orders")}</h1>
          <p>{t("Keep your suppliers, spending, and deliveries in sync.")}</p>
        </div>
      </div>
      <div className="kpis">
        {[
          [
            "Total committed",
            money(purchaseOrders.reduce((s, o) => s + total(o), 0)),
          ],
          ["Purchase orders", purchaseOrders.length],
          ["Awaiting approval", 3],
          ["Delivered", 3],
        ].map(([label, value]) => (
          <Card className="kpi" key={label}>
            <div className="kpi-label">{translateLabel(label)}</div>
            <div className="kpi-value">{value}</div>
          </Card>
        ))}
      </div>
      <Card>
        <div className="toolbar">
          <FormField
            select
            label={t("Status")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={{ width: 200 }}
          >
            {["All statuses", "Pending", "Approved", "Delivered"].map((s) => (
              <MenuItem key={s} value={s}>
                {translateLabel(s)}
              </MenuItem>
            ))}
          </FormField>
        </div>
        <DataTable
          rowKey={(o) => o.id}
          rows={purchaseOrders.filter(
            (o) => status === "All statuses" || o.status === status,
          )}
          columns={[
            {
              label: t("ORDER"),
              render: (o) => (
                <Link className="invoice-link" to={demoHref(`/orders/${o.id}`)}>
                  {o.id}
                </Link>
              ),
            },
            {
              label: t("SUPPLIER"),
              render: (o) => (
                <strong style={{ fontSize: 12 }}>{o.supplier}</strong>
              ),
            },
            {
              label: t("ORDER DATE"),
              render: (o) => <span className="table-date">{o.date}</span>,
            },
            {
              label: t("AMOUNT"),
              render: (o) => <span className="amount">{money(total(o))}</span>,
            },
            {
              label: t("STATUS"),
              render: (o) => <StatusBadge status={o.status} />,
            },
          ]}
        />
      </Card>
    </>
  );
}
function Details() {
  const { t } = useLocale();
  const { id } = useParams();
  const order = purchaseOrders.find((o) => o.id === id);
  return order ? (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("PURCHASE ORDER")}</div>
          <h1>{order.id}</h1>
          <p>
            {order.supplier}{" "}{t("· Ordered")}{" "}{order.date}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <Card className="card-pad">
        <h2>{order.supplier}</h2>
        <DataTable
          rows={order.items}
          rowKey={(i) => i.description}
          columns={[
            { label: t("DESCRIPTION"), render: (i) => i.description },
            { label: t("QUANTITY"), render: (i) => i.quantity },
            { label: t("AMOUNT"), render: (i) => money(i.rate) },
          ]}
        />
        <div className="form-total">
          <span>{t("Order total")}</span>
          <strong>{money(total(order))}</strong>
        </div>
      </Card>
    </>
  ) : (
    <EmptyState
      title={t("Order not found")}
      description={t("Choose an order from the purchase order list.")}
    />
  );
}
export default function App() {
  const { t } = useLocale();
  const location = useLocation();
  return (
    <AppShell
      title={t(location.pathname === "/settings" ? "Settings" : "Purchase orders")}
      procurement
    >
      <Routes>
        <Route path="/" element={<Orders />} />
        <Route path="/orders/:id" element={<Details />} />
        <Route
          path="/settings"
          element={
            <Card className="card-pad">
              <h1>{t("Procurement settings")}</h1>
              <p className="hint">{t("Atlas Company · USD · English · United States")}</p>
              <p>{t("Approval is required for orders over $5,000.")}</p>
            </Card>
          }
        />
        <Route
          path="*"
          element={
            <EmptyState
              title={t("Page not found")}
              description={t("Choose Purchase orders from the sidebar.")}
            />
          }
        />
      </Routes>
    </AppShell>
  );
}
