import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, RefreshCw } from 'lucide-react';

type ReadinessPayload = {
  success: boolean;
  version: string;
  mode: 'SHADOW';
  executionAuthority: false;
  asOf: number;
  dataPlane: {
    kis: { status: 'READY' | 'BLOCKED'; ready: boolean; marketDataEnvironment: 'demo' | 'real' | null; credentials: { appKeyPresent: boolean; appSecretPresent: boolean } };
    marketCap: { status: string; source: string };
    sector: { status: string; source: string };
    participantFlow: { status: string; source: string };
    cryptoExposure: { status: string; source: string };
    timeframeHistory: { minuteSession: string; dailyWeeklyMonthly: string; multiDay1h4h: string };
  };
  blockers: string[];
};

const itemClass = 'flex items-center justify-between gap-3 border-t border-[#eef0f2] px-4 py-3 first:border-t-0';

export const V10ReadinessCard = () => {
  const [payload, setPayload] = useState<ReadinessPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v10-readiness', { cache: 'no-store' });
      const json = await response.json();
      setPayload(response.ok && json?.success ? json : null);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const ready = payload?.dataPlane.kis.ready === true
    && payload?.dataPlane.cryptoExposure.status === 'READY'
    && payload?.dataPlane.timeframeHistory.multiDay1h4h === 'READY';

  return <section className="mt-4 rounded-[24px] border border-[#e6e9ed] bg-white overflow-hidden">
    <div className="flex items-start justify-between gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[#f4f6f8]"><Database className="h-4 w-4 text-[#59626c]" /></div>
        <div><div className="text-[12px] font-semibold text-[#25282e]">Live data-plane readiness</div><div className="mt-1 text-[9px] leading-4 text-[#8b929a]">실데이터가 부족하면 후보·거래를 만들어내지 않고 BLOCKED로 표시합니다.</div></div>
      </div>
      <button type="button" onClick={() => void load()} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e6e9ed] bg-[#fafbfc]" aria-label="Readiness 새로고침"><RefreshCw className={'h-3.5 w-3.5 text-[#6f7780] ' + (loading ? 'animate-spin' : '')} /></button>
    </div>

    {payload ? <>
      <div className={itemClass}><span className="text-[9px] text-[#7e858e]">KIS market data</span><span className={'flex items-center gap-1.5 text-[9px] font-semibold ' + (payload.dataPlane.kis.ready ? 'text-[#39745a]' : 'text-[#a56a32]')}>{payload.dataPlane.kis.ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{payload.dataPlane.kis.status}</span></div>
      <div className={itemClass}><span className="text-[9px] text-[#7e858e]">Market cap / sector / flow</span><span className="text-[9px] font-semibold text-[#39745a]">CODE READY</span></div>
      <div className={itemClass}><span className="text-[9px] text-[#7e858e]">Crypto exposure registry</span><span className={'text-[9px] font-semibold ' + (payload.dataPlane.cryptoExposure.status === 'READY' ? 'text-[#39745a]' : 'text-[#a56a32]')}>{payload.dataPlane.cryptoExposure.status}</span></div>
      <div className={itemClass}><span className="text-[9px] text-[#7e858e]">Persistent 1H / 4H history</span><span className={'text-[9px] font-semibold ' + (payload.dataPlane.timeframeHistory.multiDay1h4h === 'READY' ? 'text-[#39745a]' : 'text-[#a56a32]')}>{payload.dataPlane.timeframeHistory.multiDay1h4h}</span></div>
      <div className="border-t border-[#eef0f2] px-4 py-3"><div className={'inline-flex rounded-full px-2.5 py-1 text-[8px] font-semibold ' + (ready ? 'bg-[#eef7f2] text-[#39745a]' : 'bg-[#fff6e9] text-[#9a6933]')}>{ready ? 'LIVE INPUT READY' : 'SHADOW / DATA BLOCKED'}</div>{payload.blockers.length > 0 && <div className="mt-2 space-y-1">{payload.blockers.slice(0, 4).map((blocker) => <div key={blocker} className="text-[8px] leading-4 text-[#8d7b66]">• {blocker}</div>)}</div>}</div>
    </> : <div className="border-t border-[#eef0f2] px-4 py-4 text-[9px] leading-4 text-[#9a6c3f]">Readiness endpoint unavailable. V10 stays shadow-only.</div>}
  </section>;
};
