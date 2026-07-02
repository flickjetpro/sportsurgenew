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

const WNBA_TEAMS = [
  'mystics', 'dream', 'sun', 'wings', 'mercury', 'storm',
  'lynx', 'liberty', 'aces', 'sky', 'fever', 'sparks', 'valkyries', 'tempo'
];

function classifyMatch(match) {
  const title = (match.title || '').toLowerCase();
  const homeName = ((match.teams && match.teams.home && match.teams.home.name) || '').toLowerCase();
  const awayName = ((match.teams && match.teams.away && match.teams.away.name) || '').toLowerCase();
  const combined = title + ' ' + homeName + ' ' + awayName;
  const cat = (match.category || '').toLowerCase();

  if (cat === 'american-football') {
    const isCFL = CFL_TEAMS.some(t => combined.includes(t));
    if (isCFL) return cat;
    return 'nfl';
  }

  if (cat === 'basketball') {
    if (title.includes(' w ') || homeName.endsWith(' w') || awayName.endsWith(' w') ||
        WNBA_TEAMS.some(t => homeName.endsWith(t) || awayName.endsWith(t))) {
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
    soccer: 'Soccer', fight: 'Fight', motorsports: 'Motorsports',
    'american-football': 'American Football',
    hockey: 'Hockey', tennis: 'Tennis', rugby: 'Rugby',
    golf: 'Golf', cricket: 'Cricket', afl: 'AFL',
    billiards: 'Billiards', darts: 'Darts', other: 'Other'
  };
  return labels[cat] || cat;
}

function getCategoryEmoji(cat) {
  const emojis = {
    nfl: '\u{1F3C8}', nba: '\u{1F3C0}', mlb: '\u{26BE}', ufc: '\u{1F94A}',
    boxing: '\u{1F94A}', wwe: '\u{1F93C}', f1: '\u{1F3CE}\uFE0F',
    wnba: '\u{1F3C0}', soccer: '\u{26BD}',
    fight: '\u{1F94A}', motorsports: '\u{1F3CE}\uFE0F',
    'american-football': '\u{1F3C8}', hockey: '\u{1F3D2}\uFE0F',
    tennis: '\u{1F3BE}', rugby: '\u{1F3C9}', golf: '\u{26F3}\uFE0F',
    cricket: '\u{1F3CF}', afl: '\u{1F3C8}', billiards: '\u{1F3B1}',
    darts: '\u{1F3AF}'
  };
  return emojis[cat] || '\u{1F4FA}';
}
