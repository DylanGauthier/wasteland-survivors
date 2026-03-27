import { VIEW_W, VIEW_H, FPS } from '../constants';
import { game, titleState, players, playerNames, playerColors, PLAYER_COLORS, setPlayerContext, audioStarted, setAudioStarted } from '../state';
import { keys, mouse } from '../input';
import { Sound } from '../audio/SoundEngine';
import { Music } from '../audio/MusicEngine';

export function startGameFromTitle() {
  for (let i = 0; i < 2; i++) {
    playerColors[i] = PLAYER_COLORS[titleState.selectedColors[i]].color;
    players[i].visorColor = playerColors[i];
  }
  if (titleState.playerCount === 1) {
    players[1].dead = true;
  }
  game.state = 'playing';
  game.time = 0;
  if (!audioStarted) { setAudioStarted(true); Sound.init(); }
  Music.setTrack(0); Music.start();
}

export function updateTitle() {
  if (titleState.ashParticles.length < 40 && Math.random() < 0.1) {
    titleState.ashParticles.push({
      x: Math.random() * VIEW_W, y: -5,
      dx: (Math.random() - 0.5) * 0.3, dy: 0.2 + Math.random() * 0.3,
      life: 300 + Math.random() * 200, maxLife: 500,
    });
  }
  for (let i = titleState.ashParticles.length - 1; i >= 0; i--) {
    const p = titleState.ashParticles[i];
    p.x += p.dx; p.y += p.dy; p.life--;
    if (p.life <= 0 || p.y > VIEW_H + 5) titleState.ashParticles.splice(i, 1);
  }

  if (keys['escape']) {
    keys['escape'] = false;
    if (titleState.mode === 2) { titleState.mode = 1; }
    else if (titleState.mode === 1) {
      if (titleState.editingPlayer === 1) { titleState.editingPlayer = 0; titleState.mode = 2; titleState.cursor = titleState.selectedColors[0]; }
      else { titleState.mode = 0; titleState.cursor = 0; }
    }
  }

  if (titleState.mode === 0) {
    if (keys['arrowdown'] || keys['s']) { titleState.cursor = 1; keys['arrowdown'] = false; keys['s'] = false; }
    if (keys['arrowup'] || keys['z']) { titleState.cursor = 0; keys['arrowup'] = false; keys['z'] = false; }
    if (keys['enter'] || keys[' ']) {
      titleState.playerCount = titleState.cursor === 0 ? 1 : 2;
      titleState.mode = 1; titleState.editingPlayer = 0; titleState.nameInput = playerNames[0];
      keys['enter'] = false; keys[' '] = false;
    }
    if (keys['1'] || keys['&']) { titleState.playerCount = 1; titleState.mode = 1; titleState.editingPlayer = 0; titleState.nameInput = playerNames[0]; keys['1'] = false; keys['&'] = false; }
    if (keys['2'] || keys['\u00e9']) { titleState.playerCount = 2; titleState.mode = 1; titleState.editingPlayer = 0; titleState.nameInput = playerNames[0]; keys['2'] = false; keys['\u00e9'] = false; }

    if (mouse.clicked) {
      const btnW = 160, btnX = VIEW_W / 2 - 80;
      if (mouse.x >= btnX && mouse.x <= btnX + btnW) {
        if (mouse.y >= 140 && mouse.y <= 170) { titleState.playerCount = 1; titleState.mode = 1; titleState.editingPlayer = 0; titleState.nameInput = playerNames[0]; }
        if (mouse.y >= 180 && mouse.y <= 210) { titleState.playerCount = 2; titleState.mode = 1; titleState.editingPlayer = 0; titleState.nameInput = playerNames[0]; }
      }
      mouse.clicked = false;
    }
  } else if (titleState.mode === 1) {
    if (keys['enter']) {
      keys['enter'] = false;
      playerNames[titleState.editingPlayer] = titleState.nameInput || ('JOUEUR ' + (titleState.editingPlayer + 1));
      titleState.mode = 2;
      titleState.cursor = titleState.selectedColors[titleState.editingPlayer];
    }
  } else if (titleState.mode === 2) {
    if (keys['arrowleft'] || keys['q']) {
      titleState.cursor = (titleState.cursor - 1 + PLAYER_COLORS.length) % PLAYER_COLORS.length;
      if (titleState.editingPlayer === 1 && titleState.cursor === titleState.selectedColors[0])
        titleState.cursor = (titleState.cursor - 1 + PLAYER_COLORS.length) % PLAYER_COLORS.length;
      keys['arrowleft'] = false; keys['q'] = false;
    }
    if (keys['arrowright'] || keys['d']) {
      titleState.cursor = (titleState.cursor + 1) % PLAYER_COLORS.length;
      if (titleState.editingPlayer === 1 && titleState.cursor === titleState.selectedColors[0])
        titleState.cursor = (titleState.cursor + 1) % PLAYER_COLORS.length;
      keys['arrowright'] = false; keys['d'] = false;
    }
    if (keys['enter'] || keys[' ']) {
      keys['enter'] = false; keys[' '] = false;
      titleState.selectedColors[titleState.editingPlayer] = titleState.cursor;
      if (titleState.editingPlayer === 0 && titleState.playerCount === 2) {
        titleState.editingPlayer = 1;
        titleState.mode = 1;
        titleState.nameInput = playerNames[1];
      } else {
        startGameFromTitle();
      }
    }

    if (mouse.clicked) {
      const colSize = 20, colGap = 6;
      const totalColW = PLAYER_COLORS.length * (colSize + colGap) - colGap;
      const colStartX = VIEW_W / 2 - totalColW / 2;
      const colY = 165;
      for (let ci = 0; ci < PLAYER_COLORS.length; ci++) {
        const cx = colStartX + ci * (colSize + colGap);
        if (mouse.x >= cx && mouse.x <= cx + colSize && mouse.y >= colY && mouse.y <= colY + colSize) {
          const isOther = titleState.editingPlayer === 1 && ci === titleState.selectedColors[0];
          if (!isOther) {
            titleState.cursor = ci;
            titleState.selectedColors[titleState.editingPlayer] = ci;
            if (titleState.editingPlayer === 0 && titleState.playerCount === 2) {
              titleState.editingPlayer = 1;
              titleState.mode = 1;
              titleState.nameInput = playerNames[1];
            } else {
              startGameFromTitle();
            }
          }
        }
      }
      mouse.clicked = false;
    }
  }
}
