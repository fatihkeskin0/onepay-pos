"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useClientSession } from "@/hooks/useClientSession";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Message {
  id: number;
  sender: string;
  senderName: string;
  message: string;
  createdAt: string;
}

interface CashierOption {
  id: number;
  username: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const { ready, isAdmin } = useClientSession();

  const [cashiers, setCashiers] = useState<CashierOption[]>([]);
  const [selectedCashierId, setSelectedCashierId] = useState<number | null>(null);
  const [unreadMap, setUnreadMap] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!ready || !open || !isAdmin) return;
    const loadList = async () => {
      try {
        const data = await API.get<{
          cashiers: CashierOption[];
          unread: { cashierId: number; _count: number }[];
        }>("/admin/chat_list");
        setCashiers(data.cashiers);
        const map: Record<number, number> = {};
        for (const u of data.unread) map[u.cashierId] = u._count;
        setUnreadMap(map);
        if (!selectedCashierId && data.cashiers.length > 0) {
          setSelectedCashierId(data.cashiers[0].id);
        }
      } catch {
        /* ignore */
      }
    };
    loadList();
    const id = setInterval(loadList, 5000);
    return () => clearInterval(id);
  }, [open, isAdmin, selectedCashierId, ready]);

  useEffect(() => {
    if (!ready || !open) return;

    const load = async () => {
      try {
        if (isAdmin && selectedCashierId) {
          const data = await API.get<{ messages: Message[] }>(`/admin/chat?cashier_id=${selectedCashierId}`);
          setMessages(data.messages);
        } else if (!isAdmin) {
          const data = await API.get<{ messages: Message[] }>("/cashier/chat");
          setMessages(data.messages);
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [open, isAdmin, selectedCashierId, ready]);

  const send = async () => {
    if (!text.trim()) return;
    try {
      if (isAdmin && selectedCashierId) {
        await API.post("/admin/chat", { cashier_id: selectedCashierId, message: text });
      } else {
        await API.post("/cashier/chat", { message: text });
      }
      setText("");
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button type="button" className="chat-fab" onClick={() => setOpen(!open)} aria-label="Chat">
        <Icon name="chat" size={22} />
      </button>
      {open ? (
        <div className="chat-panel">
          <div className="chat-panel-head">
            {ready ? (isAdmin ? "Agent Chat" : "Admin Chat") : "Chat"}
          </div>
          {ready && isAdmin ? (
            <div className="chat-agent-tabs">
              {cashiers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`btn btn-sm ${selectedCashierId === c.id ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setSelectedCashierId(c.id)}
                >
                  {c.username}
                  {(unreadMap[c.id] ?? 0) > 0 ? (
                    <span className="chat-unread">{unreadMap[c.id]}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          <div className="chat-messages">
            {messages.map((m) => (
              <div key={m.id} className="chat-msg">
                <strong>{m.senderName}:</strong> {m.message}
              </div>
            ))}
          </div>
          <div className="chat-compose">
            <Input
              className="chat-compose-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Mesaj..."
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <Button variant="primary" onClick={send}>
              Gönder
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
