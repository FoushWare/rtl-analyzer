import { useLocale } from "@atlas/shared";
import { useParams } from "react-router-dom";
import {
  Card,
  Button,
  StatusBadge,
  DataTable,
  EmptyState,
} from "@atlas/design-system";
import { customerFor, money, total, type Invoice } from "@atlas/shared";
import { Heading } from "../components/InvoiceUi";
export function InvoiceDetails({ invoices }: { invoices: Invoice[] }) {
  const { t } = useLocale();
  const { id } = useParams();
  const i = invoices.find((i) => i.id === id);
  if (!i)
    return (
      <EmptyState
        title={t("Invoice not found")}
        description={t("Return to Invoices to select an existing invoice.")}
      />
    );
  const c = customerFor(i.customerId);
  return (
    <>
      <Heading
        title={i.id}
        description={t("Invoice for {name}", { name: c.name })}
        action={
          <Button variant="outlined" onClick={() => window.print()}>{t("Print invoice")}</Button>
        }
      />
      <Card className="card-pad">
        <StatusBadge status={i.status} />
        <div className="detail-grid">
          <div>
            <small>{t("BILL TO")}</small>
            <h3>{c.name}</h3>
            <p>{c.contact}</p>
            <p className="hint">
              {c.address}
              <br />
              {c.email}
            </p>
          </div>
          <div>
            <small>{t("ISSUED")}</small>
            <p>{i.date}</p>
            <small>{t("DUE DATE")}</small>
            <p>{i.due}</p>
            <small>{t("CURRENCY")}</small>
            <p>{i.currency}</p>
          </div>
        </div>
        <DataTable
          rows={i.items}
          rowKey={(item) => item.description}
          columns={[
            { label: t("DESCRIPTION"), render: (item) => item.description },
            { label: t("QUANTITY"), render: (item) => item.quantity },
            { label: t("RATE"), render: (item) => money(item.rate, i.currency) },
            {
              label: t("AMOUNT"),
              render: (item) => money(item.rate * item.quantity, i.currency),
            },
          ]}
        />
        <div className="form-total">
          <span>{t("Total due")}</span>
          <strong>{money(total(i), i.currency)}</strong>
        </div>
      </Card>
    </>
  );
}
