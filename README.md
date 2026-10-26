# RévizIA

Assistant de révision vocal : on charge ses cours, on parle avec un professeur IA qui interroge, corrige et suit la progression par compétence.

## Ce que fait l'application

- **Import de cours** : PDF, Word (.docx), OpenDocument (.odt), texte ou Markdown. Le texte extrait devient la seule source de vérité de l'assistant.
- **Conversation vocale en temps réel** avec l'API Gemini Live (audio natif), en français, anglais ou espagnol.
- **Cinq modes de révision** : synthèse, quiz, méthode socratique, flashcards, examen blanc.
- **Suivi des compétences** : le modèle identifie 3 à 6 thèmes clés dans le cours, note la maîtrise de chacun de 0 à 5 et l'enregistre par *function calling* (`saveProgress`).
- **Flashcards** générées par le modèle (`createFlashcards`), **fiche de synthèse** exportable en PDF, calendrier de révision.

## Stack

React 19, TypeScript, Vite, SDK `@google/genai` (Gemini Live et Gemini Pro), pdf.js, mammoth, jsPDF.

## Lancer en local

Prérequis : Node.js 20+ et une clé d'API Gemini.

```bash
npm install
echo "GEMINI_API_KEY=ta_cle" > .env.local
npm run dev
```

## Limites connues

Prototype personnel, construit en décembre 2025 pour réviser mes cours de géopolitique. Les données (cours, scores) restent dans le navigateur ; la clé d'API est utilisée côté client, donc l'application n'est pas faite pour être déployée publiquement en l'état.
