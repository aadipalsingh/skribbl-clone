# 🎨 Skribbl.io Clone - Full Stack Multiplayer Game

An end-to-end clone of **skribbl.io**, featuring real-time drawing canvas synchronization, turn-based gameplay logic, lobby chat, and a custom **retro-cartoon visual style** (inspired by the classic look of original pictionary games). Built as a full-stack real-time multiplayer application.

---

## 🚀 Live Demo

* **🎮 Live Application URL:** `[Insert Deployed Live URL Here, e.g., https://skribbl-pictionary.vercel.app]`
* **📡 WebSocket Backend URL:** `[Insert Deployed Backend URL Here, e.g., https://skribbl-backend.onrender.com]`

---

## 🏗️ Architecture Overview

This application is built with a decoupled real-time architecture:
- **Frontend (Next.js / TypeScript):** Houses our cartoon dashboard, HTML5 Canvas API capturing mouse movements, custom profiles with avatar grids, and local game states.
- **Backend (Node.js / Express):** Serves as our stateful, central gameplay engine. State is stored purely in-memory across object-oriented classes (`Room`, `Game`, and `Player`) to guarantee high-performance loops.
- **Real-time Sync (Socket.IO):** Manages real-time bi-directional events (pencil drawing vectors, instant correct-guess highlights, scoreboard updates).

---

## 🛠️ Local Setup Instructions

To run this project locally, you will need to start both the Node.js backend and the Next.js frontend in separate terminal instances:

### 1. Start the Backend Server
```bash
cd backend
npm install
npm run dev # Starts on port 3001
```

### 2. Start the Frontend Server
```bash
cd ../frontend
npm install
npm run dev # Starts on port 3000
```

---

