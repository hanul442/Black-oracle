import React, { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { signInAnonymously } from 'firebase/auth';
import { auth, useAppContext } from '../store';

export const LoginView: React.FC = () => {
  const { setCurrentView } = useAppContext();
  const [loading, setLoading] = useState(false);

  const enter = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
    } catch (error) {
      console.warn('Firebase anonymous session unavailable; continuing with gateway session.', error);
    } finally {
      setCurrentView('command');
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#fbfcfd] px-7 pb-[max(env(safe-area-inset-bottom),28px)] pt-[max(env(safe-area-inset-top),30px)] text-[#111418]" style={{ colorScheme: 'light' }}>
      <div className="mt-auto mb-auto">
        <div className="text-[38px] font-semibold tracking-[-0.065em] sm:text-[44px]">Black Oracle</div>
        <div className="mt-8 text-[27px] font-medium leading-[1.45] tracking-[-0.045em] text-[#171b20] sm:text-[31px]">
          더 깊이, 더 멀리.<br />데이터가 보지 못한 기회를,<br />먼저.
        </div>
        <div className="mt-5 text-[14px] font-medium text-[#9ba3ab]">AI for a more rational market.</div>

        <div className="relative mx-auto mt-12 h-48 w-48 sm:h-56 sm:w-56">
          <div className="absolute inset-4 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ffffff_0%,#dfe3e7_24%,#9da4aa_47%,#41484e_66%,#11161b_82%,#06080a_100%)] blur-[0.2px]" />
          <div className="absolute inset-0 rounded-full border border-[#dfe3e7] opacity-70" />
          <div className="absolute left-[-18%] top-1/2 h-px w-[136%] -rotate-[43deg] bg-[#c7cdd2]" />
          <div className="absolute right-[18%] top-[25%] h-2.5 w-2.5 rounded-full bg-[#12171c]" />
        </div>
      </div>

      <div className="space-y-3">
        <button onClick={() => void enter()} className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#131a22] text-[14px] font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] disabled:opacity-60" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />세션 연결 중</> : <>시작하기 <ArrowRight className="ml-2 h-4 w-4" /></>}
        </button>
        <button onClick={() => void enter()} className="flex h-13 w-full items-center justify-center rounded-2xl bg-[#f0f2f4] text-[13px] font-semibold text-[#313940] disabled:opacity-60" disabled={loading}>
          기존 세션으로 계속
        </button>
      </div>
      <div className="pt-7 text-center text-[10px] font-medium tracking-[0.01em] text-[#a4abb2]">Better Decisions. A Clearer Tomorrow.</div>
    </div>
  );
};
