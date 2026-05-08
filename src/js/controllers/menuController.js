export function initMenuController(options = {}) {
  const {
    menuButton: menuToggle = document.querySelector('.site-menu-button'),
    siteMenu = document.getElementById('site-menu'),
    menuCloseButton = document.querySelector('.site-menu__close'),
    menuLinks = document.querySelectorAll('.site-menu__link'),
    openBodyClassName = 'is-menu-open',
    overlaySelectors = [
      '.site-menu__overlay',
      '.menu-backdrop',
      '.page-transition',
      '.loading',
    ],
  } = options;

  if (!menuToggle || !siteMenu) {
    return () => {};
  }

  const existingCleanup = siteMenu._menuControllerCleanup;

  if (typeof existingCleanup === 'function') {
    existingCleanup();
  }

  let isMenuOpen = false;
  let menuAbortController = null;

  const moveFocusOutOfMenu = () => {
    const activeElement = document.activeElement;

    if (!(activeElement instanceof HTMLElement)) {
      return;
    }

    if (!siteMenu.contains(activeElement)) {
      return;
    }

    document.documentElement.classList.remove(openBodyClassName);
    document.body.classList.remove(openBodyClassName);

    if (typeof menuToggle.focus === 'function') {
      menuToggle.focus({ preventScroll: true });

      if (document.activeElement !== activeElement) {
        return;
      }
    }

    if (typeof activeElement.blur === 'function') {
      activeElement.blur();
      return;
    }
  };

  function resetMenuState() {
    isMenuOpen = false;
    moveFocusOutOfMenu();
    document.documentElement.classList.remove(openBodyClassName);
    document.body.classList.remove(openBodyClassName);
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.inset = '';
    document.body.style.top = '';
    document.body.style.right = '';
    document.body.style.bottom = '';
    document.body.style.left = '';
    document.body.style.touchAction = '';
    document.body.style.pointerEvents = '';

    if (siteMenu) {
      siteMenu.setAttribute('aria-hidden', 'true');
      siteMenu.setAttribute('inert', '');
      siteMenu.style.pointerEvents = '';
    }

    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'メニューを開く');
      menuToggle.style.pointerEvents = '';
    }

    document.querySelectorAll(overlaySelectors.join(',')).forEach((overlay) => {
      overlay.setAttribute('aria-hidden', 'true');

      if (overlay instanceof HTMLElement) {
        overlay.style.pointerEvents = 'none';
      }

      if ('inert' in overlay) {
        overlay.setAttribute('inert', '');
      }
    });
  }

  const openMenu = () => {
    isMenuOpen = true;
    siteMenu.removeAttribute('inert');
    siteMenu.setAttribute('aria-hidden', 'false');
    document.body.classList.add(openBodyClassName);
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'メニューを閉じる');
    menuCloseButton?.focus();
  };

  const closeMenu = () => {
    isMenuOpen = false;
    moveFocusOutOfMenu();
    document.body.classList.remove(openBodyClassName);
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'メニューを開く');
    siteMenu.setAttribute('aria-hidden', 'true');
    siteMenu.setAttribute('inert', '');
  };

  const toggleMenu = () => {
    if (isMenuOpen || document.body.classList.contains(openBodyClassName)) {
      closeMenu();
      return;
    }

    openMenu();
  };

  const handleCloseButtonClick = () => {
    closeMenu();
  };

  const handleBackdropClick = (event) => {
    if (event.target === siteMenu) {
      closeMenu();
    }
  };

  const handleKeydown = (event) => {
    if (
      event.key === 'Escape' &&
      document.body.classList.contains(openBodyClassName)
    ) {
      closeMenu();
    }
  };

  const bindMenuEvents = () => {
    if (menuAbortController) {
      menuAbortController.abort();
    }

    menuAbortController = new AbortController();
    const { signal } = menuAbortController;

    menuToggle.addEventListener('click', toggleMenu, { signal });
    menuCloseButton?.addEventListener('click', handleCloseButtonClick, {
      signal,
    });
    siteMenu.addEventListener('click', handleBackdropClick, { signal });
    menuLinks.forEach((link) => {
      link.addEventListener('click', closeMenu, { signal });
    });
    window.addEventListener('keydown', handleKeydown, { signal });
  };

  const handlePageShow = () => {
    resetMenuState();
    bindMenuEvents();
  };

  document.addEventListener('DOMContentLoaded', resetMenuState);
  window.addEventListener('pageshow', handlePageShow);
  resetMenuState();
  bindMenuEvents();

  const cleanup = () => {
    if (menuAbortController) {
      menuAbortController.abort();
      menuAbortController = null;
    }

    document.removeEventListener('DOMContentLoaded', resetMenuState);
    window.removeEventListener('pageshow', handlePageShow);
    resetMenuState();
    delete siteMenu._menuControllerCleanup;
  };

  siteMenu._menuControllerCleanup = cleanup;

  return cleanup;
}
