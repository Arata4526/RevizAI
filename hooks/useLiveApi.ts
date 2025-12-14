import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SYSTEM_INSTRUCTION_TEMPLATE, PROGRESS_TOOL_DECLARATION, FLASHCARDS_TOOL_DECLARATION } from '../constants';
import { base64ToUint8Array, decodeAudioData, createPcmBlob } from '../utils/audioUtils';
import { SessionReport, Flashcard, Course } from '../types';

const COURSES_STORAGE_KEY = 'revizia_courses_db_v1';

export function useLiveApi() {
  // Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0); 
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  // Data Management State
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

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

  // Load Courses on Mount
  useEffect(() => {
    const savedCourses = localStorage.getItem(COURSES_STORAGE_KEY);
    if (savedCourses) {
      try {
        const parsed = JSON.parse(savedCourses);
        if (Array.isArray(parsed) && parsed.length > 0) {
            setCourses(parsed);
            return;
        }
      } catch (e) {
        console.error("Failed to parse courses", e);
      }
    }

    // Default Demo Courses if storage is empty
    const demoCourses: Course[] = [
        {
            id: 'demo-math-arithmetique',
            title: 'Maths : Arithmétique de base',
            content: `L'arithmétique est la branche des mathématiques qui étudie les nombres et les opérations élémentaires.

1. L'ADDITION
L'addition est l'opération qui permet de calculer la somme de deux nombres.
Le signe est "+".
Exemple : 5 + 3 = 8.
Si on a 5 pommes et qu'on en ajoute 3, on a 8 pommes.

2. LA SOUSTRACTION
La soustraction permet de calculer la différence entre deux nombres.
Le signe est "-".
Exemple : 10 - 4 = 6.
C'est l'opération inverse de l'addition.

3. LA MULTIPLICATION
La multiplication permet de calculer le produit de deux nombres (les facteurs).
Le signe est "x" ou "*".
Exemple : 4 x 3 = 12.
C'est une addition répétée : 4 + 4 + 4 = 12.

4. LA DIVISION
La division permet de partager un nombre en parts égales. Le résultat est le quotient.
Le signe est "/" ou ":".
Exemple : 20 / 5 = 4.
Si on partage 20 bonbons entre 5 amis, chacun en reçoit 4.`,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            report: null,
            flashcards: []
        },
        {
            id: 'demo-math-geometrie',
            title: 'Maths : Géométrie plane',
            content: `La géométrie plane étudie les figures en deux dimensions. Voici les principales figures à connaître :

1. LE CARRÉ
- Possède 4 côtés de même longueur.
- Possède 4 angles droits (90°).
- Formule du Périmètre = 4 x côté.
- Formule de l'Aire = côté x côté.

2. LE RECTANGLE
- Les côtés opposés sont parallèles et de même longueur.
- Possède 4 angles droits.
- Formule du Périmètre = 2 x (Longueur + largeur).
- Formule de l'Aire = Longueur x largeur.

3. LE TRIANGLE
- Une figure à 3 côtés.
- Un triangle rectangle possède un angle droit.
- Un triangle équilatéral a 3 côtés égaux.
- Un triangle isocèle a 2 côtés égaux.
- Formule de l'Aire = (base x hauteur) / 2.

4. LE CERCLE
- Ensemble des points situés à la même distance (rayon) d'un point central (centre).
- Le diamètre est le double du rayon.
- Formule de la Circonférence = 2 x Pi x rayon.
- Formule de l'Aire = Pi x rayon².`,
            createdAt: Date.now() - 1000,
            lastAccessedAt: Date.now() - 1000,
            report: null,
            flashcards: []
        }
    ];
    setCourses(demoCourses);
  }, []);

  // Persist Courses whenever they change
  useEffect(() => {
    if (courses.length > 0) {
      localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));
    }
  }, [courses]);

  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);

  // --- Course Management Functions ---

  const createCourse = useCallback((title: string, content: string) => {
    const newCourse: Course = {
      id: crypto.randomUUID(),
      title,
      content,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      report: null,
      flashcards: []
    };
    setCourses(prev => [newCourse, ...prev]);
    setActiveCourseId(newCourse.id);
    return newCourse.id;
  }, []);

  const deleteCourse = useCallback((id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
    if (activeCourseId === id) setActiveCourseId(null);
  }, [activeCourseId]);

  const selectCourse = useCallback((id: string) => {
    setActiveCourseId(id);
    // Update last accessed
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


  // --- Live API Logic ---

  const cleanup = useCallback(() => {
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
        inputSourceRef.current = null;
    }
    if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    sourceNodesRef.current.forEach(node => {
        try { node.stop(); } catch(e) {}
    });
    sourceNodesRef.current.clear();

    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            try { session.close(); } catch(e) { console.error("Error closing session", e)}
        });
        sessionPromiseRef.current = null;
    }

    setIsConnected(false);
    setIsStreaming(false);
    setVolume(0);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    
    // We need the ACTIVE course to connect
    const currentCourse = courses.find(c => c.id === activeCourseId);

    if (!currentCourse || !currentCourse.content) {
        setError("Aucun cours actif ou contenu manquant.");
        return;
    }

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key not found");

      const ai = new GoogleGenAI({ apiKey });

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Construct System Instruction dynamically based on ACTIVE COURSE
      let finalSystemInstruction = SYSTEM_INSTRUCTION_TEMPLATE.replace('{{USER_CONTENT}}', currentCourse.content);
      
      if (currentCourse.report) {
        const scoresStr = Object.entries(currentCourse.report.scores)
            .map(([k, v]) => `${v.label} (${k}): ${v.score}/5`)
            .join(', ');
        finalSystemInstruction += `\n\nCONTEXTE MÉMOIRE (SESSION PRÉCÉDENTE sur ce sujet):\n- Derniers scores: {${scoresStr}}\n- Dernier bilan: ${currentCourse.report.summary}`;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: finalSystemInstruction,
            tools: [{ functionDeclarations: [PROGRESS_TOOL_DECLARATION, FLASHCARDS_TOOL_DECLARATION] }],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
        },
        callbacks: {
            onopen: async () => {
                setIsConnected(true);
                setIsStreaming(true);

                if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
                
                if (inputAudioContextRef.current.state === 'suspended') {
                    await inputAudioContextRef.current.resume();
                }

                const inputCtx = inputAudioContextRef.current;
                const source = inputCtx.createMediaStreamSource(mediaStreamRef.current);
                inputSourceRef.current = source;
                
                const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                scriptProcessorRef.current = processor;

                processor.onaudioprocess = (e) => {
                    if (!inputAudioContextRef.current) return;
                    const inputData = e.inputBuffer.getChannelData(0);
                    let sum = 0;
                    for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                    const rms = Math.sqrt(sum / inputData.length);
                    setVolume(prev => Math.max(rms, prev * 0.8));
                    const pcmBlob = createPcmBlob(inputData, inputCtx.sampleRate);
                    if (sessionPromiseRef.current) {
                        sessionPromiseRef.current.then(session => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    }
                };

                source.connect(processor);
                processor.connect(inputCtx.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
                const outputCtx = outputAudioContextRef.current;
                if (!outputCtx) return;

                if (message.toolCall) {
                    for (const fc of message.toolCall.functionCalls) {
                        
                        if (fc.name === 'saveProgress') {
                            const updates = fc.args.updates as {id: string, score: number, label: string}[];
                            const summary = fc.args.summary as string;

                            // Update the specific course in the state
                            setCourses(currentCourses => {
                                return currentCourses.map(c => {
                                    if (c.id === activeCourseId) {
                                        const oldScores = c.report?.scores || {};
                                        updates.forEach(u => {
                                            oldScores[u.id] = { score: u.score, label: u.label };
                                        });
                                        return {
                                            ...c,
                                            report: {
                                                scores: { ...oldScores },
                                                summary,
                                                timestamp: Date.now(),
                                                topic: c.title
                                            }
                                        };
                                    }
                                    return c;
                                });
                            });

                            sessionPromiseRef.current?.then(session => {
                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: "Progression sauvegardée dans le dossier de la matière." }
                                    }]
                                });
                            });
                        }
                        
                        if (fc.name === 'createFlashcards') {
                            const newCards = fc.args.cards as {question: string, answer: string, topic: string}[];
                            const cardsWithIds: Flashcard[] = newCards.map(c => ({
                                ...c,
                                id: Math.random().toString(36).substr(2, 9)
                            }));

                            setCourses(currentCourses => {
                                return currentCourses.map(c => {
                                    if (c.id === activeCourseId) {
                                        return { ...c, flashcards: [...c.flashcards, ...cardsWithIds] };
                                    }
                                    return c;
                                });
                            });

                            sessionPromiseRef.current?.then(session => {
                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: `${cardsWithIds.length} flashcards ajoutées au cours.` }
                                    }]
                                });
                            });
                        }
                    }
                }

                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio) {
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                    const audioBuffer = await decodeAudioData(
                        base64ToUint8Array(base64Audio),
                        outputCtx,
                        24000
                    );
                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.playbackRate.value = speechRateRef.current; // Use ref for latest value
                    source.connect(outputCtx.destination);
                    source.addEventListener('ended', () => sourceNodesRef.current.delete(source));
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += (audioBuffer.duration / speechRateRef.current);
                    sourceNodesRef.current.add(source);
                }

                if (message.serverContent?.interrupted) {
                    sourceNodesRef.current.forEach(node => { try { node.stop(); } catch(e) {} });
                    sourceNodesRef.current.clear();
                    nextStartTimeRef.current = 0;
                }
            },
            onclose: () => {
                setIsConnected(false);
                setIsStreaming(false);
            },
            onerror: (e) => {
                console.error("Live API Error", e);
                setError("Erreur de connexion. Réessayez.");
                cleanup();
            }
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (e) {
      console.error(e);
      setError("Erreur interne.");
      cleanup();
    }
  }, [cleanup, activeCourseId, courses]); // Dependencies crucial for closure

  const disconnect = useCallback(() => cleanup(), [cleanup]);

  const sendTextCommand = useCallback((text: string) => {
      if (sessionPromiseRef.current) {
          sessionPromiseRef.current.then(session => {
             session.sendRealtimeInput({ content: [{ text }] });
          });
      }
  }, []);

  const finishSession = useCallback(() => {
    if (sessionPromiseRef.current) {
        sendTextCommand("La session est finie. Fais un bilan global, mets à jour toutes les compétences avec des labels clairs et appelle saveProgress.");
    }
  }, [sendTextCommand]);

  return {
    // API
    connect,
    disconnect,
    finishSession,
    sendTextCommand,
    isConnected,
    isStreaming,
    error,
    volume,
    speechRate,
    setSpeechRate,
    
    // Course Management
    courses,
    activeCourse,
    createCourse,
    deleteCourse,
    selectCourse,
    clearFlashcards,
    exitSession: () => {
        disconnect();
        setActiveCourseId(null);
    }
  };
}