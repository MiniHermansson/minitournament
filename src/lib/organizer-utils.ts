export function isOrganizer(
  tournament: { organizerId: string; coOrganizerId?: string | null },
  userId: string
): boolean {
  return tournament.organizerId === userId || tournament.coOrganizerId === userId;
}
