import React from 'react';
import { BridgeIntegrationModal } from './BridgeIntegrationModal';
import { UserProfile, BridgeAccount } from '../types';

interface NinjaTraderIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ro' | 'en';
  authToken?: string;
  user?: UserProfile | null;
  onAccountsUpdated?: (accounts: BridgeAccount[]) => void;
}

export const NinjaTraderIntegrationModal: React.FC<NinjaTraderIntegrationModalProps> = ({
  isOpen,
  onClose,
  lang,
  authToken,
  user,
  onAccountsUpdated,
}) => {
  return (
    <BridgeIntegrationModal
      isOpen={isOpen}
      onClose={onClose}
      lang={lang}
      authToken={authToken}
      user={user}
      initialSlot={3}
      initialPlatform="NINJATRADER"
      onAccountsUpdated={onAccountsUpdated}
    />
  );
};
