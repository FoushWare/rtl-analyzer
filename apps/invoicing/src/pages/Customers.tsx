import { useLocale } from "@atlas/shared";
import { useState } from "react";
import { Avatar } from "@mui/material";
import { Card, Button, FormField, Modal } from "@atlas/design-system";
import { customers } from "@atlas/shared";
import { Heading } from "../components/InvoiceUi";
export function Customers() {
  const { t } = useLocale();
  const [id, setId] = useState<string | null>(null),
    [search, setSearch] = useState("");
  const c = customers.find((c) => c.id === id);
  return (
    <>
      <Heading
        title={t("Customers")}
        description={t("Good relationships are the foundation of good business.")}
      />
      <FormField
        label={t("Search customers")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ maxWidth: 350, marginBottom: 3 }}
      />
      <div className="customer-grid">
        {customers
          .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
          .map((c) => (
            <Card className="customer-card" key={c.id}>
              <Avatar sx={{ bgcolor: c.color + "20", color: c.color }}>
                {c.initials}
              </Avatar>
              <h3>{c.name}</h3>
              <p>{c.email}</p>
              <p>{c.contact}</p>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setId(c.id)}
              >{t("View customer")}</Button>
            </Card>
          ))}
      </div>
      <Modal
        title={c?.name || t("Customer")}
        open={!!c}
        onClose={() => setId(null)}
      >
        {c && (
          <>
            <p>{c.contact}</p>
            <p>{c.email}</p>
            <p className="hint">{c.address}</p>
          </>
        )}
      </Modal>
    </>
  );
}
