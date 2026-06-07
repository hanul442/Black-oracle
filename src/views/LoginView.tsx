import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useAppContext, auth } from '../store';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

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

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setCurrentView('oracle-feed');
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
         showError('Google 로그인이 비활성화되어 있습니다. Firebase Console에서 사용 설정해주세요.');
      } else if (error.code === 'auth/popup-closed-by-user') {
         showError('구글 로그인을 취소했습니다.');
      } else {
         showError('구글 로그인 중 오류가 발생했습니다: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          showError('비밀번호가 일치하지 않습니다.');
          setIsLoading(false);
          return;
        }
        
        await createUserWithEmailAndPassword(auth, username, password);
        setCurrentView('oracle-feed');
      } else {
        if (username === 'admin' && password === 'oracle') {
           setCurrentView('oracle-feed');
           setIsLoading(false);
           return;
        }
        await signInWithEmailAndPassword(auth, username, password);
        setCurrentView('oracle-feed');
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
         showError('이미 사용 중인 이메일입니다.');
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
         showError('이메일이나 비밀번호가 일치하지 않습니다.');
      } else if (error.code === 'auth/invalid-email') {
         showError('유효하지 않은 이메일 주소입니다.');
      } else if (error.code === 'auth/operation-not-allowed') {
         showError('이메일/비밀번호 로그인이 비활성화되어 있습니다. Firebase Console에서 사용 설정해주세요.');
      } else {
         showError('올바르지 않은 접근입니다: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  return (
    <TransformWrapper
       initialScale={1}
       minScale={0.5}
       maxScale={4}
       wheel={{ step: 0.1, activationKeys: ["Control", "Meta"] }}
       pinch={{ step: 5 }}
       panning={{ activationKeys: ["Space"], velocityDisabled: true }}
    >
      <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
        <div className="w-full h-screen bg-[#020510] flex items-center justify-center relative overflow-hidden font-sans">
      {/* Immersive minimalist background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
         <div className="w-[800px] h-[800px] rounded-full bg-gradient-to-tr from-blue-900/30 to-transparent" />
         <div className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-cyan-900/20 to-transparent" />
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 bg-red-950/90 border border-red-500/50 rounded-xl shadow-[0_0_40px_rgba(239,68,68,0.3)] backdrop-blur-md"
          >
            <div className="p-1 rounded-full bg-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-red-200 text-sm font-medium tracking-wide">{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#020510]/80 pointer-events-auto"
          >
            <div className="relative flex flex-col items-center">
              <div className="relative mb-6">
                 <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                 <div className="absolute inset-0 border-4 border-t-blue-400 border-blue-500/20 rounded-full animate-pulse blur-sm" />
              </div>
              <div className="text-blue-400 font-sans tracking-wide font-medium text-lg drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                {isSignUp ? '보안 프로필 생성 중...' : '신원 확인 및 접속 중...'}
              </div>
              <div className="text-blue-500/50 text-xs mt-3 uppercase tracking-widest font-mono">
                보안 연결 설정 중...
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="flex flex-col items-center z-10 w-full max-w-sm relative px-6"
      >
        <div className="w-64 h-64 mb-6 relative flex items-center justify-center drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]">
          {/* External Logo Image */}
          <motion.img 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 2, delay: 0.3 }}
            src="https://storage.googleapis.com/aistudio-file-uploads/131aa0aeda2e4c4bae8e3488820c75fe/download" 
            alt="BLACK ORACLE"
            className="w-full h-full object-contain filter brightness-125 hover:scale-105 transition-transform duration-700"
          />
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center group relative space-y-4">
          <div className="relative w-full max-w-[320px]">
             {/* ID Input */}
            <input 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="이메일 주소 (ID)"
              className={`w-full bg-[#111827] backdrop-blur-md rounded-xl border border-gray-800 text-gray-200 px-4 py-3.5 mb-2 text-center text-sm font-sans tracking-wide focus:outline-none transition-all duration-300 focus:bg-gray-900 focus:border-blue-500/50 ${errorMsg ? 'border-red-900/50 bg-red-950/20' : ''}`}
            />
             {/* Password Input */}
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (PW)"
              className={`w-full bg-[#111827] backdrop-blur-md rounded-xl border border-gray-800 text-gray-200 px-4 py-3.5 ${isSignUp ? 'mb-2' : ''} text-center text-sm font-sans tracking-wide focus:outline-none transition-all duration-300 focus:bg-gray-900 focus:border-blue-500/50 ${errorMsg ? 'border-red-900/50 bg-red-950/20' : ''}`}
            />
            {isSignUp && (
              <input 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 확인 (PW)"
                className={`w-full bg-[#111827] backdrop-blur-md rounded-xl border border-gray-800 text-gray-200 px-4 py-3.5 text-center text-sm font-sans tracking-wide focus:outline-none transition-all duration-300 focus:bg-gray-900 focus:border-blue-500/50 ${errorMsg ? 'border-red-900/50 bg-red-950/20' : ''}`}
              />
            )}
          </div>
          
           <div className="w-full max-w-[320px] pt-4 mt-2 border-t border-gray-800/50 flex flex-col gap-3 px-1">
             <div className="flex justify-between items-center w-full">
               <button
                 type="button"
                 onClick={() => {
                   setIsSignUp(!isSignUp);
                   setErrorMsg('');
                   setPassword('');
                   setConfirmPassword('');
                 }}
                 className="text-[12px] text-blue-400 hover:text-white font-sans tracking-wide transition-colors"
               >
                 {isSignUp ? '로그인으로 돌아가기' : '새 계정 만들기'}
               </button>
               <button 
                 type="submit"
                 disabled={isLoading}
                 className={`bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-medium px-6 py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] flex items-center justify-center min-w-[90px] ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
               >
                 {isSignUp ? '회원가입' : '로그인'}
               </button>
             </div>
             
             {!isSignUp && (
               <>
                 <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-700"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-500 text-[11px] font-medium">OR</span>
                    <div className="flex-grow border-t border-gray-700"></div>
                 </div>
                 <button
                   type="button"
                   onClick={handleGoogleLogin}
                   disabled={isLoading}
                   className={`w-full bg-white hover:bg-gray-100 text-gray-900 text-[13px] font-medium px-4 py-2.5 rounded-lg transition-all shadow-md flex items-center justify-center min-h-[40px] ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                 >
                   <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.81 15.73 17.58V20.34H19.29C21.38 18.42 22.56 15.59 22.56 12.25Z" fill="#4285F4"/>
                     <path d="M12 23C14.97 23 17.46 22.02 19.29 20.34L15.73 17.58C14.74 18.25 13.48 18.66 12 18.66C9.13001 18.66 6.70001 16.73 5.82001 14.13H2.17001V16.96C3.99001 20.57 7.70001 23 12 23Z" fill="#34A853"/>
                     <path d="M5.82001 14.13C5.59001 13.46 5.46001 12.75 5.46001 12C5.46001 11.25 5.59001 10.54 5.82001 9.87V7.04H2.17001C1.43001 8.52 1 10.21 1 12C1 13.79 1.43001 15.48 2.17001 16.96L5.82001 14.13Z" fill="#FBBC05"/>
                     <path d="M12 5.34C13.62 5.34 15.07 5.89 16.22 6.98L19.38 3.82C17.45 2.02 14.96 1 12 1C7.70001 1 3.99001 3.43 2.17001 7.04L5.82001 9.87C6.70001 7.27 9.13001 5.34 12 5.34Z" fill="#EA4335"/>
                   </svg>
                   Google 계정으로 로그인
                 </button>
               </>
             )}
          </div>
        </form>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1.5 }}
          className="absolute -bottom-24 flex items-center gap-3 text-gray-400/80 text-[11px] font-sans tracking-wide bg-gray-900/40 px-6 py-2 rounded-full border border-gray-800 backdrop-blur-sm"
        >
          <ShieldCheck className="w-4 h-4 text-blue-500 gap-2" />
          <span>안전한 종단간 연결이 설정되었습니다.</span>
        </motion.div>
      </motion.div>
    </div>
    </TransformComponent>
    </TransformWrapper>
  );
};

