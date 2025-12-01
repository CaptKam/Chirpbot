
// Timezone utility for West Coast (Pacific Time)
export function getPacificDate(date?: Date): string {
  const targetDate = date || new Date();

  // Use toLocaleString with Pacific timezone to get the date components
  const pacificDateStr = targetDate.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Parse the MM/DD/YYYY format
  const [month, day, year] = pacificDateStr.split('/');

  // Return in YYYY-MM-DD format
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function getPacificDateTime(): Date {
  // Simply return current date/time - Date object is already timezone-aware
  return new Date();
}

export function formatPacificTime(date?: Date): string {
  const targetDate = date || new Date();
  return targetDate.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: 'short',
    timeStyle: 'short'
  });
}
