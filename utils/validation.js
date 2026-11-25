// Shared checks for values sent to the API.

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const DURATIONS = [30, 60];

// Returns the value as a whole number if it is at least min, otherwise null.
export const toWholeNumber = (value, min = 1) => {
  if (!/^\d+$/.test(String(value))) return null;
  const number = Number(value);
  return number >= min ? number : null;
};

// A start time must be a full date and time with a time zone, e.g. 2026-11-20T18:00:00Z
export const toStartTime = (value) => {
  if (typeof value !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  // Reject dates that do not exist, e.g. 30 February (JavaScript would move it to March)
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);
