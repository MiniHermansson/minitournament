"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PlayerRoleBadge } from "./player-role-badge";

interface Member {
  id: string;
  role: string;
  summonerName: string | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface RosterTableProps {
  members: Member[];
  isOwner: boolean;
  onRemove?: (memberId: string) => void;
}

export function RosterTable({ members, isOwner, onRemove }: RosterTableProps) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No members yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Player</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Summoner Name</TableHead>
          {isOwner && <TableHead className="w-20" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage
                    src={member.user.image ?? undefined}
                    alt={member.user.name ?? ""}
                  />
                  <AvatarFallback className="text-xs">
                    {member.user.name?.[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {member.user.name ?? "Unknown"}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <PlayerRoleBadge role={member.role} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {member.summonerName ?? "—"}
            </TableCell>
            {isOwner && (
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onRemove?.(member.id)}
                >
                  Remove
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
