
import { CharacterPart } from './types';

export const PART_DIMENSIONS: Record<CharacterPart, { width: number; height: number }> = {
  [CharacterPart.Head]: { width: 64, height: 64 },
  [CharacterPart.Body]: { width: 96, height: 128 },
  [CharacterPart.Arms]: { width: 48, height: 96 },
  [CharacterPart.Legs]: { width: 64, height: 128 },
  [CharacterPart.Weapon]: { width: 128, height: 128 },
};

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;
