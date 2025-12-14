import { ModeConfig, RevisionMode } from './types';
import { FunctionDeclaration, Type } from '@google/genai';

export const LANGUAGE_INSTRUCTIONS = {
  fr: "Tu es un professeur pédagogue qui parle FRANÇAIS. Tes réponses, explications et interactions doivent être exclusivement en FRANÇAIS.",
  en: "You are an expert teacher speaking ENGLISH. Your responses, explanations, and interactions must be exclusively in ENGLISH.",
  es: "Eres un profesor experto que habla ESPAÑOL. Tus respuestas, explicaciones e interacciones deben ser exclusivamente en ESPAÑOL."
};

// Le contenu est maintenant dynamique et injecté via le hook useLiveApi
export const SYSTEM_INSTRUCTION_TEMPLATE = `
RÔLE ET LANGUE
{{LANGUAGE_INSTRUCTION}}

MISSION
Tu es "RévizIA", un assistant pédagogique expert. Ta mission est d'aider l'utilisateur à réviser le MATÉRIEL SOURCE fourni ci-dessous.

RÈGLES FONDAMENTALES
1. Source de Vérité : Tes réponses doivent provenir EXCLUSIVEMENT du MATÉRIEL SOURCE fourni.
2. Pédagogie : Sois encourageant, clair et structure tes réponses. Adapte ton ton à la langue choisie.
3. SYSTÈME DE COMPÉTENCES DYNAMIQUE :
   - Analyse le texte et identifie 3 à 6 compétences/thèmes clés.
   - Note la compréhension de l'utilisateur sur ces thèmes (0 à 5).
   - Utilise des IDs de compétences courts et explicites (ex: "def_juridique", "dates_cles").
   - À la fin de la session (ou sur demande), utilise l'outil 'saveProgress' pour sauvegarder ces scores.

ÉCHELLE DE NOTATION (0 à 5):
0 - Non évalué
1 - Inconnu / Erreur totale
2 - Fragile
3 - En cours d'acquisition
4 - Acquis
5 - Maîtrisé

OUTILS:
1. 'saveProgress': À utiliser pour sauvegarder les progrès. Crée les IDs de compétences toi-même basés sur le texte.
2. 'createFlashcards': À utiliser pour créer des cartes de révision. Traduis les questions/réponses dans la langue de la session.

MATÉRIEL SOURCE:
{{USER_CONTENT}}
`;

export const PROGRESS_TOOL_DECLARATION: FunctionDeclaration = {
  name: 'saveProgress',
  description: 'Sauvegarde les scores de compétence (0-5) et le bilan de la session.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      updates: {
        type: Type.ARRAY,
        description: "Liste des compétences évaluées durant cette session.",
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "L'ID de la compétence identifiée (ex: 'chapitre_1')" },
            label: { type: Type.STRING, description: "Nom lisible de la compétence (ex: 'Chapitre 1 : Les définitions')" },
            score: { type: Type.NUMBER, description: "Note de 0 à 5." }
          },
          required: ['id', 'score', 'label']
        }
      },
      summary: {
        type: Type.STRING,
        description: "Un court paragraphe de bilan de la session."
      }
    },
    required: ['updates', 'summary']
  }
};

export const FLASHCARDS_TOOL_DECLARATION: FunctionDeclaration = {
  name: 'createFlashcards',
  description: 'Génère une liste de cartes mémoire (flashcards) pour la révision.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      cards: {
        type: Type.ARRAY,
        description: "Liste des cartes à créer.",
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "La question au recto de la carte." },
            answer: { type: Type.STRING, description: "La réponse concise au verso." },
            topic: { type: Type.STRING, description: "Le sujet ou catégorie de la carte." }
          },
          required: ['question', 'answer', 'topic']
        }
      }
    },
    required: ['cards']
  }
};

export const MODES: ModeConfig[] = [
  {
    id: RevisionMode.SYNTHESIS,
    label: 'Synthèse',
    description: 'Résumé des points clés',
    icon: 'FileText',
    prompt: "Mode Synthèse. Résume-moi les points essentiels de mon cours.",
  },
  {
    id: RevisionMode.QUIZ,
    label: 'Quiz',
    description: 'Questions dynamiques',
    icon: 'HelpCircle',
    prompt: "Mode Quiz. Pose-moi une question sur le contenu pour tester mes connaissances.",
  },
  {
    id: RevisionMode.SOCRATIC,
    label: 'Socratique',
    description: 'Réflexion guidée',
    icon: 'Brain',
    prompt: "Mode Socratique. Pose-moi une question de réflexion pour m'aider à approfondir.",
  },
  {
    id: RevisionMode.FLASHCARDS,
    label: 'Flashcards',
    description: 'Générer des cartes',
    icon: 'Layers',
    prompt: "Génère 5 flashcards sur les concepts clés de ce cours (utilise l'outil createFlashcards).",
  },
  {
    id: RevisionMode.EXAM,
    label: 'Examen',
    description: 'Simulation complexe',
    icon: 'PenTool',
    prompt: "Mode Examen. Pose une question difficile type examen.",
  },
];