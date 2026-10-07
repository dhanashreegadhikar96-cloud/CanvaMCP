/**
 * NSOffice UI — shell behaviour: profile menu, view links and icons.
 *
 * Any element with data-view="<view>" (sidebar links, back buttons, hub cards) navigates:
 *   - in a single-page app that defines window.navigateTo(url, view, event), it switches views in place;
 *   - otherwise it behaves as a normal link (href, or data-href on non-link elements).
 */
(function () {
  function closeProfileMenu() {
    const popover = document.getElementById('profileMenuPopover');
    if (popover) popover.classList.remove('active');
  }

  document.addEventListener('click', (e) => {
    const popover = document.getElementById('profileMenuPopover');

    const viewLink = e.target.closest('[data-view]');
    if (viewLink) {
      closeProfileMenu();
      const href = viewLink.getAttribute('href') || viewLink.dataset.href;
      if (typeof window.navigateTo === 'function') {
        window.navigateTo(href, viewLink.dataset.view, e);
      } else if (!viewLink.hasAttribute('href') && href) {
        window.location.href = href;
      }
      return;
    }

    // Clicking the user block opens/closes the profile menu; clicking a menu item closes it
    const profile = e.target.closest('.sidebar-user');
    if (profile && popover) {
      if (popover.contains(e.target)) closeProfileMenu();
      else popover.classList.toggle('active');
      return;
    }

    closeProfileMenu(); // click outside
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProfileMenu();
  });

  // Lucide outline icons (<i data-lucide="search">) used by catalogue cards and banners
  document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();
  });
})();
