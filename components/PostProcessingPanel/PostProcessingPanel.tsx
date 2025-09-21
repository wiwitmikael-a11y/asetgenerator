
import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { PostProcessingEffects } from '../../types';

const PostProcessingPanel: React.FC = () => {
  const { postProcessingEffects, toggleEffect } = useAppContext();

  const effects: { key: keyof PostProcessingEffects; label: string }[] = [
    { key: 'halftone', label: 'Halftone/Dot Matrix' },
    { key: 'scanlines', label: 'Scanlines' },
    { key: 'vignette', label: 'Vignette' },
    { key: 'chromaticAberration', label: 'Chromatic Aberration' },
    { key: 'filmGrain', label: 'Film Grain/Noise' },
  ];

  return (
    <div className="mt-4 pt-4 border-t border-gray-600">
      <h2 className="text-xl font-bold mb-2">Post-Processing</h2>
      <div className="space-y-2">
        {effects.map(effect => (
          <label key={effect.key} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={postProcessingEffects[effect.key]}
              onChange={() => toggleEffect(effect.key)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span>{effect.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default PostProcessingPanel;
