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
