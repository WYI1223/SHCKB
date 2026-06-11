import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { EditorPage } from './pages/EditorPage';
import { ListPage } from './pages/ListPage';
import { ReadPage } from './pages/ReadPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/edit/:id" element={<EditorPage />} />
        <Route path="/notes/:slug" element={<ReadPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
