import React from 'react';
import { ActiveTab } from './Header';
import { SubscriptionTier } from '../types';
import { TIER_CONFIGS, getRequiredTierForTab } from '../utils/subscriptionTiers';
import {
  Lock,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sliders,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface LockedFeatureCardProps {
  tab: ActiveTab;
  currentTier?: SubscriptionTier;
  lang: 'ro' | 'en';
  onContactAdmin?: () => void;
}

export const LockedFeatureCard: React.FC<LockedFeatureCardProps> = ({
  tab,
  currentTier = 'basic',
  lang,
  onContactAdmin,
}) => {
  const isRo = lang === 'ro';
  const requiredTier = getRequiredTierForTab(tab) || 'diamond';
  const requiredConfig = TIER_CONFIGS[requiredTier];
  const currentConfig = TIER_CONFIGS[currentTier];

  const featureDetails: Record<
    string,
    {
      titleRo: string;
      titleEn: string;
      subtitleRo: string;
      subtitleEn: string;
      icon: React.ReactNode;
      bulletsRo: string[];
      bulletsEn: string[];
    }
  > = {
    scheduler: {
      titleRo: 'Programare Trade-uri Automate (Scheduler EA)',
      titleEn: 'Automated Trade Scheduler (EA Engine)',
      subtitleRo: 'Modul avansat de programare pe intervale orare și execuție autonomă a semnalelor în MetaTrader 5 și NinjaTrader.',
      subtitleEn: 'Advanced hourly scheduler module for autonomous signal execution in MetaTrader 5 and NinjaTrader.',
      icon: <Clock className="w-8 h-8 text-purple-400" />,
      bulletsRo: [
        'Programare automată pe ferestre orare dedicate (09:30, 15:30, 17:00 etc.)',
        'Filtrare automată a semnalelor cu scor de încredere ridicat',
        'Trimitere automată fără intervenție manuală către broker prin MT5 / NinjaTrader',
        'Istoric detaliat al execuțiilor automate și alocare pe conturi țintă',
      ],
      bulletsEn: [
        'Automated time-window scheduling (09:30, 15:30, 17:00 etc.)',
        'Automatic high-confidence signal filtering engine',
        'Hands-free execution directly to broker via MT5 / NinjaTrader Bridge',
        'Detailed execution logs and multi-account target allocation',
      ],
    },
    rules: {
      titleRo: 'Reguli Personalizate de Generare Semnale',
      titleEn: 'Custom Signal Generation Rules',
      subtitleRo: 'Configurare parametri avansați pentru algoritmii de generare semnale AI pe indici și aur.',
      subtitleEn: 'Configure advanced custom parameters for AI signal generation algorithms across indices and gold.',
      icon: <Sliders className="w-8 h-8 text-indigo-400" />,
      bulletsRo: [
        'Ajustare scor minim de intrare și filtre de volatilitate ATR',
        'Condiții personalizate de Smart Money Concepts (BOS / FVG / Liquidity Sweeps)',
        'Filtre de știri economice și protecție împotriva spread-urilor mărite',
      ],
      bulletsEn: [
        'Fine-tune minimum score thresholds and dynamic ATR volatility filters',
        'Custom Smart Money Concepts logic (BOS / FVG / Liquidity Sweeps)',
        'Macroeconomic news filters and high-spread avoidance safeguards',
      ],
    },
    risk: {
      titleRo: 'Reguli Risc & Motor EA MetaTrader 5 / NinjaTrader',
      titleEn: 'Risk Management & EA Bridge Engine',
      subtitleRo: 'Integrare activă cu platformele MT5 și NinjaTrader pentru execuție automată și protecție avansată a capitalului.',
      subtitleEn: 'Active integration with MT5 and NinjaTrader platforms for automated execution and institutional capital protection.',
      icon: <ShieldCheck className="w-8 h-8 text-cyan-400" />,
      bulletsRo: [
        'Conectare directă la 3 conturi simultan (Slot 1, Slot 2, Slot 3)',
        'Trailing Stop dinamic calculat pe puncte și Breakeven automat',
        'Protecție maximă la pierdere zilnică (Max Daily Loss) și țintă de profit',
        'Trimitere instantă a ordinelor de tip Market, Limit și Stop în MT5/NT8',
      ],
      bulletsEn: [
        'Direct multi-account connection across 3 slots (Slot 1, Slot 2, Slot 3)',
        'Dynamic point-based Trailing Stop and automated Breakeven moves',
        'Institutional Daily Max Loss safeguard and Daily Profit Target limits',
        'Instantaneous order routing (Market, Limit, Stop) into MT5/NT8',
      ],
    },
  };

  const feature = featureDetails[tab] || featureDetails.scheduler;

  return (
    <div className="max-w-4xl mx-auto my-8 px-4 animate-fadeIn">
      <div className="bg-[#090F1F]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.7)] relative overflow-hidden text-center">
        {/* Ambient Glows */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Central Lock Icon Badge */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-amber-500/20 via-[#111C38] to-indigo-500/20 border border-amber-400/30 flex items-center justify-center shadow-2xl shadow-amber-900/30">
            <Lock className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 animate-pulse" />
          </div>
          <div className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-slate-900 border border-white/15 shadow-md">
            {feature.icon}
          </div>
        </div>

        {/* Badge Tiers Comparison */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <span className="text-xs text-slate-400 font-medium">
            {isRo ? 'Pachetul tău curent:' : 'Your current tier:'}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${currentConfig.badgeBg} ${currentConfig.badgeText} ${currentConfig.badgeBorder}`}>
            {currentConfig.iconText} {isRo ? currentConfig.nameRo : currentConfig.nameEn}
          </span>
          <span className="text-white/30">•</span>
          <span className="text-xs text-slate-400 font-medium">
            {isRo ? 'Pachet Necesar:' : 'Required Tier:'}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-black border uppercase tracking-wider ${requiredConfig.badgeBg} ${requiredConfig.badgeText} ${requiredConfig.badgeBorder}`}>
            {requiredConfig.iconText} {isRo ? requiredConfig.nameRo : requiredConfig.nameEn}
          </span>
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight mb-2">
          {isRo ? feature.titleRo : feature.titleEn}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed mb-6 font-sans">
          {isRo ? feature.subtitleRo : feature.subtitleEn}
        </p>

        {/* What You Get Box */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 max-w-xl mx-auto text-left mb-6 shadow-inner">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5 font-mono">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{isRo ? 'Beneficii Incluse în Pachetul Superior:' : 'Benefits Included in Higher Tier:'}</span>
          </h4>
          <ul className="space-y-2 text-xs text-slate-200">
            {(isRo ? feature.bulletsRo : feature.bulletsEn).map((bullet, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact Admin Upgrade Notice */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 max-w-md text-center">
            {isRo
              ? 'Pentru a debloca acest modul pe contul tău, contactează administratorul platformei pentru atribuirea pachetului corespunzător.'
              : 'To unlock this module on your account, please contact the platform administrator to assign the required tier.'}
          </div>
        </div>
      </div>
    </div>
  );
};
