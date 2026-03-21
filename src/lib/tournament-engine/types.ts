export interface TeamWithSeed {
  teamId: string;
  seed: number;
}

export interface GameResult {
  gameNumber: number;
  winnerId: string;
}

export interface GenerateOptions {
  tournamentId: string;
  teams: TeamWithSeed[];
  formatConfig: Record<string, unknown>;
}

export interface SubmitResultOptions {
  matchId: string;
  winnerId: string;
  games: GameResult[];
}

export interface Standing {
  teamId: string;
  groupId?: string;
  groupName?: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  rank: number;
}

export interface TournamentEngine {
  generate(options: GenerateOptions): Promise<void>;
  submitResult(options: SubmitResultOptions): Promise<void>;
  getStandings(tournamentId: string): Promise<Standing[]>;
}
