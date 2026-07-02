const CFL_TEAMS = [
  'stampeders', 'argonauts', 'blue bombers', 'tiger-cats', 'redblacks',
  'roughriders', 'elks', 'bc lions', 'alouettes', 'winnipeg', 'hamilton',
  'ottawa', 'saskatchewan', 'montreal', 'toronto', 'calgary', 'edmonton'
];

const FIGHT_KEYWORDS = {
  ufc: ['ufc', 'fight night'],
  boxing: ['boxing'],
  wwe: ['wwe', 'smackdown', 'raw', 'nxt', 'aew', 'collision', 'wrestlemania',
        'royal rumble', 'summerslam', 'survivor series', 'tna', 'impact']
};

const F1_KEYWORDS = ['grand prix', 'practice', 'qualifying', 'sprint', 'formula 1', 'race'];

function classifyMatch(match) {
  const title = (match.title || '').toLowerCase();
  const homeName = ((match.teams && match.teams.home && match.teams.home.name) || '').toLowerCase();
  const awayName = ((match.teams && match.teams.away && match.teams.away.name) || '').toLowerCase();
  const combined = title + ' ' + homeName + ' ' + awayName;
  const cat = (match.category || '').toLowerCase();

  if (cat === 'american-football') {
    const isCFL = CFL_TEAMS.some(t => combined.includes(t));
    if (isCFL) return 'cfb';
    return 'nfl';
  }

  if (cat === 'basketball') {
    if (title.includes(' w ') || homeName.endsWith(' w') || awayName.endsWith(' w')) {
      return 'wnba';
    }
    return 'nba';
  }

  if (cat === 'baseball') return 'mlb';

  if (cat === 'fight') {
    for (const [label, keywords] of Object.entries(FIGHT_KEYWORDS)) {
      if (keywords.some(k => combined.includes(k))) return label;
    }
    return 'fight';
  }

  if (cat === 'motor-sports') {
    if (F1_KEYWORDS.some(k => combined.includes(k))) return 'f1';
    return 'motorsports';
  }

  if (cat === 'football') return 'soccer';

  return cat;
}

function getCategoryLabel(cat) {
  const labels = {
    nfl: 'NFL', nba: 'NBA', mlb: 'MLB', ufc: 'UFC',
    boxing: 'Boxing', wwe: 'WWE', f1: 'F1', wnba: 'WNBA',
    soccer: 'Soccer', cfb: 'CFB', fight: 'Fight',
    motorsports: 'Motorsports'
  };
  return labels[cat] || cat;
}

function getCategoryEmoji(cat) {
  const emojis = {
    nfl: '\u{1F3C8}', nba: '\u{1F3C0}', mlb: '\u{26BE}', ufc: '\u{1F94A}',
    boxing: '\u{1F94A}', wwe: '\u{1F93C}', f1: '\u{1F3CE}\uFE0F',
    wnba: '\u{1F3C0}', soccer: '\u{26BD}', cfb: '\u{1F3C8}',
    fight: '\u{1F94A}', motorsports: '\u{1F3CE}\uFE0F'
  };
  return emojis[cat] || '\u{1F4FA}';
}
