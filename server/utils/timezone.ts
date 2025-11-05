// Timezone utility for West Coast (Pacific Time)
export function getPacificDate(date?: Date): string {
  const targetDate = date || new Date();

  // Convert to Pacific Time and format as YYYY-MM-DD
  const pacificTimeString = targetDate.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  });

  // Parse the localized string (format: MM/DD/YYYY, HH:MM:SS)
  const [datePart] = pacificTimeString.split(', ');
  const [month, day, year] = datePart.split('/');

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