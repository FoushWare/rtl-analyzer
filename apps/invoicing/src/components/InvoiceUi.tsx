import { useLocale } from "@atlas/shared";
import { Link } from "react-router-dom";
import Add from "@mui/icons-material/Add";
import { Button } from "@atlas/design-system";
export function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{t("ATLAS INVOICE")}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function CreateButton() {
  const { t, demoHref } = useLocale();
  return (
    <Button
      component={Link}
      to={demoHref("/invoices/new")}
      startIcon={<Add fontSize="small" />}
    >
      {t("Create invoice")}
    </Button>
  );
}
