import { useLocale } from "@atlas/shared";
import { Link } from "react-router-dom";
import { Avatar, IconButton } from "@mui/material";
import ArrowForward from "@mui/icons-material/ArrowForward";
import ArrowBack from "@mui/icons-material/ArrowBack";
import { DataTable, StatusBadge } from "@atlas/design-system";
import { customerFor, money, total, type Invoice } from "@atlas/shared";
export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  const { t, demoHref, language } = useLocale();
  return (
    <DataTable
      rows={invoices}
      rowKey={(i) => i.id}
      columns={[
        {
          label: t("INVOICE"),
          render: (i) => (
            <Link className="invoice-link" to={demoHref(`/invoices/${i.id}`)}>
              {i.id}
            </Link>
          ),
        },
        {
          label: t("CUSTOMER"),
          render: (i) => {
            const c = customerFor(i.customerId);
            return (
              <div className="customer-cell">
                <Avatar
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: c.color + "18",
                    color: c.color,
                    fontSize: 10,
                    borderRadius: "8px",
                  }}
                >
                  {c.initials}
                </Avatar>
                <div>
                  <strong>{c.name}</strong>
                  <small>{c.email}</small>
                </div>
              </div>
            );
          },
        },
        {
          label: t("DUE DATE"),
          render: (i) => (
            <span className="table-date">
              {new Date(i.due + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          ),
        },
        {
          label: t("AMOUNT"),
          render: (i) => (
            <span className="amount">{money(total(i), i.currency)}</span>
          ),
        },
        { label: t("STATUS"), render: (i) => <StatusBadge status={i.status} /> },
        {
          label: "",
          render: (i) => (
            <IconButton
              component={Link}
              to={demoHref(`/invoices/${i.id}`)}
              aria-label={t("View {id}", { id: i.id })}
              size="small"
            >
              {language === "ar" ? (
                <ArrowBack sx={{ fontSize: 15, color: "#9aa2b3" }} />
              ) : (
                <ArrowForward sx={{ fontSize: 15, color: "#9aa2b3" }} />
              )}
            </IconButton>
          ),
        },
      ]}
    />
  );
}
