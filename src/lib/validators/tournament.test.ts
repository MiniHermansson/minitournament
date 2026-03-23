import { describe, it, expect } from "vitest";
import { createTournamentSchema, playerSignupSchema } from "./tournament";

describe("createTournamentSchema", () => {
  const validInput = {
    name: "Summer Cup 2026",
    format: "SINGLE_ELIMINATION",
  };

  it("accepts valid minimal input with defaults", () => {
    const result = createTournamentSchema.parse(validInput);
    expect(result.name).toBe("Summer Cup 2026");
    expect(result.format).toBe("SINGLE_ELIMINATION");
    expect(result.teamMode).toBe("PRE_MADE");
    expect(result.maxTeams).toBe(16);
    expect(result.minTeams).toBe(2);
    expect(result.teamSize).toBe(5);
  });

  it("accepts all valid formats", () => {
    const formats = [
      "SINGLE_ELIMINATION",
      "DOUBLE_ELIMINATION",
      "ROUND_ROBIN",
      "GROUP_STAGE",
      "GROUP_STAGE_PLAYOFF",
    ];
    for (const format of formats) {
      expect(() =>
        createTournamentSchema.parse({ ...validInput, format })
      ).not.toThrow();
    }
  });

  it("rejects name shorter than 2 characters", () => {
    expect(() =>
      createTournamentSchema.parse({ ...validInput, name: "A" })
    ).toThrow();
  });

  it("rejects invalid format", () => {
    expect(() =>
      createTournamentSchema.parse({ ...validInput, format: "BATTLE_ROYALE" })
    ).toThrow();
  });

  it("rejects invalid teamMode", () => {
    expect(() =>
      createTournamentSchema.parse({ ...validInput, teamMode: "RANDOM" })
    ).toThrow();
  });

  it("accepts CAPTAINS_DRAFT teamMode", () => {
    const result = createTournamentSchema.parse({
      ...validInput,
      teamMode: "CAPTAINS_DRAFT",
    });
    expect(result.teamMode).toBe("CAPTAINS_DRAFT");
  });

  it("rejects maxTeams below 2", () => {
    expect(() =>
      createTournamentSchema.parse({ ...validInput, maxTeams: 1 })
    ).toThrow();
  });

  it("rejects maxTeams above 128", () => {
    expect(() =>
      createTournamentSchema.parse({ ...validInput, maxTeams: 200 })
    ).toThrow();
  });
});

describe("playerSignupSchema", () => {
  const validSignup = {
    mainRole: "MID",
    secondaryRole: "SUPPORT",
    discordName: "player#1234",
    wantsCaptain: false,
  };

  it("accepts valid signup", () => {
    const result = playerSignupSchema.parse(validSignup);
    expect(result.mainRole).toBe("MID");
    expect(result.discordName).toBe("player#1234");
    expect(result.secondaryRole).toBe("SUPPORT");
  });

  it("accepts all valid roles", () => {
    const roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
    for (const role of roles) {
      expect(() =>
        playerSignupSchema.parse({ ...validSignup, mainRole: role })
      ).not.toThrow();
    }
    // FILL doesn't need secondaryRole
    expect(() =>
      playerSignupSchema.parse({ ...validSignup, mainRole: "FILL", secondaryRole: undefined })
    ).not.toThrow();
  });

  it("rejects invalid role", () => {
    expect(() =>
      playerSignupSchema.parse({ ...validSignup, mainRole: "TANK" })
    ).toThrow();
  });

  it("rejects missing discordName", () => {
    expect(() =>
      playerSignupSchema.parse({ mainRole: "MID", secondaryRole: "SUPPORT", wantsCaptain: false })
    ).toThrow();
  });

  it("rejects non-FILL role without secondary role", () => {
    expect(() =>
      playerSignupSchema.parse({
        mainRole: "MID",
        discordName: "player#1234",
        wantsCaptain: false,
      })
    ).toThrow();
  });

  it("accepts FILL with no secondary role", () => {
    const result = playerSignupSchema.parse({
      ...validSignup,
      mainRole: "FILL",
      secondaryRole: undefined,
    });
    expect(result.mainRole).toBe("FILL");
    expect(result.secondaryRole).toBeUndefined();
  });

  it("accepts valid secondary role", () => {
    const result = playerSignupSchema.parse({
      ...validSignup,
      secondaryRole: "SUPPORT",
    });
    expect(result.secondaryRole).toBe("SUPPORT");
  });

  it("rejects invalid opGgLink URL", () => {
    expect(() =>
      playerSignupSchema.parse({
        ...validSignup,
        opGgLink: "not-a-url",
      })
    ).toThrow();
  });

  it("accepts valid opGgLink URL", () => {
    const result = playerSignupSchema.parse({
      ...validSignup,
      opGgLink: "https://www.op.gg/summoners/euw/Player-1234",
    });
    expect(result.opGgLink).toBe("https://www.op.gg/summoners/euw/Player-1234");
  });

  it("accepts empty opGgLink", () => {
    expect(() =>
      playerSignupSchema.parse({ ...validSignup, opGgLink: "" })
    ).not.toThrow();
  });
});
