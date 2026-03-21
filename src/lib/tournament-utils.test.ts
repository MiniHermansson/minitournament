import { describe, it, expect } from "vitest";
import {
  nextPowerOf2,
  generateBracketSeeding,
  generateRoundRobinSchedule,
  getTeamForPick,
} from "./tournament-utils";

describe("nextPowerOf2", () => {
  it("returns 1 for 1", () => expect(nextPowerOf2(1)).toBe(1));
  it("returns 2 for 2", () => expect(nextPowerOf2(2)).toBe(2));
  it("returns 4 for 3", () => expect(nextPowerOf2(3)).toBe(4));
  it("returns 8 for 5", () => expect(nextPowerOf2(5)).toBe(8));
  it("returns 8 for 8", () => expect(nextPowerOf2(8)).toBe(8));
  it("returns 16 for 16", () => expect(nextPowerOf2(16)).toBe(16));
  it("returns 32 for 17", () => expect(nextPowerOf2(17)).toBe(32));
});

describe("generateBracketSeeding", () => {
  it("returns [1] for size 1", () => {
    expect(generateBracketSeeding(1)).toEqual([1]);
  });

  it("returns [1, 2] for size 2", () => {
    expect(generateBracketSeeding(2)).toEqual([1, 2]);
  });

  it("returns correct seeding for size 4", () => {
    const result = generateBracketSeeding(4);
    expect(result).toEqual([1, 4, 2, 3]);
  });

  it("places seed 1 and highest seed on opposite ends for size 8", () => {
    const result = generateBracketSeeding(8);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(8);
    expect(result.length).toBe(8);
    // All seeds 1-8 should be present
    expect([...result].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("returns correct seeding for size 16", () => {
    const result = generateBracketSeeding(16);
    expect(result.length).toBe(16);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(16);
    expect([...result].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1)
    );
  });
});

describe("generateRoundRobinSchedule", () => {
  it("schedules 4 teams in 3 rounds", () => {
    const schedule = generateRoundRobinSchedule(["A", "B", "C", "D"]);
    expect(schedule.length).toBe(3);
  });

  it("ensures every pair plays exactly once with 4 teams", () => {
    const schedule = generateRoundRobinSchedule(["A", "B", "C", "D"]);
    const pairs = new Set<string>();

    for (const round of schedule) {
      for (const [home, away] of round) {
        const key = [home, away].sort().join("-");
        expect(pairs.has(key)).toBe(false);
        pairs.add(key);
      }
    }

    // 4 teams = 6 unique pairs
    expect(pairs.size).toBe(6);
  });

  it("handles odd number of teams (3)", () => {
    const schedule = generateRoundRobinSchedule(["A", "B", "C"]);
    expect(schedule.length).toBe(3);

    const pairs = new Set<string>();
    for (const round of schedule) {
      for (const [home, away] of round) {
        const key = [home, away].sort().join("-");
        pairs.add(key);
      }
    }

    // 3 teams = 3 unique pairs
    expect(pairs.size).toBe(3);
  });

  it("handles 6 teams correctly", () => {
    const teams = ["A", "B", "C", "D", "E", "F"];
    const schedule = generateRoundRobinSchedule(teams);
    expect(schedule.length).toBe(5);

    const pairs = new Set<string>();
    for (const round of schedule) {
      for (const [home, away] of round) {
        const key = [home, away].sort().join("-");
        expect(pairs.has(key)).toBe(false);
        pairs.add(key);
      }
    }

    // 6 teams = 15 unique pairs
    expect(pairs.size).toBe(15);
  });

  it("does not include BYE in matches", () => {
    const schedule = generateRoundRobinSchedule(["A", "B", "C"]);
    for (const round of schedule) {
      for (const [home, away] of round) {
        expect(home).not.toBe("BYE");
        expect(away).not.toBe("BYE");
      }
    }
  });
});

describe("getTeamForPick (snake draft)", () => {
  it("assigns picks correctly for 2 teams", () => {
    // Round 1 (forward): T1, T2
    expect(getTeamForPick(1, 2)).toBe(1);
    expect(getTeamForPick(2, 2)).toBe(2);
    // Round 2 (reverse): T2, T1
    expect(getTeamForPick(3, 2)).toBe(2);
    expect(getTeamForPick(4, 2)).toBe(1);
    // Round 3 (forward): T1, T2
    expect(getTeamForPick(5, 2)).toBe(1);
    expect(getTeamForPick(6, 2)).toBe(2);
  });

  it("assigns picks correctly for 3 teams", () => {
    // Round 1 (forward): T1, T2, T3
    expect(getTeamForPick(1, 3)).toBe(1);
    expect(getTeamForPick(2, 3)).toBe(2);
    expect(getTeamForPick(3, 3)).toBe(3);
    // Round 2 (reverse): T3, T2, T1
    expect(getTeamForPick(4, 3)).toBe(3);
    expect(getTeamForPick(5, 3)).toBe(2);
    expect(getTeamForPick(6, 3)).toBe(1);
    // Round 3 (forward): T1, T2, T3
    expect(getTeamForPick(7, 3)).toBe(1);
    expect(getTeamForPick(8, 3)).toBe(2);
    expect(getTeamForPick(9, 3)).toBe(3);
  });

  it("produces balanced picks over 4 rounds with 3 teams", () => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (let pick = 1; pick <= 12; pick++) {
      counts[getTeamForPick(pick, 3)]++;
    }
    expect(counts[1]).toBe(4);
    expect(counts[2]).toBe(4);
    expect(counts[3]).toBe(4);
  });
});
