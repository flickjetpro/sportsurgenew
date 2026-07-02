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

async function getSports() {
  return fetchJSON(`${API_BASE}/sports`);
}

async function getLiveMatches() {
  return fetchJSON(`${API_BASE}/matches/live`);
}

async function getPopularLiveMatches() {
  return fetchJSON(`${API_BASE}/matches/live/popular`);
}

async function getTodayMatches() {
  return fetchJSON(`${API_BASE}/matches/all-today`);
}

async function getAllMatches() {
  return fetchJSON(`${API_BASE}/matches/all`);
}

async function getMatchesBySport(sport) {
  return fetchJSON(`${API_BASE}/matches/${sport}`);
}

async function getPopularMatchesBySport(sport) {
  return fetchJSON(`${API_BASE}/matches/${sport}/popular`);
}

async function getStream(source, id) {
  return fetchJSON(`${API_BASE}/stream/${source}/${id}`);
}

function getBadgeUrl(badge) {
  return `${API_BASE}/images/badge/${badge}.webp`;
}

function formatTimeET(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateET(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function isLive(timestamp) {
  return timestamp < Date.now();
}

function isToday(timestamp) {
  const now = new Date();
  const d = new Date(timestamp);
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate();
}
