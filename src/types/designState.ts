import type { TextEffect } from '../components/shirtlab/types';

export type DesignViewName = 'Front' | 'Back';

export interface SerializedImageObject {
  id: string;
  type: 'image';
  imgUrl: string;
  showHandles?: boolean;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  aspect: number;
  origW: number;
  origH: number;
  rotation: number;
  isVector?: boolean;
  name?: string;
  shapeMeta?: Record<string, any>;
}

export interface SerializedTextObject {
  id: string;
  type: 'text';
  content: string;
  font: string;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  size: number;
  alignment: 'left' | 'center' | 'right';
  rotation: number;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  showHandles?: boolean;
  effect: TextEffect;
}

export interface SerializedDesignView {
  images: SerializedImageObject[];
  texts: SerializedTextObject[];
}

export interface SerializedDesignState {
  views: Record<DesignViewName, SerializedDesignView>;
  activeView: DesignViewName;
}
