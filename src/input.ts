import { SCALE } from './constants';
import { canvas } from './canvas';
import { game, titleState, audioStarted, setAudioStarted } from './state';
import { Sound } from './audio/SoundEngine';
import { Music } from './audio/MusicEngine';

export const keys: Record<string, boolean> = {};
export const mouse = { x: 0, y: 0, down: false, clicked: false, rightClicked: false };

export function initInput() {
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (game.state === 'title') {
      if (titleState.mode === 1) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          titleState.nameInput = titleState.nameInput.slice(0, -1);
        } else if (e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
        } else if (e.key === 'Enter' || e.key === 'Escape') {
          // handled in updateTitle
        } else if (e.key.length === 1 && titleState.nameInput.length < 10) {
          const ch = e.key.toUpperCase();
          if (/[A-Z0-9 ]/.test(ch)) titleState.nameInput += ch;
        }
        return;
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (game.state === 'playing') { game.state = 'paused'; }
      else if (game.state === 'paused') { game.state = 'playing'; }
    }
    if (e.key === 'Tab') { e.preventDefault(); game.codexOpen = !game.codexOpen; }
    if (e.key.toLowerCase() === 'm') { Music.nextTrack(); }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / SCALE;
    mouse.y = (e.clientY - rect.top) / SCALE;
  });
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    if (e.button === 2) { mouse.rightClicked = true; }
    if (!audioStarted) { setAudioStarted(true); Sound.init(); Music.setTrack(5); Music.start(); }
  });
  canvas.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}
