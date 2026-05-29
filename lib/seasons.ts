export const MIN_SEASON_NUMBER = 0;
export const MAX_SEASON_NUMBER = 12;

export function seasonLabel(seasonNumber: number) {
  return `Season ${seasonNumber}`;
}

export function isValidSeasonNumber(seasonNumber: number) {
  return (
    Number.isInteger(seasonNumber) &&
    seasonNumber >= MIN_SEASON_NUMBER &&
    seasonNumber <= MAX_SEASON_NUMBER
  );
}

export function listSeasonOptions() {
  return Array.from({ length: MAX_SEASON_NUMBER - MIN_SEASON_NUMBER + 1 }, (_, index) => {
    const seasonNumber = MIN_SEASON_NUMBER + index;
    const label = seasonLabel(seasonNumber);
    return { label, value: label };
  });
}
