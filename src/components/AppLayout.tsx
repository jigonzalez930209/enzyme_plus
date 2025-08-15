import React from 'react';
import TitleBar from './TitleBar';
import { MainContent } from '@/components/content/MainContent';

const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen">
      <TitleBar />
      <main className="flex-1 bg-background text-foreground">
        <MainContent />
      </main>
    </div>
  );
};

export default AppLayout;
