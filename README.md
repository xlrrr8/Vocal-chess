# Vocal Chess

An intelligent voice-controlled chess application. Vocal Chess transforms a basic chess game into an intelligent, hands-free experience by implementing a robust Natural Language Processing (NLP) parsing pipeline, real-time command visualization, intelligent error reasoning, and a confidence-based ambiguity clarification flow.

## Features

- **Voice-Controlled Gameplay**: Make chess moves using natural language voice commands.
- **NLP Parsing Pipeline**: Intelligently parses voice commands to standard chess notation using a dedicated NLP engine.
- **Real-Time Visualization**: Visualizes your voice input and commands in real time.
- **Intelligent Error Reasoning**: Provides feedback when encountering ambiguous, illegal, or invalid moves.
- **Modern Aesthetic**: Built with a responsive and sleek UI utilizing Vite, React, and TypeScript.

## Tech Stack

- **Frontend**: React (v18), React Router
- **Language**: TypeScript
- **Chess Logic**: [chess.js](https://github.com/jhlywa/chess.js)
- **Build Tool**: Vite (SWC)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone or download the repository.
   ```bash
   cd voice-chess
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

To start the development server, run:
```bash
npm run dev
```
The application will usually be served at `http://localhost:5173`.

### Building for Production

To create a production build:
```bash
npm run build
```
To preview the generated build:
```bash
npm run preview
```
