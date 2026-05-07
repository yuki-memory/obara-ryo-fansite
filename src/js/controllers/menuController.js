export function initMenuController(options = {}) {
  const {
    menuButton = document.querySelector('.site-menu-button'),
    siteMenu = document.getElementById('site-menu'),
    menuCloseButton = document.querySelector('.site-menu__close'),
    menuLinks = document.querySelectorAll('.site-menu__link'),
    openBodyClassName = 'is-menu-open',
  } = options;

  if (!menuButton || !siteMenu) {
    return () => {};
  }

  const openMenu = () => {
    document.body.classList.add(openBodyClassName);
    menuButton.setAttribute('aria-expanded', 'true');
    menuButton.setAttribute('aria-label', 'メニューを閉じる');
    siteMenu.setAttribute('aria-hidden', 'false');
    menuCloseButton?.focus();
  };

  const closeMenu = () => {
    document.body.classList.remove(openBodyClassName);
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'メニューを開く');
    siteMenu.setAttribute('aria-hidden', 'true');
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
    menuButton.focus();
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
      menuButton.focus();
    }
  };

  menuButton.addEventListener('click', toggleMenu);
  menuCloseButton?.addEventListener('click', handleCloseButtonClick);
  siteMenu.addEventListener('click', handleBackdropClick);
  menuLinks.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
  window.addEventListener('keydown', handleKeydown);

  return () => {
    menuButton.removeEventListener('click', toggleMenu);
    menuCloseButton?.removeEventListener('click', handleCloseButtonClick);
    siteMenu.removeEventListener('click', handleBackdropClick);
    menuLinks.forEach((link) => {
      link.removeEventListener('click', closeMenu);
    });
    window.removeEventListener('keydown', handleKeydown);
    closeMenu();
  };
}
