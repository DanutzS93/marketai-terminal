import { ActiveTab } from '../components/Header';
import { SubscriptionTier } from '../types';

export interface TierConfig {
  id: SubscriptionTier;
  nameRo: string;
  nameEn: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconText: string;
  descriptionRo: string;
  descriptionEn: string;
  allowedFeaturesRo: string[];
  allowedFeaturesEn: string[];
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  basic: {
    id: 'basic',
    nameRo: 'Pachet Basic',
    nameEn: 'Basic Package',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-300',
    badgeBorder: 'border-slate-500/30',
    iconText: '🛡️',
    descriptionRo: 'Acces esențial: Cotații Live, Generare Semnale AI, Jurnal de Tranzacționare, Statistici & Winrate și Știri Macro.',
    descriptionEn: 'Essential access: Live Quotes, AI Signal Generation, Trading Journal, Stats & Winrate, and Macro News.',
    allowedFeaturesRo: [
      'Generare de Semnale AI & Cotații Live',
      'Jurnal de Tranzacționare & Istoric Detaliat',
      'Statistici Performanță & Calcul Winrate',
      'Calendar Macro Forex Factory & Avertizări Știri',
      'Pop-up Raport Macro Zilnic Matinal',
    ],
    allowedFeaturesEn: [
      'AI Signals Generation & Live Quotes',
      'Trading Journal & Detailed History',
      'Performance Statistics & Winrate Tracking',
      'Forex Factory Macro Calendar & News Alerts',
      'Morning Daily Macro Briefing Pop-up',
    ],
  },
  gold: {
    id: 'gold',
    nameRo: 'Pachet Gold',
    nameEn: 'Gold Package',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-400/40',
    iconText: '🥇',
    descriptionRo: 'Acces extins: Toate funcțiile Basic + Execuție Automată EA MT5 & NinjaTrader + Reguli Personalizate și Motor de Risc.',
    descriptionEn: 'Advanced access: All Basic features + MT5 & NinjaTrader EA Auto-Execution + Custom Rules and Risk Engine.',
    allowedFeaturesRo: [
      'Toate beneficiile din Pachetul Basic',
      'Execuție automată către MetaTrader 5 (MT5 Bridge)',
      'Execuție automată către NinjaTrader 8 (NT8 Bridge)',
      'Reguli Personalizate de Generare Semnale',
      'Motor Institutional de Gestiune Risc & Trailing Stop',
    ],
    allowedFeaturesEn: [
      'All Basic Package benefits included',
      'Automated execution to MetaTrader 5 (MT5 Bridge)',
      'Automated execution to NinjaTrader 8 (NT8 Bridge)',
      'Custom Signal Generation Rule Engine',
      'Institutional Risk Management & Trailing Stop Engine',
    ],
  },
  diamond: {
    id: 'diamond',
    nameRo: 'Pachet Diamond',
    nameEn: 'Diamond Package',
    badgeBg: 'bg-gradient-to-r from-cyan-500/25 to-indigo-500/25',
    badgeText: 'text-cyan-200',
    badgeBorder: 'border-cyan-400/40',
    iconText: '💎',
    descriptionRo: 'Acces total VIP: Toate funcțiile platformei fără nicio restricție, inclusiv Programarea Trade-urilor Automate (Scheduler).',
    descriptionEn: 'Full VIP access: All platform features without restrictions, including Automated Trade Scheduler.',
    allowedFeaturesRo: [
      'Acces TOTAL & FĂRĂ RESTRICȚII la toate modulele',
      'Programare Trade-uri Automate (Automated Trade Scheduler)',
      'Tranzacționare Multi-Slot simultană (3 conturi MT5/Ninja)',
      'Prioritate maximă de execuție în Cloud și suport dedicat',
    ],
    allowedFeaturesEn: [
      'FULL & UNRESTRICTED access to every module',
      'Automated Trade Scheduler (Automated Scheduled Orders)',
      'Multi-Slot concurrent trading (3 MT5/Ninja accounts)',
      'Highest Cloud execution priority & VIP support',
    ],
  },
};

/**
 * Checks whether a tab is locked for a specific user tier
 */
export function isTabLocked(
  tab: ActiveTab,
  tier: SubscriptionTier = 'diamond',
  isAdmin = false
): boolean {
  if (isAdmin) return false;
  if (tier === 'diamond') return false;

  if (tier === 'gold') {
    // Gold has access to everything EXCEPT scheduler
    return tab === 'scheduler';
  }

  // Basic tier: only allowed overview, signals, journal, macro
  if (tier === 'basic') {
    return tab === 'scheduler' || tab === 'rules' || tab === 'risk';
  }

  return false;
}

/**
 * Checks whether EA automated execution (MT5 / NinjaTrader integration) is accessible
 */
export function canAccessEaExecution(
  tier: SubscriptionTier = 'diamond',
  isAdmin = false
): boolean {
  if (isAdmin) return true;
  return tier === 'gold' || tier === 'diamond';
}

/**
 * Returns the minimum required tier for a locked tab
 */
export function getRequiredTierForTab(tab: ActiveTab): SubscriptionTier | null {
  if (tab === 'scheduler') return 'diamond';
  if (tab === 'rules' || tab === 'risk') return 'gold';
  return null;
}
