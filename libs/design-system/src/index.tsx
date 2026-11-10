import { useLocale, DemoControls } from "@atlas/shared";
import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  Button as MuiButton,
  Paper,
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  type ButtonProps,
  type TextFieldProps,
} from "@mui/material";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import PeopleOutline from "@mui/icons-material/PeopleOutline";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import Search from "@mui/icons-material/Search";
import NotificationsNone from "@mui/icons-material/NotificationsNone";
import Menu from "@mui/icons-material/Menu";
import Close from "@mui/icons-material/Close";
import ArrowForward from "@mui/icons-material/ArrowForward";
import styled from "@emotion/styled";
import type { Status } from "@atlas/shared";
import "./styles.css";
export { Provider, theme } from "./runtime";
export const Button = <C extends React.ElementType = "button">(
  props: ButtonProps<C, { component?: C }>,
) => <MuiButton variant="contained" {...props} />;
export const FormField = (props: TextFieldProps) => (
  <TextField fullWidth {...props} />
);
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Paper elevation={0} className={`card ${className}`}>
      {children}
    </Paper>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  const { label } = useLocale();
  const colors: Record<Status, [string, string]> = {
    Paid: ["#e9f6ef", "#27805a"],
    Pending: ["#fff5df", "#af7a14"],
    Overdue: ["#fcebec", "#c25058"],
    Draft: ["#eef0f5", "#748094"],
    Approved: ["#e9f6ef", "#27805a"],
    Delivered: ["#eaf0ff", "#4b64a9"],
  };
  return (
    <Chip
      size="small"
      label={
        <>
          <span className="status-dot">●</span>
          {label(status)}
        </>
      }
      sx={{
        background: colors[status][0],
        color: colors[status][1],
        fontWeight: 600,
        fontSize: 11,
        height: 26,
      }}
    />
  );
}
export function Modal({
  title,
  open,
  onClose,
  children,
  actions,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {title}
        <IconButton
          aria-label={t("Close dialog")}
          onClick={onClose}
          sx={{ position: "absolute", right: 12, top: 12 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>{children}</DialogContent>
      {actions && <DialogActions sx={{ padding: 3 }}>{actions}</DialogActions>}
    </Dialog>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <ReceiptLongOutlined />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function DataTable<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: { label: string; render: (row: T) => ReactNode }[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  const { t } = useLocale();
  return rows.length ? (
    <div className="table-scroll">
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell key={c.label}>{c.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow hover key={rowKey(row)}>
              {columns.map((c) => (
                <TableCell key={c.label}>{c.render(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ) : (
    <EmptyState
      title={t("No results found")}
      description={t("Try another search or adjust your filters.")}
    />
  );
}
const SidebarFrame = styled.aside`
  position: fixed;
  inset-inline-start: 0;
  top: 0;
  bottom: 0;
  width: 238px;
  background: #fff;
  border-inline-end: 1px solid #e9edf4;
  padding: 30px 18px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  @media (max-width: 900px) {
    /* @noflip */ transform: translateX(-100%);
    html[dir="rtl"] &:not(.is-open) {
      /* @noflip */ transform: translateX(100%);
    }
    &.is-open {
      /* @noflip */ transform: translateX(0);
    }
  }
`;
const links = [
  ["/", "Overview", DashboardOutlined],
  ["/invoices", "Invoices", ReceiptLongOutlined],
  ["/customers", "Customers", PeopleOutline],
  ["/settings", "Settings", SettingsOutlined],
] as const;
export function Sidebar({
  procurement,
  open,
  onClose,
}: {
  procurement: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const { t, demoHref, label: translateLabel } = useLocale();
  return (
    <SidebarFrame className={open ? "is-open" : ""}>
      <a className="brand" href={demoHref("/")}>
        <span className="brand-mark">a</span>atlas
        <span className="brand-period">.</span>
      </a>
      <div className="workspace">
        <Avatar
          sx={{
            width: 30,
            height: 30,
            bgcolor: "#eceefb",
            color: "#5d66c6",
            fontSize: 12,
          }}
        >
          AC
        </Avatar>
        <div>
          <strong>Atlas Company</strong>
          <small>{t("Pro workspace")}</small>
        </div>
        <span>⌄</span>
      </div>
      <div className="nav-label">{t("WORKSPACE")}</div>
      <nav>
        {(procurement
          ? ([
              ["/", "Purchase orders", ShoppingBagOutlined],
              ["/settings", "Settings", SettingsOutlined],
            ] as const)
          : links
        ).map(([path, label, Icon]) => (
          <NavLink end={path === "/"} to={demoHref(path)} key={path} onClick={onClose}>
            <Icon fontSize="small" />
            {translateLabel(label)}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="nav-label">{t("YOUR APPLICATIONS")}</div>
        <a
          className="app-link"
          href={demoHref(procurement ? "http://localhost:4200" : "http://localhost:4201")}
        >
          <ShoppingBagOutlined fontSize="small" />
          {t(procurement ? "Invoicing" : "Procurement")}
          <ArrowForward sx={{ fontSize: 15, marginLeft: "auto" }} />
        </a>
        <div className="support-card">
          <strong>{t("A little help goes a long way")}</strong>
          <p>{t("Everything you need to keep business moving.")}</p>
          <a href="mailto:support@atlas.example">{t("Contact support ↗")}</a>
        </div>
        <div className="profile">
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: "#ede5db",
              color: "#8c7055",
              fontSize: 12,
            }}
          >
            AJ
          </Avatar>
          <div>
            <strong>Alex Johnson</strong>
            <small>{t("Workspace admin")}</small>
          </div>
        </div>
      </div>
    </SidebarFrame>
  );
}
export function Header({
  title,
  onMenu,
}: {
  title: string;
  onMenu: () => void;
}) {
  const { t } = useLocale();
  return (
    <header className="header">
      <div className="header-title">
        <IconButton
          className="mobile-menu"
          aria-label={t("Open navigation")}
          onClick={onMenu}
        >
          <Menu />
        </IconButton>
        <span>{t("Workspace")}</span>
        <span className="breadcrumb-slash">/</span>
        <strong>{title}</strong>
      </div>
      <div className="header-tools">
        <Search sx={{ fontSize: 20, color: "#8b92a3" }} />
        <span className="header-search">{t("Your business, at a glance")}</span>
        <span className="header-divider" />
        <IconButton
          aria-label={t("Notifications")}
          onClick={() =>
            window.alert(t("You’re all caught up. No new notifications."))
          }
        >
          <NotificationsNone fontSize="small" />
        </IconButton>
        <Avatar
          sx={{
            width: 30,
            height: 30,
            fontSize: 11,
            bgcolor: "#ede5db",
            color: "#8c7055",
          }}
        >
          AJ
        </Avatar>
      </div>
    </header>
  );
}
export function AppShell({
  children,
  title,
  procurement = false,
}: {
  children: ReactNode;
  title: string;
  procurement?: boolean;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Sidebar
        procurement={procurement}
        open={open}
        onClose={() => setOpen(false)}
      />
      {open && (
        <button
          className="nav-scrim"
          aria-label={t("Close navigation")}
          onClick={() => setOpen(false)}
        />
      )}
      <div className="app-main">
        <DemoControls />
        <Header title={title} onMenu={() => setOpen(true)} />
        <main>{children}</main>
        <footer>{t("© 2026 Atlas Invoice")}<span>{t("All systems operational")}{" "}<i />
          </span>
        </footer>
      </div>
    </>
  );
}
