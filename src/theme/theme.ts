export const Theme = {
  colors: {
    background: '#06060C',      // Deep space black base
    card: '#0E091B',            // Dark purple-tinted glass card background
    cardSecondary: '#160F2B',   // Elevated purple-tinted glass
    border: '#22163B',          // Subdued purple border
    text: '#FFFFFF',            // Main text color
    textMuted: '#8A82A0',       // Muted slate-purple description text
    
    // Premium Purple accents
    primary: '#7C3AED',         // Rich Purple
    secondary: '#00F0FF',       // Neon Cyan (details/accents)
    accent: '#A78BFA',          // Light Purple Highlight
    danger: '#FF2A5F',          // Neon Crimson/Pink
    warning: '#F59E0B',         // Warm Amber/Gold
    success: '#10B981',         // Emerald Green
  },
  gradients: {
    primary: ['#7C3AED', '#9333EA'] as [string, string],
    primaryFade: ['rgba(124, 58, 237, 0.15)', 'rgba(147, 51, 234, 0.05)'] as [string, string],
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
  
  getGlow: (color: string, intensity: 'low' | 'medium' | 'high' = 'medium') => {
    const opacity = intensity === 'low' ? 0.3 : intensity === 'medium' ? 0.6 : 0.9;
    const radius = intensity === 'low' ? 4 : intensity === 'medium' ? 8 : 16;
    return {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: opacity,
      shadowRadius: radius,
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
