
import React from 'react';
import { AppProvider } from './context/AppContext';
import GeneratorPanel from './components/GeneratorPanel/GeneratorPanel';
import CanvasPanel from './components/CanvasPanel/CanvasPanel';
import LayerPanel from './components/LayerPanel/LayerPanel';
import PostProcessingPanel from './components/PostProcessingPanel/PostProcessingPanel';

const App: React.FC = () => {
  return (
    <AppProvider>
      <div className="flex h-screen bg-gray-800 text-gray-200 font-sans">
        <div className="w-1/4 p-4 bg-gray-900 flex flex-col overflow-y-auto">
          <GeneratorPanel />
        </div>
        <div className="w-1/2 p-4 flex items-center justify-center bg-gray-800">
          <CanvasPanel />
        </div>
        <div className="w-1/4 p-4 bg-gray-900 flex flex-col overflow-y-auto">
          <LayerPanel />
          <PostProcessingPanel />
        </div>
      </div>
    </AppProvider>
  );
};

export default App;
