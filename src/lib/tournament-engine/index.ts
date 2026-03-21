import type { TournamentEngine } from "./types";
import { SingleEliminationEngine } from "./single-elimination";
import { DoubleEliminationEngine } from "./double-elimination";
import { RoundRobinEngine } from "./round-robin";
import { GroupStageEngine } from "./group-stage";

export function getEngine(format: string): TournamentEngine {
  switch (format) {
    case "SINGLE_ELIMINATION":
      return new SingleEliminationEngine();
    case "DOUBLE_ELIMINATION":
      return new DoubleEliminationEngine();
    case "ROUND_ROBIN":
      return new RoundRobinEngine();
    case "GROUP_STAGE":
      return new GroupStageEngine(false);
    case "GROUP_STAGE_PLAYOFF":
      return new GroupStageEngine(true);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

export type { TournamentEngine, TeamWithSeed, GenerateOptions, SubmitResultOptions, Standing, GameResult } from "./types";
