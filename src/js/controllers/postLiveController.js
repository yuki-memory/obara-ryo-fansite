// 開発確認用。本番前に false に戻すこと
export const FORCE_POST_LIVE_MODE = false;

export function isPostLiveMode(liveDate) {
  return FORCE_POST_LIVE_MODE || Date.now() >= liveDate.getTime();
}

export function applyPostLiveMode(isPostLive, options = {}) {
  const { root = document.body, className = 'is-post-live' } = options;

  root.classList.toggle(className, isPostLive);
}

export function initPostLiveController(options = {}) {
  const {
    liveDate,
    root = document.body,
    className = 'is-post-live',
  } = options;

  if (!(liveDate instanceof Date)) {
    throw new Error(
      'initPostLiveController requires a liveDate Date instance.',
    );
  }

  const getIsPostLive = () => isPostLiveMode(liveDate);
  const sync = () => {
    applyPostLiveMode(getIsPostLive(), { root, className });
  };
  const cleanup = () => {
    applyPostLiveMode(false, { root, className });
  };

  sync();

  return {
    isPostLive: getIsPostLive,
    sync,
    cleanup,
  };
}
