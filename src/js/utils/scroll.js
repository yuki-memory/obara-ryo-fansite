export function setupScrollTopLinks(options = {}) {
  const {
    linkSelector = '.js-scroll-top',
    topButtonSelector = '.top-button',
    visibleClassName = 'is-visible',
    visibilityThreshold = 200,
    includeTopButtonVisibility = true,
    scrollTop = 0,
    scrollBehavior = 'smooth',
  } = options;

  const scrollTopLinks = document.querySelectorAll(linkSelector);
  const topButtons = includeTopButtonVisibility
    ? document.querySelectorAll(topButtonSelector)
    : [];

  const updateTopButtonState = () => {
    topButtons.forEach((button) => {
      button.classList.toggle(visibleClassName, window.scrollY > visibilityThreshold);
    });
  };

  scrollTopLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();

      window.scrollTo({
        top: scrollTop,
        behavior: scrollBehavior,
      });
    });
  });

  if (includeTopButtonVisibility) {
    updateTopButtonState();
    window.addEventListener('scroll', updateTopButtonState, { passive: true });
  }
}
