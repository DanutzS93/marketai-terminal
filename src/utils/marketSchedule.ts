export interface MarketStatusInfo {
  isClosed: boolean;
  userTimezone: string;
  userTimezoneShort: string;
  currentLocalTimeStr: string;
  nextOpenTimeStrRo: string;
  nextOpenTimeStrEn: string;
  reasonRo: string;
  reasonEn: string;
}

export function getMarketScheduleStatus(customDate?: Date): MarketStatusInfo {
  const now = customDate || new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hours = now.getHours();

  // Trading window: Monday 01:00 AM to Friday midnight (Saturday 00:00)
  // Closed: Saturday (6), Sunday (0), or Monday (1) before 01:00 AM (hours < 1)
  const isClosed = day === 6 || day === 0 || (day === 1 && hours < 1);

  // User local timezone detection
  let timezoneName = '';
  try {
    timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (e) {
    timezoneName = '';
  }

  const offsetMinutes = -now.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetMins = Math.abs(offsetMinutes) % 60;
  const offsetSign = offsetMinutes >= 0 ? '+' : '-';
  const gmtOffsetStr = `UTC/GMT${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')}`;

  const userTimezoneStr = timezoneName ? `${timezoneName} (${gmtOffsetStr})` : gmtOffsetStr;
  const userTimezoneShort = timezoneName ? timezoneName.split('/').pop()?.replace(/_/g, ' ') || gmtOffsetStr : gmtOffsetStr;

  // Calculate next Monday 01:00 AM local time
  const nextMonday = new Date(now);
  let daysUntilMonday = (1 + 7 - day) % 7;
  if (daysUntilMonday === 0 && hours >= 1) {
    daysUntilMonday = 7; // next week
  }
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(1, 0, 0, 0);

  const currentLocalTimeStr = now.toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  const nextOpenTimeStrRo = nextMonday.toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  const nextOpenTimeStrEn = nextMonday.toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const reasonRo = `Piața este închisă. Perioada de tranzacționare live este de Luni ora 01:00 până Vineri la miezul nopții. Generarea de semnale live se va relua Luni de la ora 01:00.`;
  const reasonEn = `Market is closed. The active trading window is Monday 01:00 AM through Friday midnight. Live signal generation will resume Monday at 01:00 AM.`;

  return {
    isClosed,
    userTimezone: userTimezoneStr,
    userTimezoneShort,
    currentLocalTimeStr,
    nextOpenTimeStrRo,
    nextOpenTimeStrEn,
    reasonRo,
    reasonEn,
  };
}

// Module-level cached DateTimeFormat instance to prevent high CPU / GC churn
const bucharestDtf = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function getBucharestParts(d: Date) {
  const parts = bucharestDtf.formatToParts(d);
  let year = 2026, month = 1, day = 1, hour = 0, minute = 0, second = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.type === 'year') year = parseInt(p.value, 10);
    else if (p.type === 'month') month = parseInt(p.value, 10);
    else if (p.type === 'day') day = parseInt(p.value, 10);
    else if (p.type === 'hour') hour = parseInt(p.value === '24' ? '0' : p.value, 10);
    else if (p.type === 'minute') minute = parseInt(p.value, 10);
    else if (p.type === 'second') second = parseInt(p.value, 10);
  }
  return { year, month, day, hour, minute, second };
}

/**
 * Checks if an unactivated signal is expired by the daily market close cutoff (23:00 Romania time / 1 hour before market close).
 * In global financial markets, trading closes at 17:00 New York Time (24:00 / midnight Romania time).
 * 1 hour before close is 23:00 Romania time (16:00 New York / universal market close cutoff).
 * 
 * Rules:
 * - If signal was created before 23:00 Romania time on day D, its cutoff is 23:00 Romania time on day D.
 * - If signal was created at or after 23:00 Romania time on day D, its cutoff is 23:00 Romania time on day D+1.
 * - If current time in Romania time has reached or passed that cutoff, the unactivated signal is considered expired/cancelled.
 */
export function isSignalExpiredByMarketClose(createdAtIso: string, customNow?: Date): boolean {
  if (!createdAtIso) return false;
  const createdDate = new Date(createdAtIso);
  if (isNaN(createdDate.getTime())) return false;

  const now = customNow || new Date();

  // Fast path: if created within the last 30 minutes and current Bucharest hour is < 23, it cannot be expired
  const ageMs = now.getTime() - createdDate.getTime();
  if (ageMs < 0) return false; // future date

  const nowP = getBucharestParts(now);
  if (nowP.hour < 23 && ageMs < 12 * 3600 * 1000) {
    // If current time is before 23:00 and signal was created today within last 12h, it's definitely not expired
    const createdP = getBucharestParts(createdDate);
    if (createdP.day === nowP.day && createdP.month === nowP.month) {
      return false;
    }
  }

  const createdP = getBucharestParts(createdDate);

  // Difference in calendar days in Bucharest timezone
  const createdDayUtc = Date.UTC(createdP.year, createdP.month - 1, createdP.day);
  const nowDayUtc = Date.UTC(nowP.year, nowP.month - 1, nowP.day);
  const diffDays = Math.round((nowDayUtc - createdDayUtc) / (24 * 3600 * 1000));

  if (diffDays < 0) return false; // Future creation date
  if (diffDays > 1) return true; // 2 or more days ago

  if (diffDays === 1) {
    // Created yesterday in Bucharest.
    // If created before 23:00 yesterday, cutoff was yesterday 23:00 -> expired!
    if (createdP.hour < 23) return true;
    // If created at or after 23:00 yesterday, cutoff is today at 23:00 -> expired if today is >= 23:00
    return nowP.hour >= 23;
  }

  // Same calendar day in Bucharest:
  // Expired if created before 23:00 and current time is at or past 23:00!
  return createdP.hour < 23 && nowP.hour >= 23;
}

