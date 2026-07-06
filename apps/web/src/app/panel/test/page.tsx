"use client";

import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

export default function TestPage() {
  const { notify } = useToast();

  const testLoad = async () => {
    try {
      await API.post("/admin/test_load");
      notify("Test yüklendi", "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Test İşlemleri</div>
          <div className="page-sub">Geliştirme test araçları</div>
        </div>
      </div>
      <div className="card">
        <button type="button" className="btn btn-primary" onClick={testLoad}>
          Test Load
        </button>
      </div>
    </>
  );
}
