import React, { useEffect, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth, useAppContext } from '../store';

export const LoginView: React.FC = () => {
  const { setCurrentView } = useAppContext();
  const [status, setStatus] = useState('OPENING ORACLE');

  useEffect(() => {
    let active = true;

    const enterWorkspace = () => {
      if (!active) return;
      setCurrentView('command');
    };

    if (auth.currentUser) {
      enterWorkspace();
      return () => {
        active = false;
      };
    }

    setStatus('SYNCING INTERNAL SESSION');
    signInAnonymously(auth)
      .catch((error) => {
        console.warn('Firebase background session unavailable; continuing with gateway session.', error);
      })
      .finally(enterWorkspace);

    return () => {
      active = false;
    };
  }, [setCurrentView]);

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-[#05070A] text-[#E9EDF1]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-6 w-6 animate-spin text-[#43D9E6]" />
        <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#66717C]">{status}</div>
      </div>
    </div>
  );
};
