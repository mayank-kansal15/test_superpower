const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value);
}

export function endOfDayInZone(dateOnly: string, timeZone: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, 23, 59, 59, 999);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]),
  );
  const reconstructed = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
    999,
  );

  const offset = reconstructed - guess;
  return new Date(guess - offset);
}
