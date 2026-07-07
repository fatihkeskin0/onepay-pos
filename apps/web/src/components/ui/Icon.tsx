import { NavIcon } from "@/components/NavIcon";

export type IconName =
  | "pending"
  | "check"
  | "x"
  | "card"
  | "chart"
  | "online"
  | "calendar"
  | "chat"
  | "close"
  | "success"
  | "reject"
  | "globe"
  | "receipt"
  | "bank"
  | "sync"
  | "report"
  | "shield"
  | "lock"
  | string;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

const navMap: Record<string, string> = {
  card: "adm-dep",
  globe: "adm-siteler",
  receipt: "adm-site-mutabakat",
  bank: "adm-pos",
  report: "adm-raporlar",
  chart: "adm-raporlar",
  online: "adm-monitor",
};

export function Icon({ name, size = 24, className = "" }: IconProps) {
  const navId = navMap[name];
  if (navId) {
    return (
      <span className={`icon-wrap ${className}`.trim()}>
        <NavIcon id={navId} active size={size} />
      </span>
    );
  }

  const stroke = "currentColor";
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (name) {
    case "pending":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "check":
    case "success":
      return (
        <svg {...common}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "x":
    case "reject":
    case "close":
      return (
        <svg {...common}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
