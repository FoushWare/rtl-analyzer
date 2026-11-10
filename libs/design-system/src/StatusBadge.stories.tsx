import { Provider, StatusBadge } from "./index";
export default { title: "Atlas/StatusBadge", component: StatusBadge };
export const PaymentStates = {
  render: () => (
    <Provider>
      <div style={{ display: "flex", gap: 12, padding: 24 }}>
        <StatusBadge status="Paid" />
        <StatusBadge status="Pending" />
        <StatusBadge status="Overdue" />
        <StatusBadge status="Draft" />
      </div>
    </Provider>
  ),
};
