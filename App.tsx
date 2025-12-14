import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, AlertCircle, BookOpen, Award, Save, LayoutDashboard, BrainCircuit, Layers, RotateCw, Trash2, ArrowLeft, ArrowRight, Upload, Plus, FileText, Loader2, X, Home, GraduationCap, ChevronRight, Clock, Sparkles } from 'lucide-react';
import { useLiveApi } from './hooks/useLiveApi';
import { Visualizer } from './components/Visualizer';
import { ModeSelector } from './components/ModeSelector';
import { parseFile } from './utils/fileParsing';
import { Course } from './types';

type Tab = 'session' | 'competences' | 'flashcards';
type View = 'dashboard' | 'create' | 'session';

// --- Sub-components ---

const LoadingScreen = () => (
  <div className="flex flex-col h-screen items-center justify-center bg-slate-900 text-white relative overflow-hidden">
     {/* Background Abstract Shapes */}
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

// --- Main App Component ---

export default function App() {
  const { 
    connect, 
    disconnect,
    finishSession,
    isConnected, 
    isStreaming, 
    error, 
    volume, 
    sendTextCommand,
    speechRate,
    setSpeechRate,
    
    courses,
    activeCourse,
    createCourse,
    selectCourse,
    deleteCourse,
    clearFlashcards,
    exitSession
  } = useLiveApi();

  const [activeTab, setActiveTab] = useState<Tab>('session');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);
  const [view, setView] = useState<View>('dashboard');

  // Creation State
  const [inputTopic, setInputTopic] = useState("");
  const [inputContent, setInputContent] = useState("");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flashcards State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Determine current view based on activeCourse
  useEffect(() => {
    if (activeCourse) {
        setView('session');
    } else if (view === 'session') {
        setView('dashboard');
    }
  }, [activeCourse]);

  // Handle API Key check
  useEffect(() => {
    async function checkKey() {
      // Simulate a small delay for the loading screen experience/smoothness
      await new Promise(r => setTimeout(r, 800)); 

      if (process.env.API_KEY) {
        setHasApiKey(true);
      } else if (window.aistudio && window.aistudio.hasSelectedApiKey) {
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

  // --- Handlers ---

  const handleCreateCourse = () => {
      if (!inputTopic.trim() || !inputContent.trim()) {
          alert("Veuillez remplir le titre et le contenu.");
          return;
      }
      createCourse(inputTopic, inputContent);
      setInputTopic("");
      setInputContent("");
      // View will auto-switch via useEffect
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsProcessingFile(true);
    setFileError(null);

    try {
      // Auto-fill title logic
      if (!inputTopic) {
        if (files.length === 1) {
            setInputTopic(files[0].name.split('.').slice(0, -1).join('.'));
        } else {
            setInputTopic(`Multi-docs - ${new Date().toLocaleDateString()}`);
        }
      }

      // Process all files with robust error handling
      const results = await Promise.all(files.map(async (file) => {
          try {
              const text = await parseFile(file);
              return { success: true, text: `=== DOCUMENT : ${file.name} ===\n${text}`, file };
          } catch (e: any) {
              console.warn(`Error parsing ${file.name}:`, e);
              return { success: false, error: e.message || "Erreur inconnue", file };
          }
      }));

      // Separate success and failures
      const successes = results.filter((r): r is { success: true, text: string, file: File } => r.success);
      const failures = results.filter((r): r is { success: false, error: string, file: File } => !r.success);

      // Update content only with valid texts
      if (successes.length > 0) {
          const combinedText = successes.map(r => r.text).join('\n\n');
          setInputContent(prev => prev ? prev + "\n\n" + combinedText : combinedText);
      }

      // Display errors to user if any
      if (failures.length > 0) {
          if (failures.length === 1) {
             setFileError(`Impossible de lire "${failures[0].file.name}" : ${failures[0].error}`);
          } else {
             const failedNames = failures.map(f => f.file.name).join(', ');
             setFileError(`${failures.length} fichiers ignorés (${failedNames}). Formats supportés: PDF, DOCX, ODT, TXT.`);
          }
      }

    } catch (err: any) {
      setFileError(err.message || "Erreur inattendue lors du traitement des fichiers.");
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    processFiles(files);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    processFiles(files);
  };

  // --- Calculations ---
  
  // Global stats
  const totalCourses = courses.length;
  const allScores = courses.flatMap(c => c.report ? Object.values(c.report.scores).map(s => s.score) : []);
  const globalAverage = allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / (allScores.length * 5)) * 100) : 0;
  const totalSkills = allScores.length;
  const masteredSkills = allScores.filter(s => s >= 4).length;

  // Active course stats
  const activeSkillsList = activeCourse?.report?.scores ? Object.values(activeCourse.report.scores) : [];
  const activeAverage = activeSkillsList.length > 0 
    ? Math.round((activeSkillsList.reduce((acc, curr) => acc + curr.score, 0) / (activeSkillsList.length * 5)) * 100) 
    : 0;


  if (checkingKey) return <LoadingScreen />;

  if (!hasApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="text-indigo-600 w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Bienvenue sur RévizIA</h1>
          <p className="text-slate-500 mb-6">Votre assistant pédagogique personnel propulsé par Gemini 2.5.</p>
          <button onClick={handleApiKeySelect} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5">
            Sélectionner Clé API
          </button>
        </div>
      </div>
    );
  }

  // ---------------- VIEW: DASHBOARD ----------------
  if (view === 'dashboard') {
    return (
        <div className="flex flex-col h-screen max-w-6xl mx-auto px-4 py-8 bg-slate-50 overflow-y-auto">
            <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                        <GraduationCap className="text-indigo-600" size={32} />
                        Mon Espace
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Gérez vos matières et suivez votre progression.</p>
                </div>
                <button 
                    onClick={() => setView('create')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                    <Plus size={20} strokeWidth={3} />
                    Nouveau Cours
                </button>
            </header>

            {/* Global Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between h-40">
                    <div className="flex items-start justify-between">
                         <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Award size={24} /></div>
                         <span className="text-xs font-bold uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-md">Moyenne</span>
                    </div>
                    <div>
                         <p className="text-4xl font-black text-slate-900">{globalAverage}<span className="text-2xl text-slate-400">%</span></p>
                         <h3 className="text-sm font-semibold text-slate-500 mt-1">Score global</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between h-40">
                    <div className="flex items-start justify-between">
                         <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><BrainCircuit size={24} /></div>
                         <span className="text-xs font-bold uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-md">Expertise</span>
                    </div>
                    <div>
                         <p className="text-4xl font-black text-slate-900">{masteredSkills} <span className="text-xl text-slate-400 font-bold">/ {totalSkills}</span></p>
                         <h3 className="text-sm font-semibold text-slate-500 mt-1">Compétences maîtrisées</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between h-40">
                    <div className="flex items-start justify-between">
                         <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl"><BookOpen size={24} /></div>
                         <span className="text-xs font-bold uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-md">Bibliothèque</span>
                    </div>
                    <div>
                         <p className="text-4xl font-black text-slate-900">{totalCourses}</p>
                         <h3 className="text-sm font-semibold text-slate-500 mt-1">Matières actives</h3>
                    </div>
                </div>
            </div>

            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                Vos Cours
            </h2>

            {courses.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <BookOpen className="text-slate-300" size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Votre bibliothèque est vide</h3>
                    <p className="text-slate-500 mb-8 max-w-sm mx-auto">Importez votre premier document pour commencer à réviser avec l'intelligence artificielle.</p>
                    <button onClick={() => setView('create')} className="text-indigo-600 font-bold hover:underline">Importer un cours maintenant</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pb-10">
                    {courses.map(course => {
                        const courseScore = course.report ? Math.round((Object.values(course.report.scores).reduce((a,b)=>a+b.score,0) / (Object.values(course.report.scores).length*5 || 1)) * 100) : 0;
                        return (
                            <div key={course.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-7 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-100 transition-all duration-300 flex flex-col justify-between group relative cursor-pointer" onClick={() => selectCourse(course.id)}>
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                                            <Layers size={24} />
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); deleteCourse(course.id); }}
                                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-2 transition-colors"
                                            title="Supprimer le cours"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-800 line-clamp-1 mb-1" title={course.title}>{course.title}</h3>
                                    <p className="text-xs text-slate-400 mb-6 font-medium uppercase tracking-wide">
                                        Modifié le {new Date(course.lastAccessedAt).toLocaleDateString()}
                                    </p>
                                    
                                    <div className="mb-6 bg-slate-50 rounded-xl p-4">
                                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                                            <span>Maîtrise globale</span>
                                            <span>{courseScore}%</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${courseScore}%` }}></div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 text-xs font-medium text-slate-500 mb-6">
                                        <div className="flex items-center gap-1.5 bg-white border border-slate-100 px-2 py-1 rounded-md shadow-sm">
                                            <Award size={14} className="text-orange-400" />
                                            {course.report ? Object.keys(course.report.scores).length : 0} compétences
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-white border border-slate-100 px-2 py-1 rounded-md shadow-sm">
                                            <RotateCw size={14} className="text-blue-400" />
                                            {course.flashcards.length} cartes
                                        </div>
                                    </div>
                                </div>
                                
                                <button 
                                    className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-semibold group-hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    Reprendre la révision
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
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
                  <p className="text-slate-500 text-lg">Importez vos documents pour créer un espace de révision dédié.</p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 p-10 space-y-8">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Titre du sujet</label>
                        <input 
                          type="text" 
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-transparent outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400"
                          placeholder="Ex: Droit Constitutionnel, Marketing Digital..."
                          value={inputTopic}
                          onChange={(e) => setInputTopic(e.target.value)}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Contenu du cours</label>
                        <div 
                          className="relative mb-6 group"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleDrop}
                        >
                           <input 
                             type="file" 
                             ref={fileInputRef}
                             onChange={handleFileUpload}
                             accept=".pdf,.docx,.odt,.txt,.md,.json"
                             className="hidden"
                             multiple
                           />
                           <div 
                              className="border-3 border-dashed border-indigo-100 bg-indigo-50/30 rounded-2xl p-10 text-center transition-all hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer group-hover:shadow-inner"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              {isProcessingFile ? (
                                  <div className="flex flex-col items-center justify-center py-6">
                                      <Loader2 className="animate-spin text-indigo-600 w-10 h-10 mb-4" />
                                      <p className="text-base text-indigo-800 font-bold">Analyse des fichiers en cours...</p>
                                      <p className="text-sm text-indigo-500 mt-1">Veuillez patienter quelques instants</p>
                                  </div>
                              ) : (
                                  <>
                                      <div className="w-16 h-16 bg-white shadow-sm text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                          <Upload size={32} />
                                      </div>
                                      <p className="text-lg font-bold text-slate-800 mb-1">Cliquez pour ajouter vos documents</p>
                                      <p className="text-sm text-slate-500">ou glissez-déposez vos fichiers PDF, DOCX, TXT ici</p>
                                  </>
                              )}
                           </div>
                        </div>

                        {fileError && (
                           <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-3 border border-red-100">
                              <AlertCircle size={20} className="shrink-0 mt-0.5" />
                              <div className="whitespace-pre-wrap font-medium">{fileError}</div>
                           </div>
                        )}

                        <textarea 
                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-xl h-48 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-transparent outline-none transition-all resize-none text-sm leading-relaxed text-slate-700 font-mono"
                            placeholder="Le texte extrait apparaîtra ici, vous pouvez aussi copier-coller du contenu..."
                            value={inputContent}
                            onChange={(e) => setInputContent(e.target.value)}
                        ></textarea>
                        <p className="text-xs text-slate-400 mt-2 text-right font-medium">{inputContent.length} caractères</p>
                    </div>

                    <button 
                      onClick={handleCreateCourse}
                      disabled={isProcessingFile}
                      className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 active:translate-y-0 ${isProcessingFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Créer le Cours
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
  }

  // ---------------- VIEW: SESSION (ACTIVE COURSE) ----------------
  if (!activeCourse) return null;

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto px-4 py-4 md:py-8 bg-slate-50">
      {/* Header Session */}
      <header className="flex items-center justify-between mb-8 flex-shrink-0">
        <div className="flex items-center gap-4 overflow-hidden">
          <button onClick={exitSession} className="p-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm" title="Retour accueil">
             <Home className="text-slate-600 w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-slate-900 truncate tracking-tight">{activeCourse.title}</h1>
            <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mt-1">Session active</p>
          </div>
        </div>
        <div className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 border shadow-sm transition-colors ${isConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-500'}`}>
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex mb-6 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex-shrink-0">
        <button 
          onClick={() => setActiveTab('session')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'session' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
        >
          <Mic size={18} />
          Oral
        </button>
        <button 
          onClick={() => setActiveTab('competences')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'competences' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
        >
          <LayoutDashboard size={18} />
          Bilan
        </button>
        <button 
          onClick={() => setActiveTab('flashcards')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'flashcards' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
        >
          <Layers size={18} />
          Cartes
          {activeCourse.flashcards.length > 0 && (
             <span className="bg-indigo-600 text-white text-[10px] py-0.5 px-1.5 rounded-md ml-1 shadow-sm">{activeCourse.flashcards.length}</span>
          )}
        </button>
      </nav>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 text-red-600 px-6 py-3 rounded-full shadow-lg border border-red-100 flex items-center gap-3 animate-in slide-in-from-top-4 fade-in">
            <AlertCircle size={20} />
            <p className="font-medium text-sm">{error}</p>
          </div>
        )}

        {activeTab === 'session' ? (
          <div className="flex flex-col h-full gap-6 overflow-y-auto pb-4 scrollbar-hide">
            {/* Visualizer Card */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 flex flex-col items-center justify-center relative overflow-hidden shrink-0 min-h-[380px]">
              
              {/* Background Glow */}
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] transition-opacity duration-700 ${isStreaming ? 'opacity-100' : 'opacity-0'}`}></div>

              <div className="absolute top-6 right-6 flex bg-white/50 backdrop-blur-md rounded-xl border border-slate-100 p-1 z-20 shadow-sm">
                 {[1.0, 1.2, 1.5].map(rate => (
                     <button 
                        key={rate}
                        onClick={() => setSpeechRate(rate)} 
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${speechRate === rate ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                     >{rate}x</button>
                 ))}
              </div>

              <div className="relative z-10 w-full max-w-md text-center">
                {isConnected ? (
                    <div className="animate-in fade-in zoom-in duration-500">
                        <h2 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">Je vous écoute...</h2>
                        <p className="text-slate-500 mb-10 text-lg">Choisissez un mode ou posez une question.</p>
                    </div>
                ) : (
                    <div className="animate-in fade-in zoom-in duration-500">
                        <h2 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">Prêt à réviser ?</h2>
                        <p className="text-slate-500 mb-10 text-lg">
                          Lancez l'assistant vocal pour commencer.
                        </p>
                    </div>
                )}

                <div className="mb-14 min-h-[120px] flex items-center justify-center">
                   <Visualizer volume={volume} isActive={isStreaming} />
                </div>

                <div className="flex justify-center gap-4">
                  {!isConnected ? (
                    <button
                      onClick={connect}
                      className="group flex items-center gap-3 bg-slate-900 text-white hover:bg-indigo-600 font-bold py-4 px-10 rounded-full transition-all shadow-xl shadow-slate-300 hover:shadow-indigo-300 hover:-translate-y-1"
                    >
                      <Mic size={22} className="group-hover:animate-pulse" />
                      Démarrer la session
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={finishSession}
                        className="flex items-center gap-2 bg-white text-amber-600 border-2 border-amber-100 hover:bg-amber-50 font-bold py-3 px-6 rounded-full transition-all shadow-sm hover:shadow-amber-100"
                      >
                        <Save size={20} />
                        Bilan & Stop
                      </button>
                      <button
                        onClick={disconnect}
                        className="flex items-center gap-2 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 font-bold py-3 px-6 rounded-full transition-all border border-red-100"
                      >
                        <MicOff size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 pb-10">
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><BrainCircuit size={18} /></div>
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">Modes d'Interrogation</h3>
              </div>
              <ModeSelector 
                onSelectMode={(prompt) => sendTextCommand(prompt)} 
                disabled={!isConnected} 
              />
            </div>
          </div>
        ) : activeTab === 'competences' ? (
          <div className="flex flex-col h-full overflow-y-auto pb-4 scrollbar-hide">
             <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 mb-8 flex items-center justify-between shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div className="relative z-10">
                   <h2 className="text-2xl font-bold mb-1 tracking-tight">Maîtrise du Cours</h2>
                   <p className="text-indigo-100 font-medium opacity-90">{activeCourse.title}</p>
                </div>
                <div className="relative z-10 text-5xl font-black tracking-tighter">{activeAverage}<span className="text-2xl opacity-60">%</span></div>
             </div>

             {activeCourse.report?.summary && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8 shrink-0 relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-50 text-amber-500 rounded-xl"><Award size={20} /></div>
                    <h3 className="font-bold text-slate-800">Dernier Bilan</h3>
                  </div>
                  <p className="text-slate-600 leading-relaxed italic pl-2 border-l-4 border-amber-200">"{activeCourse.report.summary}"</p>
                </div>
             )}

             <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-8">
                 <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <BrainCircuit size={20} className="text-slate-400" />
                    Compétences Identifiées
                 </h3>
                 {activeSkillsList.length > 0 ? (
                    <div className="space-y-8">
                       {activeSkillsList.map((skill, idx) => (
                           <ScoreBar key={idx} score={skill.score} label={skill.label} />
                       ))}
                    </div>
                 ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-500 font-medium">Aucune compétence évaluée pour le moment.</p>
                        <p className="text-xs text-slate-400 mt-2">Démarrez une session orale pour que l'IA analyse vos connaissances.</p>
                    </div>
                 )}
             </div>
          </div>
        ) : (
          <div className="flex flex-col h-full items-center justify-center relative p-4">
             {activeCourse.flashcards.length === 0 ? (
               <div className="text-center max-w-md bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                 <div className="bg-indigo-50 p-6 rounded-full inline-flex mb-6 text-indigo-500">
                    <Layers size={48} />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900 mb-2">Aucune carte</h2>
                 <p className="text-slate-500 mb-8 leading-relaxed">
                   Demandez à l'assistant de générer des cartes basées sur ce cours pour commencer à réviser.
                 </p>
                 <button 
                   onClick={() => {
                        setActiveTab('session');
                        sendTextCommand("Génère 5 flashcards sur ce cours.");
                   }}
                   className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-300 hover:-translate-y-1 flex items-center gap-3 mx-auto"
                 >
                   <RotateCw size={20} />
                   Générer via IA
                 </button>
               </div>
             ) : (
               <div className="w-full max-w-xl flex flex-col items-center gap-10 perspective-1000">
                  <div className="w-full flex justify-between items-center px-4">
                     <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{activeCourse.flashcards[currentCardIndex].topic}</span>
                     <span className="text-sm font-bold text-slate-400">{currentCardIndex + 1} / {activeCourse.flashcards.length}</span>
                  </div>

                  <div 
                    className="w-full aspect-[16/10] relative cursor-pointer group perspective"
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    <div 
                        className={`w-full h-full transition-all duration-700 preserve-3d relative ${isFlipped ? 'rotate-y-180' : ''}`} 
                        style={{ 
                            transformStyle: 'preserve-3d', 
                            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' 
                        }}
                    >
                        {/* Front */}
                        <div 
                            className="absolute inset-0 bg-white rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100 p-10 flex flex-col items-center justify-center text-center"
                            style={{ backfaceVisibility: 'hidden' }}
                        >
                            <h3 className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-6">Question</h3>
                            <p className="text-2xl font-bold text-slate-800 leading-snug">
                              {activeCourse.flashcards[currentCardIndex].question}
                            </p>
                            <div className="absolute bottom-6 flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <span className="text-xs text-slate-400 font-medium">Cliquez pour voir la réponse</span>
                                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                            </div>
                        </div>

                        {/* Back */}
                        <div 
                            className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl shadow-2xl shadow-indigo-200 p-10 flex flex-col items-center justify-center text-center text-white" 
                            style={{ 
                                backfaceVisibility: 'hidden', 
                                transform: 'rotateY(180deg)' 
                            }}
                        >
                            <h3 className="text-indigo-200 text-xs font-black uppercase tracking-[0.2em] mb-6">Réponse</h3>
                            <p className="text-xl font-medium leading-relaxed">
                              {activeCourse.flashcards[currentCardIndex].answer}
                            </p>
                        </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                     <button 
                       onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentCardIndex(p => (p - 1 + activeCourse.flashcards.length) % activeCourse.flashcards.length), 300); }} 
                       className="p-4 rounded-full bg-white border border-slate-100 text-slate-600 hover:text-indigo-600 hover:border-indigo-100 shadow-md hover:shadow-xl transition-all hover:-translate-y-1"
                     >
                        <ArrowLeft size={24} />
                     </button>
                     <button 
                       onClick={clearFlashcards}
                       className="p-4 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                       title="Effacer tout"
                     >
                       <Trash2 size={24} />
                     </button>
                     <button 
                       onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentCardIndex(p => (p + 1) % activeCourse.flashcards.length), 300); }} 
                       className="p-4 rounded-full bg-white border border-slate-100 text-slate-600 hover:text-indigo-600 hover:border-indigo-100 shadow-md hover:shadow-xl transition-all hover:-translate-y-1"
                     >
                        <ArrowRight size={24} />
                     </button>
                  </div>
               </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
}