/* ==========================================================================
   SnapPuzzle Application Engine
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE VARIABLES ---
    let cameraStream = null;
    let currentPhotoDataUrl = null;
    let rawPhotoDataUrl = null;
    let selectedGridSize = 3; // 3x3 default
    let puzzleMode = 'sliding'; // 'sliding' or 'jigsaw'
    let soundEnabled = true;
    let masterVolume = parseFloat(localStorage.getItem('snappuzzle_master_volume')) ?? 0.8;
    if (isNaN(masterVolume)) masterVolume = 0.8;
    let isMirrored = true;
    let rotationAngle = 0;
    let flipH = false;
    let flipV = false;
    let stampedWatermarkText = null;
    let stampedWatermarkPos = 'bottom-right';
    let stampedWatermarkFont = 'Outfit';
    let stampedWatermarkColor = '#6366f1';
    
    let timerMode = 'stopwatch'; // 'stopwatch' or 'countdown'
    let timeAttackDuration = 90;
    let remainingSeconds = 90;
    
    let isAutoSolving = false;
    let autoSolveTimer = null;

    // Cutout Shape & AI Rival State
    let selectedShape = 'square'; // 'square', 'rounded', 'hexagon', 'diamond', 'cyber'
    let isAiRivalActive = false;
    let aiRivalLevel = 'medium'; // 'easy', 'medium', 'hard'
    let aiRivalProgress = 0;
    let aiRivalTimer = null;
    let aiRivalSolvedCount = 0;
    
    // Game state
    let tiles = []; // Array of tile objects { id, currentPos, correctPos, empty }
    let movesCount = 0;
    let gameTimer = null;
    let secondsElapsed = 0;
    let isGameActive = false;
    let showTileNumbers = false;
    let moveHistory = [];

    // Replay State
    let recordedInitialTilesState = [];
    let fullRecordedMoves = [];
    let isReplaying = false;
    let replayCurrentStep = 0;
    let replaySpeed = 1;
    let replayTimer = null;



    // --- DOM ELEMENTS ---
    const videoEl = document.getElementById('webcamVideo');
    const canvasEl = document.getElementById('snapshotCanvas');
    const countdownEl = document.getElementById('cameraCountdown');
    const filterSelect = document.getElementById('filterSelect');
    const mirrorToggleBtn = document.getElementById('mirrorToggleBtn');
    const snapPhotoBtn = document.getElementById('snapPhotoBtn');
    
    const brightnessSlider = document.getElementById('brightnessSlider');
    const contrastSlider = document.getElementById('contrastSlider');
    const saturationSlider = document.getElementById('saturationSlider');
    
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const browseFileBtn = document.getElementById('browseFileBtn');
    
    const captureSection = document.getElementById('captureSection');
    const configSection = document.getElementById('configSection');
    const gameSection = document.getElementById('gameSection');
    
    const photoPreviewImg = document.getElementById('photoPreviewImg');
    const ghostImg = document.getElementById('ghostImg');
    const ghostOverlay = document.getElementById('ghostOverlay');
    
    const startPuzzleBtn = document.getElementById('startPuzzleBtn');
    const reTakeBtn = document.getElementById('reTakeBtn');
    const puzzleBoard = document.getElementById('puzzleBoard');
    
    const headerStats = document.getElementById('headerStats');
    const timerDisplay = document.getElementById('timerDisplay');
    const moveDisplay = document.getElementById('moveDisplay');
    const resetAppBtn = document.getElementById('resetAppBtn');
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    
    const toggleGhostBtn = document.getElementById('toggleGhostBtn');
    const peekGhostBtn = document.getElementById('ghostOpacitySlider') ? document.getElementById('peekGhostBtn') : null;
    const ghostOpacitySlider = document.getElementById('ghostOpacitySlider');
    const toggleNumbersBtn = document.getElementById('toggleNumbersBtn');
    const undoBtn = document.getElementById('undoBtn');
    const hintBtn = document.getElementById('hintBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');
    
    const victoryModal = document.getElementById('victoryModal');
    const finalTime = document.getElementById('finalTime');

    // Replay DOM Elements
    const replayModal = document.getElementById('replayModal');
    const closeReplayBtn = document.getElementById('closeReplayBtn');
    const replayStepText = document.getElementById('replayStepText');
    const replaySpeedBadge = document.getElementById('replaySpeedBadge');
    const replayScrubber = document.getElementById('replayScrubber');
    const replayBoard = document.getElementById('replayBoard');
    const replayStepBackBtn = document.getElementById('replayStepBackBtn');
    const replayTogglePlayBtn = document.getElementById('replayTogglePlayBtn');
    const replayStepForwardBtn = document.getElementById('replayStepForwardBtn');
    const replaySpeedBtn = document.getElementById('replaySpeedBtn');
    const replayResetBtn = document.getElementById('replayResetBtn');
    const replayMovesBtn = document.getElementById('replayMovesBtn');
    const replayToolbarBtn = document.getElementById('replayToolbarBtn');

    const finalMoves = document.getElementById('finalMoves');
    const finalStars = document.getElementById('finalStars');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const newPhotoBtn = document.getElementById('newPhotoBtn');

    // Daily Challenge DOM Elements
    let isDailyChallenge = false;
    const dailyChallengeBtn = document.getElementById('dailyChallengeBtn');
    const dailyStreakBadge = document.getElementById('dailyStreakBadge');
    const dailyChallengeModal = document.getElementById('dailyChallengeModal');
    const closeDailyChallengeBtn = document.getElementById('closeDailyChallengeBtn');
    const startDailyChallengeBtn = document.getElementById('startDailyChallengeBtn');
    const dailyDateBadge = document.getElementById('dailyDateBadge');
    const dailyStreakText = document.getElementById('dailyStreakText');
    const dailyObjectiveText = document.getElementById('dailyObjectiveText');

    // --- WEB AUDIO SYNTHESIZER ---
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;
    let soundPreset = localStorage.getItem('snappuzzle_sound_preset') || 'synth';

    const soundPresetSelect = document.getElementById('soundPresetSelect');
    if (soundPresetSelect) {
        soundPresetSelect.value = soundPreset;
        soundPresetSelect.addEventListener('change', (e) => {
            soundPreset = e.target.value;
            localStorage.setItem('snappuzzle_sound_preset', soundPreset);
            playSound('click');
        });
    }

    let voiceAnnouncerEnabled = localStorage.getItem('snappuzzle_voice_announcer') !== 'false';
    const toggleVoiceAnnouncerBtn = document.getElementById('toggleVoiceAnnouncerBtn');
    if (toggleVoiceAnnouncerBtn) {
        toggleVoiceAnnouncerBtn.textContent = voiceAnnouncerEnabled ? '🎙️ Voice: ON' : '🎙️ Voice: Off';
        toggleVoiceAnnouncerBtn.addEventListener('click', () => {
            voiceAnnouncerEnabled = !voiceAnnouncerEnabled;
            localStorage.setItem('snappuzzle_voice_announcer', voiceAnnouncerEnabled);
            toggleVoiceAnnouncerBtn.textContent = voiceAnnouncerEnabled ? '🎙️ Voice: ON' : '🎙️ Voice: Off';
            playSound('click');
            if (voiceAnnouncerEnabled) speakVoiceAnnouncements('Voice Coach Enabled!');
        });
    }

    function speakVoiceAnnouncements(text) {
        if (!voiceAnnouncerEnabled || !('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.15;
            utterance.pitch = 1.1;
            utterance.volume = Math.min(1, masterVolume * 0.9);
            window.speechSynthesis.speak(utterance);
        } catch(e) {}
    }

    // --- AMBIENT MUSIC ENGINE ---
    let musicTrack = localStorage.getItem('snappuzzle_music_track') || 'off';
    let musicInterval = null;
    let musicStepIndex = 0;

    const musicTrackSelect = document.getElementById('musicTrackSelect');
    if (musicTrackSelect) {
        musicTrackSelect.value = musicTrack;
        musicTrackSelect.addEventListener('change', (e) => {
            musicTrack = e.target.value;
            localStorage.setItem('snappuzzle_music_track', musicTrack);
            stopAmbientMusic();
            if (musicTrack !== 'off') {
                startAmbientMusic();
            }
        });
    }

    let musicPitchScale = 1.0;
    const musicPitchSlider = document.getElementById('musicPitchSlider');
    if (musicPitchSlider) {
        musicPitchSlider.addEventListener('input', (e) => {
            musicPitchScale = parseFloat(e.target.value) / 100;
        });
    }

    function startAmbientMusic() {
        stopAmbientMusic();
        if (musicTrack === 'off') return;
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        musicStepIndex = 0;
        
        const tracks = {
            cyber: [
                { notes: [130.81, 164.81, 196.00], duration: 0.6, type: 'sawtooth', filterCutoff: 600 },
                { notes: [174.61, 220.00, 261.63], duration: 0.6, type: 'sawtooth', filterCutoff: 700 },
                { notes: [146.83, 174.61, 220.00], duration: 0.6, type: 'sawtooth', filterCutoff: 650 },
                { notes: [196.00, 246.94, 293.66], duration: 0.6, type: 'sawtooth', filterCutoff: 800 }
            ],
            lofi: [
                { notes: [261.63, 329.63, 392.00, 493.88], duration: 0.8, type: 'sine', filterCutoff: 500 },
                { notes: [220.00, 261.63, 329.63, 392.00], duration: 0.8, type: 'sine', filterCutoff: 450 },
                { notes: [174.61, 220.00, 261.63, 329.63], duration: 0.8, type: 'sine', filterCutoff: 500 },
                { notes: [196.00, 246.94, 293.66, 349.23], duration: 0.8, type: 'sine', filterCutoff: 450 }
            ],
            arcade: [
                { notes: [523.25], duration: 0.2, type: 'square' },
                { notes: [659.25], duration: 0.2, type: 'square' },
                { notes: [783.99], duration: 0.2, type: 'square' },
                { notes: [1046.50], duration: 0.2, type: 'square' }
            ],
            space: [
                { notes: [65.41, 130.81, 196.00], duration: 1.4, type: 'sine', filterCutoff: 350 },
                { notes: [87.31, 174.61, 261.63], duration: 1.4, type: 'sine', filterCutoff: 400 },
                { notes: [98.00, 196.00, 293.66], duration: 1.4, type: 'sine', filterCutoff: 380 }
            ],
            rain: [
                { notes: [110.00, 164.81, 220.00], duration: 1.2, type: 'triangle', filterCutoff: 450 },
                { notes: [130.81, 196.00, 261.63], duration: 1.2, type: 'triangle', filterCutoff: 500 },
                { notes: [146.83, 220.00, 293.66], duration: 1.2, type: 'triangle', filterCutoff: 480 }
            ]
        };

        const currentSeq = tracks[musicTrack] || tracks.cyber;
        const stepTime = musicTrack === 'arcade' ? 300 : (musicTrack === 'space' || musicTrack === 'rain' ? 1400 : 1200);

        musicInterval = setInterval(() => {
            if (!soundEnabled || musicTrack === 'off') return;
            try {
                if (!audioCtx) audioCtx = new AudioCtx();
                if (audioCtx.state === 'suspended') audioCtx.resume();
                const step = currentSeq[musicStepIndex % currentSeq.length];
                musicStepIndex++;

                const now = audioCtx.currentTime;
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime((step.filterCutoff || 800) * musicPitchScale, now);

                const masterGain = audioCtx.createGain();
                masterGain.gain.setValueAtTime(0.03 * masterVolume, now);
                masterGain.gain.linearRampToValueAtTime(0.001 * masterVolume, now + step.duration);

                filter.connect(masterGain);
                masterGain.connect(audioCtx.destination);

                step.notes.forEach(freq => {
                    const osc = audioCtx.createOscillator();
                    osc.type = step.type || 'sine';
                    osc.frequency.setValueAtTime(freq * musicPitchScale, now);
                    osc.connect(filter);
                    osc.start(now);
                    osc.stop(now + step.duration);
                });
            } catch (err) {
                console.warn('Ambient music error:', err);
            }
        }, stepTime);
    }

    function stopAmbientMusic() {
        if (musicInterval) {
            clearInterval(musicInterval);
            musicInterval = null;
        }
    }

    document.addEventListener('click', () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (musicTrack !== 'off' && !musicInterval) {
            startAmbientMusic();
        }
    }, { once: true });

    function getWaveType() {
        if (soundPreset === 'arcade') return 'square';
        if (soundPreset === 'chime') return 'triangle';
        return 'sine'; // synth
    }

    let customMicAudioUrl = localStorage.getItem('snappuzzle_custom_mic_audio') || null;

    function playSound(type) {
        if (!soundEnabled || masterVolume <= 0) return;
        if (type === 'snap' && customMicAudioUrl) {
            try {
                const customAudio = new Audio(customMicAudioUrl);
                customAudio.volume = masterVolume;
                customAudio.play();
                return;
            } catch(e) {}
        }
        try {
            if (!audioCtx) audioCtx = new AudioCtx();
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const wave = getWaveType();
            const now = audioCtx.currentTime;

            if (type === 'click') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = wave;
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
                gain.gain.setValueAtTime(0.15 * masterVolume, now);
                gain.gain.linearRampToValueAtTime(0.01 * masterVolume, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'snap') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = timerMode === 'zen' ? 'sine' : wave;
                osc.connect(gain);
                gain.connect(audioCtx.destination);

                if (timerMode === 'zen') {
                    // Solfeggio 528Hz Transformation & Miracle Tone for Zen mode
                    const zenTones = [432, 528, 639, 741];
                    const freq = zenTones[Math.floor(Math.random() * zenTones.length)];
                    osc.frequency.setValueAtTime(freq, now);
                    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.35);
                    gain.gain.setValueAtTime(0.12 * masterVolume, now);
                    gain.gain.exponentialRampToValueAtTime(0.001 * masterVolume, now + 0.35);
                    osc.start(now);
                    osc.stop(now + 0.35);
                } else {
                    osc.frequency.setValueAtTime(523.25, now); // C5
                    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
                    gain.gain.setValueAtTime(0.2 * masterVolume, now);
                    gain.gain.linearRampToValueAtTime(0.01 * masterVolume, now + 0.12);
                    osc.start(now);
                    osc.stop(now + 0.12);
                }
            } else if (type === 'win') {
                // Play major chord fanfare
                [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                    const o = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    o.type = wave;
                    o.connect(g);
                    g.connect(audioCtx.destination);
                    o.frequency.setValueAtTime(freq, now + i * 0.1);
                    g.gain.setValueAtTime(0.2 * masterVolume, now + i * 0.1);
                    g.gain.linearRampToValueAtTime(0.01 * masterVolume, now + i * 0.1 + 0.4);
                    o.start(now + i * 0.1);
                    o.stop(now + i * 0.1 + 0.4);
                });
            } else if (type === 'achievement') {
                // Upward arpeggio fanfare for achievement unlock
                [523.25, 659.25, 783.99, 987.77, 1046.50].forEach((freq, i) => {
                    const o = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    o.type = wave;
                    o.connect(g);
                    g.connect(audioCtx.destination);
                    o.frequency.setValueAtTime(freq, now + i * 0.07);
                    g.gain.setValueAtTime(0.2, now + i * 0.07);
                    g.gain.linearRampToValueAtTime(0.01, now + i * 0.07 + 0.3);
                    o.start(now + i * 0.07);
                    o.stop(now + i * 0.07 + 0.3);
                });
            }
        } catch (e) {
            console.log('Audio playback error:', e);
        }
    }

    // --- TAB SWITCHER LOGIC ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab + 'Tab';
            document.getElementById(tabId).classList.add('active');

            if (btn.dataset.tab === 'camera') {
                startWebcam();
            } else {
                stopWebcam();
            }
        });
    });

    // --- WEBCAM MANAGEMENT ---
    async function startWebcam() {
        if (cameraStream) return;
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: 'user' },
                audio: false
            });
            videoEl.srcObject = cameraStream;
        } catch (err) {
            console.warn('Webcam access error:', err);
            // Fallback user notification if camera denied
        }
    }

    function stopWebcam() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
    }

    // Mirror flip toggle
    if (mirrorToggleBtn) {
        mirrorToggleBtn.addEventListener('click', () => {
            isMirrored = !isMirrored;
            videoEl.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
            mirrorToggleBtn.style.background = isMirrored ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)';
            playSound('click');
        });
    }

    // Filter change
    filterSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        let filterCSS = 'none';
        if (val === 'cyberpunk') filterCSS = 'hue-rotate(180deg) saturate(200%) contrast(120%)';
        else if (val === 'vintage') filterCSS = 'sepia(80%) contrast(110%) brightness(90%)';
        else if (val === 'vivid') filterCSS = 'saturate(250%) contrast(125%)';
        else if (val === 'grayscale') filterCSS = 'grayscale(100%) contrast(130%)';
        else if (val === 'neon') filterCSS = 'invert(100%) hue-rotate(240deg) saturate(300%)';
        else if (val === 'tealorange') filterCSS = 'contrast(130%) saturate(160%) hue-rotate(-20deg)';
        else if (val === 'retro70s') filterCSS = 'sepia(45%) contrast(90%) brightness(105%) saturate(120%)';
        else if (val === 'vaporwave') filterCSS = 'hue-rotate(260deg) saturate(220%) contrast(140%)';
        else if (val === 'pastel') filterCSS = 'brightness(115%) saturate(85%) contrast(95%)';
        else if (val === 'amber') filterCSS = 'sepia(100%) hue-rotate(-30deg) saturate(280%)';
        videoEl.style.filter = filterCSS;
    });

    // Snap Photo with Countdown
    snapPhotoBtn.addEventListener('click', () => {
        let count = 3;
        countdownEl.textContent = count;
        countdownEl.style.display = 'flex';

        const timer = setInterval(() => {
            count--;
            if (count > 0) {
                countdownEl.textContent = count;
                playSound('click');
            } else {
                clearInterval(timer);
                countdownEl.style.display = 'none';
                captureSnapshot();
            }
        }, 800);
    });

    function captureSnapshot() {
        playSound('snap');
        const ctx = canvasEl.getContext('2d');
        canvasEl.width = videoEl.videoWidth || 640;
        canvasEl.height = videoEl.videoHeight || 480;

        // Apply chosen filter onto canvas context
        ctx.filter = getComputedStyle(videoEl).filter;

        if (isMirrored) {
            ctx.translate(canvasEl.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

        rawPhotoDataUrl = canvasEl.toDataURL('image/jpeg', 0.95);
        currentPhotoDataUrl = rawPhotoDataUrl;
        motionFrames = [];
        showConfigSection();
    }

    let motionFrames = [];
    let isMotionRecording = false;
    let motionFrameInterval = null;
    let livingTileAnimInterval = null;

    const recordMotionBtn = document.getElementById('recordMotionBtn');
    if (recordMotionBtn) {
        recordMotionBtn.addEventListener('click', () => {
            if (isMotionRecording) return;
            isMotionRecording = true;
            recordMotionBtn.style.background = '#ef4444';
            recordMotionBtn.textContent = '⏺️ Recording (2.5s)...';
            playSound('click');

            motionFrames = [];
            let count = 0;
            const maxFrames = 10;

            motionFrameInterval = setInterval(() => {
                captureFrameToMotionArray();
                count++;
                if (count >= maxFrames) {
                    clearInterval(motionFrameInterval);
                    isMotionRecording = false;
                    recordMotionBtn.style.background = '';
                    recordMotionBtn.textContent = '🎥 Living Motion Snap';
                    if (motionFrames.length > 0) {
                        rawPhotoDataUrl = motionFrames[0];
                        currentPhotoDataUrl = rawPhotoDataUrl;
                        showConfigSection();
                        playSound('snap');
                        showToast('🎥 10-Frame Living Motion Loop Captured!', 'Motion Studio');
                    }
                }
            }, 250);
        });
    }

    function captureFrameToMotionArray() {
        if (!videoEl || !canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        canvasEl.width = videoEl.videoWidth || 640;
        canvasEl.height = videoEl.videoHeight || 480;
        ctx.filter = getComputedStyle(videoEl).filter;
        if (isMirrored) {
            ctx.translate(canvasEl.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        motionFrames.push(canvasEl.toDataURL('image/jpeg', 0.9));
    }

    function startLivingTileMotionLoop() {
        stopLivingTileMotionLoop();
        if (!motionFrames || motionFrames.length === 0) return;

        let frameIdx = 0;
        livingTileAnimInterval = setInterval(() => {
            if (!isGameActive) return;
            frameIdx = (frameIdx + 1) % motionFrames.length;
            currentPhotoDataUrl = motionFrames[frameIdx];

            document.querySelectorAll('.puzzle-tile').forEach(tileDiv => {
                if (!tileDiv.classList.contains('empty-tile')) {
                    tileDiv.style.backgroundImage = `url(${currentPhotoDataUrl})`;
                }
            });
        }, 220);
    }

    function stopLivingTileMotionLoop() {
        if (livingTileAnimInterval) {
            clearInterval(livingTileAnimInterval);
            livingTileAnimInterval = null;
        }
    }

    // --- UPLOAD & SAMPLE PHOTO HANDLING ---
    browseFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                rawPhotoDataUrl = evt.target.result;
                currentPhotoDataUrl = rawPhotoDataUrl;
                showConfigSection();
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Procedural CORS-safe canvas generator for sample cards
    function generateSampleArtDataUrl(type) {
        const c = document.createElement('canvas');
        c.width = 640;
        c.height = 480;
        const ctx = c.getContext('2d');

        if (type === 'cyberpunk') {
            const grad = ctx.createLinearGradient(0, 0, 640, 480);
            grad.addColorStop(0, '#0f0c29');
            grad.addColorStop(0.5, '#302b63');
            grad.addColorStop(1, '#24243e');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 640, 480);

            const sunGrad = ctx.createRadialGradient(320, 240, 10, 320, 240, 140);
            sunGrad.addColorStop(0, '#ff007f');
            sunGrad.addColorStop(1, '#7928ca');
            ctx.fillStyle = sunGrad;
            ctx.beginPath(); ctx.arc(320, 240, 120, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = '#00f2fe'; ctx.lineWidth = 2;
            for (let x = 0; x <= 640; x += 40) {
                ctx.beginPath(); ctx.moveTo(x, 240); ctx.lineTo(x, 480); ctx.stroke();
            }
            for (let y = 240; y <= 480; y += 25) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke();
            }
        } else if (type === 'nature') {
            const grad = ctx.createLinearGradient(0, 0, 0, 480);
            grad.addColorStop(0, '#ff7e5f');
            grad.addColorStop(0.5, '#feb47b');
            grad.addColorStop(1, '#2c3e50');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 640, 480);

            ctx.fillStyle = '#1a252f';
            ctx.beginPath();
            ctx.moveTo(0, 480); ctx.lineTo(160, 280); ctx.lineTo(320, 480); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(200, 480); ctx.lineTo(440, 220); ctx.lineTo(640, 480); ctx.fill();

            ctx.fillStyle = '#fff7ad';
            ctx.beginPath(); ctx.arc(440, 180, 50, 0, Math.PI * 2); ctx.fill();
        } else {
            const grad = ctx.createRadialGradient(320, 240, 20, 320, 240, 350);
            grad.addColorStop(0, '#00c6ff');
            grad.addColorStop(0.5, '#0072ff');
            grad.addColorStop(1, '#0a0a23');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 640, 480);

            for (let i = 0; i < 40; i++) {
                ctx.fillStyle = `hsla(${i * 12}, 85%, 65%, 0.35)`;
                ctx.beginPath();
                ctx.arc(Math.sin(i) * 200 + 320, Math.cos(i) * 150 + 240, 20 + i * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        return c.toDataURL('image/jpeg', 0.9);
    }

    // Sample cards click handler
    document.querySelectorAll('.sample-card').forEach(card => {
        card.addEventListener('click', () => {
            const sampleType = card.getAttribute('data-sample') || 'cyberpunk';
            const img = card.querySelector('img');
            
            // Try to use image source or fallback to procedural CORS-safe art
            try {
                if (img && img.complete && img.naturalWidth !== 0) {
                    rawPhotoDataUrl = img.src;
                } else {
                    rawPhotoDataUrl = generateSampleArtDataUrl(sampleType);
                }
            } catch (err) {
                rawPhotoDataUrl = generateSampleArtDataUrl(sampleType);
            }
            
            currentPhotoDataUrl = rawPhotoDataUrl;
            showConfigSection();
        });
    });

    // --- DOODLE & PAINT CANVAS LOGIC ---
    const doodleCanvas = document.getElementById('doodleCanvas');
    const doodleColorInput = document.getElementById('doodleColor');
    const doodleSizeInput = document.getElementById('doodleSize');
    const doodleSizeVal = document.getElementById('doodleSizeVal');
    const doodleClearBtn = document.getElementById('doodleClearBtn');
    const doodleRandomBtn = document.getElementById('doodleRandomBtn');
    const useDoodleBtn = document.getElementById('useDoodleBtn');

    let doodleCtx = null;
    let isDrawing = false;
    let doodleMode = 'brush'; // 'brush', 'rainbow', 'glow', 'eraser'
    let hue = 0;

    if (doodleCanvas) {
        doodleCtx = doodleCanvas.getContext('2d');
        initDoodleCanvas();
    }

    function initDoodleCanvas() {
        if (!doodleCtx) return;
        // Fill default dark slate canvas background
        doodleCtx.fillStyle = '#0f172a';
        doodleCtx.fillRect(0, 0, doodleCanvas.width, doodleCanvas.height);
        
        // Add a subtle grid starter pattern
        doodleCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        doodleCtx.lineWidth = 1;
        for (let i = 40; i < doodleCanvas.width; i += 40) {
            doodleCtx.beginPath();
            doodleCtx.moveTo(i, 0);
            doodleCtx.lineTo(i, doodleCanvas.height);
            doodleCtx.stroke();
        }
        for (let j = 40; j < doodleCanvas.height; j += 40) {
            doodleCtx.beginPath();
            doodleCtx.moveTo(0, j);
            doodleCtx.lineTo(doodleCanvas.width, j);
            doodleCtx.stroke();
        }
    }

    // Swatches
    document.querySelectorAll('.preset-colors .color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            if (doodleColorInput) doodleColorInput.value = swatch.dataset.color;
            if (doodleMode === 'eraser') setDoodleMode('brush');
        });
    });

    if (doodleSizeInput && doodleSizeVal) {
        doodleSizeInput.addEventListener('input', () => {
            doodleSizeVal.textContent = doodleSizeInput.value + 'px';
        });
    }

    // Mode Buttons
    document.querySelectorAll('.doodle-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setDoodleMode(btn.dataset.mode);
        });
    });

    let selectedDoodleStamp = '🧩';

    document.querySelectorAll('.doodle-stamp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedDoodleStamp = btn.dataset.stamp;
            document.querySelectorAll('.doodle-stamp-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.stamp === selectedDoodleStamp);
            });
            setDoodleMode('stamp');
            playSound('click');
        });
    });

    function setDoodleMode(mode) {
        doodleMode = mode;
        document.querySelectorAll('.doodle-mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });
        if (mode !== 'stamp') {
            document.querySelectorAll('.doodle-stamp-btn').forEach(b => b.classList.remove('active'));
        } else {
            const activeBtn = document.querySelector(`.doodle-stamp-btn[data-stamp="${selectedDoodleStamp}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }
    }

    // Helper for mouse/touch coordinates
    function getCanvasCoords(e) {
        const rect = doodleCanvas.getBoundingClientRect();
        const scaleX = doodleCanvas.width / rect.width;
        const scaleY = doodleCanvas.height / rect.height;

        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches[0]) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function stampEmojiOnCanvas(x, y, emoji) {
        if (!doodleCtx) return;
        const brushSize = parseInt(doodleSizeInput ? doodleSizeInput.value : 10);
        const fontSize = Math.max(20, brushSize * 2.8);
        doodleCtx.save();
        doodleCtx.globalCompositeOperation = 'source-over';
        doodleCtx.font = `${fontSize}px sans-serif`;
        doodleCtx.textAlign = 'center';
        doodleCtx.textBaseline = 'middle';
        doodleCtx.shadowColor = 'rgba(0,0,0,0.5)';
        doodleCtx.shadowBlur = 8;
        doodleCtx.fillText(emoji, x, y);
        doodleCtx.restore();
    }

    function startDraw(e) {
        e.preventDefault();
        const coords = getCanvasCoords(e);
        if (doodleMode === 'stamp') {
            stampEmojiOnCanvas(coords.x, coords.y, selectedDoodleStamp);
            playSound('snap');
            return;
        }
        isDrawing = true;
        doodleCtx.beginPath();
        doodleCtx.moveTo(coords.x, coords.y);
        draw(e);
    }

    function draw(e) {
        if (!isDrawing || !doodleCtx) return;
        e.preventDefault();
        const coords = getCanvasCoords(e);
        const brushSize = parseInt(doodleSizeInput ? doodleSizeInput.value : 10);

        doodleCtx.lineWidth = brushSize;
        doodleCtx.lineCap = 'round';
        doodleCtx.lineJoin = 'round';

        if (doodleMode === 'eraser') {
            doodleCtx.globalCompositeOperation = 'source-over';
            doodleCtx.strokeStyle = '#0f172a';
            doodleCtx.shadowBlur = 0;
        } else if (doodleMode === 'rainbow') {
            doodleCtx.globalCompositeOperation = 'source-over';
            hue = (hue + 4) % 360;
            doodleCtx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
            doodleCtx.shadowBlur = 0;
        } else if (doodleMode === 'glow') {
            doodleCtx.globalCompositeOperation = 'source-over';
            const color = doodleColorInput ? doodleColorInput.value : '#6366f1';
            doodleCtx.strokeStyle = color;
            doodleCtx.shadowColor = color;
            doodleCtx.shadowBlur = brushSize * 1.5;
        } else {
            doodleCtx.globalCompositeOperation = 'source-over';
            doodleCtx.strokeStyle = doodleColorInput ? doodleColorInput.value : '#6366f1';
            doodleCtx.shadowBlur = 0;
        }

        doodleCtx.lineTo(coords.x, coords.y);
        doodleCtx.stroke();
    }

    function stopDraw() {
        if (isDrawing && doodleCtx) {
            doodleCtx.closePath();
            isDrawing = false;
        }
    }

    if (doodleCanvas) {
        doodleCanvas.addEventListener('mousedown', startDraw);
        doodleCanvas.addEventListener('mousemove', draw);
        doodleCanvas.addEventListener('mouseup', stopDraw);
        doodleCanvas.addEventListener('mouseleave', stopDraw);

        doodleCanvas.addEventListener('touchstart', startDraw, { passive: false });
        doodleCanvas.addEventListener('touchmove', draw, { passive: false });
        doodleCanvas.addEventListener('touchend', stopDraw);
    }

    if (doodleClearBtn) {
        doodleClearBtn.addEventListener('click', () => {
            initDoodleCanvas();
            playSound('click');
        });
    }

    if (doodleRandomBtn) {
        doodleRandomBtn.addEventListener('click', () => {
            generateRandomArt();
            playSound('click');
        });
    }

    function generateRandomArt() {
        if (!doodleCtx) return;
        initDoodleCanvas();
        
        // Draw colorful random geometric nodes & curves
        const colors = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ec4899', '#8b5cf6'];
        const numShapes = 12 + Math.floor(Math.random() * 10);

        for (let i = 0; i < numShapes; i++) {
            doodleCtx.save();
            const color = colors[Math.floor(Math.random() * colors.length)];
            doodleCtx.strokeStyle = color;
            doodleCtx.fillStyle = color;
            doodleCtx.globalAlpha = 0.4 + Math.random() * 0.5;
            doodleCtx.lineWidth = 3 + Math.random() * 15;

            const shapeType = Math.floor(Math.random() * 3);
            const cx = Math.random() * doodleCanvas.width;
            const cy = Math.random() * doodleCanvas.height;

            if (shapeType === 0) {
                // Glowing Circle
                const r = 20 + Math.random() * 80;
                doodleCtx.shadowColor = color;
                doodleCtx.shadowBlur = 20;
                doodleCtx.beginPath();
                doodleCtx.arc(cx, cy, r, 0, Math.PI * 2);
                doodleCtx.fill();
            } else if (shapeType === 1) {
                // Curved Swirl
                doodleCtx.beginPath();
                doodleCtx.moveTo(cx, cy);
                doodleCtx.bezierCurveTo(
                    Math.random() * doodleCanvas.width, Math.random() * doodleCanvas.height,
                    Math.random() * doodleCanvas.width, Math.random() * doodleCanvas.height,
                    Math.random() * doodleCanvas.width, Math.random() * doodleCanvas.height
                );
                doodleCtx.stroke();
            } else {
                // Starburst lines
                const rays = 8;
                const len = 40 + Math.random() * 90;
                for (let a = 0; a < Math.PI * 2; a += (Math.PI * 2) / rays) {
                    doodleCtx.beginPath();
                    doodleCtx.moveTo(cx, cy);
                    doodleCtx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
                    doodleCtx.stroke();
                }
            }
            doodleCtx.restore();
        }
    }

    if (useDoodleBtn) {
        useDoodleBtn.addEventListener('click', () => {
            if (!doodleCanvas) return;
            rawPhotoDataUrl = doodleCanvas.toDataURL('image/jpeg', 0.95);
            currentPhotoDataUrl = rawPhotoDataUrl;
            showConfigSection();
            playSound('snap');
        });
    }

    // Slider & transform photo enhancement listeners
    const rotateCwBtn = document.getElementById('rotateCwBtn');
    const flipHorizBtn = document.getElementById('flipHorizBtn');
    const flipVertBtn = document.getElementById('flipVertBtn');

    let activeStickers = [];

    function applyPhotoAdjustments() {
        if (!rawPhotoDataUrl) return;
        const b = brightnessSlider ? brightnessSlider.value : 100;
        const c = contrastSlider ? contrastSlider.value : 100;
        const s = saturationSlider ? saturationSlider.value : 100;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const ctx = canvasEl.getContext('2d');
            const origW = img.width;
            const origH = img.height;

            if (rotationAngle === 90 || rotationAngle === 270) {
                canvasEl.width = origH;
                canvasEl.height = origW;
            } else {
                canvasEl.width = origW;
                canvasEl.height = origH;
            }

            ctx.save();
            ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
            ctx.translate(canvasEl.width / 2, canvasEl.height / 2);
            ctx.rotate((rotationAngle * Math.PI) / 180);
            ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
            ctx.drawImage(img, -origW / 2, -origH / 2);
            ctx.restore();

            // Draw active stickers on canvas
            if (activeStickers.length > 0) {
                ctx.save();
                const fontSize = Math.round(Math.min(canvasEl.width, canvasEl.height) * 0.16);
                ctx.font = `${fontSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                activeStickers.forEach((st) => {
                    const x = canvasEl.width * st.xRatio;
                    const y = canvasEl.height * st.yRatio;
                    ctx.fillText(st.emoji, x, y);
                });
                ctx.restore();
            }

            // Draw watermark text if present
            if (stampedWatermarkText) {
                ctx.save();
                const fontSize = Math.round(Math.min(canvasEl.width, canvasEl.height) * 0.05);
                ctx.font = `bold ${fontSize}px ${stampedWatermarkFont}, sans-serif`;
                ctx.fillStyle = stampedWatermarkColor;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                let tx = canvasEl.width * 0.95;
                let ty = canvasEl.height * 0.95;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';

                if (stampedWatermarkPos === 'bottom-left') {
                    tx = canvasEl.width * 0.05;
                    ty = canvasEl.height * 0.95;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                } else if (stampedWatermarkPos === 'top-right') {
                    tx = canvasEl.width * 0.95;
                    ty = canvasEl.height * 0.05;
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'top';
                } else if (stampedWatermarkPos === 'top-left') {
                    tx = canvasEl.width * 0.05;
                    ty = canvasEl.height * 0.05;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                } else if (stampedWatermarkPos === 'center') {
                    tx = canvasEl.width * 0.5;
                    ty = canvasEl.height * 0.5;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                }

                ctx.fillText(stampedWatermarkText, tx, ty);
                ctx.restore();
            }

            // Apply advanced canvas FX filters if selected
            const selectedFilter = filterSelect ? filterSelect.value : 'none';
            if (['pixel', 'glitch', 'sketch', 'thermal', 'vortex', 'kaleidoscope', 'matrix', 'comic'].includes(selectedFilter)) {
                applyAdvancedCanvasFX(ctx, canvasEl.width, canvasEl.height, selectedFilter);
                unlockAchievement('pixel_artist');
            }

            currentPhotoDataUrl = canvasEl.toDataURL('image/jpeg', 0.95);
            photoPreviewImg.src = currentPhotoDataUrl;
            ghostImg.src = currentPhotoDataUrl;
        };
        img.src = rawPhotoDataUrl;
    }

    function applyAdvancedCanvasFX(ctx, width, height, filterType) {
        if (filterType === 'pixel') {
            const size = Math.max(8, Math.round(Math.min(width, height) / 32));
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            for (let y = 0; y < height; y += size) {
                for (let x = 0; x < width; x += size) {
                    const pixelIndex = (y * width + x) * 4;
                    const r = data[pixelIndex];
                    const g = data[pixelIndex + 1];
                    const b = data[pixelIndex + 2];
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(x, y, size, size);
                }
            }
        } else if (filterType === 'glitch') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            const offset = Math.round(width * 0.02);
            for (let i = 0; i < data.length; i += 4) {
                if (i + offset * 4 < data.length) {
                    data[i] = data[i + offset * 4];
                }
            }
            ctx.putImageData(imgData, 0, 0);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            for (let y = 0; y < height; y += 4) {
                ctx.fillRect(0, y, width, 2);
            }
        } else if (filterType === 'sketch') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            const w = width;
            const h = height;
            for (let y = 0; y < h - 1; y++) {
                for (let x = 0; x < w - 1; x++) {
                    const idx = (y * w + x) * 4;
                    const rightIdx = (y * w + (x + 1)) * 4;
                    const downIdx = ((y + 1) * w + x) * 4;
                    const lum1 = (data[idx] + data[idx+1] + data[idx+2]) / 3;
                    const lum2 = (data[rightIdx] + data[rightIdx+1] + data[rightIdx+2]) / 3;
                    const lum3 = (data[downIdx] + data[downIdx+1] + data[downIdx+2]) / 3;
                    const edge = Math.abs(lum1 - lum2) + Math.abs(lum1 - lum3);
                    if (edge > 25) {
                        data[idx] = 99; data[idx+1] = 102; data[idx+2] = 241;
                    } else {
                        data[idx] = 15; data[idx+1] = 23; data[idx+2] = 42;
                    }
                }
            }
            ctx.putImageData(imgData, 0, 0);
        } else if (filterType === 'thermal') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const lum = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114) / 255;
                if (lum < 0.25) {
                    data[i] = 0; data[i+1] = 0; data[i+2] = Math.round(lum * 4 * 255);
                } else if (lum < 0.5) {
                    data[i] = 0; data[i+1] = Math.round((lum - 0.25) * 4 * 255); data[i+2] = 255;
                } else if (lum < 0.75) {
                    data[i] = Math.round((lum - 0.5) * 4 * 255); data[i+1] = 255; data[i+2] = 0;
                } else {
                    data[i] = 255; data[i+1] = Math.round((1 - lum) * 4 * 255); data[i+2] = 0;
                }
            }
            ctx.putImageData(imgData, 0, 0);
        } else if (filterType === 'vortex') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            const outputData = ctx.createImageData(width, height);
            const out = outputData.data;
            const cx = width / 2;
            const cy = height / 2;
            const maxR = Math.min(width, height) / 2;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = x - cx;
                    const dy = y - cy;
                    const r = Math.sqrt(dx * dx + dy * dy);
                    let angle = Math.atan2(dy, dx);
                    if (r < maxR) {
                        const amount = (1 - r / maxR);
                        angle += amount * amount * 2.5; // Swirl angle offset
                    }
                    const sx = Math.round(cx + r * Math.cos(angle));
                    const sy = Math.round(cy + r * Math.sin(angle));

                    if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                        const srcIdx = (sy * width + sx) * 4;
                        const dstIdx = (y * width + x) * 4;
                        out[dstIdx] = data[srcIdx];
                        out[dstIdx + 1] = data[srcIdx + 1];
                        out[dstIdx + 2] = data[srcIdx + 2];
                        out[dstIdx + 3] = 255;
                    }
                }
            }
            ctx.putImageData(outputData, 0, 0);
        } else if (filterType === 'kaleidoscope') {
            // Mirror quadrant 1 into all 4 quadrants
            const halfW = Math.floor(width / 2);
            const halfH = Math.floor(height / 2);
            const qData = ctx.getImageData(0, 0, halfW, halfH);

            ctx.save();
            // Top Right
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(ctx.canvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
            ctx.restore();

            ctx.save();
            // Bottom Left
            ctx.translate(0, height);
            ctx.scale(1, -1);
            ctx.drawImage(ctx.canvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
            ctx.restore();

            ctx.save();
            // Bottom Right
            ctx.translate(width, height);
            ctx.scale(-1, -1);
            ctx.drawImage(ctx.canvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
            ctx.restore();
        } else if (filterType === 'matrix') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const lum = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
                data[i] = Math.round(lum * 0.1);
                data[i + 1] = Math.min(255, Math.round(lum * 1.3 + 30)); // Vivid Matrix green glow
                data[i + 2] = Math.round(lum * 0.2);
            }
            ctx.putImageData(imgData, 0, 0);
            // Draw digital scanlines
            ctx.fillStyle = 'rgba(0, 255, 128, 0.08)';
            for (let y = 0; y < height; y += 6) {
                ctx.fillRect(0, y, width, 3);
            }
        } else if (filterType === 'comic') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                // Color quantization to 4 posterized levels
                data[i] = Math.round(data[i] / 64) * 64;
                data[i + 1] = Math.round(data[i + 1] / 64) * 64;
                data[i + 2] = Math.round(data[i + 2] / 64) * 64;
            }
            ctx.putImageData(imgData, 0, 0);
            // Halftone Dots Overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            for (let y = 0; y < height; y += 8) {
                for (let x = 0; x < width; x += 8) {
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else if (filterType === 'tealorange') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const lum = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
                if (lum < 128) {
                    data[i] = Math.max(0, data[i] - 30);
                    data[i+1] = Math.min(255, data[i+1] + 20);
                    data[i+2] = Math.min(255, data[i+2] + 45);
                } else {
                    data[i] = Math.min(255, data[i] + 45);
                    data[i+1] = Math.min(255, data[i+1] + 20);
                    data[i+2] = Math.max(0, data[i+2] - 35);
                }
            }
            ctx.putImageData(imgData, 0, 0);
        } else if (filterType === 'retro70s') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                const noise = (Math.random() - 0.5) * 18;
                data[i] = Math.min(255, Math.max(0, (r * 0.393 + g * 0.769 + b * 0.189) * 0.8 + 40 + noise));
                data[i+1] = Math.min(255, Math.max(0, (r * 0.349 + g * 0.686 + b * 0.168) * 0.8 + 20 + noise));
                data[i+2] = Math.min(255, Math.max(0, (r * 0.272 + g * 0.534 + b * 0.131) * 0.8 + noise));
            }
            ctx.putImageData(imgData, 0, 0);
        } else if (filterType === 'vaporwave') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const lum = (data[i] + data[i+1] + data[i+2]) / 3;
                data[i] = Math.min(255, Math.round(lum * 0.8 + 80));   // Hot Pink / Magenta
                data[i+1] = Math.round(lum * 0.3);
                data[i+2] = Math.min(255, Math.round(lum * 0.9 + 70)); // Electric Purple/Blue
            }
            ctx.putImageData(imgData, 0, 0);
            ctx.fillStyle = 'rgba(236, 72, 153, 0.08)';
            for (let y = 0; y < height; y += 4) {
                ctx.fillRect(0, y, width, 1);
            }
        } else if (filterType === 'pastel') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.round(data[i] * 0.7 + 75));
                data[i+1] = Math.min(255, Math.round(data[i+1] * 0.7 + 70));
                data[i+2] = Math.min(255, Math.round(data[i+2] * 0.7 + 90));
            }
            ctx.putImageData(imgData, 0, 0);
        } else if (filterType === 'amber') {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const lum = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114) / 255;
                data[i] = Math.min(255, Math.round(lum * 255 + 40));
                data[i+1] = Math.min(255, Math.round(lum * 180));
                data[i+2] = Math.min(255, Math.round(lum * 30));
            }
            ctx.putImageData(imgData, 0, 0);
        }
    }

    if (filterSelect) filterSelect.addEventListener('change', applyPhotoAdjustments);
    if (brightnessSlider) brightnessSlider.addEventListener('input', applyPhotoAdjustments);
    if (contrastSlider) contrastSlider.addEventListener('input', applyPhotoAdjustments);
    if (saturationSlider) saturationSlider.addEventListener('input', applyPhotoAdjustments);

    if (rotateCwBtn) {
        rotateCwBtn.addEventListener('click', () => {
            rotationAngle = (rotationAngle + 90) % 360;
            playSound('click');
            applyPhotoAdjustments();
        });
    }

    if (flipHorizBtn) {
        flipHorizBtn.addEventListener('click', () => {
            flipH = !flipH;
            playSound('click');
            applyPhotoAdjustments();
        });
    }

    if (flipVertBtn) {
        flipVertBtn.addEventListener('click', () => {
            flipV = !flipV;
            playSound('click');
            applyPhotoAdjustments();
        });
    }

    const applyKaleidoscopeBtn = document.getElementById('applyKaleidoscopeBtn');
    if (applyKaleidoscopeBtn) {
        applyKaleidoscopeBtn.addEventListener('click', () => {
            if (!rawPhotoDataUrl) return;
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const kCanvas = document.createElement('canvas');
                kCanvas.width = 640;
                kCanvas.height = 640;
                const ctx = kCanvas.getContext('2d');

                const halfW = 320;
                const halfH = 320;

                ctx.drawImage(img, 0, 0, img.width / 2, img.height / 2, 0, 0, halfW, halfH);

                ctx.save();
                ctx.translate(640, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, img.width / 2, img.height / 2, 0, 0, halfW, halfH);
                ctx.restore();

                ctx.save();
                ctx.translate(0, 640);
                ctx.scale(1, -1);
                ctx.drawImage(img, 0, 0, img.width / 2, img.height / 2, 0, 0, halfW, halfH);
                ctx.restore();

                ctx.save();
                ctx.translate(640, 640);
                ctx.scale(-1, -1);
                ctx.drawImage(img, 0, 0, img.width / 2, img.height / 2, 0, 0, halfW, halfH);
                ctx.restore();

                rawPhotoDataUrl = kCanvas.toDataURL('image/jpeg', 0.95);
                currentPhotoDataUrl = rawPhotoDataUrl;
                photoPreviewImg.src = currentPhotoDataUrl;
                ghostImg.src = currentPhotoDataUrl;
                playSound('snap');
                showToast('🪞 Symmetrical Kaleidoscope pattern generated!', 'Kaleidoscope Studio');
            };
            img.src = currentPhotoDataUrl || rawPhotoDataUrl;
        });
    }

    const applyMosaicBtn = document.getElementById('applyMosaicBtn');
    if (applyMosaicBtn) {
        applyMosaicBtn.addEventListener('click', () => {
            if (!rawPhotoDataUrl) return;
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const mCanvas = document.createElement('canvas');
                mCanvas.width = 640;
                mCanvas.height = 640;
                const ctx = mCanvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 640, 640);

                const size = 16;
                const imgData = ctx.getImageData(0, 0, 640, 640);
                const data = imgData.data;

                for (let y = 0; y < 640; y += size) {
                    for (let x = 0; x < 640; x += size) {
                        const pixelIndex = (y * 640 + x) * 4;
                        const r = data[pixelIndex];
                        const g = data[pixelIndex + 1];
                        const b = data[pixelIndex + 2];

                        ctx.fillStyle = `rgb(${r},${g},${b})`;
                        ctx.fillRect(x, y, size, size);

                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x, y, size, size);
                    }
                }

                rawPhotoDataUrl = mCanvas.toDataURL('image/jpeg', 0.95);
                currentPhotoDataUrl = rawPhotoDataUrl;
                photoPreviewImg.src = currentPhotoDataUrl;
                ghostImg.src = currentPhotoDataUrl;
                playSound('snap');
                showToast('🧩 Geometric Mosaic Art generated!', 'Mosaic Studio');
            };
            img.src = currentPhotoDataUrl || rawPhotoDataUrl;
        });
    }

    // Sticker Button Listeners
    document.querySelectorAll('.sticker-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stickerEmoji = e.currentTarget.getAttribute('data-sticker');
            if (stickerEmoji) {
                const xRatio = 0.25 + Math.random() * 0.5;
                const yRatio = 0.25 + Math.random() * 0.5;
                activeStickers.push({ emoji: stickerEmoji, xRatio, yRatio });
                playSound('snap');
                applyPhotoAdjustments();
            }
        });
    });

    const clearStickersBtn = document.getElementById('clearStickersBtn');
    if (clearStickersBtn) {
        clearStickersBtn.addEventListener('click', () => {
            activeStickers = [];
            playSound('click');
            applyPhotoAdjustments();
        });
    }

    const applyWatermarkBtn = document.getElementById('applyWatermarkBtn');
    if (applyWatermarkBtn) {
        applyWatermarkBtn.addEventListener('click', () => {
            const inputVal = document.getElementById('watermarkInput').value.trim();
            if (inputVal) {
                stampedWatermarkText = inputVal;
                stampedWatermarkPos = document.getElementById('watermarkPosition').value;
                stampedWatermarkFont = document.getElementById('watermarkFont').value;
                stampedWatermarkColor = document.getElementById('watermarkColor').value;
                playSound('snap');
                applyPhotoAdjustments();
                showToast(`✍️ Watermark "${stampedWatermarkText}" stamped!`);
            }
        });
    }

    function showConfigSection() {
        stopWebcam();
        captureSection.style.display = 'none';
        configSection.style.display = 'grid';
        rotationAngle = 0;
        flipH = false;
        flipV = false;
        activeStickers = [];
        stampedWatermarkText = null;
        if (brightnessSlider) brightnessSlider.value = 100;
        if (contrastSlider) contrastSlider.value = 100;
        if (saturationSlider) saturationSlider.value = 100;
        photoPreviewImg.src = currentPhotoDataUrl;
        ghostImg.src = currentPhotoDataUrl;
        unlockAchievement('first_snap');
    }

    reTakeBtn.addEventListener('click', () => {
        configSection.style.display = 'none';
        captureSection.style.display = 'flex';
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        if (activeTab === 'camera') startWebcam();
    });

    // --- CONFIG OPTIONS (Grid & Mode) ---
    document.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.grid-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGridSize = parseInt(btn.dataset.grid);
            playSound('click');
        });
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            puzzleMode = btn.dataset.mode;
            playSound('click');
        });
    });

    document.querySelectorAll('.timer-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            timerMode = btn.dataset.timermode;
            playSound('click');
        });
    });

    // --- TILE SHAPE SELECTOR LISTENERS ---
    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedShape = btn.dataset.shape;
            playSound('click');
        });
    });

    // --- AI RIVAL SPEEDRUN CONTROLS ---
    const toggleAiRivalBtn = document.getElementById('toggleAiRivalBtn');
    const aiLevelSelect = document.getElementById('aiLevelSelect');

    if (toggleAiRivalBtn) {
        toggleAiRivalBtn.addEventListener('click', () => {
            isAiRivalActive = !isAiRivalActive;
            toggleAiRivalBtn.classList.toggle('active', isAiRivalActive);
            toggleAiRivalBtn.innerHTML = isAiRivalActive ? '<span class="mode-icon">🤖⚡</span> AI Rival: ON' : '<span class="mode-icon">🤖</span> AI Rival: Off';
            if (aiLevelSelect) aiLevelSelect.style.display = isAiRivalActive ? 'inline-block' : 'none';
            playSound('click');
        });
    }

    if (aiLevelSelect) {
        aiLevelSelect.addEventListener('change', (e) => {
            aiRivalLevel = e.target.value;
            playSound('click');
        });
    }

    let isTileRotationEnabled = false;
    const toggleRotationBtn = document.getElementById('toggleRotationBtn');
    if (toggleRotationBtn) {
        toggleRotationBtn.addEventListener('click', () => {
            isTileRotationEnabled = !isTileRotationEnabled;
            toggleRotationBtn.classList.toggle('active', isTileRotationEnabled);
            toggleRotationBtn.innerHTML = isTileRotationEnabled 
                ? '<span class="mode-icon">🔄⚡</span> Tile Rotation Challenge: ON' 
                : '<span class="mode-icon">🔄</span> Tile Rotation Challenge: Off';
            playSound('click');
        });
    }

    // --- PUZZLE ENGINE & GAMEPLAY ---
    startPuzzleBtn.addEventListener('click', () => {
        configSection.style.display = 'none';
        gameSection.style.display = 'flex';
        headerStats.style.display = 'flex';
        resetAppBtn.style.display = 'inline-flex';
        initPuzzle();
    });

    function updateUndoButtonState() {
        if (undoBtn) {
            undoBtn.disabled = moveHistory.length === 0 || !isGameActive;
        }
    }

    function formatTime(s) {
        const mins = String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0');
        const secs = String(Math.max(0, s) % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    }

    function triggerTimeUpFailure() {
        stopAutoSolve();
        clearInterval(aiRivalTimer);
        isGameActive = false;
        playSound('click');
        const victoryHeader = victoryModal.querySelector('.victory-header');
        if (victoryHeader) {
            victoryHeader.querySelector('.victory-icon').textContent = '⏰';
            victoryHeader.querySelector('h2').textContent = "Time's Up!";
            victoryHeader.querySelector('p').textContent = 'Time ran out in Time Attack mode! Give it another shot.';
        }
        finalTime.textContent = formatTime(timeAttackDuration);
        finalMoves.textContent = movesCount;
        finalStars.textContent = '❌ Failed';
        victoryModal.style.display = 'flex';
    }

    // AI Rival Speedrun Engine
    const aiRivalHud = document.getElementById('aiRivalHud');
    const aiRivalAvatar = document.getElementById('aiRivalAvatar');
    const aiRivalName = document.getElementById('aiRivalName');
    const aiRivalStatusText = document.getElementById('aiRivalStatusText');
    const aiRivalProgressBar = document.getElementById('aiRivalProgressBar');
    const aiRivalPctText = document.getElementById('aiRivalPctText');

    function initAiRival() {
        clearInterval(aiRivalTimer);
        if (!isAiRivalActive) {
            if (aiRivalHud) aiRivalHud.style.display = 'none';
            return;
        }
        if (aiRivalHud) aiRivalHud.style.display = 'flex';

        aiRivalSolvedCount = 0;
        aiRivalProgress = 0;

        const botMap = {
            easy: { name: 'Novice Cat 🐱', avatar: '🐱', interval: 3200 },
            medium: { name: 'CyberBot AI 🤖', avatar: '🤖', interval: 2000 },
            hard: { name: 'Grandmaster AI ⚡', avatar: '⚡', interval: 1100 }
        };
        const botConfig = botMap[aiRivalLevel] || botMap.medium;
        if (aiRivalName) aiRivalName.textContent = botConfig.name;
        if (aiRivalAvatar) aiRivalAvatar.textContent = botConfig.avatar;

        updateAiRivalUI();

        aiRivalTimer = setInterval(() => {
            if (!isGameActive || !isAiRivalActive) return;
            const total = selectedGridSize * selectedGridSize;
            if (aiRivalSolvedCount < total) {
                aiRivalSolvedCount++;
                aiRivalProgress = Math.round((aiRivalSolvedCount / total) * 100);
                updateAiRivalUI();

                if (aiRivalSolvedCount >= total) {
                    clearInterval(aiRivalTimer);
                    triggerAiDefeat();
                }
            }
        }, botConfig.interval);
    }

    function updateAiRivalUI() {
        if (!isAiRivalActive || !aiRivalProgressBar || !aiRivalPctText || !aiRivalStatusText) return;
        aiRivalProgressBar.style.width = `${aiRivalProgress}%`;
        aiRivalPctText.textContent = `${aiRivalProgress}%`;

        const userSolvedCount = tiles.filter(t => t.currentPos === t.correctPos).length;
        const diff = userSolvedCount - aiRivalSolvedCount;

        if (diff > 0) {
            aiRivalStatusText.textContent = `🔥 You lead by ${diff} tiles!`;
            aiRivalStatusText.style.color = '#34d399';
        } else if (diff < 0) {
            aiRivalStatusText.textContent = `⚠️ Rival leads by ${Math.abs(diff)} tiles!`;
            aiRivalStatusText.style.color = '#f87171';
        } else {
            aiRivalStatusText.textContent = `⚡ Neck and neck!`;
            aiRivalStatusText.style.color = '#cbd5e1';
        }
    }

    function triggerAiDefeat() {
        isGameActive = false;
        clearInterval(gameTimer);
        clearInterval(aiRivalTimer);
        playSound('click');
        const victoryHeader = victoryModal.querySelector('.victory-header');
        if (victoryHeader) {
            victoryHeader.querySelector('.victory-icon').textContent = '🤖';
            victoryHeader.querySelector('h2').textContent = 'AI Bot Defeated You!';
            victoryHeader.querySelector('p').textContent = 'The AI Bot solved its puzzle faster! Try again or lower bot difficulty.';
        }
        finalTime.textContent = timerDisplay.textContent;
        finalMoves.textContent = movesCount;
        finalStars.textContent = '🤖 Defeated';
        victoryModal.style.display = 'flex';
    }

    let p1VersusMoves = 0;
    let p2VersusMoves = 0;
    let currentVersusTurn = 1;

    function updateVersusHud() {
        const versusHud = document.getElementById('versusHud');
        const p1ScoreVal = document.getElementById('p1ScoreVal');
        const p2ScoreVal = document.getElementById('p2ScoreVal');
        const p1StatBadge = document.getElementById('p1StatBadge');
        const p2StatBadge = document.getElementById('p2StatBadge');

        if (!versusHud) return;
        if (puzzleMode === 'versus') {
            versusHud.style.display = 'flex';
            if (p1ScoreVal) p1ScoreVal.textContent = `${p1VersusMoves} Moves`;
            if (p2ScoreVal) p2ScoreVal.textContent = `${p2VersusMoves} Moves`;

            if (p1StatBadge && p2StatBadge) {
                if (currentVersusTurn === 1) {
                    p1StatBadge.style.opacity = '1';
                    p1StatBadge.style.transform = 'scale(1.08)';
                    p2StatBadge.style.opacity = '0.5';
                    p2StatBadge.style.transform = 'scale(1)';
                } else {
                    p1StatBadge.style.opacity = '0.5';
                    p1StatBadge.style.transform = 'scale(1)';
                    p2StatBadge.style.opacity = '1';
                    p2StatBadge.style.transform = 'scale(1.08)';
                }
            }
        } else {
            versusHud.style.display = 'none';
        }
    }

    function initPuzzle() {
        stopAutoSolve();
        movesCount = 0;
        secondsElapsed = 0;
        isGameActive = true;
        moveHistory = [];
        updateUndoButtonState();
        moveDisplay.textContent = '0 Moves';

        initAiRival();

        const timerProgressWrapper = document.getElementById('timerProgressWrapper');
        const timerProgressBar = document.getElementById('timerProgressBar');

        const zenHud = document.getElementById('zenHud');
        if (puzzleMode === 'zen') {
            if (zenHud) zenHud.style.display = 'flex';
            startZenMeditationSound();
            timerDisplay.textContent = '🧘 Zen Mode';
        } else {
            if (zenHud) zenHud.style.display = 'none';
            stopZenMeditationSound();
        }

        p1VersusMoves = 0;
        p2VersusMoves = 0;
        currentVersusTurn = 1;
        updateVersusHud();

        if (timerMode === 'countdown' || timerMode === 'speedrun') {
            const timeAttackMap = { 3: 60, 4: 90, 5: 120, 6: 180, 8: 300 };
            const speedrunMap = { 3: 35, 4: 50, 5: 75, 6: 100, 8: 150 };
            timeAttackDuration = (timerMode === 'speedrun') ? (speedrunMap[selectedGridSize] || 45) : (timeAttackMap[selectedGridSize] || 90);
            remainingSeconds = timeAttackDuration;
            if (timerProgressWrapper) timerProgressWrapper.style.display = 'block';
            if (timerProgressBar) {
                timerProgressBar.style.width = '100%';
                timerProgressBar.classList.remove('low-time');
            }
            timerDisplay.textContent = (timerMode === 'speedrun') ? `🚀 ${formatTime(remainingSeconds)}` : formatTime(remainingSeconds);
        } else if (timerMode === 'zen' || puzzleMode === 'zen') {
            if (timerProgressWrapper) timerProgressWrapper.style.display = 'none';
            timerDisplay.textContent = '🧘 Zen Mode';
        } else {
            if (timerProgressWrapper) timerProgressWrapper.style.display = 'none';
            timerDisplay.textContent = '00:00';
        }

        clearInterval(gameTimer);
        gameTimer = setInterval(() => {
            if (!isGameActive) return;

            if (timerMode === 'stopwatch') {
                secondsElapsed++;
                timerDisplay.textContent = formatTime(secondsElapsed);
            } else if (timerMode === 'zen') {
                secondsElapsed++;
                timerDisplay.textContent = '🧘 Zen Mode';
            } else {
                secondsElapsed++;
                remainingSeconds--;
                timerDisplay.textContent = formatTime(remainingSeconds);
                const pct = Math.max(0, (remainingSeconds / timeAttackDuration) * 100);
                if (timerProgressBar) {
                    timerProgressBar.style.width = `${pct}%`;
                    if (remainingSeconds <= 10) {
                        timerProgressBar.classList.add('low-time');
                        playSound('click');
                    }
                }
                if (remainingSeconds <= 0) {
                    clearInterval(gameTimer);
                    triggerTimeUpFailure();
                }
            }
        }, 1000);

        buildPuzzleGrid();
    }

    function buildPuzzleGrid() {
        puzzleBoard.innerHTML = '';
        puzzleBoard.style.gridTemplateColumns = `repeat(${selectedGridSize}, 1fr)`;
        puzzleBoard.style.gridTemplateRows = `repeat(${selectedGridSize}, 1fr)`;

        const totalTiles = selectedGridSize * selectedGridSize;
        tiles = [];

        for (let i = 0; i < totalTiles; i++) {
            const isEmptyTile = (puzzleMode === 'sliding' && i === totalTiles - 1);
            const initRotation = (isTileRotationEnabled && !isEmptyTile) ? [0, 90, 180, 270][Math.floor(Math.random() * 4)] : 0;
            tiles.push({
                id: i,
                correctPos: i,
                currentPos: i,
                rotation: initRotation,
                isEmpty: isEmptyTile
            });
        }

        // Shuffle tiles with guaranteed solvability
        shuffleTilesSolvable();
        renderTiles();

        // Capture initial layout for Move Replay
        recordedInitialTilesState = JSON.parse(JSON.stringify(tiles));
        fullRecordedMoves = [];
        if (replayToolbarBtn) replayToolbarBtn.style.display = 'none';

        startLivingTileMotionLoop();
    }


    function shuffleTilesSolvable() {
        const total = tiles.length;
        let positions = Array.from({ length: total }, (_, i) => i);

        // Keep shuffling until it's solvable and not already solved
        do {
            for (let i = positions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [positions[i], positions[j]] = [positions[j], positions[i]];
            }
        } while (!isSolvable(positions) || isAlreadySolved(positions));

        for (let i = 0; i < total; i++) {
            tiles[i].currentPos = positions[i];
        }
    }

    function isSolvable(arr) {
        if (puzzleMode !== 'sliding') return true; // Jigsaw is always solvable
        let inversions = 0;
        const n = selectedGridSize;
        const total = n * n;
        const emptyIndex = arr.indexOf(total - 1);
        const emptyRowFromBottom = n - Math.floor(emptyIndex / n);

        for (let i = 0; i < total - 1; i++) {
            for (let j = i + 1; j < total; j++) {
                if (arr[i] !== total - 1 && arr[j] !== total - 1 && arr[i] > arr[j]) {
                    inversions++;
                }
            }
        }

        if (n % 2 !== 0) {
            return inversions % 2 === 0;
        } else {
            return (inversions + emptyRowFromBottom) % 2 === 0;
        }
    }

    function isAlreadySolved(arr) {
        return arr.every((val, idx) => val === idx);
    }

    let selectedTile = null;

    function renderTiles() {
        puzzleBoard.innerHTML = '';
        const size = selectedGridSize;

        // Sort tiles by currentPos so they render in grid order
        const sortedTiles = [...tiles].sort((a, b) => a.currentPos - b.currentPos);

        sortedTiles.forEach((tile) => {
            const tileDiv = document.createElement('div');
            tileDiv.classList.add('puzzle-tile');
            if (selectedShape && selectedShape !== 'square') {
                tileDiv.classList.add('shape-' + selectedShape);
            }
            tileDiv.dataset.id = tile.id;
            tileDiv.setAttribute('draggable', puzzleMode === 'jigsaw' ? 'true' : 'false');

            if (puzzleMode === 'jigsaw') {
                tileDiv.classList.add('jigsaw-tile');
                if (tile.currentPos === tile.correctPos) {
                    tileDiv.classList.add('correctly-placed');
                }
            }

            if (selectedTile && selectedTile.id === tile.id) {
                tileDiv.classList.add('selected-tile');
            }

            if (tile.isEmpty) {
                tileDiv.classList.add('empty-tile');
            } else {
                const row = Math.floor(tile.id / size);
                const col = tile.id % size;
                const percentX = (col / (size - 1)) * 100;
                const percentY = (row / (size - 1)) * 100;

                tileDiv.style.backgroundImage = `url(${currentPhotoDataUrl})`;
                tileDiv.style.backgroundSize = `${size * 100}% ${size * 100}%`;
                tileDiv.style.backgroundPosition = `${percentX}% ${percentY}%`;
            }

            if (tile.rotation) {
                tileDiv.style.transform = `rotate(${tile.rotation}deg)`;
            }

            if (showTileNumbers && !tile.isEmpty) {
                const numBadge = document.createElement('span');
                numBadge.classList.add('tile-number');
                numBadge.textContent = tile.id + 1;
                tileDiv.appendChild(numBadge);
            }

            // Click handling
            tileDiv.addEventListener('click', () => handleTileClick(tile));

            // Tile Rotation right-click listener
            if (isTileRotationEnabled && !tile.isEmpty) {
                tileDiv.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    rotateTile(tile);
                });
            }

            // Drag and drop events for Jigsaw mode
            if (puzzleMode === 'jigsaw') {
                tileDiv.addEventListener('dragstart', (e) => {
                    selectedTile = tile;
                    e.dataTransfer.setData('text/plain', tile.id);
                    tileDiv.classList.add('selected-tile');
                });
                tileDiv.addEventListener('dragover', (e) => {
                    e.preventDefault();
                });
                tileDiv.addEventListener('drop', (e) => {
                    e.preventDefault();
                    if (selectedTile && selectedTile.id !== tile.id) {
                        swapTiles(selectedTile, tile);
                        selectedTile = null;
                    }
                });
            }

            puzzleBoard.appendChild(tileDiv);
        });
    }

    function swapTiles(tileA, tileB, isUndo = false) {
        if (!isUndo) {
            moveHistory.push({ tileAId: tileA.id, tileBId: tileB.id });
            movesCount++;

            if (puzzleMode === 'versus') {
                if (currentVersusTurn === 1) {
                    p1VersusMoves++;
                    currentVersusTurn = 2;
                } else {
                    p2VersusMoves++;
                    currentVersusTurn = 1;
                }
                updateVersusHud();
            }
        } else {
            movesCount = Math.max(0, movesCount - 1);
        }
        [tileA.currentPos, tileB.currentPos] = [tileB.currentPos, tileA.currentPos];
        moveDisplay.textContent = `${movesCount} Moves`;
        updateUndoButtonState();
        updateAiRivalUI();
        if (!isUndo) {
            checkComboMultiplier(tileA, tileB);
        }
        playSound('snap');
        if (!isUndo) {
            triggerTileSnapFx(tileA, tileB);
        }
        renderTiles();
        checkWinCondition();
    }

    let comboStreak = 0;
    let lastMoveTime = 0;
    let comboTimer = null;

    function checkComboMultiplier(tileA, tileB) {
        const now = Date.now();
        const isCorrect = (tileA && tileA.currentPos === tileA.correctPos) || (tileB && tileB.currentPos === tileB.correctPos);
        if (isCorrect) {
            if (now - lastMoveTime < 3200 && lastMoveTime > 0) {
                comboStreak++;
            } else {
                comboStreak = 1;
            }
            lastMoveTime = now;

            if (comboStreak >= 2) {
                const comboHud = document.getElementById('comboHud');
                const comboBadge = document.getElementById('comboBadge');
                const comboPtsText = document.getElementById('comboPtsText');
                if (comboHud && comboBadge && comboPtsText) {
                    const pts = comboStreak * 75;
                    comboBadge.textContent = `🔥 ${comboStreak}x COMBO!`;
                    comboPtsText.textContent = `+${pts} bonus pts`;
                    comboHud.style.display = 'flex';
                    playComboSynthTone(comboStreak);
                    if (comboStreak >= 3) speakVoiceAnnouncements(`${comboStreak}X Combo Streak!`);

                    clearTimeout(comboTimer);
                    comboTimer = setTimeout(() => {
                        if (comboHud) comboHud.style.display = 'none';
                        comboStreak = 0;
                    }, 3500);
                }
            }
        }
    }

    function playComboSynthTone(streak) {
        try {
            if (!soundEnabled) return;
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (!audioCtx) audioCtx = new AudioCtxClass();
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const freq = 440 * Math.pow(1.12, Math.min(streak, 10));
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(masterVolume * 0.35, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } catch(e) {}
    }

    function handleTileClick(clickedTile) {
        if (!isGameActive || clickedTile.isEmpty) return;

        const size = selectedGridSize;
        const emptyTile = tiles.find(t => t.isEmpty);

        if (puzzleMode === 'sliding') {
            const clickPos = clickedTile.currentPos;
            const emptyPos = emptyTile.currentPos;

            const clickRow = Math.floor(clickPos / size);
            const clickCol = clickPos % size;
            const emptyRow = Math.floor(emptyPos / size);
            const emptyCol = emptyPos % size;

            // Check if adjacent
            const isAdjacent = (Math.abs(clickRow - emptyRow) + Math.abs(clickCol - emptyCol)) === 1;

            if (isAdjacent) {
                swapTiles(clickedTile, emptyTile);
            }
        } else if (puzzleMode === 'jigsaw') {
            if (!selectedTile) {
                selectedTile = clickedTile;
                playSound('click');
                renderTiles();
            } else if (selectedTile.id === clickedTile.id) {
                selectedTile = null;
                playSound('click');
                renderTiles();
            } else {
                swapTiles(selectedTile, clickedTile);
                selectedTile = null;
            }
        }
    }

    function rotateTile(tile) {
        if (!isGameActive || tile.isEmpty) return;
        tile.rotation = ((tile.rotation || 0) + 90) % 360;
        playSound('click');
        renderTiles();
        checkWinCondition();
    }

    function checkWinCondition() {
        const isSolved = tiles.every(t => t.currentPos === t.correctPos && (!isTileRotationEnabled || (t.rotation || 0) % 360 === 0));

        if (isSolved) {
            isGameActive = false;
            clearInterval(gameTimer);
            clearInterval(aiRivalTimer);
            playSound('win');

            if (isAiRivalActive && aiRivalLevel === 'hard') {
                unlockAchievement('bot_slayer');
            }
            if (['hexagon', 'diamond', 'wave', 'tabbed'].includes(selectedShape)) {
                unlockAchievement('shape_shifter');
            }

            triggerVictory();
        }
    }

    function triggerVictory() {
        stopAutoSolve();
        clearInterval(aiRivalTimer);
        speakVoiceAnnouncements('Puzzle Solved! Victory!');
        finalTime.textContent = timerDisplay.textContent;
        finalMoves.textContent = movesCount;

        const victoryHeader = victoryModal.querySelector('.victory-header');
        if (victoryHeader) {
            if (puzzleMode === 'versus') {
                if (p1VersusMoves < p2VersusMoves) {
                    victoryHeader.querySelector('.victory-icon').textContent = '👑';
                    victoryHeader.querySelector('h2').textContent = '👑 Player 1 Victory!';
                    victoryHeader.querySelector('p').textContent = `Player 1 won with ${p1VersusMoves} moves vs Player 2's ${p2VersusMoves} moves!`;
                } else if (p2VersusMoves < p1VersusMoves) {
                    victoryHeader.querySelector('.victory-icon').textContent = '👑';
                    victoryHeader.querySelector('h2').textContent = '👑 Player 2 Victory!';
                    victoryHeader.querySelector('p').textContent = `Player 2 won with ${p2VersusMoves} moves vs Player 1's ${p1VersusMoves} moves!`;
                } else {
                    victoryHeader.querySelector('.victory-icon').textContent = '🤝';
                    victoryHeader.querySelector('h2').textContent = '🤝 It\'s a Tie!';
                    victoryHeader.querySelector('p').textContent = `Both players completed the puzzle in ${p1VersusMoves} moves!`;
                }
            } else if (timerMode === 'countdown') {
                victoryHeader.querySelector('h2').textContent = '⚡ Time Attack Cleared!';
                victoryHeader.querySelector('p').textContent = 'Awesome job! You beat the countdown clock!';
            } else if (timerMode === 'zen') {
                victoryHeader.querySelector('.victory-icon').textContent = '🧘';
                victoryHeader.querySelector('h2').textContent = '🧘 Mindful Solved!';
                victoryHeader.querySelector('p').textContent = 'Peaceful completion! You solved the puzzle in Zen Relax mode.';
            } else {
                victoryHeader.querySelector('h2').textContent = 'Puzzle Solved!';
                victoryHeader.querySelector('p').textContent = 'Awesome job! You completed the photo puzzle.';
            }
        }

        // Rating
        let stars = '⭐⭐⭐';
        if (movesCount > selectedGridSize * 15) stars = '⭐⭐';
        if (movesCount > selectedGridSize * 30) stars = '⭐';
        finalStars.textContent = stars;

        saveHighScore(selectedGridSize, puzzleMode, secondsElapsed, movesCount, stars);

        // Unlock Victory Achievements
        if (selectedGridSize === 3) unlockAchievement('novice_solver');
        if (selectedGridSize >= 5) unlockAchievement('master_mind');
        if (secondsElapsed <= 30) unlockAchievement('speed_demon');
        if (timerMode === 'countdown') unlockAchievement('time_survivor');
        if (stars === '⭐⭐⭐') unlockAchievement('three_stars');

        // Daily Challenge streak update
        if (isDailyChallenge) {
            const data = loadDailyStreakData();
            const today = getTodayDateStr();
            if (!data.dates.includes(today)) {
                data.dates.push(today);
                data.streak = (data.streak || 0) + 1;
                data.lastDate = today;
                saveDailyStreakData(data);
                updateDailyStreakUI();
                showToast(`🔥 Daily Streak Updated! You are now on a ${data.streak}-day streak!`);
            }
            isDailyChallenge = false;
        }

        victoryModal.style.display = 'flex';
        addPlayerXp(100, 'Puzzle Cleared');
        startConfetti();

        // Save recorded moves & make Replay available
        fullRecordedMoves = JSON.parse(JSON.stringify(moveHistory));
        if (replayToolbarBtn) replayToolbarBtn.style.display = 'inline-block';
    }

    // --- DAILY CHALLENGE ENGINE ---
    function getTodayDateStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function loadDailyStreakData() {
        const raw = localStorage.getItem('snappuzzle_daily_streak');
        if (!raw) return { streak: 0, lastDate: '', dates: [] };
        try {
            return JSON.parse(raw);
        } catch(e) {
            return { streak: 0, lastDate: '', dates: [] };
        }
    }

    function saveDailyStreakData(data) {
        localStorage.setItem('snappuzzle_daily_streak', JSON.stringify(data));
    }

    function updateDailyStreakUI() {
        const data = loadDailyStreakData();
        if (dailyStreakBadge) dailyStreakBadge.innerHTML = `🔥 ${data.streak}`;
        if (dailyStreakText) dailyStreakText.textContent = `${data.streak} Day Streak`;

        if (dailyDateBadge) {
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            dailyDateBadge.textContent = new Date().toLocaleDateString('en-US', options);
        }

        const currentDayIndex = (new Date().getDay() + 6) % 7;
        for (let i = 0; i < 7; i++) {
            const dot = document.getElementById(`dayDot${i}`);
            if (dot) {
                if (i <= currentDayIndex && data.dates.length > 0) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            }
        }
    }

    if (dailyChallengeBtn) {
        dailyChallengeBtn.addEventListener('click', () => {
            updateDailyStreakUI();
            dailyChallengeModal.style.display = 'flex';
            playSound('click');
        });
    }

    if (closeDailyChallengeBtn) {
        closeDailyChallengeBtn.addEventListener('click', () => {
            dailyChallengeModal.style.display = 'none';
            playSound('click');
        });
    }

    if (startDailyChallengeBtn) {
        startDailyChallengeBtn.addEventListener('click', () => {
            isDailyChallenge = true;
            dailyChallengeModal.style.display = 'none';
            
            const sampleCards = document.querySelectorAll('.sample-card img');
            if (sampleCards.length > 0) {
                const dayNum = new Date().getDate();
                const chosenSample = sampleCards[dayNum % sampleCards.length];
                rawPhotoDataUrl = chosenSample.src;
                currentPhotoDataUrl = rawPhotoDataUrl;
            }
            
            selectedGridSize = 4;
            puzzleMode = 'sliding';
            
            captureSection.style.display = 'none';
            configSection.style.display = 'none';
            gameSection.style.display = 'flex';
            headerStats.style.display = 'flex';
            resetAppBtn.style.display = 'inline-flex';
            
            initPuzzle();
            playSound('win');
            showToast('🔥 Daily Seeded Challenge Started! Grid: 4x4');
        });
    }

    let playerXp = parseInt(localStorage.getItem('snappuzzle_player_xp')) || 0;
    let playerLevel = Math.floor(playerXp / 300) + 1;

    const questsBtn = document.getElementById('questsBtn');
    const questsModal = document.getElementById('questsModal');
    const closeQuestsBtn = document.getElementById('closeQuestsBtn');
    const closeQuestsFooterBtn = document.getElementById('closeQuestsFooterBtn');

    function updateQuestsUI() {
        playerLevel = Math.floor(playerXp / 300) + 1;
        const levelTitles = ['Novice Solver', 'Grid Explorer', 'Puzzle Master', 'Grand Architect', 'Cosmic Legend'];
        const levelTitle = levelTitles[Math.min(playerLevel - 1, levelTitles.length - 1)];

        const playerLevelTitle = document.getElementById('playerLevelTitle');
        const playerXpText = document.getElementById('playerXpText');
        const playerXpBar = document.getElementById('playerXpBar');

        const curLevelXp = playerXp % 300;
        const pct = Math.min(100, Math.round((curLevelXp / 300) * 100));

        if (playerLevelTitle) playerLevelTitle.textContent = `Level ${playerLevel}: ${levelTitle}`;
        if (playerXpText) playerXpText.textContent = `${curLevelXp} / 300 XP`;
        if (playerXpBar) playerXpBar.style.width = `${pct}%`;
    }

    function addPlayerXp(amount, reason) {
        playerXp += amount;
        localStorage.setItem('snappuzzle_player_xp', playerXp);
        updateQuestsUI();
        showToast(`✨ +${amount} XP Earned (${reason})!`, 'Level Progression');
    }

    if (questsBtn && questsModal) {
        questsBtn.addEventListener('click', () => {
            updateQuestsUI();
            questsModal.style.display = 'flex';
            playSound('click');
        });

        [closeQuestsBtn, closeQuestsFooterBtn].forEach(btn => {
            if (btn) btn.addEventListener('click', () => {
                questsModal.style.display = 'none';
                playSound('click');
            });
        });
    }

    updateQuestsUI();

    // Initial streak load on boot
    updateDailyStreakUI();


    // --- LEADERBOARD LOCALSTORAGE SYSTEM ---
    const LEADERBOARD_KEY = 'snappuzzle_high_scores';

    function getHighScores() {
        try {
            return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveHighScore(gridSize, mode, timeSecs, moves, stars) {
        const scores = getHighScores();
        const modeLabel = `${mode === 'sliding' ? 'Sliding Tile' : 'Jigsaw'} (${gridSize}x${gridSize})`;
        
        const existingIdx = scores.findIndex(s => s.gridSize === gridSize && s.mode === mode);
        const newRecord = {
            gridSize,
            mode,
            modeLabel,
            timeSecs,
            timeFormatted: `${String(Math.floor(timeSecs / 60)).padStart(2, '0')}:${String(timeSecs % 60).padStart(2, '0')}`,
            moves,
            stars,
            date: new Date().toLocaleDateString()
        };

        if (existingIdx !== -1) {
            // Update if better time or moves
            if (timeSecs < scores[existingIdx].timeSecs || (timeSecs === scores[existingIdx].timeSecs && moves < scores[existingIdx].moves)) {
                scores[existingIdx] = newRecord;
            }
        } else {
            scores.push(newRecord);
        }

        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(scores));
        unlockAchievement('hall_of_fame');
    }

    function renderLeaderboard() {
        const leaderboardBody = document.getElementById('leaderboardBody');
        const scores = getHighScores();

        if (scores.length === 0) {
            leaderboardBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 20px;">No high scores yet! Solve a puzzle to log your record.</td></tr>`;
            return;
        }

        leaderboardBody.innerHTML = scores.map(s => `
            <tr>
                <td><strong>${s.modeLabel}</strong></td>
                <td>⏱️ ${s.timeFormatted}</td>
                <td>🎯 ${s.moves}</td>
                <td>${s.stars}</td>
            </tr>
        `).join('');
    }

    // Leaderboard Modal Event Listeners
    const leaderboardBtn = document.getElementById('leaderboardBtn');
    const leaderboardModal = document.getElementById('leaderboardModal');
    const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
    const closeLeaderboardFooterBtn = document.getElementById('closeLeaderboardFooterBtn');
    const clearLeaderboardBtn = document.getElementById('clearLeaderboardBtn');

    leaderboardBtn.addEventListener('click', () => {
        renderLeaderboard();
        leaderboardModal.style.display = 'flex';
        playSound('click');
    });

    [closeLeaderboardBtn, closeLeaderboardFooterBtn].forEach(b => {
        if (b) b.addEventListener('click', () => {
            leaderboardModal.style.display = 'none';
            playSound('click');
        });
    });

    clearLeaderboardBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all high score records?')) {
            localStorage.removeItem(LEADERBOARD_KEY);
            renderLeaderboard();
            playSound('click');
        }
    });

    // --- SOUND LAB & SYNTHESIZER MODAL ---
    const soundboardBtn = document.getElementById('soundboardBtn');
    const soundboardModal = document.getElementById('soundboardModal');
    const closeSoundboardBtn = document.getElementById('closeSoundboardBtn');
    const closeSoundboardFooterBtn = document.getElementById('closeSoundboardFooterBtn');
    const soundVisualizerCanvas = document.getElementById('soundVisualizerCanvas');
    const soundVisualizerCtx = soundVisualizerCanvas ? soundVisualizerCanvas.getContext('2d') : null;
    let visualizerAnimFrame = null;

    if (soundboardBtn && soundboardModal) {
        soundboardBtn.addEventListener('click', () => {
            soundboardModal.style.display = 'flex';
            drawIdleSoundWaveform();
            playSound('click');
        });

        [closeSoundboardBtn, closeSoundboardFooterBtn].forEach(btn => {
            if (btn) btn.addEventListener('click', () => {
                soundboardModal.style.display = 'none';
                if (visualizerAnimFrame) cancelAnimationFrame(visualizerAnimFrame);
                playSound('click');
            });
        });

        document.querySelectorAll('.sound-key-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const soundType = e.currentTarget.getAttribute('data-sound');
                playSound(soundType);
                triggerVisualizerWaveform(soundType);
            });
        });

        const adsrAttack = document.getElementById('adsrAttack');
        const adsrDecay = document.getElementById('adsrDecay');
        const adsrPitch = document.getElementById('adsrPitch');
        const adsrAttackVal = document.getElementById('adsrAttackVal');
        const adsrDecayVal = document.getElementById('adsrDecayVal');
        const adsrPitchVal = document.getElementById('adsrPitchVal');
        const synthWaveformSelect = document.getElementById('synthWaveformSelect');
        const playCustomSynthBtn = document.getElementById('playCustomSynthBtn');

        if (adsrAttack && adsrAttackVal) adsrAttack.addEventListener('input', () => adsrAttackVal.textContent = adsrAttack.value + 'ms');
        if (adsrDecay && adsrDecayVal) adsrDecay.addEventListener('input', () => adsrDecayVal.textContent = adsrDecay.value + 'ms');
        if (adsrPitch && adsrPitchVal) adsrPitch.addEventListener('input', () => adsrPitchVal.textContent = adsrPitch.value + 'Hz');

        if (playCustomSynthBtn) {
            playCustomSynthBtn.addEventListener('click', () => {
                try {
                    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                    if (!audioCtx) audioCtx = new AudioCtxClass();
                    if (audioCtx.state === 'suspended') audioCtx.resume();

                    const now = audioCtx.currentTime;
                    const waveType = synthWaveformSelect ? synthWaveformSelect.value : 'triangle';
                    const attack = adsrAttack ? parseInt(adsrAttack.value) / 1000 : 0.01;
                    const decay = adsrDecay ? parseInt(adsrDecay.value) / 1000 : 0.15;
                    const pitch = adsrPitch ? parseInt(adsrPitch.value) : 520;

                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = waveType;
                    osc.frequency.setValueAtTime(pitch, now);

                    const vol = masterVolume * 0.4;
                    gain.gain.setValueAtTime(0.001, now);
                    gain.gain.linearRampToValueAtTime(vol, now + attack);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

                    osc.connect(gain);
                    gain.connect(audioCtx.destination);

                    osc.start(now);
                    osc.stop(now + attack + decay);

                    triggerVisualizerWaveform('zen');
                } catch (e) {}
            });
        }

        let micMediaRecorder = null;
        let micAudioChunks = [];
        const recordMicAudioBtn = document.getElementById('recordMicAudioBtn');
        const playMicAudioBtn = document.getElementById('playMicAudioBtn');
        const clearMicAudioBtn = document.getElementById('clearMicAudioBtn');

        if (customMicAudioUrl) {
            if (playMicAudioBtn) playMicAudioBtn.style.display = 'inline-block';
            if (clearMicAudioBtn) clearMicAudioBtn.style.display = 'inline-block';
        }

        if (recordMicAudioBtn) {
            recordMicAudioBtn.addEventListener('click', async () => {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    showToast('⚠️ Microphone access not supported on this browser.');
                    return;
                }
                try {
                    recordMicAudioBtn.style.background = '#ef4444';
                    recordMicAudioBtn.textContent = '⏺️ Recording (1.5s)...';
                    micAudioChunks = [];

                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    micMediaRecorder = new MediaRecorder(stream);

                    micMediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) micAudioChunks.push(e.data);
                    };

                    micMediaRecorder.onstop = () => {
                        stream.getTracks().forEach(track => track.stop());
                        const blob = new Blob(micAudioChunks, { type: 'audio/webm' });
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            customMicAudioUrl = reader.result;
                            localStorage.setItem('snappuzzle_custom_mic_audio', customMicAudioUrl);
                            recordMicAudioBtn.style.background = '';
                            recordMicAudioBtn.textContent = '🎙️ Record 1s Snap';
                            if (playMicAudioBtn) playMicAudioBtn.style.display = 'inline-block';
                            if (clearMicAudioBtn) clearMicAudioBtn.style.display = 'inline-block';
                            playSound('snap');
                            showToast('🎙️ Custom voice snap sound recorded!', 'Audio Studio');
                        };
                        reader.readAsDataURL(blob);
                    };

                    micMediaRecorder.start();
                    setTimeout(() => {
                        if (micMediaRecorder && micMediaRecorder.state === 'recording') {
                            micMediaRecorder.stop();
                        }
                    }, 1500);
                } catch(err) {
                    recordMicAudioBtn.style.background = '';
                    recordMicAudioBtn.textContent = '🎙️ Record 1s Snap';
                    showToast('⚠️ Microphone access denied.');
                }
            });
        }

        if (playMicAudioBtn) {
            playMicAudioBtn.addEventListener('click', () => {
                if (customMicAudioUrl) {
                    const audio = new Audio(customMicAudioUrl);
                    audio.volume = masterVolume;
                    audio.play();
                }
            });
        }

        if (clearMicAudioBtn) {
            clearMicAudioBtn.addEventListener('click', () => {
                customMicAudioUrl = null;
                localStorage.removeItem('snappuzzle_custom_mic_audio');
                if (playMicAudioBtn) playMicAudioBtn.style.display = 'none';
                if (clearMicAudioBtn) clearMicAudioBtn.style.display = 'none';
                playSound('click');
                showToast('🗑️ Custom voice snap reset.');
            });
        }
    }

    function drawIdleSoundWaveform() {
        if (!soundVisualizerCtx || !soundVisualizerCanvas) return;
        const w = soundVisualizerCanvas.width;
        const h = soundVisualizerCanvas.height;
        soundVisualizerCtx.clearRect(0, 0, w, h);

        soundVisualizerCtx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        soundVisualizerCtx.lineWidth = 2;
        soundVisualizerCtx.beginPath();
        soundVisualizerCtx.moveTo(0, h / 2);
        soundVisualizerCtx.lineTo(w, h / 2);
        soundVisualizerCtx.stroke();
    }

    function triggerVisualizerWaveform(soundType) {
        if (!soundVisualizerCtx || !soundVisualizerCanvas) return;
        if (visualizerAnimFrame) cancelAnimationFrame(visualizerAnimFrame);

        let startTime = Date.now();
        const duration = 600;

        function animateWave() {
            const elapsed = Date.now() - startTime;
            if (elapsed > duration) {
                drawIdleSoundWaveform();
                return;
            }

            const w = soundVisualizerCanvas.width;
            const h = soundVisualizerCanvas.height;
            soundVisualizerCtx.clearRect(0, 0, w, h);

            const progress = 1 - (elapsed / duration);
            const freq = soundType === 'win' ? 0.05 : soundType === 'zen' ? 0.02 : 0.08;
            const amp = (h / 3) * progress;

            soundVisualizerCtx.strokeStyle = soundType === 'win' ? '#f59e0b' : soundType === 'error' ? '#ef4444' : '#6366f1';
            soundVisualizerCtx.lineWidth = 3;
            soundVisualizerCtx.beginPath();

            for (let x = 0; x < w; x += 3) {
                const y = (h / 2) + Math.sin(x * freq + elapsed * 0.02) * amp * Math.sin((x / w) * Math.PI);
                if (x === 0) soundVisualizerCtx.moveTo(x, y);
                else soundVisualizerCtx.lineTo(x, y);
            }

            soundVisualizerCtx.stroke();
            visualizerAnimFrame = requestAnimationFrame(animateWave);
        }

        animateWave();
    }

    // --- ACHIEVEMENTS SYSTEM ---
    const ACHIEVEMENTS = [
        { id: 'first_snap', icon: '📸', title: 'First Snap', desc: 'Capture, upload, or choose your first photo.' },
        { id: 'novice_solver', icon: '🧩', title: 'Puzzle Novice', desc: 'Complete any 3x3 grid puzzle.' },
        { id: 'speed_demon', icon: '⚡', title: 'Speed Demon', desc: 'Solve a puzzle in under 30 seconds.' },
        { id: 'master_mind', icon: '🧠', title: 'Master Mind', desc: 'Complete a 5x5 grid puzzle or larger.' },
        { id: 'ai_assistant', icon: '🤖', title: 'AI Assistant', desc: 'Use the Auto-Solve assistant bot.' },
        { id: 'time_survivor', icon: '⌛', title: 'Time Survivor', desc: 'Complete a puzzle in Time Attack mode.' },
        { id: 'three_stars', icon: '🌟', title: 'Three-Star Finish', desc: 'Earn a 3-star rating on a puzzle.' },
        { id: 'palette_explorer', icon: '🎨', title: 'Palette Explorer', desc: 'Switch theme color palettes.' },
        { id: 'hall_of_fame', icon: '🏆', title: 'Record Holder', desc: 'Record a high score in the Hall of Fame.' },
        { id: 'bot_slayer', icon: '🤖', title: 'Bot Destroyer', desc: 'Defeat the Grandmaster AI Bot in Speedrun Mode.' },
        { id: 'shape_shifter', icon: '🐝', title: 'Shape Shifter', desc: 'Solve a puzzle using Hexagon or Diamond tile shapes.' },
        { id: 'pixel_artist', icon: '👾', title: 'Pixel Artist', desc: 'Create a puzzle using 8-Bit Pixel Art or Neon Sketch FX.' }
    ];

    let unlockedAchievements = [];
    try {
        unlockedAchievements = JSON.parse(localStorage.getItem('snappuzzle_achievements')) || [];
    } catch (e) {
        unlockedAchievements = [];
    }

    function unlockAchievement(id) {
        if (unlockedAchievements.includes(id)) return;
        unlockedAchievements.push(id);
        localStorage.setItem('snappuzzle_achievements', JSON.stringify(unlockedAchievements));
        
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (!ach) return;

        playSound('achievement');
        showAchievementToast(ach);
        updateAchievementsUI();
    }

    function showAchievementToast(ach) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = `
            <div class="achievement-toast-icon">${ach.icon}</div>
            <div class="achievement-toast-content">
                <div class="achievement-toast-tag">Achievement Unlocked!</div>
                <div class="achievement-toast-name">${ach.title}</div>
            </div>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 4000);
    }

    function updateAchievementsUI() {
        const badgeEl = document.getElementById('achievementsBadge');
        if (badgeEl) {
            badgeEl.textContent = `${unlockedAchievements.length}/${ACHIEVEMENTS.length}`;
        }

        const progressText = document.getElementById('achievementsProgressText');
        const percentText = document.getElementById('achievementsPercentText');
        const fillEl = document.getElementById('achievementsFill');
        const gridEl = document.getElementById('achievementsGrid');

        const total = ACHIEVEMENTS.length;
        const count = unlockedAchievements.length;
        const percent = Math.round((count / total) * 100);

        if (progressText) progressText.textContent = `${count} of ${total} Unlocked`;
        if (percentText) percentText.textContent = `${percent}%`;
        if (fillEl) fillEl.style.width = `${percent}%`;

        if (gridEl) {
            gridEl.innerHTML = ACHIEVEMENTS.map(ach => {
                const isUnlocked = unlockedAchievements.includes(ach.id);
                return `
                    <div class="achievement-item ${isUnlocked ? 'unlocked' : 'locked'}">
                        <div class="achievement-icon">${ach.icon}</div>
                        <div class="achievement-info">
                            <div class="achievement-title">${ach.title} ${isUnlocked ? '✓' : ''}</div>
                            <div class="achievement-desc">${ach.desc}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Achievements Modal Event Listeners
    const achievementsBtn = document.getElementById('achievementsBtn');
    const achievementsModal = document.getElementById('achievementsModal');
    const closeAchievementsBtn = document.getElementById('closeAchievementsBtn');
    const closeAchievementsFooterBtn = document.getElementById('closeAchievementsFooterBtn');

    if (achievementsBtn) {
        achievementsBtn.addEventListener('click', () => {
            updateAchievementsUI();
            achievementsModal.style.display = 'flex';
            playSound('click');
        });
    }

    [closeAchievementsBtn, closeAchievementsFooterBtn].forEach(b => {
        if (b) b.addEventListener('click', () => {
            achievementsModal.style.display = 'none';
            playSound('click');
        });
    });

    // Initialize UI count
    updateAchievementsUI();

    // --- CONFETTI PARTICLES ENGINE ---
    function startConfetti() {
        const confettiCanvas = document.getElementById('confettiCanvas');
        const ctx = confettiCanvas.getContext('2d');
        confettiCanvas.width = confettiCanvas.offsetWidth;
        confettiCanvas.height = confettiCanvas.offsetHeight;

        const particles = Array.from({ length: 80 }, () => ({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * confettiCanvas.height - confettiCanvas.height,
            size: Math.random() * 8 + 4,
            color: ['#6366f1', '#ec4899', '#06b6d4', '#eab308', '#22c55e'][Math.floor(Math.random() * 5)],
            vy: Math.random() * 3 + 2,
            vx: Math.random() * 2 - 1,
            rotation: Math.random() * 360
        }));

        function draw() {
            ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
            particles.forEach(p => {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();

                p.y += p.vy;
                p.x += p.vx;
                p.rotation += 3;
            });

            if (victoryModal.style.display === 'flex') {
                requestAnimationFrame(draw);
            }
        }
        draw();
    }

    // Toolbar buttons
    let peekTimeout = null;
    toggleGhostBtn.addEventListener('click', () => {
        const isHidden = ghostOverlay.style.display === 'none';
        ghostOverlay.style.display = isHidden ? 'block' : 'none';
        toggleGhostBtn.style.background = isHidden ? 'rgba(99, 102, 241, 0.4)' : '';
        playSound('click');
    });

    if (ghostOpacitySlider) {
        ghostOpacitySlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) / 100;
            ghostOverlay.style.opacity = val;
        });
    }

    const triggerSpeedPeek = () => {
        if (!ghostOverlay) return;
        if (peekTimeout) clearTimeout(peekTimeout);
        ghostOverlay.style.display = 'block';
        ghostOverlay.classList.add('peek-active');
        playSound('click');

        peekTimeout = setTimeout(() => {
            ghostOverlay.classList.remove('peek-active');
            if (toggleGhostBtn.style.background === '') {
                ghostOverlay.style.display = 'none';
            } else {
                ghostOverlay.style.opacity = ghostOpacitySlider ? (parseFloat(ghostOpacitySlider.value) / 100) : 0.35;
            }
        }, 1200);
    };

    if (peekGhostBtn) {
        peekGhostBtn.addEventListener('click', triggerSpeedPeek);
    }

    let isFogModeActive = false;
    const toggleFogBtn = document.getElementById('toggleFogBtn');
    const spotlightOverlay = document.getElementById('spotlightOverlay');
    const puzzleWrapperEl = document.getElementById('puzzleWrapper');

    if (toggleFogBtn && spotlightOverlay) {
        toggleFogBtn.addEventListener('click', () => {
            isFogModeActive = !isFogModeActive;
            spotlightOverlay.style.display = isFogModeActive ? 'block' : 'none';
            toggleFogBtn.style.background = isFogModeActive ? 'rgba(16, 185, 129, 0.4)' : '';
            playSound('click');
            showToast(isFogModeActive ? '🔦 Fog of War Spotlight Active!' : '🔦 Spotlight Disabled');
        });
    }

    if (puzzleWrapperEl && spotlightOverlay) {
        const updateSpotlightPos = (e) => {
            if (!isFogModeActive) return;
            const rect = puzzleWrapperEl.getBoundingClientRect();
            let clientX = e.clientX;
            let clientY = e.clientY;
            if (e.touches && e.touches[0]) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            spotlightOverlay.style.setProperty('--mouse-x', `${x}px`);
            spotlightOverlay.style.setProperty('--mouse-y', `${y}px`);
        };
        puzzleWrapperEl.addEventListener('mousemove', updateSpotlightPos);
        puzzleWrapperEl.addEventListener('touchmove', updateSpotlightPos, { passive: true });
    }

    if (toggleNumbersBtn) {
        toggleNumbersBtn.addEventListener('click', () => {
            showTileNumbers = !showTileNumbers;
            toggleNumbersBtn.style.background = showTileNumbers ? 'rgba(99, 102, 241, 0.4)' : '';
            renderTiles();
            playSound('click');
        });
    }

    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            if (!isGameActive || moveHistory.length === 0) return;
            const lastMove = moveHistory.pop();
            const tileA = tiles.find(t => t.id === lastMove.tileAId);
            const tileB = tiles.find(t => t.id === lastMove.tileBId);
            if (tileA && tileB) {
                swapTiles(tileA, tileB, true);
            }
        });
    }

    const autoSolveBtn = document.getElementById('autoSolveBtn');

    function stopAutoSolve() {
        isAutoSolving = false;
        if (autoSolveTimer) {
            clearInterval(autoSolveTimer);
            autoSolveTimer = null;
        }
        if (autoSolveBtn) {
            autoSolveBtn.textContent = '🤖 Auto-Solve (A)';
            autoSolveBtn.style.background = '';
        }
    }

    function startAutoSolve() {
        if (!isGameActive) return;
        isAutoSolving = true;
        if (autoSolveBtn) {
            autoSolveBtn.textContent = '⏸️ Stop Bot';
            autoSolveBtn.style.background = 'rgba(239, 68, 68, 0.4)';
        }

        autoSolveTimer = setInterval(() => {
            if (!isGameActive || !isAutoSolving) {
                stopAutoSolve();
                return;
            }

            const isSolved = tiles.every(t => t.currentPos === t.correctPos);
            if (isSolved) {
                stopAutoSolve();
                return;
            }

            if (moveHistory.length > 0) {
                const lastMove = moveHistory.pop();
                const tileA = tiles.find(t => t.id === lastMove.tileAId);
                const tileB = tiles.find(t => t.id === lastMove.tileBId);
                if (tileA && tileB) {
                    swapTiles(tileA, tileB, true);
                }
            } else {
                const misplaced = tiles.find(t => t.currentPos !== t.correctPos);
                if (misplaced) {
                    const targetTile = tiles.find(t => t.currentPos === misplaced.correctPos);
                    if (targetTile) {
                        swapTiles(misplaced, targetTile);
                    }
                }
            }
        }, 220);
    }

    if (autoSolveBtn) {
        autoSolveBtn.addEventListener('click', () => {
            playSound('click');
            if (isAutoSolving) {
                stopAutoSolve();
            } else {
                unlockAchievement('ai_assistant');
                startAutoSolve();
            }
        });
    }

    hintBtn.addEventListener('click', () => {
        ghostOverlay.style.display = 'block';
        setTimeout(() => { ghostOverlay.style.display = 'none'; }, 1200);
        playSound('click');
    });

    function calculateOptimalDistance() {
        const size = selectedGridSize;
        let distance = 0;
        tiles.forEach(tile => {
            if (tile.isEmpty) return;
            const curR = Math.floor(tile.currentPos / size);
            const curC = tile.currentPos % size;
            const corR = Math.floor(tile.correctPos / size);
            const corC = tile.correctPos % size;
            distance += Math.abs(curR - corR) + Math.abs(curC - corC);
        });
        return Math.ceil(distance / 2);
    }

    const hintPathBtn = document.getElementById('hintPathBtn');
    if (hintPathBtn) {
        hintPathBtn.addEventListener('click', () => {
            if (!isGameActive) return;
            const estMoves = calculateOptimalDistance();
            playSound('hint');

            document.querySelectorAll('.puzzle-tile').forEach(tileDiv => {
                const id = parseInt(tileDiv.dataset.id);
                const tile = tiles.find(t => t.id === id);
                if (tile && tile.currentPos !== tile.correctPos && !tile.isEmpty) {
                    tileDiv.style.boxShadow = '0 0 18px #34d399, inset 0 0 10px #34d399';
                    setTimeout(() => {
                        tileDiv.style.boxShadow = '';
                    }, 2400);
                }
            });

            showToast(`💡 Optimal Solution Distance: ~${estMoves} moves remaining!`, 'Path Assistant');
        });
    }

    let is3dTiltActive = false;
    const toggle3dTiltBtn = document.getElementById('toggle3dTiltBtn');
    const puzzleWrapper = document.querySelector('.puzzle-wrapper');

    if (toggle3dTiltBtn) {
        toggle3dTiltBtn.addEventListener('click', () => {
            is3dTiltActive = !is3dTiltActive;
            toggle3dTiltBtn.classList.toggle('active', is3dTiltActive);
            toggle3dTiltBtn.textContent = is3dTiltActive ? '🧊 3D Tilt: ON (T)' : '🧊 3D Tilt (T)';

            if (puzzleWrapper) puzzleWrapper.classList.toggle('tilt-3d', is3dTiltActive);
            if (puzzleBoard) puzzleBoard.classList.toggle('tilt-3d', is3dTiltActive);
            document.querySelectorAll('.puzzle-tile').forEach(t => t.classList.toggle('tilt-3d', is3dTiltActive));

            if (!is3dTiltActive && puzzleBoard) {
                puzzleBoard.style.transform = '';
            }
            playSound('click');
        });
    }

    if (puzzleWrapper) {
        puzzleWrapper.addEventListener('mousemove', (e) => {
            if (!is3dTiltActive || !puzzleBoard) return;
            const rect = puzzleWrapper.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            const rotY = (x - 0.5) * 32;
            const rotX = (0.5 - y) * 32;

            puzzleBoard.style.transform = `rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg)`;
        });

        puzzleWrapper.addEventListener('mouseleave', () => {
            if (is3dTiltActive && puzzleBoard) {
                puzzleBoard.style.transform = 'rotateX(0deg) rotateY(0deg)';
            }
        });
    }

    let isCrtFxActive = false;
    const toggleCrtFxBtn = document.getElementById('toggleCrtFxBtn');
    const crtOverlay = document.getElementById('crtOverlay');

    if (toggleCrtFxBtn) {
        toggleCrtFxBtn.addEventListener('click', () => {
            isCrtFxActive = !isCrtFxActive;
            toggleCrtFxBtn.classList.toggle('active', isCrtFxActive);
            toggleCrtFxBtn.textContent = isCrtFxActive ? '📺 CRT & Shake: ON' : '📺 CRT & Shake (C)';

            if (crtOverlay) crtOverlay.style.display = isCrtFxActive ? 'block' : 'none';
            playSound('click');
        });
    }

    shuffleBtn.addEventListener('click', () => {
        initPuzzle();
        playSound('click');
    });

    playAgainBtn.addEventListener('click', () => {
        victoryModal.style.display = 'none';
        initPuzzle();
    });

    // --- ANIMATED MOVE REPLAY SYSTEM ---
    function openReplayModal() {
        if (moveHistory.length > 0 && fullRecordedMoves.length === 0) {
            fullRecordedMoves = JSON.parse(JSON.stringify(moveHistory));
        }
        if (fullRecordedMoves.length === 0) {
            showToast('⚠️ No moves recorded to replay yet!');
            return;
        }
        stopReplayPlayback();
        replayCurrentStep = 0;
        replayModal.style.display = 'flex';
        renderReplayStep(0);
        playSound('click');
    }

    function closeReplayModal() {
        stopReplayPlayback();
        replayModal.style.display = 'none';
    }

    function renderReplayStep(stepIndex) {
        if (!recordedInitialTilesState || recordedInitialTilesState.length === 0) return;

        replayCurrentStep = Math.max(0, Math.min(stepIndex, fullRecordedMoves.length));

        // Deep copy initial layout
        let tempTiles = JSON.parse(JSON.stringify(recordedInitialTilesState));

        let lastMove = null;
        for (let i = 0; i < replayCurrentStep; i++) {
            const move = fullRecordedMoves[i];
            if (!move) break;
            const tileA = tempTiles.find(t => t.id === move.tileAId);
            const tileB = tempTiles.find(t => t.id === move.tileBId);
            if (tileA && tileB) {
                [tileA.currentPos, tileB.currentPos] = [tileB.currentPos, tileA.currentPos];
            }
            if (i === replayCurrentStep - 1) {
                lastMove = move;
            }
        }

        replayBoard.innerHTML = '';
        const size = selectedGridSize;
        replayBoard.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        replayBoard.style.gridTemplateRows = `repeat(${size}, 1fr)`;

        const sortedTiles = [...tempTiles].sort((a, b) => a.currentPos - b.currentPos);

        sortedTiles.forEach((tile) => {
            const tileDiv = document.createElement('div');
            tileDiv.classList.add('puzzle-tile');
            tileDiv.dataset.id = tile.id;

            if (puzzleMode === 'jigsaw') {
                tileDiv.classList.add('jigsaw-tile');
                if (tile.currentPos === tile.correctPos) {
                    tileDiv.classList.add('correctly-placed');
                }
            }

            if (lastMove && (tile.id === lastMove.tileAId || tile.id === lastMove.tileBId)) {
                tileDiv.classList.add('replay-highlight');
            }

            if (tile.isEmpty) {
                tileDiv.classList.add('empty-tile');
            } else {
                const row = Math.floor(tile.id / size);
                const col = tile.id % size;
                const percentX = (col / (size - 1)) * 100;
                const percentY = (row / (size - 1)) * 100;

                tileDiv.style.backgroundImage = `url(${currentPhotoDataUrl})`;
                tileDiv.style.backgroundSize = `${size * 100}% ${size * 100}%`;
                tileDiv.style.backgroundPosition = `${percentX}% ${percentY}%`;
            }

            if (showTileNumbers && !tile.isEmpty) {
                const numBadge = document.createElement('span');
                numBadge.classList.add('tile-number');
                numBadge.textContent = tile.id + 1;
                tileDiv.appendChild(numBadge);
            }

            replayBoard.appendChild(tileDiv);
        });

        if (replayScrubber) {
            replayScrubber.max = fullRecordedMoves.length;
            replayScrubber.value = replayCurrentStep;
        }
        if (replayStepText) {
            replayStepText.textContent = `Move ${replayCurrentStep} / ${fullRecordedMoves.length}`;
        }

        const replayMoveDetailText = document.getElementById('replayMoveDetailText');
        if (replayMoveDetailText) {
            if (replayCurrentStep === 0) {
                replayMoveDetailText.textContent = 'Move 0: Initial Board Layout';
            } else if (lastMove) {
                replayMoveDetailText.textContent = `Move ${replayCurrentStep}: Swapped Tile #${lastMove.tileAId + 1} & Tile #${lastMove.tileBId + 1}`;
            }
        }
    }

    function toggleReplayPlay() {
        if (isReplaying) {
            stopReplayPlayback();
        } else {
            if (replayCurrentStep >= fullRecordedMoves.length) {
                replayCurrentStep = 0;
            }
            isReplaying = true;
            if (replayTogglePlayBtn) replayTogglePlayBtn.textContent = '⏸️ Pause';
            replayTimer = setInterval(() => {
                stepReplayForward();
            }, Math.round(600 / replaySpeed));
        }
    }

    function stopReplayPlayback() {
        isReplaying = false;
        if (replayTimer) {
            clearInterval(replayTimer);
            replayTimer = null;
        }
        if (replayTogglePlayBtn) replayTogglePlayBtn.textContent = '▶️ Play';
    }

    function stepReplayForward() {
        if (replayCurrentStep < fullRecordedMoves.length) {
            replayCurrentStep++;
            renderReplayStep(replayCurrentStep);
            playSound('snap');
        } else {
            stopReplayPlayback();
            playSound('win');
        }
    }

    function stepReplayBack() {
        stopReplayPlayback();
        if (replayCurrentStep > 0) {
            replayCurrentStep--;
            renderReplayStep(replayCurrentStep);
            playSound('click');
        }
    }

    function cycleReplaySpeed() {
        replaySpeed = replaySpeed === 1 ? 2 : (replaySpeed === 2 ? 4 : 1);
        if (replaySpeedBadge) replaySpeedBadge.textContent = `Speed: ${replaySpeed}x`;
        if (replaySpeedBtn) replaySpeedBtn.textContent = `⚡ ${replaySpeed}x`;
        if (isReplaying) {
            stopReplayPlayback();
            toggleReplayPlay();
        }
        playSound('click');
    }

    function resetReplay() {
        stopReplayPlayback();
        replayCurrentStep = 0;
        renderReplayStep(0);
        playSound('click');
    }

    if (replayMovesBtn) replayMovesBtn.addEventListener('click', openReplayModal);
    if (replayToolbarBtn) replayToolbarBtn.addEventListener('click', openReplayModal);
    if (closeReplayBtn) closeReplayBtn.addEventListener('click', closeReplayModal);
    if (replayTogglePlayBtn) replayTogglePlayBtn.addEventListener('click', toggleReplayPlay);
    if (replayStepForwardBtn) replayStepForwardBtn.addEventListener('click', stepReplayForward);
    if (replayStepBackBtn) replayStepBackBtn.addEventListener('click', stepReplayBack);
    if (replaySpeedBtn) replaySpeedBtn.addEventListener('click', cycleReplaySpeed);
    if (replayResetBtn) replayResetBtn.addEventListener('click', resetReplay);

    if (replayScrubber) {
        replayScrubber.addEventListener('input', (e) => {
            stopReplayPlayback();
            const step = parseInt(e.target.value, 10);
            renderReplayStep(step);
        });
    }

    if (replayModal) {
        replayModal.addEventListener('click', (e) => {
            if (e.target === replayModal) closeReplayModal();
        });
    }


    newPhotoBtn.addEventListener('click', () => {
        stopAutoSolve();
        victoryModal.style.display = 'none';
        gameSection.style.display = 'none';
        headerStats.style.display = 'none';
        resetAppBtn.style.display = 'none';
        captureSection.style.display = 'flex';
        startWebcam();
    });

    resetAppBtn.addEventListener('click', () => {
        stopAutoSolve();
        clearInterval(gameTimer);
        gameSection.style.display = 'none';
        configSection.style.display = 'none';
        headerStats.style.display = 'none';
        resetAppBtn.style.display = 'none';
        captureSection.style.display = 'flex';
        startWebcam();
    });

    const masterVolumeSlider = document.getElementById('masterVolumeSlider');

    function updateVolumeUI() {
        if (!soundToggleBtn) return;
        if (!soundEnabled || masterVolume <= 0) {
            soundToggleBtn.textContent = '🔇';
        } else if (masterVolume > 0.5) {
            soundToggleBtn.textContent = '🔊';
        } else if (masterVolume > 0.2) {
            soundToggleBtn.textContent = '🔉';
        } else {
            soundToggleBtn.textContent = '🔈';
        }
        if (masterVolumeSlider) {
            masterVolumeSlider.value = Math.round(masterVolume * 100);
        }
    }

    if (masterVolumeSlider) {
        masterVolumeSlider.value = Math.round(masterVolume * 100);
        masterVolumeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) / 100;
            masterVolume = val;
            soundEnabled = val > 0;
            localStorage.setItem('snappuzzle_master_volume', masterVolume.toString());
            updateVolumeUI();
        });
    }

    updateVolumeUI();

    soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        if (soundEnabled && masterVolume === 0) {
            masterVolume = 0.8;
            localStorage.setItem('snappuzzle_master_volume', '0.8');
        }
        updateVolumeUI();
        if (soundEnabled) playSound('click');
    });

    // --- THEME SELECTOR & PERSISTENCE ---
    const themeSelect = document.getElementById('themeSelect');
    const savedTheme = localStorage.getItem('snappuzzle_theme') || 'cyber';

    function applyTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        if (themeSelect) themeSelect.value = themeName;
        localStorage.setItem('snappuzzle_theme', themeName);
    }

    // --- KEYBOARD HOTKEYS & ACCESSIBILITY ---
    window.addEventListener('keydown', (e) => {
        // Prevent hotkeys inside inputs
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        // Dismiss active open modals with Escape key
        if (e.key === 'Escape') {
            const cropModal = document.getElementById('cropModal');
            const soundModal = document.getElementById('soundModal');
            const achievementsModal = document.getElementById('achievementsModal');
            const victoryModal = document.getElementById('victoryModal');
            const hotkeysModal = document.getElementById('hotkeysModal');
            
            if (cropModal && cropModal.style.display !== 'none') cropModal.style.display = 'none';
            if (soundModal && soundModal.style.display !== 'none') soundModal.style.display = 'none';
            if (achievementsModal && achievementsModal.style.display !== 'none') achievementsModal.style.display = 'none';
            if (victoryModal && victoryModal.style.display !== 'none') victoryModal.style.display = 'none';
            if (hotkeysModal && hotkeysModal.style.display !== 'none') hotkeysModal.style.display = 'none';
            if (replayModal && replayModal.style.display === 'flex') closeReplayModal();
            return;
        }

        // Toggle Hotkeys Modal with ? key
        if (e.key === '?') {
            const hotkeysModal = document.getElementById('hotkeysModal');
            if (hotkeysModal) {
                hotkeysModal.style.display = hotkeysModal.style.display === 'flex' ? 'none' : 'flex';
                playSound('snap');
            }
            return;
        }

        // Replay modal key bindings
        if (replayModal && replayModal.style.display === 'flex') {
            if (e.code === 'Space') {
                e.preventDefault();
                toggleReplayPlay();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                stepReplayBack();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                stepReplayForward();
            }
            return;
        }

        if (gameSection.style.display !== 'none') {
            const key = e.key.toLowerCase();
            if (key === 'p' && (moveHistory.length > 0 || fullRecordedMoves.length > 0)) {
                openReplayModal();
                return;
            }

            if (isGameActive) {
                if (key === 'g') {
                    toggleGhostBtn.click();
                } else if (key === 'b' && peekGhostBtn) {
                    peekGhostBtn.click();
                } else if (key === 'n' && toggleNumbersBtn) {
                    toggleNumbersBtn.click();
                } else if ((key === 'u' || (e.ctrlKey && key === 'z') || (e.metaKey && key === 'z')) && undoBtn && !undoBtn.disabled) {
                    e.preventDefault();
                    undoBtn.click();
                } else if (key === 'h') {
                    hintBtn.click();
                } else if (key === 'a' && autoSolveBtn) {
                    autoSolveBtn.click();
                } else if (key === 'r') {
                    shuffleBtn.click();
                } else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && puzzleMode === 'sliding') {
                    e.preventDefault();
                    const emptyTile = tiles.find(t => t.isEmpty);
                    if (!emptyTile) return;

                    const size = selectedGridSize;
                    const emptyPos = emptyTile.currentPos;
                    const emptyRow = Math.floor(emptyPos / size);
                    const emptyCol = emptyPos % size;

                    let targetRow = emptyRow;
                    let targetCol = emptyCol;

                    if (key === 'arrowup') targetRow = emptyRow + 1; // Move tile below UP
                    if (key === 'arrowdown') targetRow = emptyRow - 1; // Move tile above DOWN
                    if (key === 'arrowleft') targetCol = emptyCol + 1; // Move tile right LEFT
                    if (key === 'arrowright') targetCol = emptyCol - 1; // Move tile left RIGHT

                    if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
                        const targetPos = targetRow * size + targetCol;
                        const targetTile = tiles.find(t => t.currentPos === targetPos);
                        if (targetTile) {
                            swapTiles(targetTile, emptyTile);
                        }
                    }
                }
            }
        } else if (captureSection.style.display !== 'none' && e.code === 'Space') {
            const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
            if (activeTab === 'camera') {
                e.preventDefault();
                snapPhotoBtn.click();
            }
        }
    });

    // --- SCORE BADGE PNG GENERATOR ---
    const downloadScoreCardBtn = document.getElementById('downloadScoreCardBtn');
    const victoryFrameSelect = document.getElementById('victoryFrameSelect');
    const victoryCaptionInput = document.getElementById('victoryCaptionInput');
    const victoryFontSelect = document.getElementById('victoryFontSelect');
    const victoryTextColor = document.getElementById('victoryTextColor');
    const victoryFontSizeSlider = document.getElementById('victoryFontSizeSlider');

    if (downloadScoreCardBtn) {
        downloadScoreCardBtn.addEventListener('click', () => {
            playSound('click');
            const cardCanvas = document.createElement('canvas');
            cardCanvas.width = 800;
            cardCanvas.height = 600;
            const ctx = cardCanvas.getContext('2d');

            const frameStyle = victoryFrameSelect ? victoryFrameSelect.value : 'glass';
            const userCaption = victoryCaptionInput && victoryCaptionInput.value.trim() ? victoryCaptionInput.value.trim() : 'Shattered & Solved! 🧩';
            const fontChoice = victoryFontSelect ? victoryFontSelect.value : 'Outfit';
            const textColorChoice = victoryTextColor ? victoryTextColor.value : '#ffffff';
            const fontSizeChoice = victoryFontSizeSlider ? parseInt(victoryFontSizeSlider.value) : 20;

            if (frameStyle === 'polaroid') {
                // Retro Polaroid Photo Card Background
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(0, 0, 800, 600);
                
                // Outer Polaroid Shadow / Border
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 4;
                ctx.strokeRect(10, 10, 780, 580);

                // Polaroid Header Title
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 36px "Outfit", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🧩 SnapPuzzle Snapshot', 400, 65);

            } else if (frameStyle === 'filmroll') {
                // Retro 35mm Film Roll Frame
                ctx.fillStyle = '#09090b';
                ctx.fillRect(0, 0, 800, 600);

                // Draw Film Sprocket Holes along left and right borders
                ctx.fillStyle = '#27272a';
                for (let y = 30; y < 580; y += 45) {
                    ctx.fillRect(20, y, 24, 30);
                    ctx.fillRect(756, y, 24, 30);
                }

                ctx.strokeStyle = '#3f3f46';
                ctx.lineWidth = 4;
                ctx.strokeRect(54, 15, 692, 570);

                ctx.fillStyle = '#f43f5e';
                ctx.font = 'bold 36px "Outfit", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('🎞️ 35mm FILM PUZZLE REEL', 400, 65);

            } else if (frameStyle === 'holographic') {
                // Holographic Prism Spectrum Frame
                const holoGrad = ctx.createLinearGradient(0, 0, 800, 600);
                holoGrad.addColorStop(0, '#ec4899');
                holoGrad.addColorStop(0.25, '#8b5cf6');
                holoGrad.addColorStop(0.5, '#3b82f6');
                holoGrad.addColorStop(0.75, '#10b981');
                holoGrad.addColorStop(1, '#f59e0b');
                ctx.fillStyle = holoGrad;
                ctx.fillRect(0, 0, 800, 600);

                ctx.fillStyle = '#0f172a';
                ctx.fillRect(15, 15, 770, 570);

                ctx.strokeStyle = holoGrad;
                ctx.lineWidth = 6;
                ctx.strokeRect(25, 25, 750, 550);

                ctx.fillStyle = '#f472b6';
                ctx.font = 'bold 38px "Outfit", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('💎 HOLOGRAPHIC PRISM REEL', 400, 70);

            } else if (frameStyle === 'neon') {
                // Cyberpunk Neon Glow Background
                ctx.fillStyle = '#05050d';
                ctx.fillRect(0, 0, 800, 600);

                // Dual Glowing Cyber Borders
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 6;
                ctx.strokeRect(15, 15, 770, 570);
                ctx.strokeStyle = '#ec4899';
                ctx.lineWidth = 2;
                ctx.strokeRect(22, 22, 756, 556);

                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 38px "Outfit", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('⚡ CYBER SNAP PUZZLE', 400, 70);

            } else if (frameStyle === 'gold') {
                // Royal Gold Metallic Frame
                const bgGrad = ctx.createRadialGradient(400, 300, 50, 400, 300, 450);
                bgGrad.addColorStop(0, '#1c1917');
                bgGrad.addColorStop(1, '#0c0a09');
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, 800, 600);

                const goldGrad = ctx.createLinearGradient(0, 0, 800, 600);
                goldGrad.addColorStop(0, '#fef08a');
                goldGrad.addColorStop(0.5, '#eab308');
                goldGrad.addColorStop(1, '#854d0e');
                ctx.strokeStyle = goldGrad;
                ctx.lineWidth = 8;
                ctx.strokeRect(20, 20, 760, 560);

                ctx.fillStyle = '#fef08a';
                ctx.font = 'bold 38px "Outfit", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🏆 ROYAL PUZZLE VICTORY 🥇', 400, 70);

            } else {
                // Classic Cyber Glass (Default)
                const bgGrad = ctx.createLinearGradient(0, 0, 800, 600);
                bgGrad.addColorStop(0, '#090d16');
                bgGrad.addColorStop(1, '#1e1b4b');
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, 800, 600);

                ctx.strokeStyle = '#6366f1';
                ctx.lineWidth = 4;
                ctx.strokeRect(20, 20, 760, 560);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 36px "Outfit", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🧩 SnapPuzzle Champion', 400, 70);
            }

            // Draw Photo Snapshot
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                if (frameStyle === 'polaroid') {
                    // Photo Inner Border
                    ctx.fillStyle = '#020617';
                    ctx.fillRect(245, 95, 310, 310);
                    ctx.drawImage(img, 250, 100, 300, 300);

                    // Custom Styled Caption
                    ctx.fillStyle = textColorChoice === '#ffffff' ? '#334155' : textColorChoice;
                    ctx.font = `italic bold ${fontSizeChoice + 4}px "${fontChoice}", sans-serif`;
                    ctx.fillText(`"${userCaption}"`, 400, 440);

                    ctx.fillStyle = '#64748b';
                    ctx.font = '18px sans-serif';
                    ctx.fillText(`Mode: ${puzzleMode.toUpperCase()} (${selectedGridSize}x${selectedGridSize})  |  ⏱️ ${timerDisplay.textContent}  |  🎯 ${movesCount} Moves`, 400, 485);

                    ctx.fillStyle = '#f59e0b';
                    ctx.font = '26px sans-serif';
                    ctx.fillText(finalStars.textContent, 400, 530);
                } else {
                    ctx.drawImage(img, 240, 100, 320, 320);

                    // Custom Styled Caption
                    ctx.fillStyle = textColorChoice;
                    ctx.font = `italic bold ${fontSizeChoice}px "${fontChoice}", sans-serif`;
                    ctx.fillText(`"${userCaption}"`, 400, 450);

                    // Stats Section
                    ctx.fillStyle = frameStyle === 'neon' ? '#38bdf8' : (frameStyle === 'gold' ? '#e2e8f0' : '#94a3b8');
                    ctx.font = '18px sans-serif';
                    ctx.fillText(`Mode: ${puzzleMode.toUpperCase()} (${selectedGridSize}x${selectedGridSize})`, 400, 485);

                    ctx.fillStyle = frameStyle === 'neon' ? '#67e8f9' : (frameStyle === 'gold' ? '#facc15' : '#38bdf8');
                    ctx.font = 'bold 22px sans-serif';
                    ctx.fillText(`⏱️ Time: ${timerDisplay.textContent}   |   🎯 Moves: ${movesCount}`, 400, 520);

                    ctx.fillStyle = '#facc15';
                    ctx.font = '26px sans-serif';
                    ctx.fillText(finalStars.textContent, 400, 555);
                }

                // Trigger PNG Download
                const link = document.createElement('a');
                link.download = `SnapPuzzle_${frameStyle.toUpperCase()}_ScoreCard.png`;
                link.href = cardCanvas.toDataURL('image/png');
                link.click();
            };
            img.src = currentPhotoDataUrl;
        });
    }

    const exportBadgeCardBtn = document.getElementById('exportBadgeCardBtn');
    if (exportBadgeCardBtn) {
        exportBadgeCardBtn.addEventListener('click', () => {
            playSound('achievement');
            const cardCanvas = document.createElement('canvas');
            cardCanvas.width = 840;
            cardCanvas.height = 540;
            const ctx = cardCanvas.getContext('2d');

            // Rich Gradient Background
            const bgGrad = ctx.createLinearGradient(0, 0, 840, 540);
            bgGrad.addColorStop(0, '#060b19');
            bgGrad.addColorStop(0.5, '#0f172a');
            bgGrad.addColorStop(1, '#1e1b4b');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, 840, 540);

            // Glowing Outer Glass Border
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 6;
            ctx.strokeRect(16, 16, 808, 508);
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.strokeRect(24, 24, 792, 492);

            // Decorative Corner Accent Lines
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 4;
            // Top-Left
            ctx.beginPath(); ctx.moveTo(16, 50); ctx.lineTo(16, 16); ctx.lineTo(50, 16); ctx.stroke();
            // Top-Right
            ctx.beginPath(); ctx.moveTo(790, 16); ctx.lineTo(824, 16); ctx.lineTo(824, 50); ctx.stroke();
            // Bottom-Left
            ctx.beginPath(); ctx.moveTo(16, 490); ctx.lineTo(16, 524); ctx.lineTo(50, 524); ctx.stroke();
            // Bottom-Right
            ctx.beginPath(); ctx.moveTo(790, 524); ctx.lineTo(824, 524); ctx.lineTo(824, 490); ctx.stroke();

            // Header Section
            ctx.fillStyle = '#34d399';
            ctx.font = '800 28px "Outfit", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('🧩 SNAPPUZZLE MASTER BADGE', 45, 60);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '500 14px "Inter", sans-serif';
            ctx.fillText('OFFICIAL COMPLETION CERTIFICATE & STATS CARD', 45, 82);

            // Divider Line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(45, 96);
            ctx.lineTo(795, 96);
            ctx.stroke();

            // Photo Preview Frame (Left Column)
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                // Photo Card Background
                ctx.fillStyle = '#020617';
                ctx.fillRect(45, 115, 300, 300);
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 3;
                ctx.strokeRect(45, 115, 300, 300);

                ctx.drawImage(img, 50, 120, 290, 290);

                // User Victory Caption Under Image
                const captionVal = victoryCaptionInput && victoryCaptionInput.value.trim() ? victoryCaptionInput.value.trim() : 'Shattered & Solved! 🧩';
                ctx.fillStyle = '#f8fafc';
                ctx.font = 'italic 600 16px "Outfit", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`"${captionVal}"`, 195, 442);

                // Right Column Stats & Badges
                const timeText = document.getElementById('finalTime') ? document.getElementById('finalTime').textContent : '00:00';
                const movesText = document.getElementById('finalMoves') ? document.getElementById('finalMoves').textContent : '0';
                const starsText = document.getElementById('finalStars') ? document.getElementById('finalStars').textContent : '⭐⭐⭐';

                // Stats Box 1: Time
                drawBadgeStatBox(ctx, 370, 115, 200, 85, '⏱️ TIME TAKEN', timeText, '#6366f1');
                // Stats Box 2: Moves
                drawBadgeStatBox(ctx, 590, 115, 200, 85, '🎯 TOTAL MOVES', movesText, '#10b981');
                // Stats Box 3: Grid Size
                drawBadgeStatBox(ctx, 370, 215, 200, 85, '🧩 GRID RESOLUTION', `${selectedGridSize}×${selectedGridSize} (${puzzleMode.toUpperCase()})`, '#f59e0b');
                // Stats Box 4: Star Rating
                drawBadgeStatBox(ctx, 590, 215, 200, 85, '⭐ STAR RATING', starsText, '#ec4899');

                // Large Master Trophy Badge Banner
                ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(370, 315, 420, 100, 12); else ctx.rect(370, 315, 420, 100);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#34d399';
                ctx.font = '800 22px "Outfit", sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('🏆 UNSTOPPABLE PUZZLE MASTER', 390, 352);

                ctx.fillStyle = '#cbd5e1';
                ctx.font = '500 14px "Inter", sans-serif';
                ctx.fillText(`Verified Solved on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 390, 382);

                // Footer watermark branding
                ctx.fillStyle = '#64748b';
                ctx.font = '600 13px "Outfit", sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText('Generated by SnapPuzzle Web App • https://github.com/sushantguri/Puzzle_photo', 795, 495);

                // Download image trigger
                const link = document.createElement('a');
                link.download = `SnapPuzzle_Master_Badge_${Date.now()}.png`;
                link.href = cardCanvas.toDataURL('image/png');
                link.click();

                showToast('🎴 Puzzle Master Badge Card exported!', 'Badge Downloaded');
            };
            img.src = currentPhotoDataUrl || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80';
        });
    }

    function drawBadgeStatBox(ctx, x, y, w, h, label, val, accentColor) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, 10); else ctx.rect(x, y, w, h);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 12px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, x + 14, y + 26);

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 20px "Outfit", sans-serif';
        ctx.fillText(val, x + 14, y + 60);
    }

    const showAnalyticsBtn = document.getElementById('showAnalyticsBtn');
    const analyticsModal = document.getElementById('analyticsModal');
    const closeAnalyticsBtn = document.getElementById('closeAnalyticsBtn');
    const closeAnalyticsFooterBtn = document.getElementById('closeAnalyticsFooterBtn');
    const heatmapCanvas = document.getElementById('heatmapCanvas');

    if (showAnalyticsBtn && analyticsModal) {
        showAnalyticsBtn.addEventListener('click', () => {
            renderHeatmapAnalytics();
            analyticsModal.style.display = 'flex';
            playSound('click');
        });

        [closeAnalyticsBtn, closeAnalyticsFooterBtn].forEach(btn => {
            if (btn) btn.addEventListener('click', () => {
                analyticsModal.style.display = 'none';
                playSound('click');
            });
        });
    }

    function renderHeatmapAnalytics() {
        if (!heatmapCanvas) return;
        const ctx = heatmapCanvas.getContext('2d');
        const w = heatmapCanvas.width;
        const h = heatmapCanvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        const size = selectedGridSize;
        const totalTiles = size * size;
        const moveCounts = {};
        for (let i = 0; i < totalTiles; i++) moveCounts[i] = 0;

        fullRecordedMoves.forEach(m => {
            if (m.tileAId !== undefined) moveCounts[m.tileAId] = (moveCounts[m.tileAId] || 0) + 1;
            if (m.tileBId !== undefined) moveCounts[m.tileBId] = (moveCounts[m.tileBId] || 0) + 1;
        });

        let maxSwaps = 1;
        let hotspotTileId = 0;
        Object.keys(moveCounts).forEach(id => {
            if (moveCounts[id] > maxSwaps) {
                maxSwaps = moveCounts[id];
                hotspotTileId = parseInt(id);
            }
        });

        const margin = 20;
        const gridW = w - margin * 2;
        const gridH = h - margin * 2;
        const cellW = gridW / size;
        const cellH = gridH / size;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const tileId = r * size + c;
                const swaps = moveCounts[tileId] || 0;
                const ratio = Math.min(1, swaps / Math.max(1, maxSwaps));

                const x = margin + c * cellW;
                const y = margin + r * cellH;

                let cellColor = '#06b6d4';
                if (ratio > 0.6) cellColor = '#ef4444';
                else if (ratio > 0.3) cellColor = '#f59e0b';

                ctx.fillStyle = cellColor;
                ctx.globalAlpha = 0.25 + ratio * 0.65;
                ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);

                ctx.strokeStyle = cellColor;
                ctx.globalAlpha = 0.8;
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 2, y + 2, cellW - 4, cellH - 4);

                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 1;
                ctx.font = 'bold 16px "Outfit", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`Tile #${tileId + 1}`, x + cellW / 2, y + cellH / 2 - 4);

                ctx.fillStyle = '#cbd5e1';
                ctx.font = '12px "Inter", sans-serif';
                ctx.fillText(`${swaps} swaps`, x + cellW / 2, y + cellH / 2 + 16);
            }
        }

        const minPossibleMoves = size * size;
        const efficiencyPct = Math.max(50, Math.min(100, Math.round((minPossibleMoves / Math.max(1, movesCount)) * 100)));
        const avgPaceSec = movesCount > 0 ? (secondsElapsed / movesCount).toFixed(1) : '0.0';

        const analyticsEfficiencyVal = document.getElementById('analyticsEfficiencyVal');
        const analyticsHotspotVal = document.getElementById('analyticsHotspotVal');
        const analyticsPaceVal = document.getElementById('analyticsPaceVal');

        if (analyticsEfficiencyVal) analyticsEfficiencyVal.textContent = `${efficiencyPct}%`;
        if (analyticsHotspotVal) analyticsHotspotVal.textContent = `Tile #${hotspotTileId + 1} (${maxSwaps} swaps)`;
        if (analyticsPaceVal) analyticsPaceVal.textContent = `${avgPaceSec}s / move`;
    }

    const themeStudioModal = document.getElementById('themeStudioModal');
    const closeThemeStudioBtn = document.getElementById('closeThemeStudioBtn');
    const applyCustomThemeBtn = document.getElementById('applyCustomThemeBtn');
    const exportThemeJsonBtn = document.getElementById('exportThemeJsonBtn');
    const themeAccentColor = document.getElementById('themeAccentColor');
    const themeBgStartColor = document.getElementById('themeBgStartColor');
    const themeBgEndColor = document.getElementById('themeBgEndColor');
    const themeBlurSlider = document.getElementById('themeBlurSlider');

    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                if (themeStudioModal) themeStudioModal.style.display = 'flex';
            } else {
                applyTheme(e.target.value);
            }
            unlockAchievement('palette_explorer');
            playSound('click');
        });
    }

    if (closeThemeStudioBtn) {
        closeThemeStudioBtn.addEventListener('click', () => {
            if (themeStudioModal) themeStudioModal.style.display = 'none';
            playSound('click');
        });
    }

    if (applyCustomThemeBtn) {
        applyCustomThemeBtn.addEventListener('click', () => {
            const accent = themeAccentColor ? themeAccentColor.value : '#6366f1';
            const bgStart = themeBgStartColor ? themeBgStartColor.value : '#0f172a';
            const bgEnd = themeBgEndColor ? themeBgEndColor.value : '#1e1b4b';

            document.documentElement.style.setProperty('--accent-primary', accent);
            document.documentElement.style.setProperty('--bg-gradient-start', bgStart);
            document.documentElement.style.setProperty('--bg-gradient-end', bgEnd);

            const customThemeObj = { accent, bgStart, bgEnd };
            localStorage.setItem('snappuzzle_custom_theme', JSON.stringify(customThemeObj));

            if (themeStudioModal) themeStudioModal.style.display = 'none';
            playSound('snap');
            showToast('🎨 Custom Theme Studio Palette Applied!', 'Theme Studio');
        });
    }

    if (exportThemeJsonBtn) {
        exportThemeJsonBtn.addEventListener('click', () => {
            const accent = themeAccentColor ? themeAccentColor.value : '#6366f1';
            const bgStart = themeBgStartColor ? themeBgStartColor.value : '#0f172a';
            const bgEnd = themeBgEndColor ? themeBgEndColor.value : '#1e1b4b';

            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ name: "Custom Palette", accent, bgStart, bgEnd }, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', dataStr);
            downloadAnchor.setAttribute('download', 'SnapPuzzle_CustomTheme.json');
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            playSound('click');
        });
    }

    // Apply initial saved theme
    applyTheme(savedTheme);

    // --- AMBIENT BACKGROUND PARTICLE ENGINE ---
    const bgCanvas = document.getElementById('bgParticleCanvas');
    const ambientBgSelect = document.getElementById('ambientBgSelect');
    let bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;
    let bgParticles = [];
    let bgAnimFrame = null;
    let currentAmbientEffect = localStorage.getItem('snappuzzle_ambient_bg') || 'starfield';
    let mouseX = 0;
    let mouseY = 0;

    if (ambientBgSelect) {
        ambientBgSelect.value = currentAmbientEffect;
    }

    function initBgCanvasSize() {
        if (!bgCanvas) return;
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', () => {
        initBgCanvasSize();
        createBgParticles();
    });
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function createBgParticles() {
        if (!bgCanvas) return;
        bgParticles = [];
        const w = bgCanvas.width;
        const h = bgCanvas.height;
        const count = Math.min(Math.floor((w * h) / 18000), 75);

        for (let i = 0; i < count; i++) {
            bgParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 0.4,
                speedY: (Math.random() - 0.5) * 0.4,
                alpha: Math.random() * 0.7 + 0.3,
                pulseSpeed: Math.random() * 0.02 + 0.005,
                char: ['0', '1', '🧩', '★', '◇', '▲'][Math.floor(Math.random() * 6)],
                color: ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'][Math.floor(Math.random() * 5)]
            });
        }
    }

    function renderBgParticles() {
        if (!bgCanvas || !bgCtx || currentAmbientEffect === 'off') {
            if (bgCtx && bgCanvas) bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
            return;
        }

        const w = bgCanvas.width;
        const h = bgCanvas.height;
        bgCtx.clearRect(0, 0, w, h);

        bgParticles.forEach(p => {
            p.x += p.speedX + (mouseX - w / 2) * 0.00005;
            p.y += p.speedY + (mouseY - h / 2) * 0.00005;
            p.alpha += Math.sin(Date.now() * p.pulseSpeed) * 0.005;
            if (p.alpha > 0.95) p.alpha = 0.95;
            if (p.alpha < 0.15) p.alpha = 0.15;

            if (p.x < 0) p.x = w;
            if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h;
            if (p.y > h) p.y = 0;

            bgCtx.save();
            bgCtx.globalAlpha = p.alpha;

            if (currentAmbientEffect === 'starfield') {
                bgCtx.fillStyle = p.color;
                bgCtx.shadowColor = p.color;
                bgCtx.shadowBlur = 8;
                bgCtx.beginPath();
                bgCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                bgCtx.fill();
            } else if (currentAmbientEffect === 'matrix') {
                bgCtx.fillStyle = '#10b981';
                bgCtx.font = `${Math.floor(p.size * 5 + 10)}px monospace`;
                bgCtx.shadowColor = '#10b981';
                bgCtx.shadowBlur = 5;
                bgCtx.fillText(p.char, p.x, p.y);
            } else if (currentAmbientEffect === 'aurora') {
                bgCtx.fillStyle = p.color;
                bgCtx.shadowColor = p.color;
                bgCtx.shadowBlur = 15;
                bgCtx.beginPath();
                bgCtx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
                bgCtx.fill();
            } else if (currentAmbientEffect === 'bokeh') {
                bgCtx.fillStyle = p.color;
                bgCtx.shadowColor = p.color;
                bgCtx.shadowBlur = 20;
                bgCtx.beginPath();
                bgCtx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
                bgCtx.fill();
            }

            bgCtx.restore();
        });

        bgAnimFrame = requestAnimationFrame(renderBgParticles);
    }

    function setAmbientEffect(effect) {
        currentAmbientEffect = effect;
        localStorage.setItem('snappuzzle_ambient_bg', effect);
        if (bgAnimFrame) cancelAnimationFrame(bgAnimFrame);
        if (effect !== 'off') {
            initBgCanvasSize();
            createBgParticles();
            renderBgParticles();
        } else if (bgCtx && bgCanvas) {
            bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        }
    }

    if (ambientBgSelect) {
        ambientBgSelect.addEventListener('change', (e) => {
            setAmbientEffect(e.target.value);
            playSound('click');
        });
    }

    setAmbientEffect(currentAmbientEffect);

    // --- CROP & FRAMING STUDIO ENGINE ---
    const openCropModalBtn = document.getElementById('openCropModalBtn');
    const cropModal = document.getElementById('cropModal');
    const closeCropModalBtn = document.getElementById('closeCropModalBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    const applyCropBtn = document.getElementById('applyCropBtn');
    const resetCropBtn = document.getElementById('resetCropBtn');
    const cropCanvas = document.getElementById('cropCanvas');
    const cropCtx = cropCanvas ? cropCanvas.getContext('2d') : null;
    const cropGuideGrid = document.getElementById('cropGuideGrid');
    const cropZoomSlider = document.getElementById('cropZoomSlider');
    const cropZoomVal = document.getElementById('cropZoomVal');
    const cropRatioBtns = document.querySelectorAll('.crop-ratio-btn');
    const cropViewportContainer = document.querySelector('.crop-viewport-container');

    let cropZoom = 1;
    let cropPanX = 0;
    let cropPanY = 0;
    let cropRatio = '1:1';
    let cropImgObj = null;
    let isDraggingCrop = false;
    let cropDragStartX = 0;
    let cropDragStartY = 0;

    function renderCropPreview() {
        if (!cropImgObj || !cropCanvas || !cropCtx) return;

        const cw = cropCanvas.width;
        const ch = cropCanvas.height;
        cropCtx.clearRect(0, 0, cw, ch);

        // Fill dark background
        cropCtx.fillStyle = '#090d16';
        cropCtx.fillRect(0, 0, cw, ch);

        const imgAspect = cropImgObj.width / cropImgObj.height;

        // Base destination fit box
        let baseW = cw;
        let baseH = cw / imgAspect;
        if (baseH < ch) {
            baseH = ch;
            baseW = ch * imgAspect;
        }

        const zoomedW = baseW * cropZoom;
        const zoomedH = baseH * cropZoom;

        // Center position + pan offset
        const drawX = (cw - zoomedW) / 2 + cropPanX;
        const drawY = (ch - zoomedH) / 2 + cropPanY;

        cropCtx.drawImage(cropImgObj, drawX, drawY, zoomedW, zoomedH);

        // Adjust guide grid overlay ratio styling
        if (cropGuideGrid) {
            if (cropRatio === '1:1') {
                const side = Math.min(cw, ch) * 0.85;
                cropGuideGrid.style.width = `${side}px`;
                cropGuideGrid.style.height = `${side}px`;
                cropGuideGrid.style.left = `${(cw - side) / 2}px`;
                cropGuideGrid.style.top = `${(ch - side) / 2}px`;
            } else if (cropRatio === '4:3') {
                const h = ch * 0.85;
                const w = h * (4 / 3);
                cropGuideGrid.style.width = `${w}px`;
                cropGuideGrid.style.height = `${h}px`;
                cropGuideGrid.style.left = `${(cw - w) / 2}px`;
                cropGuideGrid.style.top = `${(ch - h) / 2}px`;
            } else if (cropRatio === '16:9') {
                const w = cw * 0.9;
                const h = w * (9 / 16);
                cropGuideGrid.style.width = `${w}px`;
                cropGuideGrid.style.height = `${h}px`;
                cropGuideGrid.style.left = `${(cw - w) / 2}px`;
                cropGuideGrid.style.top = `${(ch - h) / 2}px`;
            } else {
                cropGuideGrid.style.width = '100%';
                cropGuideGrid.style.height = '100%';
                cropGuideGrid.style.left = '0px';
                cropGuideGrid.style.top = '0px';
            }
        }
    }

    function openCropStudio() {
        if (!currentPhotoDataUrl) return;

        cropImgObj = new Image();
        cropImgObj.crossOrigin = 'anonymous';
        cropImgObj.onload = () => {
            cropZoom = 1;
            cropPanX = 0;
            cropPanY = 0;
            cropRatio = '1:1';
            if (cropZoomSlider) cropZoomSlider.value = 100;
            if (cropZoomVal) cropZoomVal.textContent = '100%';
            
            cropRatioBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.ratio === '1:1');
            });

            if (cropModal) cropModal.style.display = 'flex';
            renderCropPreview();
        };
        cropImgObj.src = currentPhotoDataUrl;
    }

    if (openCropModalBtn) {
        openCropModalBtn.addEventListener('click', () => {
            playSound('click');
            openCropStudio();
        });
    }

    if (closeCropModalBtn) {
        closeCropModalBtn.addEventListener('click', () => {
            if (cropModal) cropModal.style.display = 'none';
            playSound('click');
        });
    }

    if (cancelCropBtn) {
        cancelCropBtn.addEventListener('click', () => {
            if (cropModal) cropModal.style.display = 'none';
            playSound('click');
        });
    }

    if (resetCropBtn) {
        resetCropBtn.addEventListener('click', () => {
            cropZoom = 1;
            cropPanX = 0;
            cropPanY = 0;
            if (cropZoomSlider) cropZoomSlider.value = 100;
            if (cropZoomVal) cropZoomVal.textContent = '100%';
            renderCropPreview();
            playSound('click');
        });
    }

    if (cropZoomSlider) {
        cropZoomSlider.addEventListener('input', (e) => {
            cropZoom = parseInt(e.target.value, 10) / 100;
            if (cropZoomVal) cropZoomVal.textContent = `${e.target.value}%`;
            renderCropPreview();
        });
    }

    cropRatioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            cropRatioBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cropRatio = btn.dataset.ratio;
            renderCropPreview();
            playSound('click');
        });
    });

    if (cropViewportContainer) {
        const handleStart = (clientX, clientY) => {
            isDraggingCrop = true;
            cropDragStartX = clientX - cropPanX;
            cropDragStartY = clientY - cropPanY;
            cropViewportContainer.style.cursor = 'grabbing';
        };

        const handleMove = (clientX, clientY) => {
            if (!isDraggingCrop) return;
            cropPanX = clientX - cropDragStartX;
            cropPanY = clientY - cropDragStartY;
            renderCropPreview();
        };

        const handleEnd = () => {
            isDraggingCrop = false;
            cropViewportContainer.style.cursor = 'grab';
        };

        cropViewportContainer.addEventListener('mousedown', (e) => handleStart(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', handleEnd);

        cropViewportContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                handleStart(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (isDraggingCrop && e.touches.length === 1) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
        window.addEventListener('touchend', handleEnd);
    }

    if (applyCropBtn) {
        applyCropBtn.addEventListener('click', () => {
            if (!cropImgObj) return;

            const targetCanvas = document.createElement('canvas');
            let tw = 600;
            let th = 600;

            if (cropRatio === '4:3') {
                tw = 800; th = 600;
            } else if (cropRatio === '16:9') {
                tw = 960; th = 540;
            } else if (cropRatio === 'free') {
                tw = cropCanvas ? cropCanvas.width : 600;
                th = cropCanvas ? cropCanvas.height : 600;
            }

            targetCanvas.width = tw;
            targetCanvas.height = th;
            const tCtx = targetCanvas.getContext('2d');

            tCtx.fillStyle = '#000';
            tCtx.fillRect(0, 0, tw, th);

            const cw = cropCanvas.width;
            const ch = cropCanvas.height;
            const scaleX = tw / cw;
            const scaleY = th / ch;

            tCtx.save();
            tCtx.scale(scaleX, scaleY);
            tCtx.drawImage(cropCanvas, 0, 0);
            tCtx.restore();

            const croppedDataUrl = targetCanvas.toDataURL('image/jpeg', 0.92);
            currentPhotoDataUrl = croppedDataUrl;
            if (photoPreviewImg) photoPreviewImg.src = croppedDataUrl;
            if (cropModal) cropModal.style.display = 'none';

            playSound('snap');
            showToast('✂️ Photo Cropped & Framed!', 'Achievement Unlocked');
    // --- HOTKEYS GUIDE MODAL ENGINE ---
    const openHotkeysBtn = document.getElementById('openHotkeysBtn');
    const hotkeysModal = document.getElementById('hotkeysModal');
    const closeHotkeysModalBtn = document.getElementById('closeHotkeysModalBtn');
    const okHotkeysBtn = document.getElementById('okHotkeysBtn');

    if (openHotkeysBtn && hotkeysModal) {
        openHotkeysBtn.addEventListener('click', () => {
            hotkeysModal.style.display = 'flex';
            playSound('snap');
        });
    }
    if (closeHotkeysModalBtn && hotkeysModal) {
        closeHotkeysModalBtn.addEventListener('click', () => {
            hotkeysModal.style.display = 'none';
        });
    }
    if (okHotkeysBtn && hotkeysModal) {
        okHotkeysBtn.addEventListener('click', () => {
            hotkeysModal.style.display = 'none';
        });
    }

    // --- SERVICE WORKER & PWA INSTALL PROMPT ---
    let deferredPrompt = null;
    const pwaInstallBtn = document.getElementById('pwaInstallBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (pwaInstallBtn) {
            pwaInstallBtn.style.display = 'inline-flex';
        }
    });

    if (pwaInstallBtn) {
        pwaInstallBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                pwaInstallBtn.style.display = 'none';
                playSound('achievement');
            }
            deferredPrompt = null;
        });
    }

    window.addEventListener('appinstalled', () => {
        if (pwaInstallBtn) pwaInstallBtn.style.display = 'none';
        deferredPrompt = null;
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('SnapPuzzle Service Worker registered:', reg.scope))
                .catch(err => console.warn('Service Worker registration failed:', err));
        });
    }

    // --- SAVE & LOAD GAME MANAGER ENGINE ---
    const saveLoadModalBtn = document.getElementById('saveLoadModalBtn');
    const saveLoadModal = document.getElementById('saveLoadModal');
    const closeSaveLoadBtn = document.getElementById('closeSaveLoadBtn');
    const closeSaveLoadFooterBtn = document.getElementById('closeSaveLoadFooterBtn');
    const quickAutoSaveBtn = document.getElementById('quickAutoSaveBtn');
    const saveSlotsContainer = document.getElementById('saveSlotsContainer');

    function renderSaveSlotsModal() {
        if (!saveSlotsContainer) return;
        saveSlotsContainer.innerHTML = '';
        for (let i = 1; i <= 3; i++) {
            const rawData = localStorage.getItem(`snappuzzle_saveslot_${i}`);
            const slotCard = document.createElement('div');
            slotCard.className = 'save-slot-card';

            if (rawData) {
                try {
                    const data = JSON.parse(rawData);
                    const minutes = Math.floor(data.secondsElapsed / 60).toString().padStart(2, '0');
                    const secs = (data.secondsElapsed % 60).toString().padStart(2, '0');
                    slotCard.innerHTML = `
                        <img src="${data.photoDataUrl || 'https://via.placeholder.com/60'}" class="save-slot-thumb" alt="Saved Game Snapshot">
                        <div class="save-slot-details">
                            <div class="save-slot-title">
                                <span>Slot ${i}</span>
                                <span class="badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc; padding:2px 8px; border-radius:6px; font-size:0.75rem;">${data.gridSize}x${data.gridSize} ${data.puzzleMode}</span>
                            </div>
                            <div class="save-slot-meta">
                                <span>⏱️ ${minutes}:${secs}</span>
                                <span>🎯 ${data.movesCount} Moves</span>
                                <span>📅 ${data.timestamp || 'Saved'}</span>
                            </div>
                        </div>
                        <div class="save-slot-actions">
                            <button class="btn btn-primary btn-sm load-slot-btn" data-slot="${i}" title="Resume saved puzzle">Load</button>
                            <button class="btn btn-secondary btn-sm save-slot-btn" data-slot="${i}" title="Overwrite this slot">Save</button>
                            <button class="btn btn-outline-danger btn-sm delete-slot-btn" data-slot="${i}" title="Delete save data">&times;</button>
                        </div>
                    `;
                } catch (e) {
                    renderEmptySlotUI(slotCard, i);
                }
            } else {
                renderEmptySlotUI(slotCard, i);
            }
            saveSlotsContainer.appendChild(slotCard);
        }

        // Attach slot action buttons listeners
        saveSlotsContainer.querySelectorAll('.load-slot-btn').forEach(btn => {
            btn.addEventListener('click', () => loadGameStateFromSlot(btn.dataset.slot));
        });
        saveSlotsContainer.querySelectorAll('.save-slot-btn').forEach(btn => {
            btn.addEventListener('click', () => saveGameStateToSlot(btn.dataset.slot));
        });
        saveSlotsContainer.querySelectorAll('.delete-slot-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteSaveSlot(btn.dataset.slot));
        });
    }

    function renderEmptySlotUI(slotCard, slotId) {
        slotCard.innerHTML = `
            <div class="save-slot-thumb save-slot-empty-thumb">💾</div>
            <div class="save-slot-details">
                <div class="save-slot-title" style="color:var(--text-muted);">Slot ${slotId} (Empty)</div>
                <div class="save-slot-meta">No saved game state</div>
            </div>
            <div class="save-slot-actions">
                <button class="btn btn-secondary btn-sm save-slot-btn" data-slot="${slotId}">Save Here</button>
            </div>
        `;
    }

    function saveGameStateToSlot(slotId) {
        if (!currentPhotoDataUrl) {
            showToast('⚠️ No active photo puzzle to save!', 'Save Warning');
            return;
        }
        const saveData = {
            slotId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
            gridSize: selectedGridSize,
            puzzleMode: puzzleMode,
            shape: selectedShape,
            movesCount: movesCount,
            secondsElapsed: secondsElapsed,
            timerMode: timerMode,
            photoDataUrl: currentPhotoDataUrl,
            tiles: tiles.map(t => ({ id: t.id, currentPos: t.currentPos, correctPos: t.correctPos, empty: t.empty })),
            moveHistory: moveHistory
        };
        try {
            localStorage.setItem(`snappuzzle_saveslot_${slotId}`, JSON.stringify(saveData));
            playSound('snap');
            showToast(`💾 Game saved to Slot ${slotId}!`, 'Saved Successfully');
            renderSaveSlotsModal();
        } catch (err) {
            showToast('❌ Save failed (Storage full)', 'Storage Error');
        }
    }

    function loadGameStateFromSlot(slotId) {
        const rawData = localStorage.getItem(`snappuzzle_saveslot_${slotId}`);
        if (!rawData) return;
        try {
            const data = JSON.parse(rawData);
            currentPhotoDataUrl = data.photoDataUrl;
            selectedGridSize = data.gridSize || 3;
            puzzleMode = data.puzzleMode || 'sliding';
            selectedShape = data.shape || 'square';
            movesCount = data.movesCount || 0;
            secondsElapsed = data.secondsElapsed || 0;
            timerMode = data.timerMode || 'stopwatch';
            moveHistory = data.moveHistory || [];

            // Restore image preview & guide
            if (photoPreviewImg) photoPreviewImg.src = currentPhotoDataUrl;
            if (ghostImg) ghostImg.src = currentPhotoDataUrl;

            // Hide previous sections and show game board
            captureSection.style.display = 'none';
            configSection.style.display = 'none';
            gameSection.style.display = 'block';
            headerStats.style.display = 'flex';
            if (resetAppBtn) resetAppBtn.style.display = 'inline-block';

            // Restore tiles array
            tiles = data.tiles.map(t => ({ ...t }));
            isGameActive = true;

            // Rebuild visual board
            if (typeof renderBoard === 'function') {
                renderBoard();
            } else if (puzzleBoard) {
                puzzleBoard.innerHTML = '';
                // Render restored tiles
                tiles.forEach(tile => {
                    const tileEl = document.createElement('div');
                    tileEl.className = `tile ${tile.empty ? 'empty' : ''}`;
                    tileEl.dataset.id = tile.id;
                    if (!tile.empty && currentPhotoDataUrl) {
                        tileEl.style.backgroundImage = `url(${currentPhotoDataUrl})`;
                    }
                    puzzleBoard.appendChild(tileEl);
                });
            }

            // Reset and start timer
            clearInterval(gameTimer);
            gameTimer = setInterval(() => {
                secondsElapsed++;
                if (timerDisplay) {
                    const mins = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
                    const secs = (secondsElapsed % 60).toString().padStart(2, '0');
                    timerDisplay.textContent = `${mins}:${secs}`;
                }
            }, 1000);

            if (moveDisplay) moveDisplay.textContent = `${movesCount} Moves`;

            if (saveLoadModal) saveLoadModal.style.display = 'none';
            playSound('win');
            showToast(`🚀 Slot ${slotId} Loaded! Resume play!`, 'Game Resumed');
        } catch (err) {
            showToast('❌ Error loading saved slot', 'Corrupted File');
        }
    }

    function deleteSaveSlot(slotId) {
        localStorage.removeItem(`snappuzzle_saveslot_${slotId}`);
        playSound('click');
        showToast(`🗑️ Slot ${slotId} deleted`, 'Slot Cleared');
        renderSaveSlotsModal();
    }

    if (saveLoadModalBtn && saveLoadModal) {
        saveLoadModalBtn.addEventListener('click', () => {
            renderSaveSlotsModal();
            saveLoadModal.style.display = 'flex';
            playSound('snap');
        });
    }
    if (closeSaveLoadBtn && saveLoadModal) {
        closeSaveLoadBtn.addEventListener('click', () => saveLoadModal.style.display = 'none');
    }
    if (closeSaveLoadFooterBtn && saveLoadModal) {
        closeSaveLoadFooterBtn.addEventListener('click', () => saveLoadModal.style.display = 'none');
    }
    if (quickAutoSaveBtn) {
        quickAutoSaveBtn.addEventListener('click', () => {
            saveGameStateToSlot(1);
        });
    }

    const openFxStudioBtn = document.getElementById('openFxStudioBtn');
    const fxStudioModal = document.getElementById('fxStudioModal');
    const closeFxStudioBtn = document.getElementById('closeFxStudioBtn');
    const closeFxStudioFooterBtn = document.getElementById('closeFxStudioFooterBtn');
    const fxParticleShapeSelect = document.getElementById('fxParticleShapeSelect');
    const fxParticleCountSlider = document.getElementById('fxParticleCountSlider');

    if (openFxStudioBtn && fxStudioModal) {
        openFxStudioBtn.addEventListener('click', () => {
            fxStudioModal.style.display = 'flex';
            playSound('click');
        });

        [closeFxStudioBtn, closeFxStudioFooterBtn].forEach(btn => {
            if (btn) btn.addEventListener('click', () => {
                fxStudioModal.style.display = 'none';
                playSound('click');
            });
        });
    }

    // ----------------------------------------------------
    // DYNAMIC TILE SNAP SPARKLE & SHOCKWAVE PARTICLE FX
    // ----------------------------------------------------
    let tileFxParticles = [];
    let tileFxRings = [];
    let tileFxAnimId = null;

    function triggerTileSnapFx(tileA, tileB) {
        const tileFxCanvas = document.getElementById('tileFxCanvas');
        if (!tileFxCanvas) return;
        const rect = tileFxCanvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        if (tileFxCanvas.width !== Math.floor(rect.width) || tileFxCanvas.height !== Math.floor(rect.height)) {
            tileFxCanvas.width = Math.floor(rect.width);
            tileFxCanvas.height = Math.floor(rect.height);
        }

        if (puzzleWrapper) {
            puzzleWrapper.classList.remove('shake-impact');
            void puzzleWrapper.offsetWidth;
            puzzleWrapper.classList.add('shake-impact');
            setTimeout(() => {
                puzzleWrapper.classList.remove('shake-impact');
            }, 150);
        }

        const size = selectedGridSize || 3;
        const tileW = tileFxCanvas.width / size;
        const tileH = tileFxCanvas.height / size;

        const chosenShape = fxParticleShapeSelect ? fxParticleShapeSelect.value : 'star';
        const userParticleCount = fxParticleCountSlider ? parseInt(fxParticleCountSlider.value) : 28;

        const tilesToFx = [tileA, tileB].filter(Boolean);
        tilesToFx.forEach(tile => {
            if (!tile) return;
            const col = tile.currentPos % size;
            const row = Math.floor(tile.currentPos / size);
            const centerX = (col + 0.5) * tileW;
            const centerY = (row + 0.5) * tileH;

            const isCorrect = tile.currentPos === tile.correctPos;
            const count = isCorrect ? userParticleCount : Math.floor(userParticleCount / 2);
            const colors = isCorrect 
                ? ['#10b981', '#34d399', '#6ee7b7', '#f59e0b', '#fbbf24', '#ffffff'] 
                : ['#6366f1', '#818cf8', '#a5b4fc', '#e0e7ff', '#ffffff'];

            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = (isCorrect ? 3.5 : 2) + Math.random() * 4;
                tileFxParticles.push({
                    x: centerX,
                    y: centerY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 3 + Math.random() * 5,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    alpha: 1,
                    decay: 0.025 + Math.random() * 0.02,
                    rotation: Math.random() * Math.PI,
                    rotSpeed: (Math.random() - 0.5) * 0.2,
                    shape: chosenShape
                });
            }

            if (isCorrect) {
                tileFxRings.push({
                    x: centerX,
                    y: centerY,
                    radius: 4,
                    maxRadius: tileW * 0.75,
                    alpha: 1,
                    color: '#34d399'
                });
            }
        });

        if (!tileFxAnimId) {
            animateTileFx();
        }
    }

    function animateTileFx() {
        const tileFxCanvas = document.getElementById('tileFxCanvas');
        if (!tileFxCanvas) return;
        const ctx = tileFxCanvas.getContext('2d');
        ctx.clearRect(0, 0, tileFxCanvas.width, tileFxCanvas.height);

        // Render shockwave rings
        for (let i = tileFxRings.length - 1; i >= 0; i--) {
            const ring = tileFxRings[i];
            ring.radius += (ring.maxRadius - ring.radius) * 0.18 + 1.2;
            ring.alpha -= 0.045;
            if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
                tileFxRings.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.beginPath();
            ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
            ctx.strokeStyle = ring.color;
            ctx.globalAlpha = Math.max(0, ring.alpha);
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }

        // Render sparkle particles
        for (let i = tileFxParticles.length - 1; i >= 0; i--) {
            const p = tileFxParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.93;
            p.vy *= 0.93;
            p.alpha -= p.decay;
            p.rotation += p.rotSpeed;

            if (p.alpha <= 0) {
                tileFxParticles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;

            if (p.shape === 'heart') {
                ctx.font = `${Math.max(10, p.size * 2.2)}px sans-serif`;
                ctx.fillText('💖', 0, 0);
            } else if (p.shape === 'flame') {
                ctx.font = `${Math.max(10, p.size * 2.2)}px sans-serif`;
                ctx.fillText('🔥', 0, 0);
            } else if (p.shape === 'coin') {
                ctx.font = `${Math.max(10, p.size * 2.2)}px sans-serif`;
                ctx.fillText('🪙', 0, 0);
            } else if (p.shape === 'snow') {
                ctx.font = `${Math.max(10, p.size * 2.2)}px sans-serif`;
                ctx.fillText('❄️', 0, 0);
            } else if (p.shape === 'star') {
                drawStarFx(ctx, 0, 0, 4, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        if (tileFxParticles.length > 0 || tileFxRings.length > 0) {
            tileFxAnimId = requestAnimationFrame(animateTileFx);
        } else {
            tileFxAnimId = null;
        }
    }

    function drawStarFx(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }

    // ----------------------------------------------------
    // ZEN MEDITATION BINAURAL AUDIO SYNTHESIZER
    // ----------------------------------------------------
    let zenAudioCtx = null;
    let zenOscillators = [];
    let zenGainNode = null;
    let zenBreathTimer = null;

    function startZenMeditationSound() {
        stopZenMeditationSound();
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            zenAudioCtx = new AudioCtx();

            zenGainNode = zenAudioCtx.createGain();
            const volPct = masterVolumeSlider ? parseInt(masterVolumeSlider.value) / 100 : 0.8;
            const targetGain = isMuted ? 0 : 0.07 * volPct;
            zenGainNode.gain.setValueAtTime(targetGain, zenAudioCtx.currentTime);
            zenGainNode.connect(zenAudioCtx.destination);

            // C-Major 7th Ambient Meditation Drone Chord (C3, E3, G3, B3)
            const freqs = [130.81, 164.81, 196.00, 246.94];
            freqs.forEach(freq => {
                const osc = zenAudioCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, zenAudioCtx.currentTime);

                const lfo = zenAudioCtx.createOscillator();
                lfo.frequency.setValueAtTime(0.18, zenAudioCtx.currentTime);
                const lfoGain = zenAudioCtx.createGain();
                lfoGain.gain.setValueAtTime(1.8, zenAudioCtx.currentTime);

                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);

                osc.connect(zenGainNode);
                osc.start();
                lfo.start();

                zenOscillators.push(osc, lfo);
            });

            const prompts = [
                "Zen Mode • Inhale peace... Exhale stress...",
                "Zen Mode • Breathe in calm harmony...",
                "Zen Mode • Enjoy every puzzle piece...",
                "Zen Mode • Mindful, relaxed focus...",
                "Zen Mode • Inhale tranquility..."
            ];
            let pIdx = 0;
            const zenBreathText = document.getElementById('zenBreathText');
            zenBreathTimer = setInterval(() => {
                pIdx = (pIdx + 1) % prompts.length;
                if (zenBreathText) zenBreathText.textContent = prompts[pIdx];
            }, 8000);

        } catch (e) {
            console.warn('Zen audio context initialization skipped', e);
        }
    }

    function stopZenMeditationSound() {
        if (zenBreathTimer) clearInterval(zenBreathTimer);
        if (zenOscillators) {
            zenOscillators.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            zenOscillators = [];
        }
        if (zenAudioCtx) {
            try { zenAudioCtx.close(); } catch (e) {}
            zenAudioCtx = null;
        }
    }

    // Auto-start webcam initially
    startWebcam();
});
