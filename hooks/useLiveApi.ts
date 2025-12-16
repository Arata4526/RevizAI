import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { SYSTEM_INSTRUCTION_TEMPLATE, PROGRESS_TOOL_DECLARATION, FLASHCARDS_TOOL_DECLARATION, LANGUAGE_INSTRUCTIONS } from '../constants';
import { base64ToUint8Array, decodeAudioData, createPcmBlob } from '../utils/audioUtils';
import { SessionReport, Flashcard, Course, Folder, Exam, SkillData } from '../types';

const COURSES_STORAGE_KEY = 'revizia_courses_db_v1';
const FOLDERS_STORAGE_KEY = 'revizia_folders_db_v1';
const EXAMS_STORAGE_KEY = 'revizia_exams_db_v1';

export type Language = 'fr' | 'en' | 'es';

// Helper robuste pour générer des IDs uniques même sans crypto.randomUUID (ex: contexte HTTP)
const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try { return crypto.randomUUID(); } catch (e) { console.warn("crypto.randomUUID failed, using fallback"); }
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

export function useLiveApi() {
  // Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0); 
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [language, setLanguage] = useState<Language>('fr');

  // Data Management State
  const [courses, setCourses] = useState<Course[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);

  // Derived active course
  const activeCourse = courses.find(c => c.id === activeCourseId) || null;

  // Audio Contexts & Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const speechRateRef = useRef(1.0);
  const isConnectedRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Load Data on Mount
  useEffect(() => {
    // 1. Load Folders
    const savedFolders = localStorage.getItem(FOLDERS_STORAGE_KEY);
    let currentFolders: Folder[] = [];
    if (savedFolders) {
        try { const parsed = JSON.parse(savedFolders); if (Array.isArray(parsed)) currentFolders = parsed; } catch (e) {}
    }
    if (currentFolders.length === 0) { currentFolders = [{ id: 'demo-folder-maths', name: 'Mathématiques', createdAt: Date.now() }]; }
    setFolders(currentFolders);

    // 2. Load Exams
    const savedExams = localStorage.getItem(EXAMS_STORAGE_KEY);
    if (savedExams) {
        try { const parsed = JSON.parse(savedExams); if (Array.isArray(parsed)) setExams(parsed); } catch (e) {}
    }

    // 3. Load Courses
    const savedCourses = localStorage.getItem(COURSES_STORAGE_KEY);
    if (savedCourses) {
      try {
        const parsed = JSON.parse(savedCourses);
        if (Array.isArray(parsed)) { setCourses(parsed); return; }
      } catch (e) {}
    }

    // Default courses if empty
    const demoCourses: Course[] = [
        {
            id: 'demo-math-arithmetique',
            title: 'Maths : Arithmétique de base',
            content: `L'arithmétique est la branche des mathématiques qui étudie les nombres et les opérations élémentaires.
1. L'ADDITION... (contenu abrégé)`,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            report: null,
            flashcards: [],
            folderId: 'demo-folder-maths'
        },
        {
            id: 'demo-math-geometrie',
            title: 'Maths : Géométrie plane',
            content: `La géométrie plane étudie les figures en deux dimensions...`,
            createdAt: Date.now() - 1000,
            lastAccessedAt: Date.now() - 1000,
            report: null,
            flashcards: [],
            folderId: 'demo-folder-maths'
        }
    ];
    setCourses(demoCourses);

  }, []);

  // Persist Data
  useEffect(() => {
    if (courses.length > 0 || localStorage.getItem(COURSES_STORAGE_KEY)) {
       localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));
    }
  }, [courses]);

  useEffect(() => {
      if (folders.length > 0 || localStorage.getItem(FOLDERS_STORAGE_KEY)) {
        localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
      }
  }, [folders]);

  useEffect(() => {
      if (exams.length > 0 || localStorage.getItem(EXAMS_STORAGE_KEY)) {
        localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(exams));
      }
  }, [exams]);

  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);

  // --- Folder Management ---
  const createFolder = useCallback((name: string) => {
      setFolders(prev => [{ id: generateUUID(), name, createdAt: Date.now() }, ...prev]);
  }, []);

  const deleteFolder = useCallback((folderId: string) => {
      setFolders(prev => prev.filter(f => f.id !== folderId));
      setCourses(prev => prev.filter(c => c.folderId !== folderId));
      if (activeCourse && activeCourse.folderId === folderId) setActiveCourseId(null);
  }, [activeCourse]);

  // --- Exam Management ---
  const createExam = useCallback((title: string, date: string, courseIds: string[]) => {
      const newExam: Exam = {
          id: generateUUID(),
          title,
          date,
          courseIds,
          createdAt: Date.now()
      };
      setExams(prev => [newExam, ...prev]);
      return newExam.id;
  }, []);

  const deleteExam = useCallback((id: string) => {
      setExams(prev => prev.filter(e => e.id !== id));
  }, []);

  const generateExamSchedule = useCallback(async (examId: string) => {
      const exam = exams.find(e => e.id === examId);
      if (!exam) return;

      const relatedCourses = courses.filter(c => exam.courseIds.includes(c.id));
      if (relatedCourses.length === 0) return;

      setIsGeneratingSchedule(true);
      setError(null);

      try {
          const apiKey = process.env.API_KEY;
          if (!apiKey) throw new Error("API Key not found");
          const ai = new GoogleGenAI({ apiKey });

          const coursesContext = relatedCourses.map(c => `--- COURS : ${c.title} ---\n${c.content.substring(0, 10000)}...`).join('\n\n');
          const today = new Date().toLocaleDateString();

          const prompt = `
          Tu es un coach d'étude expert en planification.
          CONTEXTE:
          - Date d'aujourd'hui : ${today}
          - Date de l'examen : ${exam.date}
          - Matières à réviser : ${relatedCourses.map(c => c.title).join(', ')}
          CONTENU DES COURS :
          ${coursesContext}
          TA MISSION :
          Crée un programme de révision détaillé.
          DIRECTIVES :
          Structure la réponse en Markdown clair (Jours ou Semaines).
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: prompt,
          });

          const schedule = response.text;
          if (schedule) {
              setExams(prev => prev.map(e => e.id === examId ? { ...e, schedule } : e));
          }

      } catch (e: any) {
          console.error("Error generating schedule", e);
          setError("Impossible de générer le planning : " + e.message);
      } finally {
          setIsGeneratingSchedule(false);
      }
  }, [exams, courses]);

  // --- AI Analysis for Skills ---
  const analyzeCourseSkills = useCallback(async (courseId: string, content: string) => {
      try {
          const apiKey = process.env.API_KEY;
          if (!apiKey) return;
          const ai = new GoogleGenAI({ apiKey });

          const prompt = `
          Analyse le cours suivant et identifie 4 à 6 compétences ou thèmes clés à maîtriser.
          Retourne le résultat au format JSON uniquement.
          Pour chaque compétence, donne un ID court (snake_case) et un Label clair.
          
          Cours:
          ${content.substring(0, 20000)}...
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: prompt,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          skills: {
                              type: Type.ARRAY,
                              items: {
                                  type: Type.OBJECT,
                                  properties: {
                                      id: { type: Type.STRING },
                                      label: { type: Type.STRING }
                                  }
                              }
                          }
                      }
                  }
              }
          });
          
          if(response.text) {
              const result = JSON.parse(response.text);
              const initialScores: Record<string, SkillData> = {};
              result.skills.forEach((s: any) => {
                  initialScores[s.id] = { score: 0, label: s.label };
              });
              
              setCourses(prev => prev.map(c => 
                  c.id === courseId 
                  ? { ...c, report: { scores: initialScores, summary: "Grille de compétences générée. En attente de la première session.", timestamp: Date.now() } } 
                  : c
              ));
          }

      } catch (e) {
          console.error("Auto skill generation failed", e);
      }
  }, []);


  // --- Course Management ---
  const createCourse = useCallback((title: string, content: string, folderId?: string) => {
    const newCourse: Course = {
      id: generateUUID(),
      title,
      content,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      report: null,
      flashcards: [],
      folderId: folderId
    };
    setCourses(prev => [newCourse, ...prev]);
    setActiveCourseId(newCourse.id);
    
    // Trigger Auto-Analysis
    analyzeCourseSkills(newCourse.id, content);

    return newCourse.id;
  }, [analyzeCourseSkills]);

  const deleteCourse = useCallback((id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
    setExams(prev => prev.map(e => ({...e, courseIds: e.courseIds.filter(cid => cid !== id)})));
    if (activeCourseId === id) setActiveCourseId(null);
  }, [activeCourseId]);

  const selectCourse = useCallback((id: string) => {
    setActiveCourseId(id);
    setCourses(prev => prev.map(c => c.id === id ? { ...c, lastAccessedAt: Date.now() } : c));
  }, []);

  const updateActiveCourse = useCallback((updates: Partial<Course>) => {
    if (!activeCourseId) return;
    setCourses(prev => prev.map(c => 
      c.id === activeCourseId ? { ...c, ...updates } : c
    ));
  }, [activeCourseId]);

  const clearFlashcards = useCallback(() => {
     updateActiveCourse({ flashcards: [] });
  }, [updateActiveCourse]);

  // --- AI Generation Logic (Gemini 3 Pro) ---
  const generateCheatSheet = useCallback(async () => {
      if (!activeCourse || !activeCourse.content) return;
      setIsGeneratingSheet(true);
      setError(null);
      try {
          const apiKey = process.env.API_KEY;
          if (!apiKey) throw new Error("API Key not found");
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `Tu es un professeur expert... (Prompt Cheat Sheet) \nContenu: ${activeCourse.content}`;
          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: prompt,
          });
          if (response.text) updateActiveCourse({ cheatSheet: response.text });
      } catch (e: any) {
          setError("Erreur génération fiche : " + e.message);
      } finally {
          setIsGeneratingSheet(false);
      }
  }, [activeCourse, updateActiveCourse]);

  // --- Audio Control ---
  const stopAudioPlayback = useCallback(() => {
      if (sourceNodesRef.current) {
          sourceNodesRef.current.forEach(node => {
              try { node.stop(); } catch (e) {}
          });
          sourceNodesRef.current.clear();
      }
      nextStartTimeRef.current = 0;
      if (outputAudioContextRef.current) {
          // Reset time logic slightly to prevent overlapping if rapid restart
          nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
      }
  }, []);


  // --- Live API Logic ---
  const cleanup = useCallback(() => {
    console.log("Cleanup initiated");
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
        try { scriptProcessorRef.current.disconnect(); } catch (e) {}
        scriptProcessorRef.current = null;
    }
    if (inputSourceRef.current) {
        try { inputSourceRef.current.disconnect(); } catch (e) {}
        inputSourceRef.current = null;
    }
    // Check state before closing to avoid "Cannot close a closed AudioContext"
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        try { inputAudioContextRef.current.close(); } catch(e) { console.warn("Error closing input ctx", e); }
    }
    inputAudioContextRef.current = null;

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        try { outputAudioContextRef.current.close(); } catch(e) { console.warn("Error closing output ctx", e); }
    }
    outputAudioContextRef.current = null;

    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(s => {
             try { s.close(); } catch(e) { console.warn("Error closing session", e); }
        }).catch(e => {
             console.warn("Session promise rejected during cleanup", e);
        });
        sessionPromiseRef.current = null;
    }
    setIsConnected(false); setIsStreaming(false); setVolume(0);
  }, []);

  const connect = useCallback(async () => {
    console.log("Starting connection...");
    setError(null);
    const currentCourse = courses.find(c => c.id === activeCourseId);
    if (!currentCourse || !currentCourse.content) { setError("Contenu manquant."); return; }
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key not found");
      const ai = new GoogleGenAI({ apiKey });
      
      console.log("Initializing Audio Contexts...");
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Important: Resume context to prevent it from being suspended by the browser
      await inputAudioContextRef.current.resume();
      
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await outputAudioContextRef.current.resume();

      console.log("Getting User Media...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let finalSystemInstruction = SYSTEM_INSTRUCTION_TEMPLATE
          .replace('{{USER_CONTENT}}', currentCourse.content)
          .replace('{{LANGUAGE_INSTRUCTION}}', LANGUAGE_INSTRUCTIONS[language]);
      
      // Inject existing skills context if available
      if (currentCourse.report?.scores) {
          const skillsContext = Object.entries(currentCourse.report.scores)
              .map(([id, data]) => `- ${data.label} (ID: ${id})`)
              .join('\n');
          finalSystemInstruction += `\n\nVOICI LA GRILLE DE COMPÉTENCES DÉJÀ ÉTABLIE (utilise ces IDs pour saveProgress) :\n${skillsContext}`;
      }

      console.log("Connecting to Gemini Live...");
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: finalSystemInstruction,
            tools: [{ functionDeclarations: [PROGRESS_TOOL_DECLARATION, FLASHCARDS_TOOL_DECLARATION] }],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
        callbacks: {
            onopen: async () => {
                console.log("Session Opened");
                setIsConnected(true); setIsStreaming(true);
                const inputCtx = inputAudioContextRef.current;
                if(!inputCtx) return;
                const source = inputCtx.createMediaStreamSource(stream);
                inputSourceRef.current = source;
                const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                scriptProcessorRef.current = processor;
                processor.onaudioprocess = (e) => {
                    if (!isConnectedRef.current) return; // Prevent sending if disconnected
                    const inputData = e.inputBuffer.getChannelData(0);
                    let sum = 0; for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
                    setVolume(prev => Math.max(Math.sqrt(sum/inputData.length), prev*0.8));
                    const pcmBlob = createPcmBlob(inputData, inputCtx.sampleRate);
                    sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ media: pcmBlob })).catch(err => {
                        console.warn("Failed to send audio input", err);
                    });
                };
                source.connect(processor); processor.connect(inputCtx.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
                const outputCtx = outputAudioContextRef.current;
                if (!outputCtx) return;
                
                if (msg.toolCall) {
                   console.log("Tool call received:", msg.toolCall);
                   for (const fc of msg.toolCall.functionCalls) {
                        if (fc.name === 'saveProgress') {
                            const args = fc.args as any;
                            const updates = args.updates as {id: string, score: number, label: string}[];
                            const summary = args.summary as string;

                            setCourses(curr => curr.map(c => {
                                if (c.id !== activeCourseId) return c;
                                
                                const currentScores = c.report?.scores || {};
                                const newScores = updates.reduce((acc, u) => ({
                                    ...acc,
                                    [u.id]: { score: u.score, label: u.label }
                                }), {} as Record<string, SkillData>);
                                
                                return {
                                    ...c,
                                    report: {
                                        scores: { ...currentScores, ...newScores },
                                        summary: summary,
                                        timestamp: Date.now()
                                    }
                                };
                            }));
                            sessionPromiseRef.current?.then(s => s.sendToolResponse({ functionResponses: [{id: fc.id, name: fc.name, response: {result: "OK"}}] }));
                        }
                        if (fc.name === 'createFlashcards') {
                            const newCards = ((fc.args as any).cards as any[]).map(c => ({...c, id: Math.random().toString(36).substr(2,9)}));
                            setCourses(curr => curr.map(c => c.id === activeCourseId ? { ...c, flashcards: [...c.flashcards, ...newCards] } : c));
                            sessionPromiseRef.current?.then(s => s.sendToolResponse({ functionResponses: [{id: fc.id, name: fc.name, response: {result: "OK"}}] }));
                        }
                   }
                }

                if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                    try {
                        const audioBuffer = await decodeAudioData(base64ToUint8Array(msg.serverContent.modelTurn.parts[0].inlineData.data), outputCtx, 24000);
                        const source = outputCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.playbackRate.value = speechRateRef.current;
                        source.connect(outputCtx.destination);
                        source.addEventListener('ended', () => sourceNodesRef.current.delete(source));
                        source.start(nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime));
                        nextStartTimeRef.current += audioBuffer.duration / speechRateRef.current;
                        sourceNodesRef.current.add(source);
                    } catch (decodeErr) {
                        console.error("Audio Decode Error", decodeErr);
                    }
                }

                if (msg.serverContent?.interrupted) {
                    console.log("Model interrupted");
                    stopAudioPlayback();
                }
            },
            onclose: (e) => { 
                console.log("Session Closed", e.code, e.reason); 
                setIsConnected(false); 
                setIsStreaming(false); 
            },
            onerror: (err: any) => { 
                console.error("Session Error", err);
                const msg = err instanceof Error ? err.message : "Erreur connexion Live";
                setError(msg);
                cleanup(); 
            }
        }
      });
      sessionPromiseRef.current = sessionPromise;
      // Catch initial connection rejection
      sessionPromise.catch(e => {
           console.error("Initial Connection Promise Rejected", e);
           setError("La connexion a échoué: " + (e.message || "Erreur réseau"));
           cleanup();
      });
    } catch (e: any) { 
        console.error("Connection failed", e);
        setError("Impossible de se connecter: " + e.message);
        cleanup(); 
    }
  }, [cleanup, activeCourseId, courses, language, stopAudioPlayback]);

  const disconnect = useCallback(() => cleanup(), [cleanup]);
  const sendTextCommand = useCallback((text: string) => sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ content: [{ text }] })).catch(e => console.error("Send Text Error", e)), []);
  const finishSession = useCallback(() => sendTextCommand("Fin de session. Bilan et saveProgress."), [sendTextCommand]);

  return {
    connect, disconnect, finishSession, sendTextCommand, isConnected, isStreaming, error, volume, speechRate, setSpeechRate, language, setLanguage,
    courses, folders, activeCourse, exams,
    createCourse, deleteCourse, selectCourse, clearFlashcards,
    createFolder, deleteFolder,
    createExam, deleteExam, generateExamSchedule, isGeneratingSchedule,
    exitSession: () => { disconnect(); setActiveCourseId(null); },
    generateCheatSheet, isGeneratingSheet, stopAudioPlayback
  };
}