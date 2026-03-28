/**
 * ============================================================
 *  BANSURI — Indian Flute Pitch Tutor
 *  script.js
 *
 *  Features:
 *   - Microphone access via Web Audio API
 *   - Real-time pitch detection (autocorrelation algorithm)
 *   - Indian Swar (Sa Re Ga Ma Pa Dha Ni) mapping
 *   - Tuning meter needle animation
 *   - Waveform canvas visualizer
 *   - Scale practice mode (sequential swar training)
 * ============================================================
 */

// ─── Indian Swar Definitions ──────────────────────────────────
// Each swar maps to a reference Western note and its standard
// frequency in the "Sa = C4" convention used for bamboo flute.
const SWARS = [
  { name: 'Sa',  western: 'C4',  freq: 261.63 },
  { name: 'Re',  western: 'D4',  freq: 293.66 },
  { name: 'Ga',  western: 'E4',  freq: 329.63 },
  { name: 'Ma',  western: 'F4',  freq: 349.23 },
  { name: 'Pa',  western: 'G4',  freq: 392.00 },
  { name: 'Dha', western: 'A4',  freq: 440.00 },
  { name: 'Ni',  western: 'B4',  freq: 493.88 },
];

// Tolerance (in cents) to consider a note "in tune"
const CENTS_THRESHOLD = 25;

// ─── DOM References ───────────────────────────────────────────
const startStopBtn    = document.getElementById('startStopBtn');
const btnIcon         = document.getElementById('btnIcon');
const btnText         = document.getElementById('btnText');
const micHint         = document.getElementById('micHint');
const swarNameEl      = document.getElementById('swarName');
const westernNoteEl   = document.getElementById('westernNote');
const freqDisplayEl   = document.getElementById('freqDisplay');
const feedbackEl      = document.getElementById('feedbackText');
const tunerNeedle     = document.getElementById('tunerNeedle');
const tunerCentsEl    = document.getElementById('tunerCents');
const tunerStatusEl   = document.getElementById('tunerStatus');
const scaleModeToggle = document.getElementById('scaleModeToggle');
const scaleNotesEl    = document.getElementById('scaleNotes');
const scaleProgressEl = document.getElementById('scaleProgress');
const targetNoteNameEl= document.getElementById('targetNoteName');
const scaleProgressBar= document.getElementById('scaleProgressBar');
const waveformCanvas  = document.getElementById('waveformCanvas');
const ctx2d           = waveformCanvas.getContext('2d');

// ─── State ───────────────────────────────────────────────────
let audioContext   = null;
let analyser       = null;
let mediaStream    = null;
let animFrameId    = null;
let isRunning      = false;

// Scale practice state
let scaleModeActive  = false;
let scaleIndex       = 0;          // which swar we're currently expecting
let matchHoldTimer   = null;       // timer to advance after holding a note
const HOLD_MS        = 800;        // ms the player must hold the correct note

// ─── Build Scale Notes UI ─────────────────────────────────────
function buildScaleUI() {
  scaleNotesEl.innerHTML = '';
  SWARS.forEach((swar, i) => {
    const btn = document.createElement('div');
    btn.className = 'swar-btn';
    btn.id = `swar-${i}`;
    btn.innerHTML = `
      <span class="swar-btn__name">${swar.name}</span>
      <span class="swar-btn__western">${swar.western}</span>
    `;
    scaleNotesEl.appendChild(btn);
  });
}
buildScaleUI();

// ─── Toggle Scale Mode ────────────────────────────────────────
scaleModeToggle.addEventListener('change', () => {
  scaleModeActive = scaleModeToggle.checked;
  scaleProgressEl.style.display = scaleModeActive ? 'block' : 'none';
  if (scaleModeActive) {
    scaleIndex = 0;
    updateScaleTarget();
  } else {
    clearScaleHighlights();
  }
});

function updateScaleTarget() {
  clearScaleHighlights();
  // Highlight the current target swar
  const target = SWARS[scaleIndex];
  document.getElementById(`swar-${scaleIndex}`).classList.add('active');
  targetNoteNameEl.textContent = target.name;
  // Update progress bar
  const pct = (scaleIndex / SWARS.length) * 100;
  scaleProgressBar.style.width = pct + '%';
}

function clearScaleHighlights() {
  SWARS.forEach((_, i) => {
    const el = document.getElementById(`swar-${i}`);
    el.classList.remove('active', 'matched');
  });
}

// ─── Start / Stop Button ──────────────────────────────────────
startStopBtn.addEventListener('click', () => {
  if (isRunning) stopPractice();
  else startPractice();
});

async function startPractice() {
  try {
    // Request microphone permission
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // Create Web Audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(mediaStream);

    // Analyser node — used for both waveform draw and pitch detection
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;           // must be power of 2; higher = better pitch resolution
    source.connect(analyser);

    isRunning = true;
    startStopBtn.classList.add('active');
    btnIcon.textContent  = '■';
    btnText.textContent  = 'STOP PRACTICE';
    micHint.textContent  = 'Microphone active — play your bansuri!';

    // Kick off the audio loop
    audioLoop();

  } catch (err) {
    micHint.textContent = '⚠ Microphone access denied. Please allow and try again.';
    console.error('Mic error:', err);
  }
}

function stopPractice() {
  isRunning = false;
  cancelAnimationFrame(animFrameId);

  // Stop microphone tracks
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  if (audioContext) audioContext.close();

  startStopBtn.classList.remove('active');
  btnIcon.textContent = '▶';
  btnText.textContent = 'START PRACTICE';
  micHint.textContent = 'Allow microphone access when prompted';

  // Reset displays
  swarNameEl.textContent  = '—';
  westernNoteEl.textContent = '—';
  freqDisplayEl.textContent = '— Hz';
  feedbackEl.textContent  = '—';
  tunerCentsEl.textContent = '0¢';
  tunerStatusEl.textContent = '—';
  setNeedleAngle(0);
  drawIdleWaveform();
}

// ─── Main Audio Loop ──────────────────────────────────────────
function audioLoop() {
  if (!isRunning) return;

  const bufferLength = analyser.fftSize;
  const timeDomainData = new Float32Array(bufferLength);
  analyser.getFloatTimeDomainData(timeDomainData);

  // Draw waveform on canvas
  drawWaveform(timeDomainData);

  // Detect pitch via autocorrelation
  const detectedFreq = autoCorrelate(timeDomainData, audioContext.sampleRate);

  if (detectedFreq > 0) {
    // Find nearest swar
    const { swar, cents } = findNearestSwar(detectedFreq);

    // Update displays
    swarNameEl.textContent   = swar.name;
    westernNoteEl.textContent = swar.western;
    freqDisplayEl.textContent = detectedFreq.toFixed(1) + ' Hz';

    // Tuning meter
    updateTuner(cents);

    // Feedback
    const inTune = Math.abs(cents) <= CENTS_THRESHOLD;
    swarNameEl.className   = inTune ? 'note-card__swarname correct' : 'note-card__swarname wrong';
    feedbackEl.textContent = inTune ? '✔ Correct' : '✖ Try Again';
    feedbackEl.className   = inTune ? 'correct' : 'wrong';

    // Scale mode logic
    if (scaleModeActive && inTune) {
      handleScaleMatch(swar);
    }
  }

  animFrameId = requestAnimationFrame(audioLoop);
}

// ─── Pitch Detection: Autocorrelation ─────────────────────────
// This is a classic YIN-inspired autocorrelation approach.
// It finds the fundamental frequency from the time-domain signal.
function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;

  // Compute RMS to check if there's actual sound (not silence)
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // too quiet — return no pitch

  // Find the first zero crossing going downward
  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  }

  // Slice the buffer to the zero-crossing window
  const buf2 = buffer.slice(r1, r2);
  const c = new Array(buf2.length).fill(0);

  // Autocorrelation: correlate signal with itself at different lags
  for (let i = 0; i < buf2.length; i++) {
    for (let j = 0; j < buf2.length - i; j++) {
      c[i] += buf2[j] * buf2[j + i];
    }
  }

  // Find the first trough (dip) after the zero
  let d = 0;
  while (d < c.length && c[d] > c[d + 1]) d++;

  // Now find the first peak after the trough
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < c.length; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }

  // Parabolic interpolation for sub-sample accuracy
  let T0 = maxPos;
  if (maxPos > 0 && maxPos < c.length - 1) {
    const x1 = c[maxPos - 1], x2 = c[maxPos], x3 = c[maxPos + 1];
    T0 = maxPos + (x3 - x1) / (2 * (2 * x2 - x1 - x3));
  }

  return sampleRate / T0;
}

// ─── Find Nearest Swar + Cents Deviation ─────────────────────
// Cents measure how far a frequency is from the nearest note:
// 100 cents = 1 semitone. Formula: cents = 1200 * log2(f / f_ref)
function findNearestSwar(freq) {
  let bestSwar = SWARS[0];
  let bestCents = Infinity;

  for (const swar of SWARS) {
    // Also check octave-shifted versions (flute can play in different octaves)
    for (let octave = -1; octave <= 2; octave++) {
      const refFreq = swar.freq * Math.pow(2, octave);
      const cents   = 1200 * Math.log2(freq / refFreq);
      if (Math.abs(cents) < Math.abs(bestCents)) {
        bestCents = cents;
        bestSwar  = swar;
      }
    }
  }

  return { swar: bestSwar, cents: bestCents };
}

// ─── Tuning Meter Needle ──────────────────────────────────────
// Maps cents deviation (±50) to an arc angle (±80 degrees)
function updateTuner(cents) {
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const angleDeg = (clampedCents / 50) * 80; // ±80° from center
  setNeedleAngle(angleDeg);

  tunerCentsEl.textContent = (cents >= 0 ? '+' : '') + Math.round(cents) + '¢';

  const inTune = Math.abs(cents) <= CENTS_THRESHOLD;
  if (inTune) {
    tunerStatusEl.textContent = 'IN TUNE';
    tunerStatusEl.style.color = 'var(--teal)';
  } else if (cents < 0) {
    tunerStatusEl.textContent = 'FLAT';
    tunerStatusEl.style.color = 'var(--red)';
  } else {
    tunerStatusEl.textContent = 'SHARP';
    tunerStatusEl.style.color = 'var(--blue)';
  }
}

function setNeedleAngle(deg) {
  tunerNeedle.style.transform = `rotate(${deg}deg)`;
}

// ─── Waveform Canvas Drawing ──────────────────────────────────
function resizeCanvas() {
  waveformCanvas.width  = waveformCanvas.offsetWidth;
  waveformCanvas.height = waveformCanvas.offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawWaveform(data) {
  const W = waveformCanvas.width;
  const H = waveformCanvas.height;

  // Fade effect — draw semi-transparent black over previous frame
  ctx2d.fillStyle = 'rgba(6,6,15,0.35)';
  ctx2d.fillRect(0, 0, W, H);

  ctx2d.lineWidth   = 2;
  ctx2d.strokeStyle = '#06d6a0';
  ctx2d.shadowColor = '#06d6a0';
  ctx2d.shadowBlur  = 8;

  ctx2d.beginPath();
  const sliceWidth = W / data.length;
  let x = 0;

  for (let i = 0; i < data.length; i++) {
    const v = data[i];         // value between -1 and 1
    const y = (v * 0.8 + 1) / 2 * H;  // map to canvas height

    if (i === 0) ctx2d.moveTo(x, y);
    else         ctx2d.lineTo(x, y);

    x += sliceWidth;
  }

  ctx2d.lineTo(W, H / 2);
  ctx2d.stroke();
  ctx2d.shadowBlur = 0;
}

function drawIdleWaveform() {
  // Draw a flat line when not active
  const W = waveformCanvas.width;
  const H = waveformCanvas.height;
  ctx2d.clearRect(0, 0, W, H);
  ctx2d.lineWidth   = 1.5;
  ctx2d.strokeStyle = 'rgba(6,214,160,0.2)';
  ctx2d.beginPath();
  ctx2d.moveTo(0, H / 2);
  ctx2d.lineTo(W, H / 2);
  ctx2d.stroke();
}
drawIdleWaveform();

// ─── Scale Practice Logic ─────────────────────────────────────
function handleScaleMatch(detectedSwar) {
  const targetSwar = SWARS[scaleIndex];
  if (detectedSwar.name !== targetSwar.name) {
    clearTimeout(matchHoldTimer);
    matchHoldTimer = null;
    return;
  }

  // Player is on the right note — start hold timer if not already
  if (!matchHoldTimer) {
    matchHoldTimer = setTimeout(() => {
      matchHoldTimer = null;
      // Mark current swar as matched
      document.getElementById(`swar-${scaleIndex}`).classList.remove('active');
      document.getElementById(`swar-${scaleIndex}`).classList.add('matched');

      scaleIndex++;

      if (scaleIndex >= SWARS.length) {
        // Completed the full scale!
        scaleProgressBar.style.width = '100%';
        targetNoteNameEl.textContent  = '🎉 Complete!';
        setTimeout(() => {
          // Reset for next round
          scaleIndex = 0;
          updateScaleTarget();
        }, 2000);
      } else {
        updateScaleTarget();
      }
    }, HOLD_MS);
  }
}
