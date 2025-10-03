// Timezone utility for West Coast (Pacific Time)
export function getPacificDate(date?: Date): string {
  const targetDate = date || new Date();
  
  // Use Intl.DateTimeFormat to get Pacific Time components
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
  const now = new Date();
  
  // Get Pacific Time components using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
  
  // Create Date in UTC, then adjust to represent Pacific time
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

export function formatPacificTime(date?: Date): string {
  const targetDate = date || new Date();
  return targetDate.toLocaleString("en-US", { 
    timeZone: "America/Los_Angeles",
    dateStyle: 'short',
    timeStyle: 'short'
  });
}