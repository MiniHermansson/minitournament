/**
 * Returns the next power of 2 >= n.
 */
export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Generate standard tournament seeding positions.
 * For a bracket of size N, returns array of seed positions [1..N]
 * such that seed 1 plays the lowest seed, etc.
 */
export function generateBracketSeeding(size: number): number[] {
  if (size === 1) return [1];
  if (size === 2) return [1, 2];

  let seeds = [1, 2];
  while (seeds.length < size) {
    const nextRoundSize = seeds.length * 2;
    const newSeeds: number[] = [];
    for (const seed of seeds) {
      newSeeds.push(seed);
      newSeeds.push(nextRoundSize + 1 - seed);
    }
    seeds = newSeeds;
  }

  return seeds;
}

/**
 * Circle method for round-robin scheduling.
 * Handles both even and odd team counts (adds a BYE for odd).
 */
export function generateRoundRobinSchedule(teamIds: string[]): [string, string][][] {
  const teams = [...teamIds];
  const isOdd = teams.length % 2 !== 0;

  if (isOdd) teams.push("BYE");

  const n = teams.length;
  const rounds = n - 1;
  const halfSize = n / 2;
  const schedule: [string, string][][] = [];

  const fixedTeam = teams[0];
  const rotating = teams.slice(1);

  for (let round = 0; round < rounds; round++) {
    const roundMatches: [string, string][] = [];

    const opponent = rotating[0];
    if (fixedTeam !== "BYE" && opponent !== "BYE") {
      roundMatches.push([fixedTeam, opponent]);
    }

    for (let i = 1; i < halfSize; i++) {
      const home = rotating[i];
      const away = rotating[rotating.length - i];
      if (home !== "BYE" && away !== "BYE") {
        roundMatches.push([home, away]);
      }
    }

    schedule.push(roundMatches);
    rotating.unshift(rotating.pop()!);
  }

  return schedule;
}

/**
 * Determines which team picks next in a snake draft.
 * Odd rounds: teams pick in order 1→N.
 * Even rounds: teams pick in reverse order N→1.
 */
export function getTeamForPick(pickNumber: number, totalTeams: number): number {
  const round = Math.ceil(pickNumber / totalTeams);
  const posInRound = (pickNumber - 1) % totalTeams;
  return round % 2 === 1 ? posInRound + 1 : totalTeams - posInRound;
}
