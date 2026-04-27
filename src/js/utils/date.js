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

export function getDaysLeftJST(liveDate) {
  const targetParts = getJstDateParts(liveDate);
  const todayParts = getJstDateParts(new Date());

  const diff = toDayIndex(targetParts) - toDayIndex(todayParts);
  return Math.max(0, diff);
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
