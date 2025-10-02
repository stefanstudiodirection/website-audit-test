# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Local Development Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Configure environment variables:**
   - Copy the provided `.env` file or create a new one in the project root:
     ```sh
     cp .env.example .env
     # or manually create .env
     ```
   - Add your Google Gemini API key:
     ```env
     GEMINI_API_KEY=PASTE_YOUR_KEY_HERE
     ```

3. **Start the Gemini proxy server:**
   ```sh
   node gemini-proxy.js
   ```

4. **Start the React app:**
   ```sh
   npm run dev
   ```

5. **Open** [http://localhost:5173](http://localhost:5173) in your browser.

---

**Security Note:**
- Nikada ne commit-ujte `.env` fajl ili API ključeve u javni repozitorijum.
- Rotirajte ključeve na Google Cloud nalogu ako su bili javno izloženi.
