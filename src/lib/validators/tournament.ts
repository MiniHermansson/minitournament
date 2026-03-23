import { z } from "zod";

const singleEliminationConfig = z.object({
  bestOf: z.enum(["1", "3", "5"]).transform(Number),
});

const doubleEliminationConfig = z.object({
  bestOf: z.enum(["1", "3", "5"]).transform(Number),
});

const roundRobinConfig = z.object({
  bestOf: z.enum(["1", "3", "5"]).transform(Number),
  pointsForWin: z.number().int().min(0).default(3),
  pointsForDraw: z.number().int().min(0).default(1),
});

const groupStageConfig = z.object({
  groupCount: z.number().int().min(2).max(16),
  bestOf: z.enum(["1", "3", "5"]).transform(Number),
  pointsForWin: z.number().int().min(0).default(3),
  pointsForDraw: z.number().int().min(0).default(1),
});

const groupStagePlayoffConfig = groupStageConfig.extend({
  advancingPerGroup: z.number().int().min(1).max(8).default(2),
  playoffBestOf: z.enum(["1", "3", "5"]).transform(Number),
});

export const formatConfigSchemas: Record<string, z.ZodType> = {
  SINGLE_ELIMINATION: singleEliminationConfig,
  DOUBLE_ELIMINATION: doubleEliminationConfig,
  ROUND_ROBIN: roundRobinConfig,
  GROUP_STAGE: groupStageConfig,
  GROUP_STAGE_PLAYOFF: groupStagePlayoffConfig,
};

export const createTournamentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(2000).optional(),
  format: z.enum([
    "SINGLE_ELIMINATION",
    "DOUBLE_ELIMINATION",
    "ROUND_ROBIN",
    "GROUP_STAGE",
    "GROUP_STAGE_PLAYOFF",
  ]),
  teamMode: z.enum(["PRE_MADE", "CAPTAINS_DRAFT"]).default("PRE_MADE"),
  maxTeams: z.number().int().min(2).max(128).default(16),
  minTeams: z.number().int().min(2).max(128).default(2),
  teamSize: z.number().int().min(1).max(10).default(5),
  registrationOpen: z.string().datetime().optional(),
  registrationClose: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  formatConfig: z.record(z.string(), z.unknown()).optional(),
});

export const updateTournamentSchema = createTournamentSchema.partial();

export const updateRegistrationSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
});

export const playerSignupSchema = z.object({
  mainRole: z.enum(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FILL"]),
  secondaryRole: z.enum(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FILL"]).optional(),
  wantsCaptain: z.boolean().default(false),
  opGgLink: z.string().url("Invalid URL").optional().or(z.literal("")),
  discordName: z.string().min(1, "Discord username is required"),
}).refine(
  (data) => data.mainRole === "FILL" || data.secondaryRole != null,
  { message: "Secondary role is required", path: ["secondaryRole"] }
);

export const draftPickSchema = z.object({
  userId: z.string().min(1),
});
