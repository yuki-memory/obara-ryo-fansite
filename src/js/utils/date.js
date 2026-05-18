const JST_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const jstDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toDate(value) {
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`無効な日付です: ${value}`);
  }

  return parsed;
}

function getJstDateParts(value) {
  const date = toDate(value);
  const parts = jstDateFormatter.formatToParts(date);

  let year = 0;
  let month = 0;
  let day = 0;

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];

    if (part.type === 'year') {
      year = Number(part.value);
    }

    if (part.type === 'month') {
      month = Number(part.value);
    }

    if (part.type === 'day') {
      day = Number(part.value);
    }
  }

  return { year, month, day };
}

function toDayIndex(parts) {
  return Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / ONE_DAY_MS,
  );
}

export function getDaysLeftJST(liveDate, now = new Date()) {
  const targetParts = getJstDateParts(liveDate);
  const todayParts = getJstDateParts(now);

  const diff = toDayIndex(targetParts) - toDayIndex(todayParts);
  return Math.max(0, diff);
}

export function getCountdownParts(liveDate, now = new Date()) {
  const target = toDate(liveDate);
  const diffMs = Math.max(0, target.getTime() - now.getTime());

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = getDaysLeftJST(target, now);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, diffMs };
}

export function getTimeLeftJST(targetDate, now = new Date()) {
  const target = toDate(targetDate);
  const { hours, minutes, seconds } = getCountdownParts(target, now);

  return { hours, minutes, seconds };
}

export function formatTimePart(value) {
  return String(value).padStart(2, '0');
}

export function formatTimeLeftJST(targetDate, now = new Date()) {
  const { hours, minutes, seconds } = getTimeLeftJST(targetDate, now);

  return [
    formatTimePart(hours),
    formatTimePart(minutes),
    formatTimePart(seconds),
  ].join(':');
}

function getNextJstMidnightTimestamp(now = new Date()) {
  const todayJst = getJstDateParts(now);

  return (
    Date.UTC(todayJst.year, todayJst.month - 1, todayJst.day + 1, 0, 0, 0, 0) -
    JST_UTC_OFFSET_MS
  );
}

export function scheduleMidnightUpdate(onUpdate) {
  if (typeof onUpdate !== 'function') {
    throw new Error('scheduleMidnightUpdate には関数を渡してください。');
  }

  let timerId = 0;
  let cancelled = false;

  const schedule = () => {
    if (cancelled) {
      return;
    }

    const now = Date.now();
    const nextMidnight = getNextJstMidnightTimestamp(new Date(now));
    const delay = Math.max(1, nextMidnight - now + 50);

    timerId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      try {
        onUpdate();
      } finally {
        schedule();
      }
    }, delay);
  };

  schedule();

  return () => {
    cancelled = true;
    if (timerId) {
      clearTimeout(timerId);
    }
  };
}

export function scheduleTargetTimeUpdate(targetDate, onUpdate) {
  const target = toDate(targetDate);

  if (typeof onUpdate !== 'function') {
    throw new Error('scheduleTargetTimeUpdate には関数を渡してください。');
  }

  let timerId = 0;
  let cancelled = false;

  const delay = Math.max(1, target.getTime() - Date.now() + 50);

  timerId = window.setTimeout(() => {
    if (!cancelled) {
      onUpdate();
    }
  }, delay);

  return () => {
    cancelled = true;
    if (timerId) {
      clearTimeout(timerId);
    }
  };
}
