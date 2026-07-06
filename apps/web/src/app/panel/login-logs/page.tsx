"use client";

import GenericTablePage from "@/components/GenericTablePage";

export default function LoginLogsPage() {
  return (
    <GenericTablePage
      title="Giriş Kayıtları"
      subtitle="Panel oturum logları"
      endpoint="/admin/login_logs"
      dataKey="items"
      columns={[
        { key: "username", label: "Kullanıcı" },
        { key: "role", label: "Rol" },
        { key: "ip", label: "IP" },
        { key: "loggedInAt", label: "Giriş", render: (v) => new Date(String(v)).toLocaleString("tr-TR") },
      ]}
    />
  );
}
