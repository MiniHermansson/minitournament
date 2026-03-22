"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: string;
  image: string | null;
  createdAt: string;
  hasPassword: boolean;
  providers: string[];
}

const roleBadgeStyles: Record<string, string> = {
  USER: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  ADMIN: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  SUPER_ADMIN: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Dialog state
  const [dialogType, setDialogType] = useState<"password" | "email" | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Seed state
  const [seedTournamentId, setSeedTournamentId] = useState("");
  const [seedCount, setSeedCount] = useState(10);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  const userRole = (session?.user as Record<string, unknown> | undefined)?.role as string | undefined;
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const fetchUsers = useCallback(async () => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/admin/users${params}`);
    if (res.status === 403) {
      router.push("/dashboard");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }, [search, router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const openDialog = (user: UserData, type: "password" | "email") => {
    setSelectedUser(user);
    setDialogType(type);
    setDialogValue("");
  };

  const handleDialogSubmit = async () => {
    if (!selectedUser || !dialogType) return;
    setSubmitting(true);

    const body =
      dialogType === "password"
        ? { action: "resetPassword", newPassword: dialogValue }
        : { action: "changeEmail", newEmail: dialogValue };

    const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
    } else {
      toast.success(
        dialogType === "password"
          ? `Password reset for ${selectedUser.name || selectedUser.email}`
          : `Email changed to ${dialogValue}`
      );
      setDialogType(null);
      fetchUsers();
    }
    setSubmitting(false);
  };

  const handleSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setSeeding(true);
    setSeedResult(null);

    const res = await fetch("/api/admin/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: seedTournamentId, count: seedCount }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
    } else {
      toast.success(data.message);
      setSeedResult(data.message);
      fetchUsers();
    }
    setSeeding(false);
  };

  const handleToggleRole = async (user: UserData) => {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "changeRole", role: newRole }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
    } else {
      toast.success(`${user.name || user.email} is now ${newRole}`);
      fetchUsers();
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted mb-6" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
      <p className="text-muted-foreground mb-8">Manage users and permissions</p>

      {/* Seed Test Players */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Seed Test Players</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Create dummy users and sign them up for a captains draft tournament for testing.
            Password for all test users: <code className="bg-muted px-1 py-0.5 rounded">testpass123</code>
          </p>
          <form onSubmit={handleSeed} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="seedTournamentId" className="sr-only">Tournament ID</Label>
              <Input
                id="seedTournamentId"
                value={seedTournamentId}
                onChange={(e) => setSeedTournamentId(e.target.value)}
                placeholder="Tournament ID (from URL)"
                required
              />
            </div>
            <div className="w-24">
              <Label htmlFor="seedCount" className="sr-only">Count</Label>
              <Input
                id="seedCount"
                type="number"
                value={seedCount}
                onChange={(e) => setSeedCount(Number(e.target.value))}
                min={1}
                max={50}
              />
            </div>
            <Button type="submit" disabled={seeding}>
              {seeding ? "Seeding..." : "Seed Players"}
            </Button>
          </form>
          {seedResult && (
            <p className="text-sm text-green-500 mt-3">{seedResult}</p>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1"
        />
        <Button type="submit">Search</Button>
        {search && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearch("");
              setSearchInput("");
            }}
          >
            Clear
          </Button>
        )}
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No users found.
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {user.name || "No name"}
                      </p>
                      <Badge
                        variant="outline"
                        className={roleBadgeStyles[user.role] ?? ""}
                      >
                        {user.role.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {user.email}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {user.providers.map((p) => (
                        <span
                          key={p}
                          className="text-xs bg-muted px-1.5 py-0.5 rounded"
                        >
                          {p}
                        </span>
                      ))}
                      {user.hasPassword && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          credentials
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {user.hasPassword && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog(user, "password")}
                      >
                        Reset Password
                      </Button>
                    )}
                    {!user.providers.includes("discord") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog(user, "email")}
                      >
                        Change Email
                      </Button>
                    )}
                    {isSuperAdmin && user.role !== "SUPER_ADMIN" && (
                      <Button
                        size="sm"
                        variant={user.role === "ADMIN" ? "destructive" : "default"}
                        onClick={() => handleToggleRole(user)}
                      >
                        {user.role === "ADMIN" ? "Remove Admin" : "Make Admin"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Password / Change Email Dialog */}
      <Dialog
        open={dialogType !== null}
        onOpenChange={(open) => {
          if (!open) setDialogType(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "password" ? "Reset Password" : "Change Email"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "password"
                ? `Set a new password for ${selectedUser?.name || selectedUser?.email}`
                : `Change email for ${selectedUser?.name || selectedUser?.email}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="dialogInput">
              {dialogType === "password" ? "New Password" : "New Email"}
            </Label>
            <Input
              id="dialogInput"
              type={dialogType === "password" ? "password" : "email"}
              value={dialogValue}
              onChange={(e) => setDialogValue(e.target.value)}
              placeholder={
                dialogType === "password"
                  ? "Enter new password (min 6 chars)"
                  : "Enter new email address"
              }
              minLength={dialogType === "password" ? 6 : undefined}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                submitting ||
                (dialogType === "password" && dialogValue.length < 6) ||
                (dialogType === "email" && !dialogValue.includes("@"))
              }
              onClick={handleDialogSubmit}
            >
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
