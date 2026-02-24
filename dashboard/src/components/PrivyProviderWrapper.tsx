'use client';

import { ReactNode, useState, useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WalletProvider } from '@/contexts/WalletContext';
import { PRIVY_APP_ID, privyConfig } from '@/lib/privy-config';

export default function PrivyProviderWrapper({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR/prerendering or when app ID is not set, render without Privy/Wallet
  if (!mounted || !PRIVY_APP_ID) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      <WalletProvider>
        {children}
      </WalletProvider>
    </PrivyProvider>
  );
}
