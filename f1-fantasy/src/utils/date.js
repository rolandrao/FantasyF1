// src/utils/date.js

export const formatToNYTime = (dateStr, timeStr) => {
    if (!dateStr) return { date: 'TBD', time: 'TBD', raw: new Date() }

    // 1. Construct a valid ISO UTC string (e.g., "2025-03-16T14:00:00Z")
    // Ergast API usually sends time ending in 'Z'. If not, we append it to assume UTC.
    let isoString = dateStr
    if (timeStr) {
        const cleanTime = timeStr.trim()
        const timePart = cleanTime.endsWith('Z') || cleanTime.includes('+') ? cleanTime : `${cleanTime}Z`
        isoString = `${dateStr}T${timePart}`
    }

    const dateObj = new Date(isoString)

    // 2. Format Date (e.g. "Sun, Mar 16")
    // This automatically handles date rollovers (UK Sunday -> NY Saturday)
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    })

    // 3. Format Time (e.g. "10:00 AM")
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    })

    return {
        date: dateFormatter.format(dateObj),
        time: timeStr ? timeFormatter.format(dateObj) : 'TBD',
        raw: dateObj // Use this for "isFuture" logic comparisons
    }
}