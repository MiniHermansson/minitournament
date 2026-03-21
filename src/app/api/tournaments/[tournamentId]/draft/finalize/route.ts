import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { tournamentId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (tournament.organizerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (tournament.status !== "DRAFTING") {
    return NextResponse.json({ error: "Tournament is not in drafting status" }, { status: 400 });
  }

  const draftState = await prisma.draftState.findUnique({
    where: { tournamentId },
    include: {
      captains: {
        include: { user: { select: { id: true, name: true } } },
      },
      picks: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { pickNumber: "asc" },
      },
    },
  });

  if (!draftState) {
    return NextResponse.json({ error: "Draft not initialized" }, { status: 400 });
  }

  const totalPicks = draftState.totalTeams * 4;
  if (draftState.currentPick < totalPicks) {
    return NextResponse.json(
      { error: `Draft is not complete. ${totalPicks - draftState.currentPick} picks remaining.` },
      { status: 400 }
    );
  }

  // Get signups for role info
  const signups = await prisma.playerSignup.findMany({
    where: { tournamentId },
  });
  const signupByUser = new Map(signups.map((s) => [s.userId, s]));

  try {
    // Create teams in a transaction
    const teams = await prisma.$transaction(async (tx) => {
      const createdTeams = [];

      for (let teamNum = 1; teamNum <= draftState.totalTeams; teamNum++) {
        const captain = draftState.captains.find((c) => c.teamNumber === teamNum);
        if (!captain) continue;

        const teamPicks = draftState.picks.filter((p) => p.teamNumber === teamNum);

        // Create the team
        const team = await tx.team.create({
          data: {
            name: `Team ${teamNum}`,
            tag: `T${teamNum}`,
            ownerId: captain.userId,
          },
        });

        // Add captain as team member
        const captainSignup = signupByUser.get(captain.userId);
        await tx.teamMember.create({
          data: {
            teamId: team.id,
            userId: captain.userId,
            role: captainSignup?.mainRole === "FILL" ? "SUPPORT" : (captainSignup?.mainRole ?? "SUPPORT"),
            isPrimary: true,
          },
        });

        // Add drafted players as team members
        for (const pick of teamPicks) {
          const signup = signupByUser.get(pick.userId);
          await tx.teamMember.create({
            data: {
              teamId: team.id,
              userId: pick.userId,
              role: signup?.mainRole === "FILL" ? "SUBSTITUTE" : (signup?.mainRole ?? "SUBSTITUTE"),
              isPrimary: true,
            },
          });
        }

        // Auto-register team for the tournament
        await tx.tournamentRegistration.create({
          data: {
            tournamentId,
            teamId: team.id,
            status: "ACCEPTED",
            seed: teamNum,
          },
        });

        createdTeams.push(team);
      }

      // Move tournament back to REGISTRATION so bracket generation works
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "REGISTRATION" },
      });

      return createdTeams;
    });

    return NextResponse.json({
      success: true,
      teamsCreated: teams.length,
      teams: teams.map((t) => ({ id: t.id, name: t.name, tag: t.tag })),
    });
  } catch (err) {
    console.error("Draft finalize error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
