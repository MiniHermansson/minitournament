import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be at most 50 characters"),
  image: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional(),
});

export const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE MY ACCOUNT", {
    message: 'You must type "DELETE MY ACCOUNT" to confirm',
  }),
});
