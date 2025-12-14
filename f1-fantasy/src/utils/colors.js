// src/utils/colors.js

// --- 1. TEAM COLORS (Primary & Secondary) ---
const TEAM_COLORS = {
  'red bull': { primary: '#0600ef', secondary: '#1a1a2e' },     // Navy / Dark Blue
  'ferrari': { primary: '#dc0000', secondary: '#000000' },      // Red / Black (Standard)
  'mercedes': { primary: '#00d2be', secondary: '#1f1f1f' },     // Teal / Silver-Black
  'mclaren': { primary: '#ff8700', secondary: '#474747' },      // Papaya / Anthracite
  'aston martin': { primary: '#006f62', secondary: '#cedc00' }, // British Racing Green / Acid Green
  'alpine': { primary: '#0090ff', secondary: '#fd4bc7' },       // Alpine Blue / Pink
  'williams': { primary: '#005aff', secondary: '#00a0ff' },     // Dark Blue / Light Blue
  'rb': { primary: '#1634cb', secondary: '#ffffff' },           // Visa Cash App Blue / White
  'kick': { primary: '#52e252', secondary: '#000000' },         // Neon Green / Black
  'sauber': { primary: '#52e252', secondary: '#000000' },
  'haas': { primary: '#b6babd', secondary: '#e6002b' },         // Grey / Red
  'default': { primary: '#444444', secondary: '#1a1a1a' },
};

// --- 2. RACE/COUNTRY COLORS ---
const RACE_COLORS = {
  // BAHRAIN (Red/White)
  'bahrain': { primary: '#ce1126', secondary: '#ffffff' }, 
  
  // SAUDI ARABIA (Green/White)
  'saudi': { primary: '#165d31', secondary: '#ffffff' }, 
  
  // AUSTRALIA (Blue/Red - Union Jack influence)
  'australia': { primary: '#012169', secondary: '#e4002b' }, 
  
  // JAPAN (White/Red - Rising Sun)
  'japan': { primary: '#ffffff', secondary: '#bc002d' }, 
  
  // CHINA (Red/Yellow)
  'china': { primary: '#ee1c25', secondary: '#ffff00' }, 
  
  // USA - MIAMI (Teal/Pink - Vice City Theme)
  'miami': { primary: '#00a19c', secondary: '#f68fbe' }, 
  
  // ITALY - IMOLA (Green/Red - Tricolore)
  'imola': { primary: '#009246', secondary: '#ce2b37' }, 
  'emilia': { primary: '#009246', secondary: '#ce2b37' }, 
  
  // MONACO (Red/White)
  'monaco': { primary: '#ce1126', secondary: '#ffffff' }, 
  
  // CANADA (Red/White - Maple Leaf)
  'canada': { primary: '#ff0000', secondary: '#ffffff' }, 
  
  // SPAIN (Red/Yellow)
  'spain': { primary: '#aa151b', secondary: '#f1bf00' }, 
  
  // AUSTRIA (Red/White)
  'austria': { primary: '#ef3340', secondary: '#ffffff' }, 
  
  // GREAT BRITAIN (Navy/Red)
  'britain': { primary: '#012169', secondary: '#c8102e' }, 
  'silverstone': { primary: '#012169', secondary: '#c8102e' }, 
  
  // HUNGARY (Green/Red/White)
  'hungary': { primary: '#477050', secondary: '#ce2939' }, 
  
  // BELGIUM (Black/Yellow/Red)
  'belgium': { primary: '#fae042', secondary: '#000000' }, 
  
  // NETHERLANDS (Orange - National Color)
  'netherlands': { primary: '#ff4f00', secondary: '#ffffff' }, 
  'dutch': { primary: '#ff4f00', secondary: '#ffffff' },
  
  // ITALY - MONZA (Red/White/Green - Distinct from Imola)
  'italy': { primary: '#ce2b37', secondary: '#009246' }, 
  'monza': { primary: '#ce2b37', secondary: '#009246' }, 
  
  // AZERBAIJAN (Blue/Red/Green)
  'azerbaijan': { primary: '#00b5e2', secondary: '#509e2f' }, 
  'baku': { primary: '#00b5e2', secondary: '#509e2f' }, 
  
  // SINGAPORE (Red/White)
  'singapore': { primary: '#ef3340', secondary: '#ffffff' }, 
  
  // USA - AUSTIN (Navy/Red - Stars & Stripes)
  'usa': { primary: '#002868', secondary: '#bf0a30' }, 
  'austin': { primary: '#002868', secondary: '#bf0a30' }, 
  
  // MEXICO (Green/Red)
  'mexico': { primary: '#006847', secondary: '#ce1126' }, 
  
  // BRAZIL (Green/Yellow)
  'brazil': { primary: '#009c3b', secondary: '#ffdf00' }, 
  
  // USA - LAS VEGAS (Black/Gold/Neon Red)
  'vegas': { primary: '#000000', secondary: '#d4af37' }, 
  
  // QATAR (Maroon/White)
  'qatar': { primary: '#8d1b3d', secondary: '#ffffff' }, 
  
  // ABU DHABI (Green/Red/White/Black)
  'abu dhabi': { primary: '#007a3d', secondary: '#ce1126' }, 
  
  // Default
  'default': { primary: '#333333', secondary: '#000000' },
};

// --- HELPER FUNCTIONS ---

export const getTeamColors = (teamName) => {
  if (!teamName) return TEAM_COLORS['default'];
  const normalized = teamName.toLowerCase();
  
  // We match partial strings (e.g. "oracle red bull racing" -> "red bull")
  const key = Object.keys(TEAM_COLORS).find(k => normalized.includes(k));
  return key ? TEAM_COLORS[key] : TEAM_COLORS['default'];
};

export const getRaceColors = (raceName) => {
  if (!raceName) return RACE_COLORS['default'];
  const normalized = raceName.toLowerCase();

  const key = Object.keys(RACE_COLORS).find(k => normalized.includes(k));
  return key ? RACE_COLORS[key] : RACE_COLORS['default'];
};