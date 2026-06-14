const MOBILE_BREAKPOINT = 768;
const DEFAULT_WIDE_ASPECT_THRESHOLD = 1.9;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createOffscreenCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

function resolveResponsiveValue(width, desktopValue, mobileValue, fallback) {
  if (width < MOBILE_BREAKPOINT) {
    return mobileValue ?? desktopValue ?? fallback;
  }
  return desktopValue ?? mobileValue ?? fallback;
}

function resolveLayout(options) {
  const {
    width,
    height,
    sampleStepDesktop = 2,
    sampleStepMobile = 3,
    maxWidthRatio,
    maxWidthRatioDesktop,
    maxWidthRatioMobile,
    maxHeightRatio,
    maxHeightRatioDesktop,
    maxHeightRatioMobile,
    wideAspectThreshold = DEFAULT_WIDE_ASPECT_THRESHOLD,
    wideMaxWidthAdjust = 0.04,
    wideMaxHeightAdjust = -0.02,
  } = options;

  let resolvedMaxWidthRatio = resolveResponsiveValue(
    width,
    maxWidthRatioDesktop ?? maxWidthRatio,
    maxWidthRatioMobile ?? maxWidthRatio,
    0.64,
  );
  let resolvedMaxHeightRatio = resolveResponsiveValue(
    width,
    maxHeightRatioDesktop ?? maxHeightRatio,
    maxHeightRatioMobile ?? maxHeightRatio,
    0.4,
  );

  const aspect = width / Math.max(1, height);
  if (aspect >= wideAspectThreshold) {
    resolvedMaxWidthRatio = clamp(resolvedMaxWidthRatio + wideMaxWidthAdjust, 0.42, 0.95);
    resolvedMaxHeightRatio = clamp(resolvedMaxHeightRatio + wideMaxHeightAdjust, 0.16, 0.5);
  }

  return {
    sampleStep: width < MOBILE_BREAKPOINT ? sampleStepMobile : sampleStepDesktop,
    maxWidthRatio: resolvedMaxWidthRatio,
    maxHeightRatio: resolvedMaxHeightRatio,
  };
}

function createCharacterRegions({
  ctx,
  text,
  font,
  fontSize,
  lineIndex,
  centerX,
  centerY,
  sampleStep,
  groupedPoints,
  groupedMeta,
}) {
  const chars = Array.from(text);
  ctx.font = font;

  const widths = chars.map((char) => ctx.measureText(char).width);
  const totalWidth = widths.reduce((total, charWidth) => total + charWidth, 0);
  const startX = centerX - totalWidth * 0.5;
  const centers = [];
  let cursorX = startX;

  widths.forEach((charWidth) => {
    centers.push(cursorX + charWidth * 0.5);
    cursorX += charWidth;
  });

  return chars.map((char, charIndex) => {
    const groupKey = `line-${lineIndex}-char-${charIndex}`;
    const xStart = charIndex === 0
      ? startX - sampleStep
      : (centers[charIndex - 1] + centers[charIndex]) * 0.5;
    const xEnd = charIndex === chars.length - 1
      ? startX + totalWidth + sampleStep
      : (centers[charIndex] + centers[charIndex + 1]) * 0.5;

    groupedPoints[groupKey] = [];
    groupedMeta[groupKey] = { lineIndex, charIndex, char };

    return {
      lineIndex,
      charIndex,
      char,
      groupKey,
      xStart,
      xEnd,
      xCenter: centers[charIndex],
      yStart: centerY - fontSize * 0.82,
      yEnd: centerY + fontSize * (lineIndex === 1 ? 1.0 : 0.72),
      yCenter: centerY,
    };
  });
}

function findRegion(regions, x) {
  return regions.find((region) => x >= region.xStart && x <= region.xEnd)
    ?? regions.reduce((closestRegion, region) => (
      Math.abs(x - region.xCenter) < Math.abs(x - closestRegion.xCenter)
        ? region
        : closestRegion
    ), regions[0]);
}

function normalizePointCount(points, particleCount) {
  if (particleCount <= 0 || points.length === 0) {
    return [];
  }

  const sampled = points.slice();
  for (let i = sampled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = sampled[i];
    sampled[i] = sampled[j];
    sampled[j] = tmp;
  }

  if (sampled.length >= particleCount) {
    return sampled.slice(0, particleCount);
  }

  return Array.from({ length: particleCount }, (_, index) => sampled[index % sampled.length]);
}

export function buildThreeCountdownTargetPoints(options) {
  const {
    lines,
    width,
    height,
    particleCount,
    alphaThreshold = 22,
    fontFamily = '"Helvetica Neue", Arial, sans-serif',
  } = options;

  const resolvedLines = Array.isArray(lines) && lines.length > 0
    ? lines
    : [{ text: '', fontWeight: 900 }];
  const daysText = resolvedLines[0]?.text ?? '';
  const timeText = resolvedLines[1]?.text ?? '';
  const layout = resolveLayout(options);
  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return { points: [], groupedPoints: {}, groupedMeta: {} };
  }

  const isMobile = width < MOBILE_BREAKPOINT;
  const mainRatio = isMobile ? 0.22 : 0.13;
  const timeRatio = isMobile ? 0.48 : 0.32;
  const minMainFontSize = 36;
  const maxTextWidth = width * layout.maxWidthRatio;
  let mainFontSize = Math.min(width * mainRatio, height * 0.22, 190);

  while (mainFontSize > minMainFontSize) {
    ctx.font = `900 ${mainFontSize}px ${fontFamily}`;
    const daysWidth = ctx.measureText(daysText).width;
    ctx.font = `700 ${mainFontSize * timeRatio}px ${fontFamily}`;
    const timeWidth = timeText ? ctx.measureText(timeText).width : 0;

    if (Math.max(daysWidth, timeWidth) <= maxTextWidth) {
      break;
    }
    mainFontSize -= 2;
  }

  const timeFontSize = mainFontSize * timeRatio;
  const centerX = width * 0.5;
  const daysY = height * 0.46;
  const timeDrawY = height * 0.61 - timeFontSize * 0.06;
  const groupedPoints = {};
  const groupedMeta = {};

  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const dayRegions = createCharacterRegions({
    ctx,
    text: daysText,
    font: `900 ${mainFontSize}px ${fontFamily}`,
    fontSize: mainFontSize,
    lineIndex: 0,
    centerX,
    centerY: daysY,
    sampleStep: layout.sampleStep,
    groupedPoints,
    groupedMeta,
  });
  const timeRegions = timeText
    ? createCharacterRegions({
      ctx,
      text: timeText,
      font: `700 ${timeFontSize}px ${fontFamily}`,
      fontSize: timeFontSize,
      lineIndex: 1,
      centerX,
      centerY: timeDrawY,
      sampleStep: layout.sampleStep,
      groupedPoints,
      groupedMeta,
    })
    : [];

  const points = [];
  [dayRegions, timeRegions].filter((regions) => regions.length > 0).forEach((regions) => {
    const lineIndex = regions[0].lineIndex;
    ctx.clearRect(0, 0, width, height);

    if (lineIndex === 0) {
      ctx.font = `900 ${mainFontSize}px ${fontFamily}`;
      ctx.lineWidth = Math.max(1.4, mainFontSize * 0.018);
      ctx.strokeText(daysText, centerX, daysY);
      ctx.fillText(daysText, centerX, daysY);
    } else {
      ctx.font = `700 ${timeFontSize}px ${fontFamily}`;
      ctx.lineWidth = Math.max(1, timeFontSize * 0.022);
      ctx.strokeText(timeText, centerX, timeDrawY);
      ctx.fillText(timeText, centerX, timeDrawY);
    }

    const imageData = ctx.getImageData(0, 0, width, height).data;
    const minX = Math.max(0, Math.floor(regions[0].xStart - layout.sampleStep));
    const maxX = Math.min(width, Math.ceil(regions[regions.length - 1].xEnd + layout.sampleStep));
    const minY = Math.max(0, Math.floor(regions[0].yStart - layout.sampleStep));
    const maxY = Math.min(height, Math.ceil(regions[0].yEnd + layout.sampleStep));
    const threshold = Math.max(18, alphaThreshold);

    for (let y = minY; y < maxY; y += layout.sampleStep) {
      for (let x = minX; x < maxX; x += layout.sampleStep) {
        const alpha = imageData[(y * width + x) * 4 + 3];
        if (alpha < threshold) {
          continue;
        }

        const region = findRegion(regions, x);
        const point = {
          x,
          y,
          type: region.lineIndex === 0 ? 'days' : 'time',
          char: region.char,
          lineIndex: region.lineIndex,
          charIndex: region.charIndex,
          groupKey: region.groupKey,
        };
        points.push(point);
        groupedPoints[region.groupKey].push(point);
      }
    }
  });

  return {
    points: normalizePointCount(points, particleCount),
    groupedPoints,
    groupedMeta,
  };
}
