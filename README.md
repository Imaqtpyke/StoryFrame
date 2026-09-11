# StoryFrame 🎬
> **Cinematic Story, Shot Taxonomy, and Narrator Script Breakdown Generator**

StoryFrame is a creative suite for storytellers, filmmakers, video creators, and animators. It transforms raw story ideas, concepts, and scripts into scene-by-scene production blueprints — generating production-ready image prompts for generative models (Midjourney, Flux, DALL-E), camera shot taxonomies, and synchronized narrator voiceover scripts.

---

## ✨ Features

- **Scene-by-Scene Prompt Generation**: Detailed, prompt-engineered image prompts formatted with shot composition, camera lens settings, lighting style, and environmental details.
- **Cinematic Shot Taxonomy**: Structured breakdowns including framing (Wide, Medium, Close-Up, Extreme Close-Up), camera angle (Eye Level, Low Angle, Aerial, Dutch), and camera movement cues.
- **Narrator Voiceover Scripts**: Synchronized, paced narrative scripts paired with each scene for easy recording or text-to-speech integration.
- **Character & Style Continuity**: Maintain visual consistency across scenes with dedicated character appearance prompts and thematic visual styles.
- **Aspect Ratio & Platform Adaptations**: Tailor output for standard 16:9 widescreen or 9:16 vertical video formats (Reels, TikTok, Shorts).
- **Responsive Dark Theme**: Modern editorial typography with responsive views tailored for both mobile and desktop screens.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Motion](https://motion.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Integration**: [@google/genai](https://www.npmjs.com/package/@google/genai) (Google Gemini)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm`, `pnpm`, or `bun` package manager
- A [Google Gemini API Key](https://aistudio.google.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/storyframe.git
   cd storyframe
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY="your_actual_gemini_api_key"
   ```
   *(See `.env.example` for reference)*

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000` (or the port specified by Vite).

---

## 🌐 Deploying to Vercel

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/), click **Add New** > **Project** and select your repository.
3. In **Project Settings** > **Environment Variables**, optionally add:
   - `VITE_GEMINI_API_KEY`: Your Google Gemini API key.
   *(If not set as an environment variable, users can also securely enter their API key directly in the web app under Model Options).*
4. Click **Deploy**.

> **Note on 503 (Model Overloaded) Errors**:
> Google's free-tier Gemini endpoints can occasionally experience high-traffic spikes, resulting in temporary `503 Service Unavailable: The model is overloaded` responses. StoryFrame includes built-in exponential backoff retries and automatic multi-model failover (`gemini-3.8-flash` ➔ `gemini-flash-latest` ➔ `gemini-2.5-flash` ➔ `gemini-3.1-pro-preview`). If a 503 occurs during peak hours, waiting 10-20 seconds before retrying usually resolves it immediately as Google's cluster clears.

---

## 📦 Available Scripts

- `npm run dev` — Starts the Vite development server.
- `npm run build` — Compiles TypeScript and builds the production-ready static assets in `dist/`.
- `npm run preview` — Locally previews the production build.
- `npm run lint` — Runs TypeScript type-checking (`tsc --noEmit`).

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
