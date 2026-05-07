import {
  formatTimeLeftJST,
  getDaysLeftJST,
} from '../utils/date.js';

function getChangedCharIndexes(previousLines, nextLines) {
  if (!previousLines) {
    return null;
  }

  const changed = [];

  nextLines.forEach((line, lineIndex) => {
    const previousLine = previousLines[lineIndex] || '';
    const maxLength = Math.max(previousLine.length, line.length);

    for (let charIndex = 0; charIndex < maxLength; charIndex += 1) {
      if (previousLine[charIndex] !== line[charIndex]) {
        changed.push({ lineIndex, charIndex });
      }
    }
  });

  return changed;
}

export function initCountdownController(options = {}) {
  const {
    liveDate,
    intervalMs = 1000,
    isEnabled = () => true,
    isActive = () => true,
    applyFullTarget = () => {},
    buildTargetFromLines = () => null,
    softUpdateTargetsByGroup = () => {},
  } = options;

  if (!(liveDate instanceof Date)) {
    throw new Error('initCountdownController requires a liveDate Date instance.');
  }

  let previousLines = null;
  let intervalId = null;

  const getLiveDaysLeft = () => getDaysLeftJST(liveDate);

  const getCountdownLines = () => {
    const days = getLiveDaysLeft();
    const timeLeft = formatTimeLeftJST(liveDate);

    return [
      `${days}DAYS`,
      timeLeft,
    ];
  };

  const setPreviousLines = (lines) => {
    previousLines = Array.isArray(lines) ? [...lines] : null;
  };

  const updateDiff = () => {
    if (!isActive()) {
      return;
    }

    const nextLines = getCountdownLines();

    if (!previousLines) {
      applyFullTarget();
      return;
    }

    const shouldRebuildAll = previousLines.some((line, index) => (
      line.length !== (nextLines[index] || '').length
    ));

    if (shouldRebuildAll) {
      applyFullTarget();
      return;
    }

    const changed = getChangedCharIndexes(previousLines, nextLines);

    if (!changed || changed.length === 0) {
      return;
    }

    const nextTarget = buildTargetFromLines(nextLines);
    const changedGroupKeys = changed.map(
      ({ lineIndex, charIndex }) => `line-${lineIndex}-char-${charIndex}`,
    );

    if (!nextTarget?.groupedPoints) {
      applyFullTarget();
      return;
    }

    softUpdateTargetsByGroup(nextTarget.groupedPoints, changedGroupKeys);
    setPreviousLines(nextLines);
  };

  const stop = () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };

  const start = () => {
    stop();

    if (!isEnabled()) {
      return;
    }

    setPreviousLines(getCountdownLines());
    intervalId = window.setInterval(updateDiff, intervalMs);
  };

  const cleanup = () => {
    stop();
    previousLines = null;
  };

  return {
    getLiveDaysLeft,
    getCountdownLines,
    setPreviousLines,
    start,
    stop,
    cleanup,
  };
}
