export enum AssetType {
  Character = 'Karakter',
  NPC = 'NPC/Musuh',
  Prop = 'Prop',
  Background = 'Latar',
}

export enum CharacterPart {
  Head = 'Kepala',
  Body = 'Badan',
  Arms = 'Lengan',
  Legs = 'Kaki',
  Weapon = 'Senjata',
}

export enum FacingDirection {
  Left = 'kiri',
  Right = 'kanan',
}

export interface Layer {
  id: string;
  name: string;
  src: string;
  x: number;
  y: number;
  zIndex: number;
  scale: number;
}

export interface PostProcessingEffects {
  scanlines: boolean;
  vignette: boolean;
  halftone: boolean;
  chromaticAberration: boolean;
  filmGrain: boolean;
}

export interface GeneratedFile {
  filename: string;
  data: string; // base64 data URL
}

export interface BatchProgress {
  total: number;
  current: number;
  status: 'idle' | 'processing' | 'done' | 'error';
  generatedFiles: GeneratedFile[];
  currentFileName?: string;
  error?: string;
}