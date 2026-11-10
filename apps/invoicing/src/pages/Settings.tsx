import { useLocale } from "@atlas/shared";
import { useState } from "react";
import { Alert, FormControlLabel, Switch } from "@mui/material";
import { Card, Button, FormField } from "@atlas/design-system";
import { Heading } from "../components/InvoiceUi";
export function Settings() {
  const { t } = useLocale();
  const initial = JSON.parse(
    localStorage.getItem("atlas-settings") || "null",
  ) || {
    company: "Atlas Company",
    email: "finance@atlas.example",
    address: "88 Lexington Avenue, New York, United States",
    reminders: true,
  };
  const [form, setForm] = useState(initial),
    [saved, setSaved] = useState(false);
  return (
    <>
      <Heading
        title={t("Settings")}
        description={t("Your workspace, just the way you like it.")}
      />
      <form
        className="settings-width"
        onSubmit={(e) => {
          e.preventDefault();
          localStorage.setItem("atlas-settings", JSON.stringify(form));
          setSaved(true);
        }}
      >
        <Card className="card-pad form-section">
          <h2>{t("Company information")}</h2>
          <div className="form-grid">
            <FormField
              required
              label={t("Company name")}
              value={form.company}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, company: e.target.value });
              }}
            />
            <FormField
              required
              label={t("Billing email")}
              type="email"
              value={form.email}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, email: e.target.value });
              }}
            />
            <FormField
              required
              label={t("Company address")}
              value={form.address}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, address: e.target.value });
              }}
            />
          </div>
        </Card>
        <Card className="card-pad form-section">
          <h2>{t("Application preferences")}</h2>
          <FormControlLabel
            control={
              <Switch
                checked={form.reminders}
                onChange={(_, value) => {
                  setSaved(false);
                  setForm({ ...form, reminders: value });
                }}
              />
            }
            label={t("Enable payment reminder preference")}
          />
          <p className="hint">{t("English · United States · LTR")}</p>
          <p className="hint">{t("Preferences are stored locally. Reminder delivery is not connected in this demo.")}</p>
        </Card>
        {saved && (
          <Alert severity="success" sx={{ marginBottom: 2 }}>{t("Settings saved")}</Alert>
        )}
        <Button type="submit">{t("Save changes")}</Button>
      </form>
    </>
  );
}
