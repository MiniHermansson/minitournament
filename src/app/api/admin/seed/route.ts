import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-utils";
import { z } from "zod";

export const runtime = "nodejs";

const ROLES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FILL"] as const;

const seedSchema = z.object({
  tournamentId: z.string().min(1),
  count: z.number().int().min(1).max(50).default(10),
});

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { tournamentId, count } = seedSchema.parse(body);

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }
    if (tournament.teamMode !== "CAPTAINS_DRAFT") {
      return NextResponse.json({ error: "Tournament is not a captains draft" }, { status: 400 });
    }
    if (tournament.status !== "REGISTRATION") {
      return NextResponse.json({ error: "Tournament must be in REGISTRATION status" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash("testpass123", 12);
    const created: { id: string; name: string; email: string }[] = [];
    let signedUp = 0;

    for (let i = 1; i <= count; i++) {
      const email = `testplayer${i}@test.local`;
      const name = `Test Player ${i}`;

      // Create user if not exists
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: { name, email, password: hashedPassword },
        });
        created.push({ id: user.id, name: user.name!, email: user.email });
      }

      // Sign up for tournament if not already signed up
      const existing = await prisma.playerSignup.findUnique({
        where: { tournamentId_userId: { tournamentId, userId: user.id } },
      });

      if (!existing) {
        const role = ROLES[i % ROLES.length];
        const secondary = role === "FILL" ? null : ROLES[(i + 2) % ROLES.length] || null;
        await prisma.playerSignup.create({
          data: {
            tournamentId,
            userId: user.id,
            mainRole: role,
            secondaryRole: secondary === role ? null : secondary,
            discordName: `TestPlayer#${String(i).padStart(4, "0")}`,
            wantsCaptain: i <= 2, // First 2 players want to be captains
          },
        });
        signedUp++;
      }
    }

    return NextResponse.json({
      message: `Created ${created.length} users, signed up ${signedUp} players`,
      created,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Seed error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
