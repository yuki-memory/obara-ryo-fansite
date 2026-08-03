export const GA_MEASUREMENT_ID = 'G-EZQJ8XH34B';

const OUTBOUND_EVENT_NAMES = Object.freeze({
  x: 'click_x_link',
  youtube: 'click_youtube_link',
  spotify: 'click_spotify_link',
  appleMusic: 'click_apple_music_link',
});

const TRACKING_FLAG = '__obaraRyoAnalyticsLinkTracking';

function getGtag() {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return null;
  }

  return window.gtag;
}

function getPageParams() {
  if (typeof window === 'undefined') {
    return {};
  }

  return {
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
  };
}

function getLinkLabel(link) {
  const label = link.getAttribute('aria-label') || link.textContent || '';

  return label.trim().replace(/\s+/g, ' ').slice(0, 120);
}

function getOutboundPlatform(url) {
  let hostname = '';

  try {
    hostname = new URL(url, window.location.href).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }

  if (hostname === 'x.com' || hostname === 'twitter.com') {
    return 'x';
  }

  if (
    hostname === 'youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'youtu.be'
  ) {
    return 'youtube';
  }

  if (hostname === 'open.spotify.com' || hostname === 'spotify.com') {
    return 'spotify';
  }

  if (hostname === 'music.apple.com') {
    return 'appleMusic';
  }

  return '';
}

export function sendAnalyticsEvent(eventName, params = {}) {
  const gtag = getGtag();

  if (!gtag) {
    return;
  }

  gtag('event', eventName, {
    ...getPageParams(),
    ...params,
  });
}

export function trackPageViewEvent(pageName, params = {}) {
  sendAnalyticsEvent(`view_${pageName}_page`, params);
}

export function trackShareButtonClick(params = {}) {
  sendAnalyticsEvent('click_share_button', params);
}

export function initOutboundLinkTracking(root = document) {
  if (typeof window === 'undefined' || window[TRACKING_FLAG]) {
    return;
  }

  window[TRACKING_FLAG] = true;

  root.addEventListener(
    'click',
    (event) => {
      const link = event.target.closest?.('a[href]');

      if (!link) {
        return;
      }

      const platform = getOutboundPlatform(link.href);
      const eventName = OUTBOUND_EVENT_NAMES[platform];

      if (!eventName) {
        return;
      }

      sendAnalyticsEvent(eventName, {
        link_url: link.href,
        link_text: getLinkLabel(link),
      });
    },
    { capture: true },
  );
}
