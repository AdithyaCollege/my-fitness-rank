export const Theme = {
  colors: {
    background: '#0A0E17',      // Pitch black / deep slate base
    card: '#121824',            // Card panel background
    cardSecondary: '#1C2434',   // Highlighted list items
    border: '#1F2C47',          // Subdued borders
    text: '#FFFFFF',            // Main text color
    textMuted: '#8E9AA8',       // Secondary description text
    
    // Neon Esports Accents
    primary: '#00FF66',         // Neon Green
    secondary: '#00F0FF',       // Neon Cyan
    accent: '#B026FF',          // Neon Purple
    danger: '#FF0055',          // Neon Crimson/Pink
    warning: '#FFB300',         // Neon Gold/Yellow
    success: '#00FF66',
  },
  
  // Rank specific colors & glow configurations
  ranks: {
    Bronze: {
      color: '#CD7F32',
      name: 'Bronze',
      glow: '#CD7F32',
      minXp: 0,
      maxXp: 99,
    },
    Silver: {
      color: '#A8A9AD',
      name: 'Silver',
      glow: '#C0C0C0',
      minXp: 100,
      maxXp: 499,
    },
    Gold: {
      color: '#FFD700',
      name: 'Gold',
      glow: '#FFD700',
      minXp: 500,
      maxXp: 1499,
    },
    Platinum: {
      color: '#4AE3B5',
      name: 'Platinum',
      glow: '#4AE3B5',
      minXp: 1500,
      maxXp: 3499,
    },
    Diamond: {
      color: '#00F0FF',
      name: 'Diamond',
      glow: '#00F0FF',
      minXp: 3500,
      maxXp: 7499,
    },
    Champion: {
      color: '#FF0055',
      name: 'Champion',
      glow: '#FF0055',
      minXp: 7500,
      maxXp: 999999, // uncapped
    },
  },
  
  // Helper to generate React Native shadow style for glowing elements
  getGlow: (color: string, intensity: 'low' | 'medium' | 'high' = 'medium') => {
    const opacity = intensity === 'low' ? 0.3 : intensity === 'medium' ? 0.6 : 0.9;
    const radius = intensity === 'low' ? 4 : intensity === 'medium' ? 8 : 16;
    return {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: opacity,
      shadowRadius: radius,
      elevation: intensity === 'low' ? 3 : intensity === 'medium' ? 6 : 12, // for Android
    };
  },
};

export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Champion';

export function getRankDetails(xp: number) {
  if (xp >= 7500) return Theme.ranks.Champion;
  if (xp >= 3500) return Theme.ranks.Diamond;
  if (xp >= 1500) return Theme.ranks.Platinum;
  if (xp >= 500) return Theme.ranks.Gold;
  if (xp >= 100) return Theme.ranks.Silver;
  return Theme.ranks.Bronze;
}
