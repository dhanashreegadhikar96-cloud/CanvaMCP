/**
 * NSOffice UI — composer: the bee button's tools menu and its flyouts, prompt cards, and sending.
 * Works on every .composer on the page (rendered by the composer() macro); no setup needed.
 *
 *   bee button               opens/closes the menu
 *   menu item [data-flyout]  shows the flyout with that id (on click or hover)
 *   prompt card              puts its prompt in the ask bar
 *   Enter / send button      dispatches "composer:send" ({ detail: { text } }) from the .composer and
 *                            clears the input; the app decides where the message goes
 * Chips and menu items with data-view/data-href navigate through shell.js.
 * Ask-bar classes used outside a .composer (e.g. a chat page driven by its own code) are left alone.
 */
(function () {
  function closeMenu(composer) {
    const menu = composer.querySelector('.composer-menu');
    if (!menu) return;
    menu.classList.remove('active');
    composer.querySelector('.composer-bee')?.setAttribute('aria-expanded', 'false');
    showFlyout(composer, null);
  }

  function showFlyout(composer, item) {
    composer.querySelectorAll('.composer-menu-item').forEach((i) => i.classList.toggle('active', i === item));
    const id = item ? item.dataset.flyout : null;
    composer.querySelectorAll('.composer-flyout').forEach((f) => f.classList.toggle('active', !!id && f.id === id));
  }

  function send(composer) {
    const input = composer.querySelector('.composer-input');
    const text = (input?.value || '').trim();
    if (!text) return;
    composer.dispatchEvent(new CustomEvent('composer:send', { bubbles: true, detail: { text } }));
    input.value = '';
  }

  document.addEventListener('click', (e) => {
    const composer = e.target.closest('.composer');

    if (composer) {
      const bee = e.target.closest('.composer-bee');
      if (bee) {
        const menu = composer.querySelector('.composer-menu');
        if (menu.classList.contains('active')) {
          closeMenu(composer);
        } else {
          menu.classList.add('active');
          bee.setAttribute('aria-expanded', 'true');
        }
        return;
      }

      const item = e.target.closest('.composer-menu-item[data-flyout]');
      if (item) {
        showFlyout(composer, item);
        return;
      }

      if (e.target.closest('.composer-send')) {
        send(composer);
        return;
      }

      const prompt = e.target.closest('.composer-prompt');
      if (prompt) {
        const input = composer.querySelector('.composer-input');
        if (input) {
          input.value = prompt.dataset.prompt || '';
          input.focus();
        }
        return;
      }
    }

    // Click outside the menu (or on a chip) closes it
    document.querySelectorAll('.composer').forEach((c) => {
      const menu = c.querySelector('.composer-menu');
      if (menu && (!menu.contains(e.target) || e.target.closest('.composer-chip'))) closeMenu(c);
    });
  });

  document.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.composer-menu-item');
    if (item && item.closest('.composer-menu.active')) {
      showFlyout(item.closest('.composer'), item.dataset.flyout ? item : null);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.composer').forEach(closeMenu);
    const input = e.target.closest?.('.composer .composer-input');
    if (input && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input.closest('.composer'));
    }
  });
})();
