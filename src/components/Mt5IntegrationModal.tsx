import React from 'react';
import { BridgeIntegrationModal } from './BridgeIntegrationModal';
import { UserProfile, BridgeAccount } from '../types';

interface Mt5IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ro' | 'en';
  authToken?: string;
  user?: UserProfile | null;
  onAccountsUpdated?: (accounts: BridgeAccount[]) => void;
}

export const Mt5IntegrationModal: React.FC<Mt5IntegrationModalProps> = ({
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
      initialSlot={1}
      initialPlatform="MT5"
      onAccountsUpdated={onAccountsUpdated}
    />
  );
};
