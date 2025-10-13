import type { ImageObject, TextObject } from '../types';

type Rotatable = Pick<ImageObject | TextObject, 'x' | 'y' | 'w' | 'h'> & Partial<Pick<ImageObject | TextObject, 'rotation'>>;

export type Point = { x: number; y: number };

export function getRotationRadians(item: Rotatable): number {
  return ((item.rotation || 0) * Math.PI) / 180;
}

export function getRotatedCorners(item: Rotatable) {
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  const rad = getRotationRadians(item);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const TL: Point = { x: item.x, y: item.y };
  const TR: Point = { x: item.x + item.w, y: item.y };
  const BL: Point = { x: item.x, y: item.y + item.h };
  const BR: Point = { x: item.x + item.w, y: item.y + item.h };

  const rotate = ({ x, y }: Point): Point => {
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  };

  return {
    TL: rotate(TL),
    TR: rotate(TR),
    BL: rotate(BL),
    BR: rotate(BR),
  };
}

export function getAABBCorners(item: Rotatable) {
  const corners = getRotatedCorners(item);
  const minX = Math.min(corners.TL.x, corners.TR.x, corners.BL.x, corners.BR.x);
  const maxX = Math.max(corners.TL.x, corners.TR.x, corners.BL.x, corners.BR.x);
  const minY = Math.min(corners.TL.y, corners.TR.y, corners.BL.y, corners.BR.y);
  const maxY = Math.max(corners.TL.y, corners.TR.y, corners.BL.y, corners.BR.y);
  return {
    TL: { x: minX, y: minY },
    TR: { x: maxX, y: minY },
    BL: { x: minX, y: maxY },
    BR: { x: maxX, y: maxY },
  };
}

export function pointInRotatedRect(px: number, py: number, item: Rotatable) {
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  const rad = -getRotationRadians(item);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return lx >= -item.w / 2 && lx <= item.w / 2 && ly >= -item.h / 2 && ly <= item.h / 2;
}

export function getAABB(item: Rotatable) {
  const corners = getRotatedCorners(item);
  const minX = Math.min(corners.TL.x, corners.TR.x, corners.BL.x, corners.BR.x);
  const maxX = Math.max(corners.TL.x, corners.TR.x, corners.BL.x, corners.BR.x);
  const minY = Math.min(corners.TL.y, corners.TR.y, corners.BL.y, corners.BR.y);
  const maxY = Math.max(corners.TL.y, corners.TR.y, corners.BL.y, corners.BR.y);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
