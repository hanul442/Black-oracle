import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Database,
  Loader2,
  LockKeyhole,
  Radar,
  ShieldCheck,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth, useAppContext } from '../store';

const QA_PREVIEW_HOST = 'black-oracle-git-integration-465b8a-kimwriter222-7385s-projects.vercel.app';

const developmentAccessAllowed = () => {
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === QA_PREVIEW_HOST;
};

export const LoginView: React.FC = () => {
  const { setCurrentView } = useAppContext();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return '비밀번호는 최소 8자 이상이어야 합니다.';
    if (!/[A-Za-z]/.test(pass) || !/[0-9!@#$%^&*]/.test(pass)) {
      return '영문자와 숫자 또는 특수문자를 포함해야 합니다.';
    }
    return '';
  };

  const showError = (message: string) => {
    setErrorMsg(message);
    window.setTimeout(() => setErrorMsg(''), 4000);
  };

  const completeAccess = () => setCurrentView('command');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      completeAccess();
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        showError('Google 로그인이 비활성화되어 있습니다. Firebase Console에서 사용 설정해주세요.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        showError('구글 로그인을 취소했습니다.');
      } else if (error.code === 'auth/unauthorized-domain') {
        showError('현재 배포 도메인은 Google 로그인 허용 목록에 없습니다. QA Preview에서는 admin / oracle을 사용해주세요.');
      } else {
        showError(`구글 로그인 중 오류가 발생했습니다: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username) {
      showError('이메일을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        const passError = validatePassword(password);
        if (passError) {
          showError(passError);
          return;
        }
        if (password !== confirmPassword) {
          showError('비밀번호가 일치하지 않습니다.');
          return;
        }
        await createUserWithEmailAndPassword(auth, username, password);
        completeAccess();
      } else {
        if (developmentAccessAllowed() && username === 'admin' && password === 'oracle') {
          completeAccess();
          return;
        }
        await signInWithEmailAndPassword(auth, username, password);
        completeAccess();
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        showError('이미 사용 중인 이메일입니다.');
      } else if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/user-not-found'
      ) {
        showError('이메일이나 비밀번호가 일치하지 않습니다.');
      } else if (error.code === 'auth/invalid-email') {
        showError('유효하지 않은 이메일 주소입니다.');
      } else if (error.code === 'auth/operation-not-allowed') {
        showError('이메일/비밀번호 로그인이 비활성화되어 있습니다. Firebase Console에서 사용 설정해주세요.');
      } else {
        showError(`올바르지 않은 접근입니다: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-[#05070A] text-[#E9EDF1]">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div className="pointer-events-none absolute left-[12%] top-[18%] h-[420px] w-[420px] rounded-full bg-[#43D9E6]/[0.025] blur-[110px]" />

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed left-1/2 top-5 z-[100] flex w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 items-start gap-3 border border-[#D66565]/30 bg-[#160D10]/96 px-4 py-3 shadow-2xl backdrop-blur-xl"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D66565]" />
            <span className="text-[11px] leading-relaxed text-[#E6C7C7]">{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[#05070A]/88 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-7 w-7 animate-spin text-[#43D9E6]" />
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#77818C]">
                {isSignUp ? 'Creating operator profile' : 'Authorizing operator'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 m-auto grid h-full w-full max-w-[1320px] lg:grid-cols-[1.15fr_.85fr]">
        <section className="hidden min-h-0 flex-col justify-between border-r border-white/[0.06] p-10 lg:flex xl:p-14">
          <div className="flex items-center gap-3">
            <OracleMark />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#E9EDF1]">Black Oracle</div>
              <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.17em] text-[#4F5963]">Decision intelligence system</div>
            </div>
          </div>

          <div className="max-w-[620px]">
            <div className="mb-4 font-mono text-[8px] uppercase tracking-[0.23em] text-[#43D9E6]">Operator access</div>
            <h1 className="text-5xl font-medium leading-[1.03] tracking-[-0.045em] text-[#E6EAEE] xl:text-6xl">
              Evidence before conviction.
              <br />
              Probability before action.
            </h1>
            <p className="mt-6 max-w-[520px] text-sm leading-7 text-[#68727C]">
              Black Oracle preserves the chain from source and signal to hypothesis, scenario, decision, and audit memory. Enter the workspace to inspect the current state of that chain.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-px border border-white/[0.06] bg-white/[0.05]">
            <SystemFact icon={Radar} label="INTELLIGENCE" value="Evidence-led" />
            <SystemFact icon={ShieldCheck} label="RISK" value="Fail closed" />
            <SystemFact icon={Database} label="MEMORY" value="Auditable" />
          </div>
        </section>

        <section className="flex min-h-0 items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[430px]"
          >
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <OracleMark />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em]">Black Oracle</div>
                <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.14em] text-[#4F5963]">Decision intelligence system</div>
              </div>
            </div>

            <div className="border border-white/[0.07] bg-[#080C11]/94">
              <div className="border-b border-white/[0.06] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#43D9E6]">Secure workspace</div>
                    <h2 className="mt-2 text-xl font-medium tracking-[-0.025em]">{isSignUp ? 'Create operator' : 'Authenticate'}</h2>
                  </div>
                  <LockKeyhole className="h-4 w-4 text-[#59636D]" />
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-[#68727C]">
                  {isSignUp ? 'Create credentials for this Black Oracle workspace.' : 'Use the credentials associated with this workspace.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-5 sm:p-6">
                <Field label="EMAIL / OPERATOR ID">
                  <input
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="operator@example.com"
                    className="h-11 w-full border border-white/[0.08] bg-[#05070A] px-3 text-[12px] text-[#D8DEE4] outline-none transition placeholder:text-[#3F4851] focus:border-[#43D9E6]/35"
                  />
                </Field>

                <Field label="PASSWORD">
                  <input
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••••••"
                    className="h-11 w-full border border-white/[0.08] bg-[#05070A] px-3 text-[12px] text-[#D8DEE4] outline-none transition placeholder:text-[#3F4851] focus:border-[#43D9E6]/35"
                  />
                </Field>

                {isSignUp && (
                  <Field label="CONFIRM PASSWORD">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="••••••••••••"
                      className="h-11 w-full border border-white/[0.08] bg-[#05070A] px-3 text-[12px] text-[#D8DEE4] outline-none transition placeholder:text-[#3F4851] focus:border-[#43D9E6]/35"
                    />
                  </Field>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 flex h-11 w-full items-center justify-between border border-[#43D9E6]/25 bg-[#43D9E6]/[0.055] px-4 font-mono text-[8px] uppercase tracking-[0.18em] text-[#BCEFF3] transition hover:bg-[#43D9E6]/[0.09] disabled:opacity-50"
                >
                  <span>{isSignUp ? 'Create operator' : 'Enter command'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>

                {!isSignUp && (
                  <>
                    <div className="my-5 flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/[0.055]" />
                      <span className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#46505A]">or</span>
                      <div className="h-px flex-1 bg-white/[0.055]" />
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="flex h-11 w-full items-center justify-center gap-2 border border-white/[0.08] bg-[#070A0E] text-[11px] text-[#AEB7C0] transition hover:border-white/[0.14] hover:text-[#E1E6EB] disabled:opacity-50"
                    >
                      <GoogleMark /> Continue with Google
                    </button>
                  </>
                )}
              </form>

              <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp((value) => !value);
                    setErrorMsg('');
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="font-mono text-[7px] uppercase tracking-[0.12em] text-[#68727C] transition hover:text-[#D2D9DF]"
                >
                  {isSignUp ? 'Back to sign in' : 'Create account'}
                </button>
                <span className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#3F4851]">BO / ACCESS 03</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.12em] text-[#46505A]">
              <ShieldCheck className="h-3 w-3 text-[#59636D]" />
              Authentication handled by the configured identity provider
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
};

const OracleMark = () => (
  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
    <span className="absolute h-6 w-6 rounded-full border border-[#43D9E6]/30" />
    <span className="absolute h-3.5 w-3.5 rounded-full border border-white/[0.12]" />
    <span className="h-1.5 w-1.5 rounded-full bg-[#43D9E6] shadow-[0_0_12px_rgba(67,217,230,0.55)]" />
  </span>
);

const SystemFact = ({ icon: Icon, label, value }: any) => (
  <div className="bg-[#070A0E] p-4">
    <Icon className="h-3.5 w-3.5 text-[#59636D]" />
    <div className="mt-4 font-mono text-[6px] uppercase tracking-[0.13em] text-[#4F5963]">{label}</div>
    <div className="mt-1 text-[10px] text-[#9AA4AE]">{value}</div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="mb-4 block">
    <span className="mb-2 block font-mono text-[7px] uppercase tracking-[0.14em] text-[#59636D]">{label}</span>
    {children}
  </label>
);

const GoogleMark = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3.1-4.4 3.1-7.4Z" fill="#4285F4" />
    <path d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1a5.9 5.9 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z" fill="#34A853" />
    <path d="M6.5 14.1a6 6 0 0 1 0-4.2V7.3H3.2a10 10 0 0 0 0 9.4l3.3-2.6Z" fill="#FBBC05" />
    <path d="M12 5.9c1.6 0 3 .5 4 1.6l3-3A10 10 0 0 0 3.2 7.3l3.3 2.6A5.9 5.9 0 0 1 12 5.9Z" fill="#EA4335" />
  </svg>
);
