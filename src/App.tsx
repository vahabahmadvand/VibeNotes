import React, { useState, useEffect } from 'react';
import { StickyNote } from './components/StickyNote';
import { NotesHub } from './components/NotesHub';

export const App: React.FC = () => {
  const [route, setRoute] = useState<string>(() => window.location.hash || '#/hub');

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash || '#/hub');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route.startsWith('#/note/')) {
    const noteId = route.replace('#/note/', '').trim();
    return <StickyNote noteId={noteId} />;
  }

  return <NotesHub />;
};

export default App;
