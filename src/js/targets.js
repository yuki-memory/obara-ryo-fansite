const MOBILE_BREAKPOINT = 768;
const DEFAULT_WIDE_ASPECT_THRESHOLD = 1.9;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveResponsiveValue(width, desktopValue, mobileValue, fallbackValue) {
  const isMobile = width < MOBILE_BREAKPOINT;

  if (isMobile && typeof mobileValue === 'number') {
    return mobileValue;
  }

  if (!isMobile && typeof desktopValue === 'number') {
    return desktopValue;
  }

  if (typeof desktopValue === 'number') {
    return desktopValue;
  }

  if (typeof mobileValue === 'number') {
    return mobileValue;
  }

  return fallbackValue;
}

function resolveLogoLayout(options) {
  const {
    width,
    height,
    fitWidthRatio,
    fitWidthRatioDesktop,
    fitWidthRatioMobile,
    fitHeightRatio,
    fitHeightRatioDesktop,
    fitHeightRatioMobile,
    sidePadding,
    sidePaddingDesktop,
    sidePaddingMobile,
    sampleStepDesktop = 1,
    sampleStepMobile = 2,
    wideAspectThreshold = DEFAULT_WIDE_ASPECT_THRESHOLD,
    wideFitWidthAdjust = -0.03,
    wideFitHeightAdjust = -0.08,
    wideSidePaddingScale = 1.2,
  } = options;

  // Resolve SP/PC baseline first, then apply wide-screen correction.
  let resolvedFitWidthRatio = resolveResponsiveValue(
    width,
    fitWidthRatioDesktop ?? fitWidthRatio,
    fitWidthRatioMobile ?? fitWidthRatio,
    0.88,
  );
  let resolvedFitHeightRatio = resolveResponsiveValue(
    width,
    fitHeightRatioDesktop ?? fitHeightRatio,
    fitHeightRatioMobile ?? fitHeightRatio,
    0.54,
  );
  let resolvedSidePadding = resolveResponsiveValue(
    width,
    sidePaddingDesktop ?? sidePadding,
    sidePaddingMobile ?? sidePadding,
    40,
  );

  const aspect = width / Math.max(1, height);
  if (aspect >= wideAspectThreshold) {
    resolvedFitWidthRatio = clamp(resolvedFitWidthRatio + wideFitWidthAdjust, 0.45, 0.98);
    resolvedFitHeightRatio = clamp(resolvedFitHeightRatio + wideFitHeightAdjust, 0.2, 0.92);
    resolvedSidePadding = Math.max(8, resolvedSidePadding * wideSidePaddingScale);
  }

  const sampleStep = width < MOBILE_BREAKPOINT
    ? Math.max(1, Math.floor(sampleStepMobile))
    : 1;

  return {
    sampleStep,
    fitWidthRatio: resolvedFitWidthRatio,
    fitHeightRatio: resolvedFitHeightRatio,
    sidePadding: resolvedSidePadding,
  };
}

function resolveDaysLayout(options) {
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
    wideMaxWidthAdjust = 0.06,
    wideMaxHeightAdjust = -0.03,
  } = options;

  // Days text uses its own responsive constraints to keep readability.
  let resolvedMaxWidthRatio = resolveResponsiveValue(
    width,
    maxWidthRatioDesktop ?? maxWidthRatio,
    maxWidthRatioMobile ?? maxWidthRatio,
    0.58,
  );
  let resolvedMaxHeightRatio = resolveResponsiveValue(
    width,
    maxHeightRatioDesktop ?? maxHeightRatio,
    maxHeightRatioMobile ?? maxHeightRatio,
    0.24,
  );

  const aspect = width / Math.max(1, height);
  if (aspect >= wideAspectThreshold) {
    resolvedMaxWidthRatio = clamp(resolvedMaxWidthRatio + wideMaxWidthAdjust, 0.42, 0.95);
    resolvedMaxHeightRatio = clamp(resolvedMaxHeightRatio + wideMaxHeightAdjust, 0.14, 0.5);
  }

  return {
    sampleStep: width < MOBILE_BREAKPOINT ? sampleStepMobile : sampleStepDesktop,
    maxWidthRatio: resolvedMaxWidthRatio,
    maxHeightRatio: resolvedMaxHeightRatio,
  };
}

function createOffscreenCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(new Error(`画像の読み込みに失敗しました: ${url}`));
    };

    image.src = url;
  });
}

export function samplePointsFromTransparentImage(image, options) {
  const {
    width,
    height,
    sampleStep = 2,
    alphaThreshold = 16,
    fitWidthRatio = 0.88,
    fitHeightRatio = 0.54,
    sidePadding = 40,
    offsetY = 0,
  } = options;

  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return [];
  }

  const availableWidth = Math.max(1, width * fitWidthRatio - sidePadding * 2);
  const availableHeight = Math.max(1, height * fitHeightRatio);
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);

  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = (width - drawWidth) * 0.5;
  const centeredY = (height - drawHeight) * 0.5 + offsetY;
  const drawY = Math.min(height - drawHeight, Math.max(0, centeredY));

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const imageData = ctx.getImageData(0, 0, width, height).data;
  const points = [];

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const alpha = imageData[index + 3];

      if (alpha >= alphaThreshold) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

export function samplePointsFromText(text, options) {
  const {
    width,
    height,
    sampleStep = 5,
    alphaThreshold = 20,
    fontFamily = '"Helvetica Neue", Arial, sans-serif',
    fontWeight = 800,
    maxWidthRatio = 0.58,
    maxHeightRatio = 0.24,
    offsetY = 18,
  } = options;

  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return [];
  }

  let fontSize = Math.min(width * 0.22, height * 0.28, 220);
  const minFontSize = 24;
  const maxTextWidth = width * maxWidthRatio;
  const maxTextHeight = height * maxHeightRatio;

  while (fontSize > minFontSize) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const measuredWidth = ctx.measureText(text).width;
    if (measuredWidth + fontSize * 0.035 <= maxTextWidth && fontSize <= maxTextHeight) {
      break;
    }
    fontSize -= 2;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.lineJoin = 'round';
  const strokeWidth = fontSize * 0.035;
  if (strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, width * 0.5, height * 0.5 + offsetY);
  }
  ctx.fillText(text, width * 0.5, height * 0.5 + offsetY);

  const imageData = ctx.getImageData(0, 0, width, height).data;
  const points = [];

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const alpha = imageData[index + 3];

      if (alpha >= alphaThreshold) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

export function samplePointsFromTextLines(options) {
  const {
    width,
    height,
    sampleStep = 5,
    alphaThreshold = 20,
    fontFamily = '"Helvetica Neue", Arial, sans-serif',
    maxWidthRatio = 0.64,
    lines,
    text,
  } = options;

  const resolvedLines = Array.isArray(lines) && lines.length > 0
    ? lines
    : [{ text: text ?? '', fontWeight: options.fontWeight ?? 900 }];
  const daysText = resolvedLines[0]?.text ?? '';
  const timeText = resolvedLines[1]?.text ?? '';

  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return { points: [], groupedPoints: {} };
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const isMobile = width < MOBILE_BREAKPOINT;
  const widthRatio = isMobile ? 0.22 : 0.13;
  const timeFontRatio = isMobile ? 0.48 : 0.32;
  let mainFontSize = Math.min(width * widthRatio, height * 0.22, 190);
  const minMainFontSize = 36;
  const maxTextWidth = width * maxWidthRatio;

  while (mainFontSize > minMainFontSize) {
    ctx.font = `900 ${mainFontSize}px ${fontFamily}`;
    const timeFontSize = mainFontSize * timeFontRatio;
    const daysWidth = ctx.measureText(daysText).width;
    ctx.font = `700 ${timeFontSize}px ${fontFamily}`;
    const timeWidth = timeText ? ctx.measureText(timeText).width : 0;

    if (Math.max(daysWidth, timeWidth) <= maxTextWidth) {
      break;
    }

    mainFontSize -= 2;
  }

  const timeFontSize = mainFontSize * timeFontRatio;
  const centerX = width * 0.5;
  const daysY = height * 0.46;
  const timeY = height * 0.61;
  const timeDrawY = timeY - timeFontSize * 0.06;
  const groupedPoints = {};
  const groupedMeta = {};

  function createCharacterRegions({
    text,
    font,
    fontSize,
    lineIndex,
    centerY,
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

    cursorX = startX;

    return chars.map((char, charIndex) => {
      const groupKey = `line-${lineIndex}-char-${charIndex}`;
      const charWidth = widths[charIndex];
      const xStart = charIndex === 0
        ? startX - sampleStep
        : (centers[charIndex - 1] + centers[charIndex]) * 0.5;
      const xEnd = charIndex === chars.length - 1
        ? startX + totalWidth + sampleStep
        : (centers[charIndex] + centers[charIndex + 1]) * 0.5;

      groupedPoints[groupKey] = [];
      groupedMeta[groupKey] = {
        lineIndex,
        charIndex,
        char,
      };

      const charBounds = {
        lineIndex,
        charIndex,
        char,
        groupKey,
        xStart,
        xEnd,
        xCenter: centers[charIndex] ?? cursorX + charWidth * 0.5,
        yStart: centerY - fontSize * 0.85,
        yEnd: centerY + fontSize * (lineIndex === 1 ? 0.83 : 0.65),
        yCenter: centerY,
      };

      // Expand bottom sampling range to capture full glyph descenders
      if (lineIndex === 1) {
        charBounds.yEnd += fontSize * 0.2;
      }
      if (lineIndex === 0) {
        charBounds.yEnd += fontSize * 0.08;
      }

      cursorX += charWidth;
      return charBounds;
    });
  }

  const dayRegions = createCharacterRegions({
    text: daysText,
    font: `900 ${mainFontSize}px ${fontFamily}`,
    fontSize: mainFontSize,
    lineIndex: 0,
    centerY: daysY,
  });
  const timeRegions = timeText
    ? createCharacterRegions({
      text: timeText,
      font: `700 ${timeFontSize}px ${fontFamily}`,
      fontSize: timeFontSize,
      lineIndex: 1,
      centerY: timeDrawY,
    })
    : [];
  const lineRegions = [dayRegions, timeRegions].filter((regions) => regions.length > 0);

  const points = [];

  function findCharacterRegionInLine(regions, x) {
    return regions.find((region) => x >= region.xStart && x <= region.xEnd)
      ?? regions.reduce((closestRegion, region) => {
        const currentDistance = Math.abs(x - region.xCenter);
        const closestDistance = Math.abs(x - closestRegion.xCenter);
        return currentDistance < closestDistance ? region : closestRegion;
      }, regions[0]);
  }

  lineRegions.forEach((regions) => {
    const lineIndex = regions[0].lineIndex;
    
    // Clear and draw only the current line to prevent bounding box overlap
    ctx.clearRect(0, 0, width, height);
    if (lineIndex === 0) {
      ctx.font = `900 ${mainFontSize}px ${fontFamily}`;
      ctx.lineWidth = Math.max(1, mainFontSize * 0.025);
      ctx.strokeText(daysText, centerX, daysY);
      ctx.fillText(daysText, centerX, daysY);
    } else {
      ctx.font = `700 ${timeFontSize}px ${fontFamily}`;
      ctx.lineWidth = Math.max(1, timeFontSize * 0.03);
      ctx.strokeText(timeText, centerX, timeDrawY);
      ctx.fillText(timeText, centerX, timeDrawY);
    }
    const imageData = ctx.getImageData(0, 0, width, height).data;

    const lineSampleStep = 1;
    const lineAlphaThreshold = Math.max(4, alphaThreshold * 0.4);
    const minX = Math.max(0, Math.floor(regions[0].xStart - lineSampleStep));
    const maxX = Math.min(width, Math.ceil(regions[regions.length - 1].xEnd + lineSampleStep));
    const minY = Math.max(0, Math.floor(regions[0].yStart - lineSampleStep));
    const maxY = Math.min(height, Math.ceil(regions[0].yEnd + lineSampleStep));

    for (let y = minY; y < maxY; y += lineSampleStep) {
      for (let x = minX; x < maxX; x += lineSampleStep) {
        const index = (y * width + x) * 4;
        const alpha = imageData[index + 3];

        if (alpha >= lineAlphaThreshold) {
          const region = findCharacterRegionInLine(regions, x);
          const point = {
            x,
            y,
            char: region.char,
            lineIndex: region.lineIndex,
            charIndex: region.charIndex,
            groupKey: region.groupKey,
          };
          points.push(point);
          groupedPoints[region.groupKey].push(point);
        }
      }
    }
  });

  return { points, groupedPoints, groupedMeta };
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
}

export function normalizePointCount(points, particleCount) {
  if (particleCount <= 0 || points.length === 0) {
    return [];
  }

  const sampled = points.slice();
  shuffleInPlace(sampled);

  if (sampled.length >= particleCount) {
    return sampled.slice(0, particleCount);
  }

  const normalized = new Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    normalized[i] = sampled[i % sampled.length];
  }

  return normalized;
}

export function buildLogoTargetPoints(options) {
  const {
    image,
    width,
    height,
    particleCount,
    offsetY,
    alphaThreshold,
  } = options;

  const responsiveLayout = resolveLogoLayout(options);

  let points = samplePointsFromTransparentImage(image, {
    width,
    height,
    sampleStep: responsiveLayout.sampleStep,
    alphaThreshold,
    fitWidthRatio: responsiveLayout.fitWidthRatio,
    fitHeightRatio: responsiveLayout.fitHeightRatio,
    sidePadding: responsiveLayout.sidePadding,
    offsetY,
  });

  // Keep density high without wasting particles on exact duplicates:
  // if sampled points are insufficient, retry once with step=1.
  if (points.length < particleCount && responsiveLayout.sampleStep > 1) {
    points = samplePointsFromTransparentImage(image, {
      width,
      height,
      sampleStep: 1,
      alphaThreshold,
      fitWidthRatio: responsiveLayout.fitWidthRatio,
      fitHeightRatio: responsiveLayout.fitHeightRatio,
      sidePadding: responsiveLayout.sidePadding,
      offsetY,
    });
  }

  const normalized = normalizePointCount(points, particleCount);

  if (normalized.length > 0) {
    return normalized;
  }

  return Array.from({ length: particleCount }, () => ({
    x: width * 0.5,
    y: height * 0.5,
  }));
}

export function buildDaysTargetPoints(options) {
  const {
    text,
    lines,
    width,
    height,
    particleCount,
    alphaThreshold = 20,
    fontFamily,
    fontWeight,
    offsetY,
  } = options;

  const responsiveLayout = resolveDaysLayout(options);

  const textOptions = {
    text,
    lines,
    width,
    height,
    sampleStep: responsiveLayout.sampleStep,
    alphaThreshold,
    fontFamily,
    fontWeight,
    maxWidthRatio: responsiveLayout.maxWidthRatio,
    maxHeightRatio: responsiveLayout.maxHeightRatio,
    offsetY,
  };

  if (Array.isArray(lines) && lines.length > 0) {
    const { points, groupedPoints, groupedMeta } = samplePointsFromTextLines(textOptions);
    const normalized = normalizePointCount(points, particleCount);

    if (normalized.length > 0) {
      return { points: normalized, groupedPoints, groupedMeta };
    }

    return {
      points: Array.from({ length: particleCount }, () => ({
        x: width * 0.5,
        y: height * 0.5,
      })),
      groupedPoints: {},
      groupedMeta: {},
    };
  }

  const points = samplePointsFromText(text, textOptions);
  const normalized = normalizePointCount(points, particleCount);

  if (normalized.length > 0) {
    return normalized;
  }

  return Array.from({ length: particleCount }, () => ({
    x: width * 0.5,
    y: height * 0.5,
  }));
}
