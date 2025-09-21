
import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Layer } from '../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants';

const LayerPanel: React.FC = () => {
  const { layers, setLayers, updateLayer, removeLayer, postProcessingEffects } = useAppContext();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reorderedLayers = [...layers];
    const draggedItem = reorderedLayers.splice(draggedIndex, 1)[0];
    reorderedLayers.splice(index, 0, draggedItem);
    
    const finalLayers = reorderedLayers.map((layer, idx) => ({ ...layer, zIndex: idx }));
    
    setLayers(finalLayers);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleScaleChange = (id: string, newScale: number) => {
    updateLayer(id, { scale: Math.max(0.1, newScale) });
  };
  
  const handleExport = () => {
    const sceneData = {
      sceneId: `scene_${Date.now()}`,
      canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      assets: layers.map(layer => ({
        fileName: layer.name,
        layerOrder: layer.zIndex,
        position: { x: layer.x, y: layer.y },
        scale: layer.scale,
      })),
      effects: postProcessingEffects,
    };

    const jsonString = JSON.stringify(sceneData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sceneData.sceneId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col flex-grow space-y-4">
      <h2 className="text-xl font-bold border-b border-gray-600 pb-2">Layers</h2>
      <div className="flex-grow space-y-2 overflow-y-auto">
        {layers.map((layer, index) => (
          <div
            key={layer.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`p-2 bg-gray-700 rounded-md flex items-center space-x-2 cursor-grab ${draggedIndex === index ? 'opacity-50' : ''}`}
          >
            <img src={layer.src} alt={layer.name} className="w-10 h-10 object-contain bg-gray-800 rounded-sm" />
            <div className="flex-grow">
              <p className="text-sm truncate">{layer.name}</p>
              <div className="flex items-center space-x-1">
                <label htmlFor={`scale-${layer.id}`} className="text-xs">Scale:</label>
                <input
                  id={`scale-${layer.id}`}
                  type="number"
                  step="0.1"
                  value={layer.scale}
                  onChange={(e) => handleScaleChange(layer.id, parseFloat(e.target.value))}
                  className="w-16 p-1 text-xs bg-gray-800 border border-gray-600 rounded-md"
                />
              </div>
            </div>
            <button onClick={() => removeLayer(layer.id)} className="text-red-400 hover:text-red-600 p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )).reverse() /* Show top layer first */ }
      </div>
      <button onClick={handleExport} className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 rounded-md transition-colors">
        Export to JSON
      </button>
    </div>
  );
};

export default LayerPanel;
