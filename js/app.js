let currentRoute = '';
let matchDataCache = [];

function navigate(hash) {
  if (hash === currentRoute) return;
  currentRoute = hash;
  window.location.hash = hash;
  routePage(hash);
}

function routePage(hash) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const clean = hash.replace('#', '') || '/';

  if (clean === '/' || clean === '') {
    document.getElementById('page-home').classList.add('active');
    renderHomepage();
  } else if (clean.startsWith('/match/')) {
    const id = clean.replace('/match/', '');
    document.getElementById('page-match').classList.add('active');
    renderMatchDetail(id);
  } else {
    const catMatch = clean.match(/^\/(\w+)\//);
    if (catMatch) {
      const cat = catMatch[1];
      document.getElementById('page-category').classList.add('active');
      const navLink = document.querySelector(`.nav-link[data-cat="${cat}"]`);
      if (navLink) navLink.classList.add('active');
      renderCategory(cat);
    } else {
      navigate('#/');
    }
  }
}

function renderHomepage() {
  const tbody = document.getElementById('match-tbody');
  const loading = document.getElementById('loading-matches');

  Promise.all([
    getPopularLiveMatches().catch(() => []),
    getLiveMatches().catch(() => []),
    getTodayMatches().catch(() => [])
  ]).then(([popular, live, today]) => {
    const seen = new Set();
    const rows = [];

    function addMatch(m) {
      if (m.date === 0) return;
      if (!m.sources || m.sources.length === 0) return;
      if (seen.has(m.id)) return;
      seen.add(m.id);
      rows.push(m);
    }

    (popular || []).forEach(addMatch);
    (live || []).forEach(addMatch);
    (today || []).forEach(addMatch);

    if (rows.length === 0) {
      loading.textContent = 'No matches available right now. Check back later!';
      return;
    }

    loading.style.display = 'none';
    tbody.innerHTML = rows.map(m => buildMatchRow(m, true)).join('');
    attachRowListeners(tbody);
    updateLeagueCounts(rows);
  }).catch(err => {
    loading.textContent = 'Failed to load matches. Please refresh.';
    console.error(err);
  });
}

function renderCategory(cat) {
  const tbody = document.getElementById('cat-tbody');
  const loading = document.getElementById('loading-cat');
  const title = document.getElementById('cat-title');
  title.innerHTML = `${getCategoryEmoji(cat)} ${getCategoryLabel(cat)} <span>Streams</span>`;

  Promise.all([
    getMatchesBySport(cat).catch(() => []),
    getAllMatches().catch(() => [])
  ]).then(([sportMatches, all]) => {
    const allFiltered = all.filter(m => classifyMatch(m) === cat && m.sources && m.sources.length > 0 && m.date !== 0);
    const sportFiltered = (sportMatches || []).filter(m => classifyMatch(m) === cat && m.sources && m.sources.length > 0 && m.date !== 0);

    const seen = new Set();
    const combined = [];

    [...sportFiltered, ...allFiltered].forEach(m => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      combined.push(m);
    });

    combined.sort((a, b) => {
      const aLive = isLive(a.date);
      const bLive = isLive(b.date);
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return a.date - b.date;
    });

    if (combined.length === 0) {
      loading.textContent = 'No matches available for this category.';
      return;
    }

    loading.style.display = 'none';
    tbody.innerHTML = combined.map(m => buildMatchRow(m, false)).join('');
    attachRowListeners(tbody);
  }).catch(err => {
    loading.textContent = 'Failed to load matches. Please refresh.';
    console.error(err);
  });
}

function buildMatchRow(m, showCatOnHome) {
  const classify = classifyMatch(m);
  const catLabel = getCategoryLabel(classify);
  const homeName = m.teams && m.teams.home ? m.teams.home.name : '';
  const awayName = m.teams && m.teams.away ? m.teams.away.name : '';
  const homeBadge = m.teams && m.teams.home && m.teams.home.badge ? getBadgeUrl(m.teams.home.badge) : '';
  const awayBadge = m.teams && m.teams.away && m.teams.away.badge ? getBadgeUrl(m.teams.away.badge) : '';
  const displayTitle = homeName && awayName ? `${homeName} vs ${awayName}` : (m.title || 'Match');

  const live = isLive(m.date);
  const statusHtml = live
    ? `<div class="status-live">\u{1F534} LIVE</div>`
    : `<div class="status-time">${formatTimeET(m.date)}</div>`;

  const catHtml = showCatOnHome ? `<div class="cat-tag">${catLabel}</div>` : '';

  const homeHtml = homeName
    ? `<div class="team-cell">${homeBadge ? `<img src="${homeBadge}" alt="" loading="lazy">` : ''}<span class="name">${homeName}</span></div>`
    : `<div class="team-cell"><span class="name">${displayTitle.split(' vs ')[0] || displayTitle}</span></div>`;

  const awayHtml = awayName
    ? `<div class="team-cell">${awayBadge ? `<img src="${awayBadge}" alt="" loading="lazy">` : ''}<span class="name">${awayName}</span></div>`
    : `<div class="team-cell"><span class="name">${displayTitle.split(' vs ')[1] || ''}</span></div>`;

  return `<tr class="match-row" data-id="${m.id}">
    <td>${homeHtml}</td>
    <td class="status-cell">${statusHtml}${catHtml}</td>
    <td>${awayHtml}</td>
    <td class="nav-icon">\u{25B6}</td>
  </tr>`;
}

function attachRowListeners(tbody) {
  tbody.querySelectorAll('.match-row').forEach(row => {
    row.addEventListener('click', () => {
      navigate('#/match/' + row.dataset.id);
    });
  });
}

function updateLeagueCounts(rows) {
  const counts = {};
  rows.forEach(m => {
    const cat = classifyMatch(m);
    counts[cat] = (counts[cat] || 0) + 1;
  });
  document.querySelectorAll('.league-card').forEach(card => {
    const cat = card.dataset.cat;
    const count = counts[cat] || 0;
    let el = card.querySelector('.lcount');
    if (!el) {
      el = document.createElement('div');
      el.className = 'lcount';
      card.appendChild(el);
    }
    el.textContent = count > 0 ? `${count} match${count > 1 ? 'es' : ''}` : 'No matches';
  });
}

async function renderMatchDetail(id) {
  const container = document.getElementById('match-detail-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Loading match details...</div>';

  try {
    const all = await getAllMatches();
    const match = all.find(m => m.id === id);

    if (!match) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Match not found.</div>';
      return;
    }

    const cat = classifyMatch(match);
    const catLabel = getCategoryLabel(cat);
    const homeName = match.teams && match.teams.home ? match.teams.home.name : '';
    const awayName = match.teams && match.teams.away ? match.teams.away.name : '';
    const homeBadge = match.teams && match.teams.home && match.teams.home.badge ? getBadgeUrl(match.teams.home.badge) : '';
    const awayBadge = match.teams && match.teams.away && match.teams.away.badge ? getBadgeUrl(match.teams.away.badge) : '';
    const displayTitle = homeName && awayName ? `${homeName} vs ${awayName}` : (match.title || 'Match');
    const live = isLive(match.date);

    const dateStr = isToday(match.date)
      ? 'Today'
      : formatDateET(match.date);

    const timeStr = formatTimeET(match.date);

    let sourcesHtml = '<div class="sources-grid">';
    for (const s of match.sources || []) {
      try {
        const streams = await getStream(s.source, s.id);
        const primaryStream = streams[0] || {};
        const lang = primaryStream.language || 'Unknown';
        const hd = primaryStream.hd ? 'HD' : 'SD';
        const viewers = primaryStream.viewers !== undefined ? `${primaryStream.viewers} watching` : '';
        const watchUrl = `https://watch.sportsurge.shop/?source=${s.source}&id=${s.id}&stream=${primaryStream.streamNo || 1}&matchId=${match.id}`;

        sourcesHtml += `<div class="source-card">
          <div class="sname">${s.source.charAt(0).toUpperCase() + s.source.slice(1)}</div>
          <div class="sinfo">${lang} ${hd}</div>
          ${viewers ? `<div class="sviewers">${viewers}</div>` : ''}
          <a href="${watchUrl}" target="_blank" rel="noopener" class="watch-btn">\u{25B6} Watch</a>
        </div>`;
      } catch (e) {
        sourcesHtml += `<div class="source-card">
          <div class="sname">${s.source.charAt(0).toUpperCase() + s.source.slice(1)}</div>
          <div class="sinfo">Stream unavailable</div>
        </div>`;
      }
    }
    sourcesHtml += '</div>';

    container.innerHTML = `
      <div class="match-detail-header">
        <div class="teams">
          <div class="team">
            ${homeBadge ? `<img src="${homeBadge}" alt="${homeName}">` : ''}
            <span class="tname">${homeName}</span>
          </div>
          <div class="vs">VS</div>
          <div class="team">
            ${awayBadge ? `<img src="${awayBadge}" alt="${awayName}">` : ''}
            <span class="tname">${awayName}</span>
          </div>
        </div>
        <div class="meta">
          <span>${live ? '\u{1F534} LIVE' : '\u{23F0} ' + dateStr}</span>
          <span>\u{1F3C6} ${catLabel}</span>
          <span>\u{1F552} ${timeStr} ET</span>
        </div>
      </div>
      <h2 style="font-size:1rem;font-weight:700;margin-bottom:4px">Stream Sources</h2>
      ${sourcesHtml}
    `;
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Failed to load match details.</div>';
    console.error(err);
  }
}

window.addEventListener('hashchange', () => {
  routePage(window.location.hash || '#/');
});

document.querySelectorAll('.league-card').forEach(card => {
  card.addEventListener('click', () => {
    navigate('#/' + card.dataset.cat + '/');
  });
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(link.getAttribute('href'));
  });
});

document.querySelector('[data-nav="home"]').addEventListener('click', (e) => {
  e.preventDefault();
  navigate('#/');
});

const initialHash = window.location.hash || '#/';
routePage(initialHash);
initSearch();
