"use client";

import GenericTablePage from "@/components/GenericTablePage";

export default function SuspiciousPage() {
  return (
    <GenericTablePage
      title="Şüpheli İşlemler"
      subtitle="Anomali flag'li yatırımlar"
      endpoint="/admin/supheliler"
      dataKey="items"
      columns={[
        { key: "reference", label: "Ref" },
        { key: "userId", label: "User" },
        { key: "amount", label: "Tutar" },
        { key: "suspiciousReason", label: "Sebep" },
      ]}
    />
  );
}
