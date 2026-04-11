# ProductScope Lab v2 - Market Simulation Lab

ProductScope Lab is an AI-powered market analysis and persona simulation platform. It helps product managers and founders validate their ideas by simulating competitor landscapes, extracting feature matrices, and running synthetic user personas against their product.

## 🚀 Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/SanjayGoffl/prodscope-v1.git
cd prodscope-v1
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory and add your API keys:
```env
GOOGLE_GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
OPEN_ROUTER_API_KEY=your_key_here
```
*Note: The app uses a fallback chain. It will try Gemini first, then Groq, then OpenRouter.*

### 3. Run Locally
Since this is a lightweight SPA with vanilla JS, you can run it with any static file server.

**Option A (Node.js/NPM):**
```bash
npx serve .
```
Access at: `http://localhost:3000`

**Option B (VS Code):**
Right-click `index.html` and select **"Open with Live Server"**.

## 🛠️ Features
- **Phase 1: Product Setup**: define identity, market context, and pricing. Uses AI for dynamic idea generation.
- **Phase 2: Competitor Discovery**: Automated AI-driven competitor analysis.
- **Phase 3-7**: Feature extraction, Persona generation, and Market simulation.
- **Global History**: Saves your previous scans to local storage.
- **AI Chat Assistant**: Talk to your market data across multiple scans.

## 📁 Project Structure
- `/core`: Global state, routing, shell, and AI logic.
- `/phases`: Isolated modules for each of the 7 analysis phases.
- `/assets`: Shared CSS (animations, components, layout).
- `.env`: (Ignored) Local API keys.
- `WORKLOG.md`: Detailed history of all modifications.

## ⚖️ License
MIT
