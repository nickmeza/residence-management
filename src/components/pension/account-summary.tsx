import { formatShortDate, formatSoles } from "@/lib/format";

// Cómo va con sus pagos: hasta qué día pagó, si tiene saldo a favor o debe, y el próximo pago sugerido.
export function AccountSummary({
  account,
}: {
  account: { paidUntil: string | null; balance: string; next: { from: string; to: string; amount: string } };
}) {
  const balance = Number(account.balance);
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div className="rounded-lg bg-muted/50 p-3">
        <dt className="text-muted-foreground">Pagado hasta</dt>
        <dd className="text-lg font-bold">
          {account.paidUntil ? formatShortDate(account.paidUntil) : "Sin pagos"}
        </dd>
      </div>
      <div className="rounded-lg bg-muted/50 p-3">
        <dt className="text-muted-foreground">{balance < 0 ? "Debe" : "Saldo a favor"}</dt>
        <dd className={balance < 0 ? "text-lg font-bold text-danger" : "text-lg font-bold"}>
          {formatSoles(Math.abs(balance))}
        </dd>
      </div>
      <div className="rounded-lg bg-muted/50 p-3">
        <dt className="text-muted-foreground">Próximo pago</dt>
        <dd className="text-lg font-bold">{formatSoles(account.next.amount)}</dd>
        <dd className="text-xs text-muted-foreground">
          Del {formatShortDate(account.next.from)} al {formatShortDate(account.next.to)}
        </dd>
      </div>
    </dl>
  );
}
