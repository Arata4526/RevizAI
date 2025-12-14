export enum RevisionMode {
  SYNTHESIS = 'SYNTHESIS',
  QUIZ = 'QUIZ',
  SOCRATIC = 'SOCRATIC',
  FLASHCARDS = 'FLASHCARDS',
  EXAM = 'EXAM',
}

export interface ModeConfig {
  id: RevisionMode;
  label: string;
  description: string;
  icon: string;
  prompt: string;
}

export interface SkillData {
  score: number;
  label: string;
}

export interface LiveConnectionState {
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
}

export interface SessionReport {
  scores: Record<string, SkillData>; // Map ID -> {Score, Label}
  summary: string;
  timestamp: number;
  topic?: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  topic: string;
}

export interface Course {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  lastAccessedAt: number;
  report: SessionReport | null;
  flashcards: Flashcard[];
}