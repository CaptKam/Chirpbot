// Timezone utility for West Coast (Pacific Time)
export function getPacificDate(date?: Date): string {
  const targetDate = date || new Date();

  // Use Intl.DateTimeFormat to get Pacific Time date string
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(targetDate);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';

  return `${year}-${month}-${day}`;
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