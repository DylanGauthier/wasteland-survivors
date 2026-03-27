import { VIEW_W, VIEW_H, SCALE } from './constants';

export const canvas = document.getElementById('game') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d')!;
canvas.width = VIEW_W * SCALE;
canvas.height = VIEW_H * SCALE;
ctx.imageSmoothingEnabled = false;
canvas.style.cursor = 'none';

export const buf = document.createElement('canvas');
buf.width = VIEW_W;
buf.height = VIEW_H;
export const bx = buf.getContext('2d')!;

// Bloom layer — captures bright stuff, blurs it, composites back
export const bloomBuf = document.createElement('canvas');
bloomBuf.width = VIEW_W;
bloomBuf.height = VIEW_H;
export const bloomCtx = bloomBuf.getContext('2d')!;
