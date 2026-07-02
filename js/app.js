const API_BASE = 'https://streamed.pk/api';
const CACHE_TTL = 60000;
const cache = {};

function getCached(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCached(key, data) {
  cache[key] = { data, ts: Date.now() };
}

async function fetchJSON(url) {
  const cached = getCached(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const data = await res.json();
  setCached(url, data);
  return data;
}

async function getSports() { return fetchJSON(`${API_BASE}/sports`); }
async function getLiveMatches() { return fetchJSON(`${API_BASE}/matches/live`); }
async function getPopularLiveMatches() { return fetchJSON(`${API_BASE}/matches/live/popular`); }
async function getTodayMatches() { return fetchJSON(`${API_BASE}/matches/all-today`); }
async function getAllMatches() { return fetchJSON(`${API_BASE}/matches/all`); }
async function getMatchesBySport(sport) { return fetchJSON(`${API_BASE}/matches/${sport}`); }
async function getPopularMatchesBySport(sport) { return fetchJSON(`${API_BASE}/matches/${sport}/popular`); }
async function getStream(source, id) { return fetchJSON(`${API_BASE}/stream/${source}/${id}`); }
function getBadgeUrl(badge) { return `${API_BASE}/images/badge/${badge}.webp`; }

function formatTimeET(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true
  });
}

function formatDateET(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  });
}

function isLive(timestamp) { return timestamp < Date.now(); }
function isToday(timestamp) {
  const now = new Date();
  const d = new Date(timestamp);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const CFL_TEAMS = ['stampeders','argonauts','blue bombers','tiger-cats','redblacks','roughriders','elks','bc lions','alouettes','winnipeg','hamilton','ottawa','saskatchewan','montreal','toronto','calgary','edmonton'];
const FIGHT_KEYWORDS = {ufc:['ufc','fight night'],boxing:['boxing'],wwe:['wwe','smackdown','raw','nxt','aew','collision','wrestlemania','royal rumble','summerslam','survivor series','tna','impact']};
const F1_KEYWORDS = ['grand prix','practice','qualifying','sprint','formula 1','race'];

function classifyMatch(match) {
  const title = (match.title || '').toLowerCase();
  const home = (match.teams && match.teams.home && match.teams.home.name || '').toLowerCase();
  const away = (match.teams && match.teams.away && match.teams.away.name || '').toLowerCase();
  const combined = title + ' ' + home + ' ' + away;
  const cat = (match.category || '').toLowerCase();

  if (cat === 'american-football') return CFL_TEAMS.some(t => combined.includes(t)) ? 'cfb' : 'nfl';
  if (cat === 'basketball') return (title.includes(' w ') || home.endsWith(' w') || away.endsWith(' w')) ? 'wnba' : 'nba';
  if (cat === 'baseball') return 'mlb';
  if (cat === 'fight') { for (const [label, ks] of Object.entries(FIGHT_KEYWORDS)) { if (ks.some(k => combined.includes(k))) return label; } return 'fight'; }
  if (cat === 'motor-sports') return F1_KEYWORDS.some(k => combined.includes(k)) ? 'f1' : 'motorsports';
  if (cat === 'football') return 'soccer';
  return cat;
}

function getCategoryLabel(cat) {
  const labels = {nfl:'NFL',nba:'NBA',mlb:'MLB',ufc:'UFC',boxing:'Boxing',wwe:'WWE',f1:'F1',wnba:'WNBA',soccer:'Soccer',cfb:'CFB',fight:'Fight',motorsports:'Motorsports'};
  return labels[cat] || cat;
}

function getCategoryEmoji(cat) {
  const emojis = {nfl:'🏈',nba:'🏀',mlb:'⚾',ufc:'🥊',boxing:'🥊',wwe:'🤼',f1:'🏎️',wnba:'🏀',soccer:'⚽',cfb:'🏈',fight:'🥊',motorsports:'🏎️'};
  return emojis[cat] || '📺';
}

function getCurrentRoute() {
  let path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/match' || path.startsWith('/match/')) return { type: 'match', id: new URLSearchParams(window.location.search).get('id') };
  const cats = ['nfl','nba','mlb','ufc','boxing','wwe','f1','wnba','soccer'];
  const match = cats.find(c => path === '/' + c);
  if (match) return { type: 'category', category: match };
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
  document.querySelectorAll('.league-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = '/' + card.dataset.cat + '/';
    });
  });
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
    tbody.innerHTML = rows.map(m => buildMatchRow(m, true)).join('');
    attachRowListeners(tbody);
    updateLeagueCounts(rows);
  }).catch(err => { loading.textContent = 'Failed to load matches. Please refresh.'; console.error(err); });
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
    tbody.innerHTML = combined.map(m => buildMatchRow(m, false)).join('');
    attachRowListeners(tbody);
  }).catch(err => { loading.textContent = 'Failed to load matches.'; console.error(err); });
}

function buildMatchRow(m, showCatOnHome) {
  const cls = classifyMatch(m);
  const catLabel = getCategoryLabel(cls);
  const home = m.teams && m.teams.home || {};
  const away = m.teams && m.teams.away || {};
  const homeBadge = home.badge ? getBadgeUrl(home.badge) : '';
  const awayBadge = away.badge ? getBadgeUrl(away.badge) : '';
  const homeName = home.name || '';
  const awayName = away.name || '';

  const live = isLive(m.date);
  const statusHtml = live ? `<div class="status-live">🔴 LIVE</div>` : `<div class="status-time">${formatTimeET(m.date)}</div>`;
  const catHtml = showCatOnHome ? `<div class="cat-tag">${catLabel}</div>` : '';

  return `<tr class="match-row" data-id="${m.id}">
    <td><div class="team-cell">${homeBadge ? `<img src="${homeBadge}" alt="" loading="lazy">` : ''}<span class="name">${homeName || m.title.split(' vs ')[0]}</span></div></td>
    <td class="status-cell">${statusHtml}${catHtml}</td>
    <td><div class="team-cell">${awayBadge ? `<img src="${awayBadge}" alt="" loading="lazy">` : ''}<span class="name">${awayName || m.title.split(' vs ')[1] || ''}</span></div></td>
    <td class="nav-icon">▶</td>
  </tr>`;
}

function attachRowListeners(tbody) {
  tbody.querySelectorAll('.match-row').forEach(row => {
    row.addEventListener('click', () => {
      window.location.href = '/match/?id=' + row.dataset.id;
    });
  });
}

function updateLeagueCounts(rows) {
  const counts = {};
  rows.forEach(m => { const c = classifyMatch(m); counts[c] = (counts[c] || 0) + 1; });
  document.querySelectorAll('.league-card').forEach(card => {
    const cat = card.dataset.cat;
    const count = counts[cat] || 0;
    let el = card.querySelector('.lcount');
    if (!el) { el = document.createElement('div'); el.className = 'lcount'; card.appendChild(el); }
    el.textContent = count > 0 ? `${count} match${count > 1 ? 'es' : ''}` : 'No matches';
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
