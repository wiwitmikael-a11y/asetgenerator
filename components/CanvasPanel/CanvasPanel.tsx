
import React, { useRef, useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants';
import { Layer } from '../../types';

interface DragState {
  layerId: string;
  offsetX: number;
  offsetY: number;
}

const CanvasPanel: React.FC = () => {
  const { layers, addLayer, updateLayer, postProcessingEffects } = useAppContext();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const imageSrc = e.dataTransfer.getData('imageSrc');
    const name = e.dataTransfer.getData('name');
    if (imageSrc && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;
      addLayer(imageSrc, name);
      // We add layer at a default position, user can move it.
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, layer: Layer) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const canvasRect = canvasRef.current!.getBoundingClientRect();
    
    setDragState({
        layerId: layer.id,
        offsetX: e.clientX - (canvasRect.left + layer.x),
        offsetY: e.clientY - (canvasRect.top + layer.y),
    });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState && canvasRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - canvasRect.left - dragState.offsetX;
        const y = e.clientY - canvasRect.top - dragState.offsetY;
        updateLayer(dragState.layerId, { x, y });
    }
  }, [dragState, updateLayer]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={canvasRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="bg-gray-700 relative overflow-hidden shadow-lg"
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
    >
      {/* Guide Boxes */}
      <div className="absolute top-0 left-0 w-1/3 h-full flex items-center justify-center pointer-events-none">
        <div style={{width: 192, height: 384}} className="border-2 border-dashed border-blue-400 opacity-50"></div>
      </div>
      <div className="absolute top-0 right-0 w-1/3 h-full flex items-center justify-center pointer-events-none">
         <div style={{width: 192, height: 384}} className="border-2 border-dashed border-red-400 opacity-50"></div>
      </div>

      {/* Layers */}
      {sortedLayers.map(layer => (
        <div
          key={layer.id}
          onMouseDown={(e) => handleMouseDown(e, layer)}
          className="absolute cursor-move select-none"
          style={{
            left: layer.x,
            top: layer.y,
            zIndex: layer.zIndex,
            transform: `scale(${layer.scale})`,
            transformOrigin: 'top left',
          }}
        >
          <img src={layer.src} alt={layer.name} className="pointer-events-none w-auto h-auto" />
        </div>
      ))}

      {/* Post-Processing Overlays */}
      {postProcessingEffects.vignette && <div className="absolute inset-0 pointer-events-none" style={{boxShadow: 'inset 0 0 100px 20px rgba(0,0,0,0.7)'}}></div>}
      {postProcessingEffects.scanlines && <div className="absolute inset-0 pointer-events-none opacity-10" style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 3px)'}}></div>}
      {postProcessingEffects.filmGrain && <div className="absolute inset-0 pointer-events-none opacity-5 bg-repeat" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}}></div>}
      {postProcessingEffects.chromaticAberration && <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-50" style={{textShadow: '1px 0 red, -1px 0 blue'}}></div>}
    </div>
  );
};

export default CanvasPanel;
