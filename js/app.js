function getCurrentRoute() {
  let path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/match' || path.startsWith('/match/')) return { type: 'match', id: new URLSearchParams(window.location.search).get('id') };
  const cats = ['nfl','nba','mlb','ufc','boxing','wwe','f1','wnba','soccer'];
  const clean = cats.find(c => path === '/' + c);
  if (clean) return { type: 'category', category: clean };
  const filePath = cats.find(c => path.includes('/' + c + '/') || path.includes('\\' + c + '\\'));
  if (filePath) return { type: 'category', category: filePath };
  return { type: 'home' };
}

document.addEventListener('DOMContentLoaded', () => {
  const route = getCurrentRoute();
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  if (route.type === 'category') {
    document.getElementById('page-category').classList.add('active');
    const link = document.querySelector(`.nav-link[data-cat="${route.category}"]`);
    if (link) link.classList.add('active');
    renderCategory(route.category);
  } else if (route.type === 'match' && route.id) {
    document.getElementById('page-match').classList.add('active');
    renderMatchDetail(route.id);
  } else {
    document.getElementById('page-home').classList.add('active');
    renderHomepage();
  }

  initSearch();
});

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
      if (m.date === 0 || !m.sources || m.sources.length === 0 || seen.has(m.id)) return;
      seen.add(m.id);
      rows.push(m);
    }

    (popular || []).forEach(addMatch);
    (live || []).forEach(addMatch);
    (today || []).forEach(addMatch);

    if (rows.length === 0) { loading.textContent = 'No matches available right now. Check back later!'; return; }
    loading.style.display = 'none';
    tbody.innerHTML = rows.map(m => buildMatchRow(m, true, false)).join('');
    attachRowListeners(tbody);
  }).catch(err => { loading.textContent = 'Failed to load matches. Please refresh.'; console.error(err); });
}

function renderCategory(cat) {
  const tbody = document.getElementById('cat-tbody');
  const loading = document.getElementById('loading-cat');
  const title = document.getElementById('cat-title');
  title.innerHTML = `Sportsurge ${getCategoryLabel(cat)} <span>Streams</span>`;

  Promise.all([
    getMatchesBySport(cat).catch(() => []),
    getAllMatches().catch(() => [])
  ]).then(([sportMatches, all]) => {
    const filter = m => classifyMatch(m) === cat && m.date !== 0 && m.sources && m.sources.length > 0;
    const allFiltered = (all || []).filter(filter);
    const sportFiltered = (sportMatches || []).filter(filter);

    const seen = new Set();
    const combined = [];
    [...sportFiltered, ...allFiltered].forEach(m => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      combined.push(m);
    });

    combined.sort((a, b) => {
      const aL = isLive(a.date), bL = isLive(b.date);
      if (aL && !bL) return -1;
      if (!aL && bL) return 1;
      return a.date - b.date;
    });

    if (combined.length === 0) { loading.textContent = 'No matches available for this category.'; return; }
    loading.style.display = 'none';
    tbody.innerHTML = combined.map(m => buildMatchRow(m, false, true)).join('');
    attachRowListeners(tbody);
  }).catch(err => { loading.textContent = 'Failed to load matches.'; console.error(err); });
}

function buildMatchRow(m, showCatOnHome, showFullDate) {
  const cls = classifyMatch(m);
  const catLabel = getCategoryLabel(cls);
  const home = m.teams && m.teams.home || {};
  const away = m.teams && m.teams.away || {};
  const homeBadge = home.badge ? getBadgeUrl(home.badge) : '';
  const awayBadge = away.badge ? getBadgeUrl(away.badge) : '';
  const homeName = home.name || '';
  const awayName = away.name || '';

  const live = isLive(m.date);
  let statusHtml;
  if (live) {
    statusHtml = `<div class="status-live">🔴 LIVE</div>`;
  } else if (showFullDate && !isToday(m.date)) {
    statusHtml = `<div class="status-time">${formatDateOnlyET(m.date)}<br><span class="status-sub">${formatTimeET(m.date)}</span></div>`;
  } else {
    statusHtml = `<div class="status-time">${formatTimeET(m.date)}</div>`;
  }
  const catHtml = showCatOnHome ? `<div class="cat-tag">${catLabel}</div>` : '';

  return `<tr class="match-row" data-id="${m.id}">
    <td><div class="team-cell">${homeBadge ? `<img src="${homeBadge}" alt="" loading="lazy">` : ''}<span class="name">${homeName || m.title.split(' vs ')[0]}</span></div></td>
    <td class="status-cell">${statusHtml}${catHtml}</td>
    <td><div class="team-cell">${awayBadge ? `<img src="${awayBadge}" alt="" loading="lazy">` : ''}<span class="name">${awayName || m.title.split(' vs ')[1] || ''}</span></div></td>
    <td class="nav-icon">›</td>
  </tr>`;
}

function attachRowListeners(tbody) {
  tbody.querySelectorAll('.match-row').forEach(row => {
    row.addEventListener('click', () => {
      window.location.href = '/match/?id=' + row.dataset.id;
    });
  });
}

async function renderMatchDetail(id) {
  const container = document.getElementById('match-detail-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Loading match details...</div>';

  try {
    const all = await getAllMatches();
    const match = all.find(m => m.id === id);
    if (!match) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Match not found.</div>'; return; }

    const cat = classifyMatch(match);
    const catLabel = getCategoryLabel(cat);
    const home = match.teams && match.teams.home || {};
    const away = match.teams && match.teams.away || {};
    const homeBadge = home.badge ? getBadgeUrl(home.badge) : '';
    const awayBadge = away.badge ? getBadgeUrl(away.badge) : '';
    const live = isLive(match.date);
    const dateStr = isToday(match.date) ? 'Today' : formatDateET(match.date);
    const timeStr = formatTimeET(match.date);

    let sourcesHtml = '<div class="sources-grid">';
    for (const s of match.sources || []) {
      try {
        const streams = await getStream(s.source, s.id);
        const ps = streams[0] || {};
        const lang = ps.language || 'Unknown';
        const hd = ps.hd ? 'HD' : 'SD';
        const viewers = ps.viewers !== undefined ? `${ps.viewers} watching` : '';
        const watchUrl = `https://watch.sportsurge.shop/?source=${s.source}&id=${s.id}&stream=${ps.streamNo || 1}&matchId=${match.id}`;
        sourcesHtml += `<div class="source-card"><div class="sname">${s.source.charAt(0).toUpperCase() + s.source.slice(1)}</div><div class="sinfo">${lang} ${hd}</div>${viewers ? `<div class="sviewers">${viewers}</div>` : ''}<a href="${watchUrl}" target="_blank" rel="noopener" class="watch-btn">▶ Watch</a></div>`;
      } catch (e) {
        sourcesHtml += `<div class="source-card"><div class="sname">${s.source.charAt(0).toUpperCase() + s.source.slice(1)}</div><div class="sinfo">Stream unavailable</div></div>`;
      }
    }
    sourcesHtml += '</div>';

    container.innerHTML = `
      <div class="match-detail-header">
        <div class="teams">
          <div class="team">${homeBadge ? `<img src="${homeBadge}" alt="${home.name}">` : ''}<span class="tname">${home.name}</span></div>
          <div class="vs">VS</div>
          <div class="team">${awayBadge ? `<img src="${awayBadge}" alt="${away.name}">` : ''}<span class="tname">${away.name}</span></div>
        </div>
        <div class="meta"><span>${live ? '🔴 LIVE' : '⏰ ' + dateStr}</span><span>🏆 ${catLabel}</span><span>🕒 ${timeStr} ET</span></div>
      </div>
      <h2 style="font-size:1rem;font-weight:700;margin-bottom:4px">Stream Sources</h2>
      ${sourcesHtml}
    `;
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Failed to load match details.</div>';
    console.error(err);
  }
}
