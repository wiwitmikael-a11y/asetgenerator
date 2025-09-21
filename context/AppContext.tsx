import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect } from 'react';
import { Layer, PostProcessingEffects, BatchProgress } from '../types';

interface AppContextType {
  layers: Layer[];
  generatedImages: { src: string; prompt: string }[];
  postProcessingEffects: PostProcessingEffects;
  batchProgress: BatchProgress;
  geminiApiKey: string;
  openAiApiKey: string;
  openAiApiEndpoint: string;
  addLayer: (imageSrc: string, name: string) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  setLayers: (layers: Layer[]) => void;
  toggleEffect: (effect: keyof PostProcessingEffects) => void;
  setGeneratedImages: (images: { src: string; prompt: string }[]) => void;
  setBatchProgress: (progress: BatchProgress | ((prev: BatchProgress) => BatchProgress)) => void;
  setGeminiApiKey: (key: string) => void;
  setOpenAiApiKey: (key: string) => void;
  setOpenAiApiEndpoint: (endpoint: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [generatedImages, setGeneratedImages] = useState<{ src: string; prompt: string }[]>([]);
  const [postProcessingEffects, setPostProcessingEffects] = useState<PostProcessingEffects>({
    scanlines: false,
    vignette: false,
    halftone: false,
    chromaticAberration: false,
    filmGrain: false,
  });
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    total: 0,
    current: 0,
    status: 'idle',
    generatedFiles: [],
  });
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>('');
  const [openAiApiKey, setOpenAiApiKeyState] = useState<string>('');
  const [openAiApiEndpoint, setOpenAiApiEndpointState] = useState<string>('https://api.openai.com/v1');


  useEffect(() => {
    const storedGeminiKey = sessionStorage.getItem('geminiApiKey');
    if (storedGeminiKey) {
      setGeminiApiKeyState(storedGeminiKey);
    }
    const storedOpenAiKey = sessionStorage.getItem('openAiApiKey');
    if (storedOpenAiKey) {
      setOpenAiApiKeyState(storedOpenAiKey);
    }
    const storedOpenAiEndpoint = sessionStorage.getItem('openAiApiEndpoint');
    if (storedOpenAiEndpoint) {
        setOpenAiApiEndpointState(storedOpenAiEndpoint);
    }
  }, []);

  const addLayer = useCallback((imageSrc: string, name: string) => {
    setLayers(prevLayers => {
      const newLayer: Layer = {
        id: crypto.randomUUID(),
        name,
        src: imageSrc,
        x: 100,
        y: 100,
        zIndex: prevLayers.length,
        scale: 1,
      };
      return [...prevLayers, newLayer];
    });
  }, []);

  const removeLayer = useCallback((id: string) => {
    setLayers(prevLayers => prevLayers.filter(layer => layer.id !== id));
  }, []);

  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    setLayers(prevLayers =>
      prevLayers.map(layer => (layer.id === id ? { ...layer, ...updates } : layer))
    );
  }, []);

  const toggleEffect = useCallback((effect: keyof PostProcessingEffects) => {
    setPostProcessingEffects(prev => ({ ...prev, [effect]: !prev[effect] }));
  }, []);

  const setGeminiApiKey = useCallback((key: string) => {
    setGeminiApiKeyState(key);
    sessionStorage.setItem('geminiApiKey', key);
  }, []);

  const setOpenAiApiKey = useCallback((key: string) => {
    setOpenAiApiKeyState(key);
    sessionStorage.setItem('openAiApiKey', key);
  }, []);

  const setOpenAiApiEndpoint = useCallback((endpoint: string) => {
    const finalEndpoint = endpoint.trim().length > 0 ? endpoint.trim() : 'https://api.openai.com/v1';
    setOpenAiApiEndpointState(finalEndpoint);
    sessionStorage.setItem('openAiApiEndpoint', finalEndpoint);
  }, []);

  const contextValue: AppContextType = {
    layers,
    generatedImages,
    postProcessingEffects,
    batchProgress,
    geminiApiKey,
    openAiApiKey,
    openAiApiEndpoint,
    addLayer,
    removeLayer,
    updateLayer,
    setLayers,
    toggleEffect,
    setGeneratedImages,
    setBatchProgress,
    setGeminiApiKey,
    setOpenAiApiKey,
    setOpenAiApiEndpoint,
  };

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};