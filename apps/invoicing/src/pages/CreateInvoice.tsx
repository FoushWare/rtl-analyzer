import { useLocale } from "@atlas/shared";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MenuItem, IconButton, Alert } from "@mui/material";
import Add from "@mui/icons-material/Add";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import { Card, Button, FormField, Modal } from "@atlas/design-system";
import {
  customers,
  mockApi,
  money,
  total,
  type Invoice,
  type LineItem,
} from "@atlas/shared";
import { Heading } from "../components/InvoiceUi";
export function CreateInvoice({
  onCreated,
}: {
  onCreated: (invoice: Invoice) => void;
}) {
  const { t, demoHref } = useLocale();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(""),
    [date, setDate] = useState("2026-10-11"),
    [due, setDue] = useState("2026-11-10"),
    [currency, setCurrency] = useState("USD"),
    [items, setItems] = useState<LineItem[]>([
      { description: "", quantity: 1, rate: 0 },
    ]),
    [errors, setErrors] = useState(false),
    [confirm, setConfirm] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const valid =
    !!customer &&
    !!date &&
    !!due &&
    due >= date &&
    items.every(
      (i) =>
        i.description.trim() &&
        Number.isFinite(i.quantity) &&
        i.quantity > 0 &&
        Number.isFinite(i.rate) &&
        i.rate > 0,
    );
  function update(index: number, key: keyof LineItem, value: string) {
    setItems(
      items.map((i, n) =>
        n === index
          ? { ...i, [key]: key === "description" ? value : Number(value) }
          : i,
      ),
    );
  }
  async function save() {
    setSaving(true);
    try {
      const invoice: Invoice = {
        id: `INV-2026-${Date.now()}`,
        customerId: customer,
        date,
        due,
        currency,
        items,
        status: "Pending",
      };
      await mockApi.createInvoice(invoice);
      onCreated(invoice);
      navigate(demoHref(`/invoices/${invoice.id}`));
    } catch {
      setError(t("Unable to save invoice. Please try again."));
      setConfirm(false);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Heading
        title={t("Create invoice")}
        description={t("Make your next great project official.")}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErrors(true);
          if (valid) setConfirm(true);
        }}
        noValidate
      >
        <Card className="card-pad form-section">
          <h2>{t("Invoice details")}</h2>
          <div className="form-grid">
            <FormField
              label={t("Customer")}
              select
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              error={errors && !customer}
              helperText={
                errors && !customer
                  ? t("Select a customer")
                  : t("Choose the company you’re billing")
              }
            >
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              label={t("Currency")}
              select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {["USD", "EUR", "GBP"].map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              label={t("Invoice date")}
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={errors && !date}
              helperText={errors && !date ? t("Invoice date is required") : ""}
            />
            <FormField
              label={t("Due date")}
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={due}
              onChange={(e) => setDue(e.target.value)}
              error={errors && (!due || due < date)}
              helperText={
                errors && (!due || due < date)
                  ? t("Due date must be on or after the invoice date")
                  : ""
              }
            />
          </div>
        </Card>
        <Card className="card-pad form-section">
          <h2>{t("Line items")}</h2>
          {items.map((item, index) => (
            <div className="line-item" key={index}>
              <FormField
                label={t("Description {number}", { number: index + 1 })}
                value={item.description}
                onChange={(e) => update(index, "description", e.target.value)}
                error={errors && !item.description.trim()}
                helperText={
                  errors && !item.description.trim()
                    ? t("Description is required")
                    : ""
                }
              />
              <FormField
                label={t("Quantity {number}", { number: index + 1 })}
                type="number"
                value={item.quantity}
                onChange={(e) => update(index, "quantity", e.target.value)}
                error={errors && item.quantity <= 0}
                helperText={
                  errors && item.quantity <= 0 ? t("Must be positive") : ""
                }
              />
              <FormField
                label={t("Rate {number}", { number: index + 1 })}
                type="number"
                value={item.rate}
                onChange={(e) => update(index, "rate", e.target.value)}
                error={errors && item.rate <= 0}
                helperText={errors && item.rate <= 0 ? t("Must be positive") : ""}
              />
              <IconButton
                aria-label={t("Remove item {number}", { number: index + 1 })}
                disabled={items.length === 1}
                onClick={() => setItems(items.filter((_, i) => i !== index))}
              >
                <DeleteOutline />
              </IconButton>
            </div>
          ))}
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() =>
              setItems([...items, { description: "", quantity: 1, rate: 0 }])
            }
          >{t("Add line item")}</Button>
          <div className="form-total">
            <span>{t("Total")}</span>
            <strong>{money(total({ items }), currency)}</strong>
          </div>
        </Card>
        {error && <Alert severity="error">{error}</Alert>}
        <div className="heading-actions" style={{ justifyContent: "flex-end" }}>
          <Button component={Link} to={demoHref("/invoices")} variant="outlined">{t("Cancel")}</Button>
          <Button type="submit">{t("Review invoice")}</Button>
        </div>
      </form>
      <Modal
        title={t("Confirm invoice")}
        open={confirm}
        onClose={() => !saving && setConfirm(false)}
        actions={
          <>
            <Button
              variant="outlined"
              disabled={saving}
              onClick={() => setConfirm(false)}
            >{t("Keep editing")}</Button>
            <Button disabled={saving} onClick={save}>
              {saving ? t("Saving…") : t("Create invoice")}
            </Button>
          </>
        }
      >
        <p>{t("Create an invoice for")}{" "}
          <strong>{customers.find((c) => c.id === customer)?.name}</strong>{" "}{t("totaling")}{" "}<strong>{money(total({ items }), currency)}</strong>{t("?")}</p>
        <p className="hint">{t("The invoice will be saved to this demo workspace as Pending. No email is sent.")}</p>
      </Modal>
    </>
  );
}
