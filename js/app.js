(function(){var _Hasync=_Hasync||[];_Hasync.push(['Histats.start','1,5037469,4,0,0,0,00010000']);_Hasync.push(['Histats.fasi','1']);_Hasync.push(['Histats.track_hits','']);var hs=document.createElement('script');hs.type='text/javascript';hs.async=true;hs.src=('//s10.histats.com/js15_as.js');document.head.appendChild(hs);})();

function getCurrentRoute() {
  let path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path.endsWith('/match') || path.includes('/match/') || path.includes('\\match\\')) return { type: 'match', id: new URLSearchParams(window.location.search).get('id') };
  const cats = ['nfl','nba','mlb','ufc','boxing','wwe','f1','wnba','soccer'];
  const clean = cats.find(c => path === '/' + c || path.endsWith('/' + c));
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

async function renderHomepage() {
  const tbody = document.getElementById('match-tbody');
  const next24h = Date.now() + 86400000;

  try {
    const [today, popularLive] = await Promise.all([
      getTodayMatches().catch(() => []),
      getPopularLiveMatches().catch(() => [])
    ]);

    const seen = new Set();
    const matches = [];

    function add(m) {
      if (m.date === 0 || !m.sources || m.sources.length === 0 || seen.has(m.id)) return;
      if (m.date > next24h) return;
      seen.add(m.id);
      matches.push(m);
    }

    (today || []).forEach(add);
    (popularLive || []).forEach(add);

    if (!matches.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px 0;color:var(--muted)">No matches available right now.</td></tr>';
      return;
    }

    const withViewers = await Promise.all(matches.map(async m => {
      const results = await Promise.all(
        (m.sources || []).map(s => getStream(s.source, s.id).catch(() => []))
      );
      const totalViewers = results.reduce((sum, streams) =>
        sum + streams.reduce((s, st) => s + (st.viewers || 0), 0), 0);
      return { ...m, totalViewers };
    }));

    const now = Date.now();
    const next3h = now + 3 * 60 * 60 * 1000;

    const live = withViewers.filter(m => isLive(m.date));
    const upcoming = withViewers.filter(m => !isLive(m.date));

    const tier1 = withViewers.filter(m => m.totalViewers > 0 && (isLive(m.date) || m.date <= next3h)).sort((a, b) => b.totalViewers - a.totalViewers);

    const popularIds = new Set((popularLive || []).map(m => m.id));
    const tier2 = live.filter(m => m.totalViewers === 0 && popularIds.has(m.id)).sort((a, b) => a.date - b.date);
    const tier3 = live.filter(m => m.totalViewers === 0 && !popularIds.has(m.id)).sort((a, b) => a.date - b.date);
    const tier4 = upcoming.sort((a, b) => a.date - b.date);

    const rows = [...tier1, ...tier2, ...tier3, ...tier4];
    tbody.innerHTML = rows.map(m => buildMatchRow(m, true, false)).join('');
    attachRowListeners(tbody);
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px 0;color:var(--muted)">Failed to load matches.</td></tr>';
    console.error(err);
  }
}

async function renderCategory(cat) {
  const tbody = document.getElementById('cat-tbody');
  const title = document.getElementById('cat-title');
  title.innerHTML = `Sportsurge ${getCategoryLabel(cat)} Streams`;

  try {
    const [sportMatches, all] = await Promise.all([
      getMatchesBySport(cat).catch(() => []),
      getAllMatches().catch(() => [])
    ]);

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

    if (!combined.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:40px 0">No matches available for this category.</td></tr>';
      return;
    }

    const withViewers = await Promise.all(combined.map(async m => {
      const results = await Promise.all(
        (m.sources || []).map(s => getStream(s.source, s.id).catch(() => []))
      );
      const totalViewers = results.reduce((sum, streams) =>
        sum + streams.reduce((s, st) => s + (st.viewers || 0), 0), 0);
      return { ...m, totalViewers };
    }));

    const now = Date.now();
    const next3h = now + 3 * 60 * 60 * 1000;

    const live = withViewers.filter(m => isLive(m.date));
    const upcoming = withViewers.filter(m => !isLive(m.date));

    const tier1 = withViewers.filter(m => m.totalViewers > 0 && (isLive(m.date) || m.date <= next3h)).sort((a, b) => b.totalViewers - a.totalViewers);
    const tier2 = live.filter(m => m.totalViewers === 0).sort((a, b) => a.date - b.date);
    const tier3 = upcoming.sort((a, b) => a.date - b.date);

    const rows = [...tier1, ...tier2, ...tier3];
    tbody.innerHTML = rows.map(m => buildMatchRow(m, false, true)).join('');
    attachRowListeners(tbody);
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:40px 0">Failed to load matches.</td></tr>';
    console.error(err);
  }
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
    <td><div class="team-cell">${homeBadge ? `<img src="${homeBadge}" alt="${homeName || m.title.split(/\s+vs\.?\s*/i)[0]}" loading="lazy">` : ''}<span class="name">${homeName || m.title.split(/\s+vs\.?\s*/i)[0]}</span></div></td>
    <td class="status-cell">${statusHtml}${catHtml}</td>
    <td><div class="team-cell">${awayBadge ? `<img src="${awayBadge}" alt="${awayName || m.title.split(/\s+vs\.?\s*/i)[1] || ''}" loading="lazy">` : ''}<span class="name">${awayName || m.title.split(/\s+vs\.?\s*/i)[1] || ''}</span></div></td>
    <td class="nav-icon">›</td>
  </tr>`;
}

function attachRowListeners(tbody) {
  tbody.querySelectorAll('.match-row').forEach(row => {
    row.addEventListener('click', () => {
      window.location.href = '/match/index.html?id=' + row.dataset.id;
    });
  });
}

async function renderMatchDetail(id) {
  const container = document.getElementById('match-detail-content');

  try {
    const all = await getAllMatches();
    const match = all.find(m => m.id === id);
    if (!match) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Match not found.</div>';
      return;
    }

    const cat = classifyMatch(match);
    const catLabel = getCategoryLabel(cat);
    const catEmoji = getCategoryEmoji(cat);
    const home = match.teams?.home || {};
    const away = match.teams?.away || {};
    const homeBadge = home.badge ? getBadgeUrl(home.badge) : '';
    const awayBadge = away.badge ? getBadgeUrl(away.badge) : '';
    const live = isLive(match.date);

    let statusHtml;
    if (live) {
      statusHtml = '<span class="live-label">🔴 LIVE</span>';
    } else if (isToday(match.date)) {
      statusHtml = `<span>🕐 ${formatTimeET(match.date)} ET</span>`;
    } else {
      statusHtml = `<span>📅 ${formatDateOnlyET(match.date)} · ${formatTimeET(match.date)} ET</span>`;
    }

    const hasTeams = home.name && away.name;
    let heroHtml;
    if (hasTeams) {
      heroHtml = `
        <div class="match-hero">
          <div class="teams">
            <div class="team">${homeBadge ? `<img src="${homeBadge}" alt="${home.name}">` : ''}<span class="tname">${home.name}</span></div>
            <div class="vs">VS</div>
            <div class="team">${awayBadge ? `<img src="${awayBadge}" alt="${away.name}">` : ''}<span class="tname">${away.name}</span></div>
          </div>
          <div class="meta">${statusHtml}<span>${catEmoji} ${catLabel}</span></div>
        </div>`;
    } else {
      heroHtml = `
        <div class="match-hero">
          <div class="single-title">${match.title || 'Match'}</div>
          <div class="meta">${statusHtml}<span>${catEmoji} ${catLabel}</span></div>
        </div>`;
    }

    let sourcesHtml = '<h2 style="font-size:1rem;font-weight:700;margin-bottom:12px">Stream Sources</h2>';
    if (!match.sources || match.sources.length === 0) {
      sourcesHtml += '<div style="text-align:center;padding:24px;color:var(--muted)">No stream links available for this match.</div>';
    } else {
      const streamPromises = match.sources.map(async s => {
        try {
          const streams = await getStream(s.source, s.id);
          return { source: s.source, id: s.id, streams };
        } catch (e) {
          return { source: s.source, id: s.id, streams: [] };
        }
      });
      const results = await Promise.all(streamPromises);

      let hasAnyStreams = false;
      for (const result of results) {
        if (result.streams.length === 0) continue;
        hasAnyStreams = true;

        const capName = result.source.charAt(0).toUpperCase() + result.source.slice(1);
        const count = result.streams.length;

        sourcesHtml += `<div class="source-card">
          <div class="sc-header">
            <span class="sc-name">${capName}</span>
            <span class="sc-count">${count} ${count === 1 ? 'Link' : 'Links'}</span>
          </div>
          <table><thead><tr><th style="width:36px;text-align:center">#</th><th>Language</th><th style="width:100px">Viewers</th><th style="width:100px"></th></tr></thead><tbody>`;

        for (const ps of result.streams) {
          const lang = ps.language || 'Unknown';
          const badgeClass = ps.hd ? 'hd-badge' : 'sd-badge';
          const badgeText = ps.hd ? 'HD' : 'SD';
          const viewers = ps.viewers !== undefined ? `${ps.viewers} watching` : '';
          const watchUrl = `https://flickjetpro.github.io/sportsurgestreampage/stream/?source=${result.source}&id=${result.id}&stream=${ps.streamNo || 1}&matchId=${match.id}`;

          sourcesHtml += `<tr>
            <td class="snum">${ps.streamNo || '?'}</td>
            <td><div class="slang"><span>${lang}</span><span class="${badgeClass}">${badgeText}</span></div></td>
            <td class="sv">${viewers}</td>
            <td style="text-align:right"><a href="${watchUrl}" target="_blank" rel="noopener" class="src-watch-btn">▶ Watch</a></td>
          </tr>`;
        }

        sourcesHtml += '</tbody></table></div>';
      }

      if (!hasAnyStreams) {
        sourcesHtml = '<h2 style="font-size:1rem;font-weight:700;margin-bottom:12px">Stream Sources</h2><div style="text-align:center;padding:24px;color:var(--muted)">No stream links available for this match.</div>';
      }
    }

    const adHtml = '<div class="match-ad" id="match-ad"></div>';
    container.innerHTML = heroHtml + adHtml + sourcesHtml;

    const adDiv = document.getElementById('match-ad');
    if (adDiv) {
      window.atOptions = {'key':'f5b3ebd0afd4ebb276c39c1fba40970b','format':'iframe','height':90,'width':728,'params':{}};
      const sc = document.createElement('script');
      sc.src = 'https://www.highperformanceformat.com/f5b3ebd0afd4ebb276c39c1fba40970b/invoke.js';
      adDiv.appendChild(sc);
    }
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Failed to load match details.</div>';
    console.error(err);
  }
}
