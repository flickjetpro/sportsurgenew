let searchTimeout = null;
let allMatchesCache = [];

async function initSearch() {
  const input = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');

  input.addEventListener('focus', () => {
    if (dropdown.children.length > 0) dropdown.classList.add('open');
  });

  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(input.value, dropdown), 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) {
      dropdown.classList.remove('open');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dropdown.classList.remove('open');
    if (e.key === 'Enter') {
      const first = dropdown.querySelector('.search-item');
      if (first) first.click();
    }
  });

  try {
    allMatchesCache = await getAllMatches();
  } catch (e) {
    console.warn('Failed to load search cache:', e);
  }
}

function performSearch(query, dropdown) {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) {
    dropdown.classList.remove('open');
    return;
  }

  const results = allMatchesCache
    .filter(m => {
      if (m.date === 0) return false;
      const title = (m.title || '').toLowerCase();
      const home = (m.teams && m.teams.home && m.teams.home.name || '').toLowerCase();
      const away = (m.teams && m.teams.away && m.teams.away.name || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      const combined = title + ' ' + home + ' ' + away + ' ' + cat;
      return combined.includes(q);
    })
    .slice(0, 15);

  if (results.length === 0) {
    dropdown.classList.remove('open');
    return;
  }

  dropdown.innerHTML = results.map(m => {
    const cat = classifyMatch(m);
    const label = getCategoryLabel(cat);
    const status = isLive(m.date) ? '\u{1F534} LIVE' : formatTimeET(m.date);
    const homeName = m.teams && m.teams.home ? m.teams.home.name : '';
    const awayName = m.teams && m.teams.away ? m.teams.away.name : '';
    const title = homeName && awayName ? `${homeName} vs ${awayName}` : m.title;
    return `<div class="search-item" data-id="${m.id}">
      <div class="search-item-teams"><strong>${title}</strong></div>
      <span class="cat-tag">${label}</span>
      <div class="search-item-meta">${status}</div>
    </div>`;
  }).join('');

  dropdown.querySelectorAll('.search-item').forEach(el => {
    el.addEventListener('click', () => {
      navigate('#/match/' + el.dataset.id);
      dropdown.classList.remove('open');
      document.getElementById('search-input').value = '';
    });
  });

  dropdown.classList.add('open');
}
