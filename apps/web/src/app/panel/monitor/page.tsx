"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";

interface Agent {
  id: number;
  username: string;
  lastSeenAt: string | null;
  online: boolean;
}

export default function MonitorPage() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await API.get<{ agents: Agent[] }>("/admin/agent_monitor");
      setAgents(data.agents);
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Canlı İzleme</div>
          <div className="page-sub">Agent online durumu</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Durum</th>
              <th>Son Görülme</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td>
                  <span className={`badge ${a.online ? "badge-approved" : "badge-cancelled"}`}>
                    {a.online ? "Online" : "Offline"}
                  </span>
                </td>
                <td>{a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString("tr-TR") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
