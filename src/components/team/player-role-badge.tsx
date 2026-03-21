import { Badge } from "@/components/ui/badge";

const roleConfig: Record<string, { label: string; className: string }> = {
  TOP: { label: "Top", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  JUNGLE: { label: "Jungle", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  MID: { label: "Mid", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ADC: { label: "ADC", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  SUPPORT: { label: "Support", className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
  SUBSTITUTE: { label: "Sub", className: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};

export function PlayerRoleBadge({ role }: { role: string }) {
  const config = roleConfig[role] ?? { label: role, className: "" };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
