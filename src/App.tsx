/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Lightbulb, 
  TrendingUp, 
  Users, 
  ShieldCheck, 
  Clock, 
  ArrowRight,
  ChevronRight, 
  DollarSign,
  Briefcase,
  Zap,
  Check,
  LogIn,
  LogOut,
  Share2,
  Smartphone,
  Monitor
} from 'lucide-react';
import { 
  db, 
  auth, 
  googleProvider, 
  signInWithPopup, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot 
} from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

// Error Handling Spec for Firestore
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Error Boundary Component
class ErrorBoundary extends Component<any, any> {
  public state: any;
  public props: any;

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "알 수 없는 오류가 발생했습니다.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "권한이 없습니다. 관리자 계정으로 로그인해 주세요.";
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">오류 발생</h2>
            <p className="text-slate-600 mb-8">{errorMessage}</p>
            <Button onClick={() => window.location.reload()} className="bg-blue-600 text-white w-full">다시 시도</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Section = ({ children, className = "", id }: { children: React.ReactNode, className?: string, id?: string }) => (
  <section id={id} className={`py-20 px-6 md:px-12 lg:px-24 ${className}`}>
    <div className="max-w-6xl mx-auto">
      {children}
    </div>
  </section>
);

const Button = ({ children, className = "", onClick, disabled, type = "button" }: { children: React.ReactNode, className?: string, onClick?: () => void, disabled?: boolean, type?: "button" | "submit" | "reset" }) => (
  <button 
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`px-8 py-4 rounded-full font-bold text-lg transition-all active:scale-95 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    experience: '',
    industry: '',
    revenue: ''
  });

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [statusModal, setStatusModal] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !isAdminView || !user) return;

    const q = query(collection(db, 'leads'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeads(leadsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'leads');
    });

    return () => unsubscribe();
  }, [isAuthReady, isAdminView, user]);

  const scrollToForm = () => {
    document.getElementById('support-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogin = async () => {
    console.log("Attempting Google login...");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Login success:", result.user.email);
    } catch (error: any) {
      console.error("Login error details:", error);
      let message = "로그인에 실패했습니다.";
      if (error.code === 'auth/popup-blocked') {
        message = "팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해 주세요.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = `승인되지 않은 도메인(${window.location.hostname})입니다. Firebase 콘솔에서 이 도메인을 승인된 도메인에 추가해야 합니다.`;
      } else if (error.message) {
        message = `로그인 실패: ${error.message}`;
      }
      setStatusModal({ type: 'error', message });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdminView(false);
    } catch (error) {
      setStatusModal({ type: 'error', message: "로그아웃에 실패했습니다." });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contact) {
      setStatusModal({ type: 'error', message: "이름과 연락처를 입력해주세요." });
      return;
    }

    setIsSubmitting(true);
    try {
      const leadData: any = {
        ...formData,
        created_at: new Date().toISOString(),
      };
      
      if (auth.currentUser?.uid) {
        leadData.uid = auth.currentUser.uid;
      }

      await addDoc(collection(db, 'leads'), leadData);
      setStatusModal({ type: 'success', message: "지원이 완료되었습니다. 24시간 내에 연락드리겠습니다." });
      setFormData({ name: '', contact: '', experience: '', industry: '', revenue: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leads');
      setStatusModal({ type: 'error', message: "지원 중 오류가 발생했습니다. 다시 시도해 주세요." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchLeads = async () => {
    if (!user) {
      handleLogin();
      return;
    }

    if (adminPassword !== "jwkim4924") {
      setStatusModal({ type: 'error', message: "비밀번호가 틀렸습니다." });
      return;
    }

    setIsAdminView(true);
    setShowPasswordModal(false);
    setAdminPassword('');
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteDoc(doc(db, 'leads', deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `leads/${deleteId}`);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Shop in Shop 헤드헌터 파트너 모집',
          text: '독립적인 헤드헌터들을 위한 Shop in Shop 파트너십 랜딩페이지입니다.',
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      setStatusModal({ type: 'success', message: '링크가 클립보드에 복사되었습니다.' });
    }
  };

  if (isAdminView) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <h1 className="text-2xl md:text-3xl font-bold">지원자 현황 (관리자)</h1>
              <span className="text-sm text-slate-500">{user?.email}</span>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <Button onClick={handleLogout} className="flex-1 md:flex-none bg-slate-200 text-slate-700 flex items-center justify-center gap-2">
                <LogOut className="w-4 h-4" /> 로그아웃
              </Button>
              <Button onClick={() => setIsAdminView(false)} className="flex-1 md:flex-none bg-slate-900 text-white">랜딩페이지</Button>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="p-4 whitespace-nowrap">지원일시</th>
                    <th className="p-4 whitespace-nowrap">이름</th>
                    <th className="p-4 whitespace-nowrap">연락처</th>
                    <th className="p-4 whitespace-nowrap">경력</th>
                    <th className="p-4 whitespace-nowrap">산업</th>
                    <th className="p-4 whitespace-nowrap">매출구간</th>
                    <th className="p-4 whitespace-nowrap">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 text-sm text-slate-500 whitespace-nowrap">{new Date(lead.created_at).toLocaleString()}</td>
                      <td className="p-4 font-bold whitespace-nowrap">{lead.name}</td>
                      <td className="p-4 whitespace-nowrap">{lead.contact}</td>
                      <td className="p-4 whitespace-nowrap">{lead.experience}</td>
                      <td className="p-4 whitespace-nowrap">{lead.industry}</td>
                      <td className="p-4 whitespace-nowrap">{lead.revenue}</td>
                      <td className="p-4">
                        <button 
                          onClick={() => setDeleteId(lead.id)}
                          className="text-red-500 hover:text-red-700 text-sm font-bold"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {leads.length === 0 && <div className="p-20 text-center text-slate-400">아직 지원자가 없습니다.</div>}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {leads.map((lead) => (
              <div key={lead.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">{new Date(lead.created_at).toLocaleString()}</p>
                    <h3 className="text-lg font-bold text-slate-900">{lead.name}</h3>
                  </div>
                  <button 
                    onClick={() => setDeleteId(lead.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    삭제
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">연락처</p>
                    <p className="text-slate-700">{lead.contact}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">경력</p>
                    <p className="text-slate-700">{lead.experience}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">산업</p>
                    <p className="text-slate-700">{lead.industry}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">매출구간</p>
                    <p className="text-slate-700">{lead.revenue}</p>
                  </div>
                </div>
              </div>
            ))}
            {leads.length === 0 && <div className="p-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">아직 지원자가 없습니다.</div>}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
            <div className="relative bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl">
              <h3 className="text-xl font-bold mb-4">정말 삭제하시겠습니까?</h3>
              <div className="flex gap-3">
                <Button onClick={() => setDeleteId(null)} className="flex-1 bg-slate-100 text-slate-600">취소</Button>
                <Button onClick={handleDelete} className="flex-1 bg-red-500 text-white">삭제</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const modalContent: Record<string, { title: string, content: string }> = {
    "개인정보 보호": {
      title: "개인정보 보호 정책",
      content: "수집된 개인정보는 파트너 지원 검토 및 연락 목적으로만 사용되며, 개인정보 보호법에 따라 안전하게 관리됩니다. 지원자의 동의 없이 제3자에게 제공되지 않습니다."
    },
    "비밀 유지 보장": {
      title: "비밀 유지 보장",
      content: "지원 사실 및 상담 내용은 철저히 비밀로 유지됩니다. 현재 소속된 조직이나 외부로 어떠한 정보도 유출되지 않음을 엄격히 보장합니다."
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-100">
      {/* Modal Overlay */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setActiveModal(null)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white w-full max-w-lg p-8 rounded-[2rem] shadow-2xl border border-slate-100"
          >
            <h3 className="text-2xl font-bold mb-4">{modalContent[activeModal]?.title}</h3>
            <p className="text-slate-600 leading-relaxed mb-8">
              {modalContent[activeModal]?.content}
            </p>
            <Button 
              onClick={() => setActiveModal(null)}
              className="w-full bg-slate-900 text-white hover:bg-slate-800"
            >
              확인
            </Button>
          </motion.div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)} />
          <div className="relative bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100">
            {!user ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <LogIn className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold mb-2">관리자 로그인</h3>
                <p className="text-slate-500 mb-8 text-sm">관리자 권한 확인을 위해<br />구글 로그인이 필요합니다.</p>
                <Button 
                  onClick={handleLogin} 
                  className="w-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center gap-3 py-4 hover:bg-slate-50 transition-colors"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                  Google로 로그인
                </Button>
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="mt-6 text-slate-400 text-sm hover:text-slate-600"
                >
                  취소
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-slate-200 overflow-hidden">
                    {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-4">관리자 비밀번호</h3>
                <input 
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 mb-6 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="비밀번호 입력"
                  onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
                  autoFocus
                />
                <div className="flex gap-3">
                  <Button onClick={() => setShowPasswordModal(false)} className="flex-1 bg-slate-100 text-slate-600">취소</Button>
                  <Button onClick={fetchLeads} className="flex-1 bg-blue-600 text-white">확인</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Status Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setStatusModal(null)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl text-center"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${statusModal.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
              {statusModal.type === 'success' ? (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-600" />
              )}
            </div>
            <h3 className="text-2xl font-bold mb-2">{statusModal.type === 'success' ? '지원 완료' : '오류 발생'}</h3>
            <p className="text-slate-600 mb-8">{statusModal.message}</p>
            <Button 
              onClick={() => setStatusModal(null)}
              className={`w-full text-white ${statusModal.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              확인
            </Button>
          </motion.div>
        </div>
      )}

      {/* Hero Section */}
      <Section className="bg-white border-b border-slate-100 pt-32 pb-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-50/50 -skew-x-12 translate-x-1/2 pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-blue-50 text-blue-600 font-semibold text-sm tracking-wide uppercase">
            Shop in Shop 파트너 모집
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-8">
            혼자 하는 서치펌,<br />
            <span className="text-blue-600">이제 끝내세요</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-2xl leading-relaxed">
            혼자 일하지만, 조직처럼 벌 수 있습니다. <br className="hidden md:block" />
            독립적인 헤드헌터가 조직의 인프라를 활용해 하나의 사업부처럼 운영하는 구조입니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Users, text: "고객사 & 포지션 공유" },
              { icon: TrendingUp, text: "70~90% 수익 쉐어" },
              { icon: DollarSign, text: "고정비 0원" }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                  <item.icon className="w-6 h-6 text-blue-600" />
                </div>
                <span className="font-bold text-slate-800 text-lg">{item.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* Problem Section */}
      <Section className="bg-slate-50 py-32">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 text-amber-600 mb-4 px-4 py-1.5 bg-amber-50 rounded-full border border-amber-100">
            <AlertCircle className="w-5 h-5" />
            <span className="font-bold uppercase tracking-widest text-xs">The Reality</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-slate-900 leading-tight">
            헤드헌터의 현실, <br className="md:hidden" /> 이대로 괜찮으신가요?
          </h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">대부분의 1인 헤드헌터가 겪는 고질적인 문제들입니다.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { title: "영업의 한계", desc: "혼자서 고객사 발굴부터 포지션 확보까지 하기엔 시간이 턱없이 부족합니다." },
            { title: "정보의 고립", desc: "최신 채용 트렌드와 고급 포지션 정보에서 소외되어 성장이 정체됩니다." },
            { title: "높은 고정비", desc: "사무실 임대료, DB 이용료 등 매달 나가는 고정비가 큰 부담이 됩니다." }
          ].map((item, i) => (
            <div key={i} className="bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-500 group">
              <div className="text-slate-200 font-black text-6xl mb-8 group-hover:text-blue-600/10 transition-colors">0{i+1}</div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800">{item.title}</h3>
              <p className="text-slate-600 leading-relaxed text-lg">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Solution Section */}
      <Section className="py-32 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div className="relative">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60" />
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-black mb-8 tracking-tight leading-[1.1]">
                Shop in Shop 모델이 <br />
                <span className="text-blue-600 underline decoration-blue-100 decoration-8 underline-offset-8">해답입니다.</span>
              </h2>
              <p className="text-xl text-slate-600 leading-relaxed mb-12 max-w-lg">
                우리는 개별 헤드헌터의 독립성을 존중하면서도, 대형 서치펌 수준의 인프라와 네트워크를 공유합니다.
              </p>
              <ul className="space-y-8">
                {[
                  "실시간 포지션 매칭 시스템 제공",
                  "공동 영업 및 공동 진행을 통한 성사율 극대화",
                  "사무 공간 및 유료 채용 포털 계정 무상 지원"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-5">
                    <div className="mt-1 bg-blue-600 rounded-full p-1 shadow-lg shadow-blue-200">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-lg font-bold text-slate-800">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-blue-600 rounded-[4rem] rotate-3 opacity-5" />
            <div className="relative bg-slate-900 rounded-[4rem] p-16 text-white shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl" />
              <div className="flex items-center gap-4 mb-12">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <span className="text-2xl font-bold tracking-tight">성공 방정식</span>
              </div>
              <div className="space-y-12">
                <div>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mb-4">Current State</p>
                  <p className="text-2xl font-light text-slate-400 italic leading-relaxed">"혼자서 모든 것을 해결해야 하는 <br />과부하 상태"</p>
                </div>
                <div className="h-px bg-slate-800" />
                <div>
                  <p className="text-blue-400 text-xs font-black uppercase tracking-[0.2em] mb-4">With Us</p>
                  <p className="text-4xl font-black leading-tight">영업과 매칭에만 <br />집중하는 시스템</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Benefits Section */}
      <Section className="bg-slate-900 text-white py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,0.1),transparent_50%)]" />
        <div className="relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tight">압도적 혜택</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">오직 파트너의 성공만을 위해 설계된 시스템입니다.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[
              { 
                title: "고객사 & 포지션 공유", 
                desc: "혼자서는 만나기 어려운 대형 고객사와 포지션이 즉시 연결됩니다.",
                icon: Users
              },
              { 
                title: "브랜드 파워 활용", 
                desc: "개인이 아닌 조직의 이름으로 영업하여 수주 신뢰도를 극대화합니다.",
                icon: ShieldCheck
              },
              { 
                title: "수익 구조 혁신", 
                desc: "업계 최고 수준인 70~90% 수익 쉐어와 고정비 0원을 실현합니다.",
                icon: DollarSign
              },
              { 
                title: "올인원 지원 시스템", 
                desc: "계약, 정산, 행정 업무를 본사에서 완벽하게 지원합니다.",
                icon: Zap
              },
              { 
                title: "강력한 협업 네트워크", 
                desc: "베테랑 헤드헌터들과의 협업으로 성사율을 3배 이상 높입니다.",
                icon: Users
              },
              { 
                title: "프리미엄 인프라", 
                desc: "쾌적한 사무 공간과 유료 채용 포털 계정을 무상 제공합니다.",
                icon: Briefcase
              }
            ].map((benefit, i) => (
              <div key={i} className="p-12 rounded-[3rem] bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/50 transition-all duration-500 group">
                <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-10 group-hover:bg-blue-600 transition-colors duration-500">
                  <benefit.icon className="w-8 h-8 text-blue-400 group-hover:text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 tracking-tight">{benefit.title}</h3>
                <p className="text-slate-400 leading-relaxed text-lg">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Before/After Section */}
      <Section className="bg-slate-50 py-32">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">성장의 가속도</h2>
          <p className="text-xl text-slate-500">Shop in Shop이 만드는 명확한 차이</p>
        </div>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8 text-slate-400">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <span className="font-bold uppercase tracking-widest text-sm">기존 방식 (Solo)</span>
              </div>
              <ul className="space-y-6">
                {[
                  { label: "고객사", value: "개인 인맥에 의존한 한정적 영업" },
                  { label: "데이터", value: "비싼 비용 대비 부족한 후보자 DB" },
                  { label: "수익성", value: "낮은 요율과 높은 고정비 부담" },
                  { label: "성장성", value: "정보 부재로 인한 성장의 한계" }
                ].map((item, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-400">{item.label}</span>
                    <span className="text-lg text-slate-500">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-blue-600 p-12 rounded-[3rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl" />
              <div className="flex items-center gap-3 mb-8 text-blue-200">
                <div className="w-2 h-2 rounded-full bg-blue-300 animate-pulse" />
                <span className="font-bold uppercase tracking-widest text-sm">Shop in Shop</span>
              </div>
              <ul className="space-y-6">
                {[
                  { label: "데이터", value: "모든 유료 포털 및 내부 DB 무상 지원" },
                  { label: "수익성", value: "70~90% 수익 쉐어 & 고정비 0원" },
                  { label: "성장성", value: "베테랑들과의 협업으로 무한 성장" }
                ].map((item, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-blue-300">{item.label}</span>
                    <span className="text-lg font-bold">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* Performance Section */}
      <Section className="py-32">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">검증된 데이터</h2>
          <p className="text-xl text-slate-500">숫자가 증명하는 파트너십의 가치</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { label: "평균 매출 성장", value: "240%", sub: "합류 후 6개월 기준" },
            { label: "포지션 수주율", value: "3.5배", sub: "브랜드 인프라 활용 시" },
            { label: "파트너 만족도", value: "98%", sub: "시스템 및 지원 만족도" }
          ].map((stat, i) => (
            <div key={i} className="p-16 bg-white rounded-[3rem] text-center border border-slate-100 shadow-sm hover:shadow-xl transition-all">
              <p className="text-slate-500 font-bold mb-6 uppercase tracking-widest text-sm">{stat.label}</p>
              <p className="text-6xl font-black text-blue-600 mb-4 tracking-tighter">{stat.value}</p>
              <p className="text-slate-400 font-medium">{stat.sub}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Operation Section */}
      <Section className="bg-slate-900 text-white py-32 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,rgba(37,99,235,0.1),transparent_50%)]" />
        <div className="relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tight">운영 프로세스</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">단순하고 명확한 협업 구조를 지향합니다.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { 
                step: "01", 
                role: "파트너", 
                tasks: ["고객사 발굴", "후보자 관리", "인터뷰 조율"],
                color: "text-blue-400"
              },
              { 
                step: "02", 
                role: "본사 지원", 
                tasks: ["계약 / 행정 대행", "DB / 시스템 제공", "정산 관리"],
                color: "text-amber-400"
              },
              { 
                step: "03", 
                role: "수익 정산", 
                tasks: ["70~90% 수익 쉐어", "투명한 실시간 정산"],
                color: "text-emerald-400"
              }
            ].map((item, i) => (
              <div key={i} className="bg-white/5 p-12 rounded-[3rem] border border-white/10 hover:border-blue-500/50 transition-all group">
                <span className={`text-xl font-black mb-8 block ${item.color}`}>{item.step}</span>
                <h3 className="text-3xl font-bold mb-8 tracking-tight">{item.role}</h3>
                <ul className="space-y-4">
                  {item.tasks.map((task, j) => (
                    <li key={j} className="flex items-center gap-3 text-slate-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                      <span className="text-lg">{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Revenue Section */}
      <Section className="py-32">
        <div className="max-w-4xl mx-auto bg-white p-16 md:p-24 rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-[2rem] mb-10 shadow-lg shadow-emerald-200">
              <DollarSign className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-8 tracking-tight">압도적인 수익 구조</h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 mb-12">
              <div className="text-center">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">수익 쉐어</p>
                <p className="text-6xl font-black text-slate-900 tracking-tighter">70~90%</p>
              </div>
              <div className="w-px h-16 bg-slate-100 hidden md:block" />
              <div className="text-center">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">고정 비용</p>
                <p className="text-6xl font-black text-emerald-500 tracking-tighter">0원</p>
              </div>
            </div>
            <p className="text-xl text-slate-500 leading-relaxed max-w-xl mx-auto">
              사무실 임대료, DB 이용료 등 모든 고정비를 본사가 부담합니다. <br />
              오직 성과에 따른 수익만 가져가세요.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA Section */}
      <Section className="bg-white text-center py-32">
        <h2 className="text-5xl font-black mb-12 tracking-tight">지금 선택하세요</h2>
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100">
              <p className="text-xl text-slate-500 mb-2">기존 방식</p>
              <p className="text-2xl font-bold text-slate-400">혼자 계속 버티실 건가요?</p>
            </div>
            <div className="p-10 rounded-[2.5rem] bg-blue-600 text-white shadow-2xl shadow-blue-200">
              <p className="text-xl text-blue-200 mb-2">Shop in Shop</p>
              <p className="text-2xl font-bold">함께 더 크게 성장하실 건가요?</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Target Section */}
      <Section className="bg-slate-50 py-32">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">이런 분들께 추천합니다</h2>
          <p className="text-xl text-slate-500">성장의 의지가 있는 분들을 기다립니다.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {[
            "현재 SoHO로 활동 중인 헤드헌터",
            "독립했지만 매출이 정체된 분",
            "고객사 확보가 어려운 분",
            "더 큰 딜을 하고 싶은 분",
            "조직의 인프라가 그리운 분",
            "수익 요율을 높이고 싶은 분"
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-6 p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-xl font-bold text-slate-800">{text}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Urgency Section */}
      <Section className="bg-amber-50 border-y border-amber-100">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 text-amber-600 mb-4">
            <Clock className="w-6 h-6" />
            <span className="font-bold uppercase tracking-widest text-sm">Limited Opportunity</span>
          </div>
          <h2 className="text-4xl font-bold mb-4 text-slate-900">현재 파트너 모집 중</h2>
          <p className="text-amber-800 text-xl leading-relaxed">
            선착순 <span className="font-black underline decoration-amber-400 decoration-4 underline-offset-4">10명</span>만 진행합니다. <br className="hidden md:block" />
            분야별 독점 구조로 조기 마감될 수 있습니다.
          </p>
        </div>
      </Section>

      {/* Support Form Section */}
      <Section id="support-form" className="bg-slate-50 scroll-mt-20 py-32">
        <div className="max-w-3xl mx-auto bg-white p-12 md:p-16 rounded-[3.5rem] shadow-2xl shadow-slate-200/60 border border-white">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-6 shadow-lg shadow-blue-200">
              <Briefcase className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl font-black mb-4 tracking-tight">간단 지원 (1분)</h2>
            <p className="text-slate-500 text-lg">제출 후 24시간 내에 담당자가 연락드립니다.</p>
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">이름</label>
                <input 
                  type="text" 
                  value={formData.name}
                  placeholder="성함을 입력해주세요"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">연락처</label>
                <input 
                  type="tel" 
                  inputMode="tel"
                  value={formData.contact}
                  placeholder="010-0000-0000"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">경력 (년차)</label>
              <input 
                type="text" 
                value={formData.experience}
                placeholder="예: 5년차"
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                onChange={(e) => setFormData({...formData, experience: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">전문 산업</label>
              <input 
                type="text" 
                value={formData.industry}
                placeholder="예: IT/반도체"
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                onChange={(e) => setFormData({...formData, industry: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">현재 매출 구간</label>
              <div className="relative">
                <select 
                  value={formData.revenue}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none pr-12"
                  onChange={(e) => setFormData({...formData, revenue: e.target.value})}
                >
                  <option value="">선택해주세요</option>
                  <option value="3,000만원 미만">3,000만원 미만</option>
                  <option value="3,000만원 ~ 5,000만원">3,000만원 ~ 5,000만원</option>
                  <option value="5,000만원 ~ 1억">5,000만원 ~ 1억</option>
                  <option value="1억 이상">1억 이상</option>
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronRight className="w-5 h-5 text-slate-400 rotate-90" />
                </div>
              </div>
            </div>
            <Button 
              type="submit"
              className={`w-full text-white py-5 text-xl ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? '제출 중...' : '지금 바로 파트너 지원하기'}
            </Button>
          </form>

          <div className="mt-12 flex justify-center gap-12 text-center">
            {[
              { icon: ShieldCheck, text: "개인정보 보호" },
              { icon: ShieldCheck, text: "비밀 유지 보장" }
            ].map((item, i) => (
              <button 
                key={i} 
                onClick={() => setActiveModal(item.text)}
                className="flex flex-col items-center gap-2 group cursor-pointer hover:scale-105 transition-transform"
              >
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                  <item.icon className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter group-hover:text-slate-900 transition-colors">{item.text}</span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Footer */}
      <footer className="bg-slate-900 py-20 px-6 text-center border-t border-slate-800">
        <div className="max-w-4xl mx-auto">
          <p className="text-3xl md:text-4xl font-black text-white mb-8">
            “혼자 일하는 시대는 끝났다”
          </p>
          <div className="h-px w-24 bg-blue-600 mx-auto mb-8" />
          <p className="text-slate-500 text-sm">
            &copy; 2026 Shop in Shop Partnership. All rights reserved.
          </p>
          <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-6">
            <button 
              onClick={handleShare}
              className="px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold flex items-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Share2 className="w-5 h-5 text-blue-600" />
              친구에게 공유하기
            </button>
            <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-2xl border border-slate-700">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center border-2 border-slate-900">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center border-2 border-slate-900">
                  <Monitor className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-slate-400 text-sm font-medium">
                안드로이드/맥에서 <span className="text-white font-bold">"앱으로 설치"</span>하여 <br className="md:hidden" /> 더 편리하게 이용하세요.
              </p>
            </div>
          </div>
          <div className="mt-12">
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="px-6 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm md:text-xs hover:bg-slate-800 hover:text-white transition-all inline-flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              지원자 현황 확인 (Admin View)
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
