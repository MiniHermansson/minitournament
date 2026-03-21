import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters").max(50),
  tag: z
    .string()
    .min(2, "Tag must be at least 2 characters")
    .max(5, "Tag must be at most 5 characters")
    .toUpperCase(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

export const updateTeamSchema = createTeamSchema.partial();

export const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "SUBSTITUTE"]),
  summonerName: z.string().optional(),
});

export const updateMemberSchema = z.object({
  role: z.enum(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "SUBSTITUTE"]).optional(),
  summonerName: z.string().optional(),
});
