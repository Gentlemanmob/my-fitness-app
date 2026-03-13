import React, { useState, useEffect, useRef } from 'react';
import { 
  Dumbbell, Play, Plus, Clock, CheckCircle2, 
  Home, Settings, Video, X, RotateCcw,
  Trophy, CalendarDays, CalendarCheck, ChevronLeft, ChevronRight,
  Activity, Cloud, CloudOff, Loader2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// ==========================================
// Firebase 云端数据库配置区域
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyB2GZPB577KIzln07ohUgjaDr2ImoQacq0",
  authDomain: "my-fitness-app-48bfd.firebaseapp.com",
  projectId: "my-fitness-app-48bfd",
  storageBucket: "my-fitness-app-48bfd.firebasestorage.app",
  messagingSenderId: "477764715862",
  appId: "1:477764715862:web:77db4ea3e48052596c02f7",
  measurementId: "G-WQKC8FYS4Z"
};

const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'fitness-app-id';

// 肌肉部位定义
const MUSCLES = {
  chest: { id: 'chest', name: '胸部', color: '#ef4444' }, 
  back: { id: 'back', name: '背部', color: '#3b82f6' }, 
  legs: { id: 'legs', name: '腿部', color: '#10b981' }, 
  core: { id: 'core', name: '核心', color: '#f59e0b' }, 
  arms: { id: 'arms', name: '手臂', color: '#8b5cf6' }, 
};

// 默认周计划数据
const defaultWeeklyPlan = {
  1: [
    { id: '101', name: '跪姿俯卧撑', sets: 3, reps: '8', restTime: 60, videoUrl: null, targets: ['chest', 'arms'] },
    { id: '102', name: '板凳臂屈伸', sets: 3, reps: '10', restTime: 60, videoUrl: null, targets: ['arms'] }
  ],
  2: [
    { id: '201', name: '自重深蹲', sets: 4, reps: '15', restTime: 60, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', targets: ['legs'] },
    { id: '202', name: '弓箭步', sets: 3, reps: '12', restTime: 60, videoUrl: null, targets: ['legs'] }
  ],
  3: [
    { id: '301', name: '平板支撑', sets: 3, reps: '30秒', restTime: 45, videoUrl: null, targets: ['core'] },
    { id: '302', name: '卷腹', sets: 3, reps: '15', restTime: 45, videoUrl: null, targets: ['core'] }
  ],
  4: [
    { id: '401', name: '引体向上', sets: 3, reps: '8', restTime: 60, videoUrl: null, targets: ['back', 'arms'] },
    { id: '402', name: '超人起飞', sets: 3, reps: '15', restTime: 45, videoUrl: null, targets: ['back', 'core'] }
  ],
  5: [
    { id: '501', name: '波比跳', sets: 3, reps: '10', restTime: 60, videoUrl: null, targets: ['legs', 'core', 'chest'] },
    { id: '502', name: '俯卧撑', sets: 3, reps: '10', restTime: 60, videoUrl: null, targets: ['chest', 'arms'] }
  ],
  6: [], 
  0: []  
};

const formatDate = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 人体肌肉分布图组件
const BodyMap = ({ activeMuscles }) => {
  const getColor = (muscleId) => activeMuscles.includes(muscleId) ? MUSCLES[muscleId].color : '#e5e7eb';
  return (
    <div className="relative w-28 h-48 mx-auto flex items-center justify-center">
      <svg viewBox="0 0 100 200" className="w-full h-full drop-shadow-md transition-all duration-500">
        <circle cx="50" cy="25" r="14" fill="#d1d5db" />
        <rect x="46" y="38" width="8" height="10" fill="#d1d5db" />
        <path d="M30 48 Q50 48 70 48 L65 85 L35 85 Z" fill={activeMuscles.includes('back') ? getColor('back') : getColor('chest')} className="transition-colors duration-500" />
        <path d="M35 87 L65 87 L60 115 L40 115 Z" fill={getColor('core')} className="transition-colors duration-500" />
        <path d="M28 48 Q20 48 15 85 Q12 110 18 115 Q24 115 25 85 L30 55 Z" fill={getColor('arms')} className="transition-colors duration-500" />
        <path d="M72 48 Q80 48 85 85 Q88 110 82 115 Q76 115 75 85 L70 55 Z" fill={getColor('arms')} className="transition-colors duration-500" />
        <path d="M38 117 L48 117 L45 190 Q40 195 35 190 Q30 160 32 117 Z" fill={getColor('legs')} className="transition-colors duration-500" />
        <path d="M62 117 L52 117 L55 190 Q60 195 65 190 Q70 160 68 117 Z" fill={getColor('legs')} className="transition-colors duration-500" />
      </svg>
    </div>
  );
};

export default function App() {
  // 云端存储相关状态
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedData = useRef('');

  // 业务状态
  const [currentView, setCurrentView] = useState('home'); 
  const [weeklyPlan, setWeeklyPlan] = useState(defaultWeeklyPlan);
  const [activeDate, setActiveDate] = useState(new Date());
  const [dailyRecords, setDailyRecords] = useState({}); 
  const [history, setHistory] = useState({}); 
  const [activeVideo, setActiveVideo] = useState(null);
  const [isResting, setIsResting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // 管理页面状态
  const [manageDay, setManageDay] = useState(new Date().getDay()); 
  const [newEx, setNewEx] = useState({ name: '', sets: 3, reps: '12', restTime: 60, videoUrl: null, targets: ['chest'] });
  const fileInputRef = useRef(null);

  // 日历查看月份控制
  const [displayDate, setDisplayDate] = useState(new Date());

  // 动态注入 Tailwind CSS
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
  }, []);

  // 1. 初始化鉴权
  useEffect(() => {
    if (!auth) {
      setIsLoaded(true);
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("鉴权失败", error);
        setIsLoaded(true);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 监听云端数据下载
  useEffect(() => {
    if (!user || !db) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'fitness_data', 'main');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const dataStr = JSON.stringify(data);
        if (dataStr === lastSavedData.current) return; 

        lastSavedData.current = dataStr;
        if (data.weeklyPlan) setWeeklyPlan(data.weeklyPlan);
        if (data.dailyRecords) setDailyRecords(data.dailyRecords);
        if (data.history) setHistory(data.history);
      }
      setIsLoaded(true);
    }, (error) => {
      console.error("拉取数据失败:", error);
      setIsLoaded(true);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. 监听本地数据变动并上传
  useEffect(() => {
    if (!isLoaded || !user || !db) return;
    
    const currentDataStr = JSON.stringify({ weeklyPlan, dailyRecords, history });
    if (currentDataStr === lastSavedData.current) return; 

    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      try {
        lastSavedData.current = currentDataStr;
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'fitness_data', 'main');
        await setDoc(docRef, { weeklyPlan, dailyRecords, history }, { merge: true });
      } catch (error) {
        console.error("保存失败:", error);
      }
      setIsSaving(false);
    }, 1500);
    
    return () => clearTimeout(timeoutId);
  }, [weeklyPlan, dailyRecords, history, user, isLoaded]);

  // 核心业务逻辑
  const activeDateStr = formatDate(activeDate);
  const activeDayOfWeek = activeDate.getDay();
  const currentExercises = weeklyPlan[activeDayOfWeek] || [];

  const getDaysOfWeek = (baseDate) => {
    const week = [];
    const current = new Date(baseDate);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(current.setDate(diff));
    for (let i = 0; i < 7; i++) {
      const next = new Date(monday);
      next.setDate(monday.getDate() + i);
      week.push(next);
    }
    return week;
  };
  const weekDays = getDaysOfWeek(activeDate);

  useEffect(() => {
    let timer;
    if (isResting && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (isResting && timeLeft === 0) {
      setIsResting(false);
    }
    return () => clearInterval(timer);
  }, [isResting, timeLeft]);

  const totalSets = currentExercises.reduce((acc, ex) => acc + ex.sets, 0);
  let completedSets = 0;
  
  if (dailyRecords[activeDateStr]) {
    currentExercises.forEach(ex => {
      const sets = dailyRecords[activeDateStr][ex.id] || [];
      completedSets += sets.filter(Boolean).length;
    });
  }
  const progress = totalSets === 0 ? 0 : Math.round((completedSets / totalSets) * 100);

  useEffect(() => {
    if (totalSets > 0) {
      setHistory(prev => {
        const isDone = progress === 100;
        if (prev[activeDateStr] === isDone) return prev;
        return { ...prev, [activeDateStr]: isDone };
      });
    }
  }, [progress, totalSets, activeDateStr]);

  const toggleSet = (exId, setIndex, restTime) => {
    setDailyRecords(prev => {
      const dayRecord = prev[activeDateStr] || {};
      const exRecord = dayRecord[exId] || Array(weeklyPlan[activeDayOfWeek].find(e => e.id === exId).sets).fill(false);
      const newExRecord = [...exRecord];
      const willBeCompleted = !newExRecord[setIndex];
      newExRecord[setIndex] = willBeCompleted;
      
      if (willBeCompleted) {
        setTimeLeft(restTime);
        setIsResting(true);
      }
      return { ...prev, [activeDateStr]: { ...dayRecord, [exId]: newExRecord } };
    });
  };

  const skipRest = () => { setIsResting(false); setTimeLeft(0); };

  const resetTodayPlan = () => {
    setDailyRecords(prev => {
      const newRecords = { ...prev };
      delete newRecords[activeDateStr];
      return newRecords;
    });
    setHistory(prev => {
      const newHistory = { ...prev };
      newHistory[activeDateStr] = false;
      return newHistory;
    });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-indigo-600">
        <Loader2 size={48} className="animate-spin mb-4" />
        <p className="font-medium text-gray-500">正在同步你的健身数据...</p>
      </div>
    );
  }

  // ==========================================
  // 子页面渲染函数
  // ==========================================
  const renderHome = () => {
    const isToday = formatDate(new Date()) === activeDateStr;
    const activeMuscles = [...new Set(currentExercises.flatMap(ex => ex.targets || []))];

    return (
      <div className="pb-28 max-w-md mx-auto h-full flex flex-col">
        <div className="bg-white px-4 py-4 rounded-b-3xl shadow-sm mb-6 sticky top-0 z-20">
          <div className="flex justify-between items-center mb-4">
             <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               {isToday ? "今日计划" : `${activeDate.getMonth() + 1}月${activeDate.getDate()}日 计划`}
             </h1>
             <div className="flex items-center gap-3">
               <div className="flex items-center gap-1 text-[10px] text-gray-400">
                 {isSaving ? <Loader2 size={12} className="animate-spin text-indigo-500" /> : (db ? <Cloud size={12} className="text-green-500" /> : <CloudOff size={12} />)}
                 <span className="hidden sm:inline">{isSaving ? '同步中' : (db ? '已同步' : '单机模式')}</span>
               </div>
               <button onClick={() => setActiveDate(new Date())} className="text-xs font-medium bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition">
                 回今天
               </button>
             </div>
          </div>
          
          <div className="flex justify-between gap-1">
            {weekDays.map((date, idx) => {
              const dStr = formatDate(date);
              const isSelected = dStr === activeDateStr;
              const isCompleted = history[dStr];
              const dayName = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
              
              return (
                <button key={idx} onClick={() => setActiveDate(date)} className={`flex flex-col items-center justify-center w-12 h-16 rounded-2xl transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  <span className="text-xs mb-1">{dayName}</span>
                  <span className={`text-lg font-bold ${isCompleted && !isSelected ? 'text-green-500' : ''}`}>{date.getDate()}</span>
                  {isCompleted && isSelected && <CheckCircle2 size={12} className="absolute bottom-1 text-indigo-200" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 flex-1 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
             <div className="flex-1">
               <h2 className="text-gray-500 text-sm font-medium mb-2">锻炼部位</h2>
               {activeMuscles.length > 0 ? (
                 <div className="flex flex-wrap gap-2">
                   {activeMuscles.map(m => (
                     <span key={m} className="px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: MUSCLES[m].color }}>
                       {MUSCLES[m].name}
                     </span>
                   ))}
                 </div>
               ) : (
                 <p className="text-xl font-bold text-green-500 flex items-center gap-2">
                   <Activity size={24} /> 休息日
                 </p>
               )}
               <div className="mt-4">
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span className="text-gray-500">计划进度</span>
                    <span className="text-indigo-600">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>
               </div>
             </div>
             <div className="w-1/2 flex justify-end">
                <BodyMap activeMuscles={activeMuscles} />
             </div>
          </div>

          {progress === 100 && totalSets > 0 && (
             <div className="bg-green-100 border border-green-200 p-4 rounded-2xl flex items-center gap-4 shadow-sm transition-opacity duration-300">
                 <div className="bg-green-500 text-white p-3 rounded-full"><Trophy size={20} /></div>
                 <div className="flex-1">
                     <h3 className="font-bold text-green-800">全部完成！</h3>
                     <p className="text-xs text-green-600">你太棒了，继续保持！</p>
                 </div>
                 <button onClick={resetTodayPlan} className="text-green-600 hover:bg-green-200 p-2 rounded-full transition"><RotateCcw size={18} /></button>
             </div>
          )}

          <div className="space-y-4">
            {currentExercises.length === 0 ? (
               <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                 <p className="text-gray-500">今天是休息日，好好放松肌肉吧！</p>
                 <button onClick={() => setCurrentView('manage')} className="mt-4 text-indigo-600 font-medium text-sm hover:underline">去设置计划</button>
               </div>
            ) : (
              currentExercises.map((ex) => {
                const dayRecord = dailyRecords[activeDateStr] || {};
                const setsRecord = dayRecord[ex.id] || Array(ex.sets).fill(false);
                const isAllDone = setsRecord.filter(Boolean).length === ex.sets;
                
                return (
                  <div key={ex.id} className={`bg-white p-5 rounded-2xl border transition-all ${isAllDone ? 'border-green-200 shadow-sm' : 'border-gray-100 shadow-md shadow-gray-200/50'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          {(ex.targets || []).map(t => MUSCLES[t] && (
                            <div key={t} className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MUSCLES[t].color }}></span>
                              <span className="text-xs text-gray-500">{MUSCLES[t].name}</span>
                            </div>
                          ))}
                        </div>
                        <h3 className={`text-xl font-bold ${isAllDone ? 'text-green-700' : 'text-gray-800'} flex items-center gap-2`}>
                          {isAllDone && <CheckCircle2 className="text-green-500" size={18} />} {ex.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">{ex.sets}组 × {ex.reps} • 休息 {ex.restTime}s</p>
                      </div>
                      {ex.videoUrl && (
                        <button onClick={() => setActiveVideo(ex.videoUrl)} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition active:scale-95">
                          <Play size={12} /> 演示
                        </button>
                      )}
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {Array.from({ length: ex.sets }).map((_, idx) => {
                        const isDone = setsRecord[idx];
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleSet(ex.id, idx, ex.restTime)}
                            className={`flex-1 min-w-[3rem] py-2.5 rounded-xl border-2 flex items-center justify-center transition-all active:scale-90 ${
                              isDone ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-indigo-300'
                            }`}
                          >
                            {isDone ? <CheckCircle2 size={18} /> : <span className="font-semibold text-xs">第{idx + 1}组</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderManage = () => {
    const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    const handleVideoUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
        const videoUrl = URL.createObjectURL(file);
        setNewEx({ ...newEx, videoUrl });
      }
    };

    const toggleTargetMuscle = (mId) => {
      setNewEx(prev => {
        const newTargets = prev.targets.includes(mId) ? prev.targets.filter(t => t !== mId) : [...prev.targets, mId];
        return { ...prev, targets: newTargets };
      });
    };
    
    const handleAdd = () => {
      if (!newEx.name) return alert('请输入动作名称');
      if (newEx.targets.length === 0) return alert('请至少选择一个锻炼部位');
      const updatedPlan = { ...weeklyPlan };
      if (!updatedPlan[manageDay]) updatedPlan[manageDay] = [];
      updatedPlan[manageDay].push({ ...newEx, id: Date.now().toString() });
      setWeeklyPlan(updatedPlan);
      setNewEx({ name: '', sets: 3, reps: '12', restTime: 60, videoUrl: null, targets: ['chest'] });
    };

    const removeExercise = (id) => {
      const updatedPlan = { ...weeklyPlan };
      updatedPlan[manageDay] = updatedPlan[manageDay].filter(ex => ex.id !== id);
      setWeeklyPlan(updatedPlan);
    };

    return (
      <div className="p-6 pb-28 max-w-md mx-auto h-full flex flex-col overflow-y-auto">
        <header className="mb-6 mt-2">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Settings className="text-indigo-600" />周计划设置</h1>
        </header>

        <div className="flex bg-gray-200 p-1 rounded-xl mb-6 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {weekNames.map((name, idx) => (
            <button key={idx} onClick={() => setManageDay(idx)} className={`flex-1 py-2 text-sm font-medium rounded-lg whitespace-nowrap px-3 transition-all ${manageDay === idx ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
              {name}
            </button>
          ))}
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">添加到 {weekNames[manageDay]}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-600 mb-2">锻炼部位 (可多选)</label>
              <div className="flex gap-2 flex-wrap">
                 {Object.values(MUSCLES).map(m => {
                   const isSelected = newEx.targets.includes(m.id);
                   return <button key={m.id} onClick={() => toggleTargetMuscle(m.id)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${isSelected ? 'text-white border-transparent shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`} style={{ backgroundColor: isSelected ? m.color : '' }}>{m.name}</button>;
                 })}
              </div>
            </div>
            <div><label className="block text-xs text-gray-600 mb-1">动作名称</label><input type="text" className="w-full border rounded-lg p-2.5 bg-gray-50 text-sm" value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} placeholder="例如：引体向上" /></div>
            <div className="flex gap-3">
              <div className="flex-1"><label className="block text-xs text-gray-600 mb-1">组数</label><input type="number" className="w-full border rounded-lg p-2.5 bg-gray-50 text-sm" value={newEx.sets} onChange={e => setNewEx({...newEx, sets: parseInt(e.target.value) || 0})} /></div>
              <div className="flex-1"><label className="block text-xs text-gray-600 mb-1">次数</label><input type="text" className="w-full border rounded-lg p-2.5 bg-gray-50 text-sm" value={newEx.reps} onChange={e => setNewEx({...newEx, reps: e.target.value})} /></div>
              <div className="flex-1"><label className="block text-xs text-gray-600 mb-1">休息(秒)</label><input type="number" className="w-full border rounded-lg p-2.5 bg-gray-50 text-sm" value={newEx.restTime} onChange={e => setNewEx({...newEx, restTime: parseInt(e.target.value) || 0})} /></div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">动作演示视频 (可选)</label>
              <input type="file" accept="video/*" className="hidden" ref={fileInputRef} onChange={handleVideoUpload} />
              <button onClick={() => fileInputRef.current.click()} className="w-full border-2 border-dashed border-gray-300 rounded-xl p-3 text-gray-500 flex items-center justify-center hover:bg-gray-50 transition gap-2">
                {newEx.videoUrl ? <><CheckCircle2 size={16} className="text-green-500" /> <span className="text-sm text-green-600">已选择视频</span></> : <><Video size={16} /> <span className="text-sm">点击选择本地视频文件</span></>}
              </button>
            </div>
            <button onClick={handleAdd} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">
              <Plus size={18} /> 加入今日
            </button>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-500 mb-3">{weekNames[manageDay]} 动作清单</h2>
        <div className="space-y-3">
          {(weeklyPlan[manageDay] || []).length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">本日休息</p>
          ) : (
            (weeklyPlan[manageDay] || []).map(ex => (
              <div key={ex.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {(ex.targets || []).map(t => MUSCLES[t] && <span key={t} className="w-2 h-2 rounded-full" style={{ backgroundColor: MUSCLES[t].color }}></span>)}
                  </div>
                  <p className="font-semibold text-gray-800 text-sm">{ex.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ex.sets}组 × {ex.reps} | 休息 {ex.restTime}s</p>
                </div>
                <button onClick={() => removeExercise(ex.id)} className="text-red-400 p-2 hover:bg-red-50 rounded-lg"><X size={18} /></button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = Array.from({length: firstDay}).fill(null).concat(Array.from({length: daysInMonth}, (_, i) => i + 1));

    const prevMonth = () => setDisplayDate(new Date(year, month - 1, 1));
    const nextMonth = () => setDisplayDate(new Date(year, month + 1, 1));

    return (
      <div className="p-6 pb-28 max-w-md mx-auto h-full flex flex-col">
        <header className="mb-6 mt-2"><h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><CalendarCheck className="text-indigo-600" />打卡日历</h1></header>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition"><ChevronLeft size={24} className="text-gray-600" /></button>
            <h2 className="text-xl font-bold text-gray-800 text-center">{year}年 {month + 1}月</h2>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition"><ChevronRight size={24} className="text-gray-600" /></button>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-4 text-center">
            {['日', '一', '二', '三', '四', '五', '六'].map(day => <div key={day} className="text-xs font-semibold text-gray-400">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-4 gap-x-2">
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="h-10" />;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isCompleted = history[dateKey];
              return (
                <div key={idx} className="flex flex-col items-center justify-center h-10 relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${isCompleted ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-gray-50 text-gray-600 border border-transparent'}`}>
                    {day}
                  </div>
                  {isCompleted && <div className="absolute -bottom-1 text-green-500 bg-white rounded-full"><CheckCircle2 size={14} className="fill-green-100" /></div>}
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="mt-6 bg-indigo-50 rounded-2xl p-5 border border-indigo-100 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm text-indigo-600 font-medium mb-1">本月打卡天数</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-indigo-800">
                {Object.keys(history).filter(k => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) && history[k]).length}
              </span>
              <span className="text-indigo-600 font-medium">天</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center shadow-inner"><Trophy className="text-indigo-500" size={24} /></div>
        </div>
      </div>
    );
  };

  const renderNavigation = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 pb-6 pt-2 z-30">
      <div className="max-w-md mx-auto flex justify-around px-2">
        <button onClick={() => setCurrentView('home')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${currentView === 'home' ? 'text-indigo-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}><Home size={24} className="mb-1" /><span className="text-[10px] font-medium">打卡</span></button>
        <button onClick={() => setCurrentView('calendar')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${currentView === 'calendar' ? 'text-indigo-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}><CalendarCheck size={24} className="mb-1" /><span className="text-[10px] font-medium">记录</span></button>
        <button onClick={() => setCurrentView('manage')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${currentView === 'manage' ? 'text-indigo-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}><Settings size={24} className="mb-1" /><span className="text-[10px] font-medium">计划</span></button>
      </div>
    </nav>
  );

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-900 relative">
      {currentView === 'home' && renderHome()}
      {currentView === 'calendar' && renderCalendar()}
      {currentView === 'manage' && renderManage()}
      {renderNavigation()}

      {activeVideo && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-center items-center transition-opacity duration-300">
          <div className="w-full max-w-md relative flex flex-col h-full">
            <div className="p-4 flex justify-end">
              <button onClick={() => setActiveVideo(null)} className="text-white/70 hover:text-white bg-white/10 p-2 rounded-full backdrop-blur transition"><X size={24} /></button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <video src={activeVideo} controls autoPlay loop playsInline className="w-full max-h-[70vh] rounded-lg shadow-2xl" />
            </div>
            <div className="p-6 text-center text-white/50 text-sm">看完视频后，可点击右上角关闭继续打卡</div>
          </div>
        </div>
      )}

      {isResting && timeLeft > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm text-white px-5 py-3 rounded-full flex items-center gap-4 shadow-2xl z-40 border border-gray-700 w-max transition-all duration-500 transform translate-y-0">
          <Clock size={22} className="text-yellow-400 animate-pulse" />
          <div className="flex flex-col"><span className="text-[10px] text-gray-400 -mb-1 tracking-wider uppercase">休息时间</span><span className="font-mono text-xl font-bold leading-none mt-1">{timeLeft}s</span></div>
          <button onClick={skipRest} className="ml-2 bg-gray-700 hover:bg-gray-600 p-2 rounded-full transition" title="跳过休息"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}