import { Suspense } from "react";
import DepositsPage from "@/components/pages/DepositsPage";

export default function TransactionsRoutePage() {
  return (
    <Suspense fallback={<div className="page-header"><div className="page-title">Yükleniyor…</div></div>}>
      <DepositsPage />
    </Suspense>
  );
}
