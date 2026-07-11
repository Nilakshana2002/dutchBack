/**
 * Returns a Date object representing the start of the current day (or given date) in Sri Lanka (+05:30) timezone.
 */
export const getStartOfTodaySL = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const year = parts.find(p => p.type === 'year').value;
    return new Date(`${year}-${month}-${day}T00:00:00.000+05:30`);
};

/**
 * Returns a Date object representing the end of the current day (or given date) in Sri Lanka (+05:30) timezone.
 */
export const getEndOfTodaySL = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const year = parts.find(p => p.type === 'year').value;
    return new Date(`${year}-${month}-${day}T23:59:59.999+05:30`);
};
