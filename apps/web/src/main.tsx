import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { EditorPage } from './pages/EditorPage';
import { InAppView } from './pages/InAppView';
import { LoginPage } from './pages/LoginPage';
import { ReadPage } from './pages/ReadPage';
import { WelcomePane } from './pages/WelcomePane';
import { Shell } from './shell/Shell';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* workspace shell: sidebar directory + main pane */}
        <Route element={<Shell />}>
          <Route path="/" element={<WelcomePane />} />
          <Route path="/edit/:id" element={<EditorPage />} />
          <Route path="/view/:id" element={<InAppView />} />
          {/* in-app read pane (anonymous browsing inside the shell) */}
          <Route path="/read/:id" element={<ReadPage />} />
        </Route>
        {/* standalone: login + the clean public share page */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/notes/:id" element={<ReadPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
