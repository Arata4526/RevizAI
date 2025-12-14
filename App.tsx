import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, AlertCircle, BookOpen, Award, Save, LayoutDashboard, BrainCircuit, Layers, RotateCw, Trash2, ArrowLeft, ArrowRight, Upload, Plus, FileText, Loader2, X, Home, GraduationCap, ChevronRight, Sparkles, Folder as FolderIcon, FolderPlus, MoreVertical, Download, Calendar as CalendarIcon, Clock, CheckSquare } from 'lucide-react';
import { useLiveApi, Language } from './hooks/useLiveApi';
import { Visualizer } from './components/Visualizer';
import { ModeSelector } from './components/ModeSelector';
import { parseFile } from './utils/fileParsing';
import { generatePDF } from './utils/pdfGenerator';
import { Course } from './types';

type Tab = 'session' | 'competences' | 'flashcards' | 'cheatsheet';
type View = 'dashboard' | 'create' | 'session' | 'calendar';

// --- Sub-components ---

const FlagFR = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" className="rounded-full shadow-sm">
    <circle cx="16" cy="16" r="16" fill="#F0F0F0"/>
    <path d="M16 0C10.8 0 6 1.3 2 3.8V28.2C6 30.7 10.8 32 16 32V0Z" fill="#F0F0F0"/>
    <path d="M2 3.8C0.8 5.6 0 7.7 0 10V22C0 24.3 0.8 26.4 2 28.2V3.8Z" fill="#0055A4"/>
    <path d="M10.7 0H21.3V32H10.7V0Z" fill="#FFFFFF"/>
    <path d="M16 0V32C21.2 32 26 30.7 30 28.2V3.8C26 1.3 21.2 0 16 0Z" fill="#EF4135"/>
  </svg>
);

const FlagEN = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" className="rounded-full shadow-sm border border-slate-100">
    <circle cx="16" cy="16" r="16" fill="#00247D"/>
    <path d="M0 0L32 32M32 0L0 32" stroke="white" strokeWidth="4"/>
    <path d="M0 0L32 32M32 0L0 32" stroke="#CF142B" strokeWidth="2"/>
    <path d="M16 0V32M0 16H32" stroke="white" strokeWidth="6"/>
    <path d="M16 0V32M0 16H32" stroke="#CF142B" strokeWidth="3"/>
  </svg>
);

const FlagES = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" className="rounded-full shadow-sm border border-slate-100">
     <circle cx="16" cy="16" r="16" fill="#AA151B"/>
     <path d="M0 8H32V24H0V8Z" fill="#F1BF00"/>
  </svg>
);

const LoadingScreen = () => (
  <div className="flex flex-col h-screen items-center justify-center bg-slate-900 text-white relative overflow-hidden">
     <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-violet-600/20 rounded-full blur-[100px]"></div>
     </div>
     <div className="z-10 flex flex-col items-center">
        <div className="relative">
           <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mb-6"></div>
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
             <BrainCircuit className="text-white/80 w-6 h-6" />
           </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">RévizIA</h1>
        <p className="text-indigo-200 text-sm font-medium animate-pulse">Chargement de votre espace...</p>
     </div>
  </div>
);

const ScoreBar = ({ score, label }: { score: number, label: string }) => {
  let colorClass = "bg-slate-200";
  let statusLabel = "Non évalué";
  let width = "0%";

  if (score === 1) { colorClass = "bg-red-500"; statusLabel = "Inconnu"; width = "20%"; }
  else if (score === 2) { colorClass = "bg-orange-500"; statusLabel = "Fragile"; width = "40%"; }
  else if (score === 3) { colorClass = "bg-yellow-500"; statusLabel = "En cours"; width = "60%"; }
  else if (score === 4) { colorClass = "bg-blue-500"; statusLabel = "Acquis"; width = "80%"; }
  else if (score === 5) { colorClass = "bg-emerald-500"; statusLabel = "Maîtrisé"; width = "100%"; }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-end">
        <span className="text-sm font-semibold text-slate-700 truncate max-w-[70%]">{label}</span>
        <div className="text-right flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full ${score > 0 ? 'bg-slate-100 text-slate-500' : 'text-slate-300'}`}>{statusLabel}</span>
            <span className="text-sm font-bold text-slate-900">{score > 0 ? `${score}/5` : '-'}</span>
        </div>
      </div>
      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`} style={{ width: score > 0 ? width : '0%' }}></div>
      </div>
    </div>
  );
};

// --- Modal Component ---
const ConfirmModal = ({ 
    isOpen, 
    title, 
    message, 
    onConfirm, 
    onCancel,
    isDanger = false 
}: { 
    isOpen: boolean, title: string, message: string, onConfirm: () => void, onCancel: () => void, isDanger?: boolean 
}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 mb-8 leading-relaxed">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Annuler</button>
                    <button onClick={onConfirm} className={`px-5 py-2.5 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}>
                        Confirmer
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Main App Component ---

export default function App() {
  const { 
    connect, disconnect, finishSession,
    isConnected, isStreaming, error, volume, 
    sendTextCommand, speechRate, setSpeechRate, 
    language, setLanguage,
    courses, folders, activeCourse, exams,
    createCourse, deleteCourse, selectCourse, clearFlashcards,
    createFolder, deleteFolder, exitSession,
    generateCheatSheet, isGeneratingSheet,
    createExam, deleteExam, generateExamSchedule, isGeneratingSchedule
  } = useLiveApi();

  const [activeTab, setActiveTab] = useState<Tab>('session');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  
  // Dashboard Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Modal State
  const [deleteModal, setDeleteModal] = useState<{type: 'course'|'folder', id: string, name: string} | null>(null);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Exam Creation State
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState("");
  const [newExamDate, setNewExamDate] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  
  // Schedule Viewing State
  const [scheduleModalOpen, setScheduleModalOpen] = useState<string | null>(null); // Exam ID

  // Creation State
  const [inputTopic, setInputTopic] = useState("");
  const [inputContent, setInputContent] = useState("");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flashcards State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (activeCourse) { setView('session'); } 
    else if (view === 'session') { setView('dashboard'); }
  }, [activeCourse]);

  useEffect(() => {
    async function checkKey() {
      await new Promise(r => setTimeout(r, 800)); 
      if (process.env.API_KEY) { setHasApiKey(true); } 
      else if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
      setCheckingKey(false);
    }
    checkKey();
  }, []);

  const handleApiKeySelect = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    }
  };

  const handleCreateCourse = () => {
      if (!inputTopic.trim() || !inputContent.trim()) { alert("Veuillez remplir le titre et le contenu."); return; }
      createCourse(inputTopic, inputContent, currentFolderId || undefined);
      setInputTopic("");
      setInputContent("");
      setView('dashboard');
  };

  const handleCreateFolder = () => {
      if(newFolderName.trim()){
          createFolder(newFolderName.trim());
          setNewFolderName("");
          setCreateFolderModalOpen(false);
      }
  }

  const handleDeleteConfirm = () => {
      if(!deleteModal) return;
      if(deleteModal.type === 'course') deleteCourse(deleteModal.id);
      if(deleteModal.type === 'folder') deleteFolder(deleteModal.id);
      setDeleteModal(null);
  }

  const handleCreateExam = () => {
      if(!newExamTitle || !newExamDate || selectedCourseIds.size === 0) return;
      createExam(newExamTitle, newExamDate, Array.from(selectedCourseIds));
      setExamModalOpen(false);
      setNewExamTitle("");
      setNewExamDate("");
      setSelectedCourseIds(new Set());
  }

  const toggleCourseSelection = (id: string) => {
      const newSet = new Set(selectedCourseIds);
      if(newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedCourseIds(newSet);
  }

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsProcessingFile(true);
    setFileError(null);
    try {
      if (!inputTopic) {
        if (files.length === 1) { setInputTopic(files[0].name.split('.').slice(0, -1).join('.')); } 
        else { setInputTopic(`Multi-docs - ${new Date().toLocaleDateString()}`); }
      }
      const results = await Promise.all(files.map(async (file) => {
          try {
              const text = await parseFile(file);
              return { success: true, text: `=== DOCUMENT : ${file.name} ===\n${text}`, file };
          } catch (e: any) {
              return { success: false, error: e.message || "Erreur inconnue", file };
          }
      }));
      const successes = results.filter((r): r is { success: true, text: string, file: File } => r.success);
      const failures = results.filter((r): r is { success: false, error: string, file: File } => !r.success);

      if (successes.length > 0) {
          const combinedText = successes.map(r => r.text).join('\n\n');
          setInputContent(prev => prev ? prev + "\n\n" + combinedText : combinedText);
      }
      if (failures.length > 0) {
          const failedNames = failures.map(f => f.file.name).join(', ');
          setFileError(`${failures.length} fichiers ignorés (${failedNames}).`);
      }
    } catch (err: any) {
      setFileError(err.message || "Erreur inattendue.");
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const activeSkillsList = activeCourse?.report?.scores ? Object.values(activeCourse.report.scores) : [];
  const activeAverage = activeSkillsList.length > 0 ? Math.round((activeSkillsList.reduce((acc, curr) => acc + curr.score, 0) / (activeSkillsList.length * 5)) * 100) : 0;

  // Filter Data based on navigation
  const visibleCourses = courses.filter(c => currentFolderId ? c.folderId === currentFolderId : !c.folderId);
  const currentFolder = folders.find(f => f.id === currentFolderId);

  // Global stats calculations (all courses)
  const allScores = courses.flatMap(c => c.report ? Object.values(c.report.scores).map(s => s.score) : []);
  const globalAverage = allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / (allScores.length * 5)) * 100) : 0;
  const masteredSkills = allScores.filter(s => s >= 4).length;


  if (checkingKey) return <LoadingScreen />;

  if (!hasApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="text-indigo-600 w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Bienvenue sur RévizIA</h1>
          <button onClick={handleApiKeySelect} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 px-4 rounded-xl mt-6 shadow-lg shadow-indigo-200 transition-all">Sélectionner Clé API</button>
        </div>
      </div>
    );
  }

  // ---------------- VIEW: DASHBOARD & CALENDAR ----------------
  if (view === 'dashboard' || view === 'calendar') {
    return (
        <div className="relative flex flex-col h-screen overflow-hidden bg-slate-50">
            {/* Background Ambient Effect */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                 <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-indigo-200/20 rounded-full blur-[100px]"></div>
                 <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] bg-blue-200/20 rounded-full blur-[100px]"></div>
            </div>

            <div className="relative z-10 flex flex-col h-full max-w-6xl mx-auto px-4 py-8 overflow-y-auto scrollbar-hide w-full">
                {/* Confirmation Modals */}
                <ConfirmModal 
                    isOpen={!!deleteModal}
                    title={deleteModal?.type === 'folder' ? 'Supprimer le dossier ?' : 'Supprimer le cours ?'}
                    message={deleteModal?.type === 'folder' 
                        ? `Attention : La suppression du dossier "${deleteModal?.name}" entraînera la suppression définitive de TOUS les cours qu'il contient.`
                        : `Voulez-vous vraiment supprimer le cours "${deleteModal?.name}" ? Cette action est irréversible.`
                    }
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setDeleteModal(null)}
                    isDanger={true}
                />

                {/* Create Exam Modal */}
                {examModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-4 text-slate-900">Programmer un Partiel</h3>
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Nom de l'épreuve</label>
                                    <input autoFocus type="text" className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800" placeholder="Ex: Partiels S1 - Droit" value={newExamTitle} onChange={e => setNewExamTitle(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Date de l'examen</label>
                                    <input type="date" className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800" value={newExamDate} onChange={e => setNewExamDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Cours à réviser ({selectedCourseIds.size})</label>
                                    <div className="max-h-40 overflow-y-auto border rounded-xl p-2 space-y-1 bg-slate-50 text-slate-700">
                                        {courses.map(course => (
                                            <div key={course.id} onClick={() => toggleCourseSelection(course.id)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedCourseIds.has(course.id) ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-200'}`}>
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedCourseIds.has(course.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-400 bg-white'}`}>
                                                    {selectedCourseIds.has(course.id) && <CheckSquare size={14} className="text-white" />}
                                                </div>
                                                <span className="text-sm font-medium truncate">{course.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setExamModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Annuler</button>
                                <button onClick={handleCreateExam} disabled={!newExamTitle || !newExamDate || selectedCourseIds.size === 0} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50">Créer</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Schedule View Modal */}
                {scheduleModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl h-[80vh] flex flex-col relative overflow-hidden">
                             <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                                 <h3 className="text-lg font-bold text-slate-800">Planning de Révision</h3>
                                 <button onClick={() => setScheduleModalOpen(null)} className="p-2 hover:bg-slate-200 rounded-full"><X size={20} /></button>
                             </div>
                             <div className="flex-1 overflow-y-auto p-8 font-serif leading-relaxed text-slate-700">
                                 {exams.find(e => e.id === scheduleModalOpen)?.schedule?.split('\n').map((line, i) => {
                                      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-indigo-700 mb-4 mt-6">{line.replace('# ', '')}</h1>;
                                      if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-slate-900 mb-3 mt-6 border-b pb-2">{line.replace('## ', '')}</h2>;
                                      if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-slate-800 mb-2 mt-4">{line.replace('### ', '')}</h3>;
                                      if (line.trim().startsWith('- ')) return <li key={i} className="ml-4 list-disc marker:text-indigo-400 pl-2 mb-1">{line.replace('- ', '')}</li>;
                                      if (line.trim() === '') return <br key={i} />;
                                      return <p key={i} className="mb-2">{line.replace(/\*\*(.*?)\*\*/g, '')}<strong className="font-bold">{line.match(/\*\*(.*?)\*\*/)?.[1]}</strong></p>;
                                 }) || <p className="text-center text-slate-400">Erreur d'affichage</p>}
                             </div>
                             <div className="p-4 border-t bg-slate-50 flex justify-end">
                                <button onClick={() => generatePDF(exams.find(e => e.id === scheduleModalOpen)?.title || "Planning", exams.find(e => e.id === scheduleModalOpen)?.schedule || "")} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700"><Download size={16} /> PDF</button>
                             </div>
                        </div>
                    </div>
                )}

                {/* Create Folder Modal */}
                {createFolderModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                            <h3 className="text-lg font-bold mb-4">Nouveau Dossier</h3>
                            <input autoFocus type="text" className="w-full border rounded-xl p-3 mb-6 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nom du dossier (ex: Histoire)" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setCreateFolderModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Annuler</button>
                                <button onClick={handleCreateFolder} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Créer</button>
                            </div>
                        </div>
                    </div>
                )}

                <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-2">
                        {currentFolderId && view === 'dashboard' ? (
                           <>
                               <button onClick={() => setCurrentFolderId(null)} className="text-2xl font-extrabold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1">
                                   Mon Espace
                               </button>
                               <ChevronRight size={24} className="text-slate-300" />
                               <h1 className="text-2xl font-extrabold text-slate-900 truncate max-w-[200px] md:max-w-md" title={currentFolder?.name}>
                                   {currentFolder?.name}
                               </h1>
                           </>
                        ) : (
                           <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                               <GraduationCap className="text-indigo-600" size={32} />
                               {view === 'calendar' ? 'Calendrier' : 'Mon Espace'}
                           </h1>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Switcher */}
                        <div className="bg-white p-1 rounded-xl border border-slate-200 flex gap-1 shadow-sm mr-2">
                            <button onClick={() => setView('dashboard')} className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${view === 'dashboard' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>
                                <LayoutDashboard size={16} /> Cours
                            </button>
                            <button onClick={() => setView('calendar')} className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${view === 'calendar' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>
                                <CalendarIcon size={16} /> Calendrier
                            </button>
                        </div>

                        {view === 'dashboard' && !currentFolderId && (
                            <button onClick={() => setCreateFolderModalOpen(true)} className="bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 px-4 py-3 rounded-xl font-bold shadow-sm flex items-center gap-2 transition-all" title="Nouveau Dossier">
                                <FolderPlus size={20} /> <span className="hidden md:inline">Dossier</span>
                            </button>
                        )}

                        {view === 'dashboard' ? (
                            <button onClick={() => setView('create')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0">
                                <Plus size={20} strokeWidth={3} /> <span className="hidden md:inline">Nouveau Cours</span> <span className="md:hidden">Cours</span>
                            </button>
                        ) : (
                            <button onClick={() => setExamModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0">
                                <Plus size={20} strokeWidth={3} /> <span className="hidden md:inline">Programmer</span>
                            </button>
                        )}
                    </div>
                </header>

                {/* === VIEW: CALENDAR === */}
                {view === 'calendar' && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {exams.length === 0 ? (
                            <div className="text-center py-24 bg-white/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
                                <div className="w-20 h-20 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                    <CalendarIcon className="text-slate-300" size={40} />
                                </div>
                                <h2 className="text-xl font-bold text-slate-700 mb-2">Aucun examen programmé</h2>
                                <p className="text-slate-500 mb-8 font-medium">Planifiez vos partiels pour obtenir un programme de révision sur mesure.</p>
                                <button onClick={() => setExamModalOpen(true)} className="text-indigo-600 font-bold hover:underline text-base">Programmer mon premier examen</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {exams.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(exam => {
                                    const daysLeft = Math.ceil((new Date(exam.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    const isPast = daysLeft < 0;
                                    return (
                                        <div key={exam.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4">
                                                <button onClick={() => deleteExam(exam.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                            </div>
                                            <div className="mb-4">
                                                <h3 className="text-lg font-bold text-slate-900 mb-1">{exam.title}</h3>
                                                <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                                                    <Clock size={16} />
                                                    {new Date(exam.date).toLocaleDateString()}
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isPast ? 'bg-slate-100 text-slate-500' : daysLeft <= 3 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                        {isPast ? 'Terminé' : `J-${daysLeft}`}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-1 mb-6">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Matières ({exam.courseIds.length})</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {exam.courseIds.slice(0, 3).map(cid => (
                                                        <span key={cid} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
                                                            {courses.find(c => c.id === cid)?.title || '?'}
                                                        </span>
                                                    ))}
                                                    {exam.courseIds.length > 3 && <span className="text-xs text-slate-400">+{exam.courseIds.length - 3}</span>}
                                                </div>
                                            </div>
                                            
                                            {exam.schedule ? (
                                                <button onClick={() => setScheduleModalOpen(exam.id)} className="w-full py-3 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                                                    <CalendarIcon size={18} /> Voir le Planning
                                                </button>
                                            ) : (
                                                <button onClick={() => generateExamSchedule(exam.id)} disabled={isGeneratingSchedule} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                                                    {isGeneratingSchedule ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} 
                                                    Générer Planning (IA)
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* === VIEW: DASHBOARD (COURSES) === */}
                {view === 'dashboard' && (
                    <>
                    {/* Global Stats - Only show at root */}
                    {!currentFolderId && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
                                <div className="flex items-center gap-3 mb-2 text-blue-600"><Award size={20} /><span className="text-xs font-bold uppercase text-slate-400">Moyenne</span></div>
                                <p className="text-3xl font-black text-slate-900">{globalAverage}<span className="text-xl text-slate-400">%</span></p>
                            </div>
                            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
                                <div className="flex items-center gap-3 mb-2 text-emerald-600"><BrainCircuit size={20} /><span className="text-xs font-bold uppercase text-slate-400">Maîtrise</span></div>
                                <p className="text-3xl font-black text-slate-900">{masteredSkills}</p>
                            </div>
                            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
                                <div className="flex items-center gap-3 mb-2 text-violet-600"><BookOpen size={20} /><span className="text-xs font-bold uppercase text-slate-400">Total Cours</span></div>
                                <p className="text-3xl font-black text-slate-900">{courses.length}</p>
                            </div>
                        </div>
                    )}

                    {/* FOLDERS SECTION (Only at Root) */}
                    {!currentFolderId && (
                        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <FolderIcon className="text-amber-500 fill-amber-500/20" size={20} />
                                    Dossiers
                                </h2>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {folders.length === 0 ? (
                                    <div className="col-span-2 md:col-span-4 p-6 border-2 border-dashed border-slate-200 bg-white/50 rounded-2xl text-center text-slate-400 text-sm">
                                        Aucun dossier. Créez-en un pour organiser vos matières.
                                    </div>
                                ) : (
                                    folders.map(folder => {
                                        const count = courses.filter(c => c.folderId === folder.id).length;
                                        return (
                                            <div 
                                                key={folder.id} 
                                                onClick={() => setCurrentFolderId(folder.id)}
                                                className="bg-amber-50/60 hover:bg-amber-100/80 border border-amber-100/50 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-md group relative backdrop-blur-sm"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <FolderIcon className="text-amber-500 fill-amber-500/20 group-hover:scale-110 transition-transform" size={32} />
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setDeleteModal({ type: 'folder', id: folder.id, name: folder.name }); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 text-red-400 hover:text-red-500 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                                <h3 className="font-bold text-slate-800 truncate" title={folder.name}>{folder.name}</h3>
                                                <p className="text-xs text-amber-600/70 font-medium mt-1">{count} cours</p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* COURSES SECTION */}
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <BookOpen className="text-indigo-500" size={20} />
                            {currentFolderId ? `Cours dans "${currentFolder?.name}"` : 'Cours non classés'}
                        </h2>

                        {visibleCourses.length === 0 ? (
                            <div className="text-center py-16 bg-white/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
                                <div className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                    <Layers className="text-slate-300" size={32} />
                                </div>
                                <p className="text-slate-500 mb-6 font-medium">Ce dossier est vide.</p>
                                <button onClick={() => setView('create')} className="text-indigo-600 font-bold hover:underline text-sm">Ajouter un cours ici</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                                {visibleCourses.map(course => {
                                    const courseScore = course.report ? Math.round((Object.values(course.report.scores).reduce((a,b)=>a+b.score,0) / (Object.values(course.report.scores).length*5 || 1)) * 100) : 0;
                                    return (
                                        <div key={course.id} className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-slate-100 p-6 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-100 transition-all duration-300 flex flex-col justify-between group cursor-pointer" onClick={() => selectCourse(course.id)}>
                                            <div>
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="bg-indigo-50 w-10 h-10 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                                                        <BookOpen size={20} />
                                                    </div>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setDeleteModal({ type: 'course', id: course.id, name: course.title }); }}
                                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-2 transition-colors"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>

                                                <h3 className="text-lg font-bold text-slate-800 line-clamp-1 mb-1">{course.title}</h3>
                                                <p className="text-xs text-slate-400 mb-5 font-medium uppercase tracking-wide">
                                                    {new Date(course.lastAccessedAt).toLocaleDateString()}
                                                </p>
                                                
                                                <div className="mb-5 bg-slate-50 rounded-xl p-3">
                                                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                                                        <span>Maîtrise</span>
                                                        <span>{courseScore}%</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${courseScore}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <button className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-bold group-hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2">
                                                Réviser
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    </>
                )}
            </div>
        </div>
    );
  }

  // ---------------- VIEW: CREATE ----------------
  if (view === 'create') {
    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-y-auto">
            <div className="max-w-3xl mx-auto w-full p-6 my-8">
                <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-8 transition-colors font-medium px-4 py-2 hover:bg-slate-200 rounded-lg w-fit">
                    <ArrowLeft size={18} />
                    Retour
                </button>
                <div className="text-center mb-10">
                  <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Nouveau Cours</h1>
                  {currentFolderId && <p className="text-indigo-600 font-bold bg-indigo-50 inline-block px-3 py-1 rounded-full text-sm mb-2">Dans : {folders.find(f => f.id === currentFolderId)?.name}</p>}
                  <p className="text-slate-500 text-lg">Importez vos documents pour créer un espace de révision dédié.</p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 p-10 space-y-8">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Titre du sujet</label>
                        <input type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-medium text-slate-800" placeholder="Ex: Droit Constitutionnel..." value={inputTopic} onChange={(e) => setInputTopic(e.target.value)} />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Contenu</label>
                        <div className="relative mb-6 group" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
                           <input type="file" ref={fileInputRef} onChange={(e) => processFiles(e.target.files ? Array.from(e.target.files) : [])} accept=".pdf,.docx,.odt,.txt,.md,.json" className="hidden" multiple />
                           <div className="border-3 border-dashed border-indigo-100 bg-indigo-50/30 rounded-2xl p-10 text-center transition-all hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer group-hover:shadow-inner" onClick={() => fileInputRef.current?.click()}>
                              {isProcessingFile ? (
                                  <div className="flex flex-col items-center justify-center py-6"><Loader2 className="animate-spin text-indigo-600 w-10 h-10 mb-4" /><p className="text-indigo-800 font-bold">Analyse...</p></div>
                              ) : (
                                  <>
                                      <div className="w-16 h-16 bg-white shadow-sm text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><Upload size={32} /></div>
                                      <p className="text-lg font-bold text-slate-800 mb-1">Ajouter vos documents</p>
                                  </>
                              )}
                           </div>
                        </div>
                        {fileError && <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-3 border border-red-100"><AlertCircle size={20} />{fileError}</div>}
                        <textarea className="w-full p-5 bg-slate-50 border border-slate-200 rounded-xl h-48 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none resize-none text-sm text-slate-700 font-mono" placeholder="Texte extrait..." value={inputContent} onChange={(e) => setInputContent(e.target.value)}></textarea>
                    </div>

                    <button onClick={handleCreateCourse} disabled={isProcessingFile} className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 active:translate-y-0 ${isProcessingFile ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        Créer le Cours <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
  }

  // ---------------- VIEW: SESSION ----------------
  if (!activeCourse) return null;

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto px-4 py-4 md:py-8 bg-slate-50">
      <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 flex-shrink-0">
        <div className="flex items-center gap-4 overflow-hidden w-full md:w-auto">
          <button onClick={exitSession} className="p-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm shrink-0"><Home className="text-slate-600 w-5 h-5" /></button>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-slate-900 truncate tracking-tight">{activeCourse.title}</h1>
            <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mt-1">Session active</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center bg-white border border-slate-200 rounded-full p-1.5 shadow-sm gap-2">
                <button onClick={() => !isConnected && setLanguage('fr')} disabled={isConnected} className={`p-1 rounded-full transition-all border-2 ${language === 'fr' ? 'border-indigo-500 scale-110 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`} title="Français">
                   <FlagFR />
                </button>
                <button onClick={() => !isConnected && setLanguage('en')} disabled={isConnected} className={`p-1 rounded-full transition-all border-2 ${language === 'en' ? 'border-indigo-500 scale-110 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`} title="English">
                   <FlagEN />
                </button>
                 <button onClick={() => !isConnected && setLanguage('es')} disabled={isConnected} className={`p-1 rounded-full transition-all border-2 ${language === 'es' ? 'border-indigo-500 scale-110 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`} title="Español">
                   <FlagES />
                </button>
            </div>
            <div className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border shadow-sm transition-colors ${isConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-500'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex mb-6 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex-shrink-0">
        <button onClick={() => setActiveTab('session')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'session' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}><Mic size={18} /> Oral</button>
        <button onClick={() => setActiveTab('competences')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'competences' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}><LayoutDashboard size={18} /> Bilan</button>
        <button onClick={() => setActiveTab('flashcards')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'flashcards' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}><Layers size={18} /> Cartes {activeCourse.flashcards.length > 0 && <span className="bg-indigo-600 text-white text-[10px] py-0.5 px-1.5 rounded-md ml-1 shadow-sm">{activeCourse.flashcards.length}</span>}</button>
        <button onClick={() => setActiveTab('cheatsheet')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'cheatsheet' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}><FileText size={18} /> Fiche</button>
      </nav>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        {error && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 text-red-600 px-6 py-3 rounded-full shadow-lg border border-red-100 flex items-center gap-3 animate-in slide-in-from-top-4 fade-in"><AlertCircle size={20} /><p className="font-medium text-sm">{error}</p></div>}

        {activeTab === 'session' ? (
          <div className="flex flex-col h-full gap-6 overflow-y-auto pb-4 scrollbar-hide">
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 flex flex-col items-center justify-center relative overflow-hidden shrink-0 min-h-[380px]">
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] transition-opacity duration-700 ${isStreaming ? 'opacity-100' : 'opacity-0'}`}></div>
              <div className="absolute top-6 right-6 flex bg-white/50 backdrop-blur-md rounded-xl border border-slate-100 p-1 z-20 shadow-sm">
                 {[1.0, 1.2, 1.5].map(rate => (<button key={rate} onClick={() => setSpeechRate(rate)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${speechRate === rate ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{rate}x</button>))}
              </div>

              <div className="relative z-10 w-full max-w-md text-center">
                {isConnected ? (
                    <div className="animate-in fade-in zoom-in duration-500">
                        <h2 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">{language === 'fr' ? "Je vous écoute..." : language === 'en' ? "I'm listening..." : "Te escucho..."}</h2>
                        <p className="text-slate-500 mb-10 text-lg">{language === 'fr' ? "Choisissez un mode ou posez une question." : language === 'en' ? "Choose a mode or ask a question." : "Elige un modo o haz una pregunta."}</p>
                    </div>
                ) : (
                    <div className="animate-in fade-in zoom-in duration-500">
                        <h2 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">Prêt à réviser ?</h2>
                        <p className="text-slate-500 mb-10 text-lg">Lancez l'assistant vocal pour commencer.</p>
                    </div>
                )}
                <div className="mb-14 min-h-[120px] flex items-center justify-center"><Visualizer volume={volume} isActive={isStreaming} /></div>
                <div className="flex justify-center gap-4">
                  {!isConnected ? (
                    <button onClick={connect} className="group flex items-center gap-3 bg-slate-900 text-white hover:bg-indigo-600 font-bold py-4 px-10 rounded-full transition-all shadow-xl shadow-slate-300 hover:shadow-indigo-300 hover:-translate-y-1"><Mic size={22} className="group-hover:animate-pulse" /> Démarrer</button>
                  ) : (
                    <>
                      <button onClick={finishSession} className="flex items-center gap-2 bg-white text-amber-600 border-2 border-amber-100 hover:bg-amber-50 font-bold py-3 px-6 rounded-full transition-all shadow-sm hover:shadow-amber-100"><Save size={20} /> Stop</button>
                      <button onClick={disconnect} className="flex items-center gap-2 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 font-bold py-3 px-6 rounded-full transition-all border border-red-100"><MicOff size={20} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 pb-10">
              <div className="flex items-center gap-3 mb-6 px-2"><div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><BrainCircuit size={18} /></div><h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">Modes d'Interrogation</h3></div>
              <ModeSelector onSelectMode={(prompt) => sendTextCommand(prompt)} disabled={!isConnected} />
            </div>
          </div>
        ) : activeTab === 'competences' ? (
          <div className="flex flex-col h-full overflow-y-auto pb-4 scrollbar-hide">
             <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 mb-8 flex items-center justify-between shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div className="relative z-10"><h2 className="text-2xl font-bold mb-1 tracking-tight">Maîtrise du Cours</h2><p className="text-indigo-100 font-medium opacity-90">{activeCourse.title}</p></div>
                <div className="relative z-10 text-5xl font-black tracking-tighter">{activeAverage}<span className="text-2xl opacity-60">%</span></div>
             </div>
             {activeCourse.report?.summary && <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8 shrink-0 relative"><div className="flex items-center gap-3 mb-3"><div className="p-2 bg-amber-50 text-amber-500 rounded-xl"><Award size={20} /></div><h3 className="font-bold text-slate-800">Dernier Bilan</h3></div><p className="text-slate-600 leading-relaxed italic pl-2 border-l-4 border-amber-200">"{activeCourse.report.summary}"</p></div>}
             <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-8">
                 <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><BrainCircuit size={20} className="text-slate-400" /> Compétences Identifiées</h3>
                 {activeSkillsList.length > 0 ? (<div className="space-y-8">{activeSkillsList.map((skill, idx) => (<ScoreBar key={idx} score={skill.score} label={skill.label} />))}</div>) : (<div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200"><p className="text-slate-500 font-medium">Aucune compétence évaluée.</p></div>)}
             </div>
          </div>
        ) : activeTab === 'flashcards' ? (
          <div className="flex flex-col h-full items-center justify-center relative p-4">
             {activeCourse.flashcards.length === 0 ? (
               <div className="text-center max-w-md bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                 <div className="bg-indigo-50 p-6 rounded-full inline-flex mb-6 text-indigo-500"><Layers size={48} /></div>
                 <h2 className="text-2xl font-bold text-slate-900 mb-2">Aucune carte</h2>
                 <p className="text-slate-500 mb-8 leading-relaxed">Demandez à l'assistant de générer des cartes.</p>
                 <button onClick={() => { setActiveTab('session'); sendTextCommand("Génère 5 flashcards sur ce cours."); }} className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-300 hover:-translate-y-1 flex items-center gap-3 mx-auto"><RotateCw size={20} /> Générer via IA</button>
               </div>
             ) : (
               <div className="w-full max-w-xl flex flex-col items-center gap-10 perspective-1000">
                  <div className="w-full flex justify-between items-center px-4"><span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{activeCourse.flashcards[currentCardIndex].topic}</span><span className="text-sm font-bold text-slate-400">{currentCardIndex + 1} / {activeCourse.flashcards.length}</span></div>
                  <div className="w-full aspect-[16/10] relative cursor-pointer group perspective" onClick={() => setIsFlipped(!isFlipped)}>
                    <div className={`w-full h-full transition-all duration-700 preserve-3d relative ${isFlipped ? 'rotate-y-180' : ''}`} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                        <div className="absolute inset-0 bg-white rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100 p-10 flex flex-col items-center justify-center text-center" style={{ backfaceVisibility: 'hidden' }}>
                            <h3 className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-6">Question</h3>
                            <p className="text-2xl font-bold text-slate-800 leading-snug">{activeCourse.flashcards[currentCardIndex].question}</p>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl shadow-2xl shadow-indigo-200 p-10 flex flex-col items-center justify-center text-center text-white" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                            <h3 className="text-indigo-200 text-xs font-black uppercase tracking-[0.2em] mb-6">Réponse</h3>
                            <p className="text-xl font-medium leading-relaxed">{activeCourse.flashcards[currentCardIndex].answer}</p>
                        </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                     <button onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentCardIndex(p => (p - 1 + activeCourse.flashcards.length) % activeCourse.flashcards.length), 300); }} className="p-4 rounded-full bg-white border border-slate-100 text-slate-600 hover:text-indigo-600 hover:border-indigo-100 shadow-md hover:shadow-xl transition-all hover:-translate-y-1"><ArrowLeft size={24} /></button>
                     <button onClick={clearFlashcards} className="p-4 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={24} /></button>
                     <button onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentCardIndex(p => (p + 1) % activeCourse.flashcards.length), 300); }} className="p-4 rounded-full bg-white border border-slate-100 text-slate-600 hover:text-indigo-600 hover:border-indigo-100 shadow-md hover:shadow-xl transition-all hover:-translate-y-1"><ArrowRight size={24} /></button>
                  </div>
               </div>
             )}
          </div>
        ) : (
           // --- TAB: CHEAT SHEET ---
           <div className="flex flex-col h-full overflow-hidden">
               {!activeCourse.cheatSheet ? (
                   <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                       <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-600">
                           <FileText size={36} />
                       </div>
                       <h2 className="text-2xl font-bold text-slate-900 mb-2">Fiche de Révision</h2>
                       <p className="text-slate-500 mb-8 max-w-md mx-auto">
                           L'IA peut analyser l'intégralité de vos documents pour générer une fiche de synthèse structurée (définitions, points clés, résumé).
                       </p>
                       <button 
                           onClick={generateCheatSheet}
                           disabled={isGeneratingSheet}
                           className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                       >
                           {isGeneratingSheet ? (
                               <><Loader2 className="animate-spin" /> Génération en cours...</>
                           ) : (
                               <><Sparkles size={20} /> Générer la Fiche (IA)</>
                           )}
                       </button>
                       {isGeneratingSheet && <p className="text-xs text-slate-400 mt-4 animate-pulse">Cela peut prendre quelques secondes (Modèle Gemini 3 Pro)...</p>}
                   </div>
               ) : (
                   <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
                       <div className="absolute top-0 right-0 p-4 bg-gradient-to-b from-white via-white to-transparent w-full flex justify-end z-10">
                           <button 
                               onClick={() => generatePDF(activeCourse.title, activeCourse.cheatSheet!)}
                               className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 transition-all"
                           >
                               <Download size={14} /> Télécharger PDF
                           </button>
                       </div>
                       <div className="overflow-y-auto p-8 pt-16 h-full font-serif leading-relaxed text-slate-700 space-y-4">
                            {/* Rendu Markdown simulé pour l'affichage écran */}
                            {activeCourse.cheatSheet.split('\n').map((line, i) => {
                                if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold text-indigo-700 mb-4 mt-6 border-b pb-2">{line.replace('# ', '')}</h1>;
                                if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-slate-900 mb-3 mt-6">{line.replace('## ', '')}</h2>;
                                if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-slate-800 mb-2 mt-4">{line.replace('### ', '')}</h3>;
                                if (line.trim().startsWith('- ')) return <li key={i} className="ml-4 list-disc marker:text-indigo-400 pl-2">{line.replace('- ', '').replace(/\*\*(.*?)\*\*/g, (match, p1) => p1)}</li>; // Simple bold removal for clean list
                                if (line.trim() === '') return <br key={i} />;
                                // Gestion basique du gras (**texte**)
                                const parts = line.split(/(\*\*.*?\*\*)/g);
                                return (
                                    <p key={i} className="text-base">
                                        {parts.map((part, j) => {
                                            if (part.startsWith('**') && part.endsWith('**')) {
                                                return <strong key={j} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
                                            }
                                            return part;
                                        })}
                                    </p>
                                );
                            })}
                       </div>
                   </div>
               )}
           </div>
        )}
      </main>
    </div>
  );
}