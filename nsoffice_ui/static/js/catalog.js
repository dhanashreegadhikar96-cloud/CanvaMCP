/**
 * NSOffice UI — catalogue search and filter pills.
 * Works on every .catalog on the page (rendered by the catalog() macro); no setup needed.
 */
(function () {
  function applyFilters(catalog) {
    const query = (catalog.querySelector('.catalog-search-input')?.value || '').trim().toLowerCase();
    const activePill = catalog.querySelector('.catalog-pill.active');
    const category = activePill ? activePill.dataset.category : 'all';

    // Each card carries its category (its own, or its section's), so pills work for sectioned
    // catalogues and for flat ones where categories are mixed in one grid.
    catalog.querySelectorAll('.catalog-card').forEach((card) => {
      const text = `${card.querySelector('.catalog-card-title')?.textContent || ''} ${card.querySelector('.catalog-card-desc')?.textContent || ''}`;
      const inCategory = category === 'all' || card.dataset.category === category;
      card.style.display = inCategory && text.toLowerCase().includes(query) ? 'flex' : 'none';
    });

    // Hide group and section headings that have no matching cards left
    catalog.querySelectorAll('.catalog-group, .catalog-section').forEach((el) => {
      const anyVisible = [...el.querySelectorAll('.catalog-card')].some((c) => c.style.display !== 'none');
      el.classList.toggle('is-empty', !anyVisible);
    });
  }

  document.addEventListener('input', (e) => {
    const input = e.target.closest('.catalog-search-input');
    if (input) applyFilters(input.closest('.catalog'));
  });

  document.addEventListener('click', (e) => {
    const pill = e.target.closest('.catalog-pill');
    if (!pill) return;
    const catalog = pill.closest('.catalog');
    catalog.querySelectorAll('.catalog-pill').forEach((p) => p.classList.toggle('active', p === pill));
    applyFilters(catalog);
  });
})();
