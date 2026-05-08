export function initMenuController(options = {}) {
  const {
    menuButton: menuToggle = document.querySelector('.site-menu-button'),
    siteMenu = document.getElementById('site-menu'),
    menuCloseButton = document.querySelector('.site-menu__close'),
    menuLinks = document.querySelectorAll('.site-menu__link'),
    openBodyClassName = 'is-menu-open',
  } = options;

  if (!menuToggle || !siteMenu) {
    return () => {};
  }

  const existingCleanup = siteMenu._menuControllerCleanup;

  if (typeof existingCleanup === 'function') {
    existingCleanup();
  }

  const moveFocusOutOfMenu = () => {
    const activeElement = document.activeElement;

    if (!(activeElement instanceof HTMLElement)) {
      return;
    }

    if (!siteMenu.contains(activeElement)) {
      return;
    }

    if (typeof menuToggle.focus === 'function') {
      menuToggle.focus();
      return;
    }

    activeElement.blur();
  };

  function resetMenuState() {
    moveFocusOutOfMenu();
    document.body.classList.remove(openBodyClassName);

    if (siteMenu) {
      siteMenu.setAttribute('aria-hidden', 'true');
      siteMenu.setAttribute('inert', '');
    }

    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'メニューを開く');
    }
  }

  const openMenu = () => {
    siteMenu.removeAttribute('inert');
    siteMenu.setAttribute('aria-hidden', 'false');
    document.body.classList.add(openBodyClassName);
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'メニューを閉じる');
    menuCloseButton?.focus();
  };

  const closeMenu = () => {
    moveFocusOutOfMenu();
    document.body.classList.remove(openBodyClassName);
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'メニューを開く');
    siteMenu.setAttribute('aria-hidden', 'true');
    siteMenu.setAttribute('inert', '');
  };

  const toggleMenu = () => {
    if (document.body.classList.contains(openBodyClassName)) {
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

  menuToggle.addEventListener('click', toggleMenu);
  menuCloseButton?.addEventListener('click', handleCloseButtonClick);
  siteMenu.addEventListener('click', handleBackdropClick);
  menuLinks.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
  window.addEventListener('keydown', handleKeydown);
  document.addEventListener('DOMContentLoaded', resetMenuState);
  window.addEventListener('pageshow', resetMenuState);
  resetMenuState();

  const cleanup = () => {
    menuToggle.removeEventListener('click', toggleMenu);
    menuCloseButton?.removeEventListener('click', handleCloseButtonClick);
    siteMenu.removeEventListener('click', handleBackdropClick);
    menuLinks.forEach((link) => {
      link.removeEventListener('click', closeMenu);
    });
    window.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('DOMContentLoaded', resetMenuState);
    window.removeEventListener('pageshow', resetMenuState);
    resetMenuState();
    delete siteMenu._menuControllerCleanup;
  };

  siteMenu._menuControllerCleanup = cleanup;

  return cleanup;
}
