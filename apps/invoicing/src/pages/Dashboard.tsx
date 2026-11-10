import { useLocale } from "@atlas/shared";
import { Link } from "react-router-dom";
import { Card, Button } from "@atlas/design-system";
import { money, total, type Invoice } from "@atlas/shared";
import { Heading, CreateButton } from "../components/InvoiceUi";
import { InvoiceTable } from "../components/InvoiceTable";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import TrendingUp from "@mui/icons-material/TrendingUp";
export function Dashboard({ invoices }: { invoices: Invoice[] }) {
  const { t, demoHref, label: translateLabel } = useLocale();
  const paid = invoices.filter((i) => i.status === "Paid"),
    pending = invoices.filter((i) => i.status === "Pending"),
    overdue = invoices.filter((i) => i.status === "Overdue");
  const aggregate = (items: Invoice[]) =>
    items.filter((i) => i.currency === "USD").reduce((s, i) => s + total(i), 0);
  return (
    <>
      <Heading
        title={t("Overview")}
        description={t("Welcome back, Alex. Here’s how your business is doing today.")}
        action={
          <div className="heading-actions">
            <Button
              variant="outlined"
              sx={{ borderColor: "#e0e5ee", color: "#707a8e", bgcolor: "#fff" }}
              onClick={() => window.print()}
            >{t("Print report")}</Button>
            <CreateButton />
          </div>
        }
      />
      <div className="kpis">
        {[
          {
            label: "Total revenue (USD)",
            value: money(aggregate(paid)),
            note: "12.8% ",
            icon: AccountBalanceWalletOutlined,
          },
          {
            label: "Outstanding (USD)",
            value: money(aggregate(pending)),
            note: t("{count} invoices ", { count: pending.length }),
            icon: ScheduleOutlined,
          },
          {
            label: "Overdue (USD)",
            value: money(aggregate(overdue)),
            note: t("{count} invoices ", { count: overdue.length }),
            icon: ReceiptLongOutlined,
          },
          {
            label: "Total invoices",
            value: String(invoices.length),
            note: "8.2% ",
            icon: TrendingUp,
          },
        ].map((k) => (
          <Card key={k.label} className="kpi">
            <div className="kpi-icon">
              <k.icon sx={{ fontSize: 18 }} />
            </div>
            <div className="kpi-label">{translateLabel(k.label)}</div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-note">
              <b>↗ {k.note}</b>
              {k.label === "Total revenue (USD)" || k.label === "Total invoices"
                ? t("vs. previous month")
                : t("this month")}
            </div>
          </Card>
        ))}
      </div>
      <div className="charts">
        <Card>
          <div className="section-title">
            <div>
              <h2>{t("Revenue overview")}</h2>
              <p>{t("Your revenue performance over time")}</p>
            </div>
            <span className="chart-legend">
              <i />{t("Revenue · USD")}</span>
          </div>
          <div className="chart-wrap">
            <svg
              viewBox="0 0 600 215"
              role="img"
              aria-label={t("Revenue increased from May to October, from 24,000 to 61,000 US dollars")}
            >
              <defs>
                <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6671e0" stopOpacity=".18" />
                  <stop offset="100%" stopColor="#6671e0" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[30, 75, 120, 165].map((y, i) => (
                <g key={y}>
                  <line
                    x1="45"
                    x2="590"
                    y1={y}
                    y2={y}
                    stroke="#edf0f6"
                    strokeDasharray="4 4"
                  />
                  <text x="0" y={y + 4} fontSize="9" fill="#9ca4b3">
                    ${60 - i * 15}k
                  </text>
                </g>
              ))}
              <path
                d="M45 145 C80 145 100 110 145 115 S215 150 255 104 S325 85 365 96 S435 50 475 60 S545 50 590 25 L590 190 L45 190Z"
                fill="url(#revenue-fill)"
              />
              <path
                d="M45 145 C80 145 100 110 145 115 S215 150 255 104 S325 85 365 96 S435 50 475 60 S545 50 590 25"
                fill="none"
                stroke="#5864db"
                strokeWidth="3"
              />
              <circle
                cx="590"
                cy="25"
                r="4"
                fill="#5864db"
                stroke="white"
                strokeWidth="2"
              />
            </svg>
            <div className="chart-labels">
              {["May", "Jun", "Jul", "Aug", "Sep", "Oct"].map((m) => (
                <span key={m}>{translateLabel(m)}</span>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div className="section-title">
            <div>
              <h2>{t("Payment status")}</h2>
              <p>{t("October 2026 · invoice count")}</p>
            </div>
            <span className="hint">•••</span>
          </div>
          <div className="breakdown">
            <div
              className="donut"
              style={{
                background: `conic-gradient(#5864dc 0 ${(paid.length / invoices.length) * 100}%,#e8b557 ${(paid.length / invoices.length) * 100}% ${((paid.length + pending.length) / invoices.length) * 100}%,#df838d ${((paid.length + pending.length) / invoices.length) * 100}% ${((paid.length + pending.length + overdue.length) / invoices.length) * 100}%,#cbd0dd 0 100%)`,
              }}
            >
              <div className="donut-center">
                <strong>{invoices.length}</strong>
                <small>{t("Total invoices")}</small>
              </div>
            </div>
            {[
              ["Paid", paid.length, "#5864dc"],
              ["Pending", pending.length, "#e8b557"],
              ["Overdue", overdue.length, "#df838d"],
              [
                "Draft",
                invoices.filter((i) => i.status === "Draft").length,
                "#cbd0dd",
              ],
            ].map(([label, count, color]) => (
              <div className="breakdown-row" key={label}>
                <span>
                  <i style={{ background: String(color) }} />
                  {translateLabel(label)}
                </span>
                <strong>
                  {count}{" "}
                  <span
                    style={{
                      display: "inline",
                      fontWeight: 400,
                      marginLeft: 10,
                    }}
                  >
                    {Math.round((Number(count) / invoices.length) * 100)}%
                  </span>
                </strong>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <div className="section-title">
          <div>
            <h2>{t("Recent invoices")}</h2>
            <p>{t("A quick look at your latest billing activity")}</p>
          </div>
          <Link to={demoHref("/invoices")}>{t("View all invoices →")}</Link>
        </div>
        <InvoiceTable invoices={invoices.slice(0, 5)} />
      </Card>
      <p className="hint" style={{ fontSize: 10, marginTop: 16 }}>{t("Revenue trend and comparisons are illustrative demo figures. Invoice balances include USD invoices only; counts include all currencies.")}</p>
    </>
  );
}
