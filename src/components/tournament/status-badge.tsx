import { Badge } from "@/components/ui/badge";

const statusStyles: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  REGISTRATION: { label: "Registration Open", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  DRAFTING: { label: "Drafting", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  COMPLETED: { label: "Completed", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  CANCELLED: { label: "Cancelled", className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusStyles[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
