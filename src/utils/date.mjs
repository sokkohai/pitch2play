/**
 * Date utility functions.
 * Functions for date formatting and manipulation.
 */

/**
 * Formats a date as YYYY-MM-DD.
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatYYYYMMDD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formats a date as YYYY-MM.
 * @param {Date} date - Date to format
 * @returns {string} Formatted month string
 */
export function formatYYYYMM(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

/**
 * Gets the last Sunday (00:00:00) from the given date.
 * @param {Date} date - Reference date
 * @returns {Date} Last Sunday at midnight
 */
export function getLastSunday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1-6 = Mon-Sat
  const diff = day; // Days since last Sunday
  const sunday = new Date(d);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(sunday.getDate() - diff);
  return sunday;
}

/**
 * Gets the first day of the month for the given date.
 * @param {Date} date - Reference date
 * @returns {Date} First day of month at midnight
 */
export function getFirstDayOfMonth(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

/**
 * Calculates the difference between two dates in milliseconds.
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} Difference in milliseconds
 */
export function diffMs(date1, date2) {
  return Math.abs(date1.getTime() - date2.getTime());
}
