import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isOrganizer } from "@/lib/auth-utils";
import { resolveActiveTournamentId } from "@/lib/active-tournament";

export const runtime = "nodejs";

export async function POST() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const tournamentId = await resolveActiveTournamentId();
  if (!tournamentId) {
    return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (!isOrganizer(tournament, session!.user.id)) {
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

  const signups = await prisma.playerSignup.findMany({
    where: { tournamentId },
  });
  const signupByUser = new Map(signups.map((s) => [s.userId, s]));

  try {
    const teams = await prisma.$transaction(async (tx) => {
      const createdTeams = [];

      for (let teamNum = 1; teamNum <= draftState.totalTeams; teamNum++) {
        const captain = draftState.captains.find((c) => c.teamNumber === teamNum);
        if (!captain) continue;

        const teamPicks = draftState.picks.filter((p) => p.teamNumber === teamNum);

        const team = await tx.team.create({
          data: {
            name: `Team ${teamNum}`,
            tag: `T${teamNum}`,
            ownerId: captain.userId,
          },
        });

        const captainSignup = signupByUser.get(captain.userId);
        await tx.teamMember.create({
          data: {
            teamId: team.id,
            userId: captain.userId,
            role: captainSignup?.mainRole === "FILL" ? "SUPPORT" : (captainSignup?.mainRole ?? "SUPPORT"),
            isPrimary: true,
          },
        });

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
