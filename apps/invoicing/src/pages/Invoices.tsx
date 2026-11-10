import { useLocale } from "@atlas/shared";
import { useState } from "react";
import { MenuItem, Pagination } from "@mui/material";
import { Card, FormField } from "@atlas/design-system";
import { customerFor, type Invoice } from "@atlas/shared";
import { Heading, CreateButton } from "../components/InvoiceUi";
import { InvoiceTable } from "../components/InvoiceTable";
export function Invoices({ invoices }: { invoices: Invoice[] }) {
  const { t, label, language } = useLocale();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("All statuses"),
    [page, setPage] = useState(1);
  const filtered = invoices.filter(
    (i) =>
      (status === "All statuses" || i.status === status) &&
      `${i.id} ${customerFor(i.customerId).name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        title={t("Invoices")}
        description={t("Manage your invoices, track payments, and keep business moving.")}
        action={<CreateButton />}
      />
      <Card>
        <div className="toolbar">
          <FormField
            className="search"
            label={t("Search invoices")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <FormField
            select
            label={t("Status")}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            sx={{ width: 180 }}
          >
            {["All statuses", "Paid", "Pending", "Overdue", "Draft"].map(
              (s) => (
                <MenuItem key={s} value={s}>
                  {label(s)}
                </MenuItem>
              ),
            )}
          </FormField>
          <span className="hint" style={{ marginLeft: "auto" }}>
            {filtered.length}{" "}{t("invoices")}</span>
        </div>
        <InvoiceTable invoices={filtered.slice((page - 1) * 8, page * 8)} />
        <div className="pagination">
          <span>
            {filtered.length
              ? t("{start}–{end} of {count}", { start: (page - 1) * 8 + 1, end: Math.min(page * 8, filtered.length), count: filtered.length })
              : t("0 results")}
          </span>
          <Pagination
            size="small"
            getItemAriaLabel={language === "ar" ? (type, number) => type === "page" ? t("Go to page {page}", { page: number ?? 1 }) : label(`Go to ${type} page`) : undefined}
            page={page}
            count={Math.max(1, Math.ceil(filtered.length / 8))}
            onChange={(_, p) => setPage(p)}
          />
        </div>
      </Card>
    </>
  );
}
