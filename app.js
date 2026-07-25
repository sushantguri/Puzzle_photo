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
    let isMirrored = true;
    
    // Game state
    let tiles = []; // Array of tile objects { id, currentPos, correctPos, empty }
    let movesCount = 0;
    let gameTimer = null;
    let secondsElapsed = 0;
    let isGameActive = false;

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
    const hintBtn = document.getElementById('hintBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');
    
    const victoryModal = document.getElementById('victoryModal');
    const finalTime = document.getElementById('finalTime');
    const finalMoves = document.getElementById('finalMoves');
    const finalStars = document.getElementById('finalStars');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const newPhotoBtn = document.getElementById('newPhotoBtn');

    // --- WEB AUDIO SYNTHESIZER ---
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;

    function playSound(type) {
        if (!soundEnabled) return;
        try {
            if (!audioCtx) audioCtx = new AudioCtx();
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            const now = audioCtx.currentTime;

            if (type === 'click') {
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'snap') {
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'win') {
                // Play major chord fanfare
                [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                    const o = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    o.connect(g);
                    g.connect(audioCtx.destination);
                    o.frequency.setValueAtTime(freq, now + i * 0.1);
                    g.gain.setValueAtTime(0.2, now + i * 0.1);
                    g.gain.linearRampToValueAtTime(0.01, now + i * 0.1 + 0.4);
                    o.start(now + i * 0.1);
                    o.stop(now + i * 0.1 + 0.4);
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
        showConfigSection();
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

    // Sample cards click
    document.querySelectorAll('.sample-card').forEach(card => {
        card.addEventListener('click', () => {
            const img = card.querySelector('img');
            rawPhotoDataUrl = img.src;
            currentPhotoDataUrl = rawPhotoDataUrl;
            showConfigSection();
        });
    });

    // Slider photo enhancement listeners
    function applyPhotoAdjustments() {
        if (!rawPhotoDataUrl) return;
        const b = brightnessSlider ? brightnessSlider.value : 100;
        const c = contrastSlider ? contrastSlider.value : 100;
        const s = saturationSlider ? saturationSlider.value : 100;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const ctx = canvasEl.getContext('2d');
            canvasEl.width = img.width;
            canvasEl.height = img.height;
            ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
            ctx.drawImage(img, 0, 0);
            currentPhotoDataUrl = canvasEl.toDataURL('image/jpeg', 0.95);
            photoPreviewImg.src = currentPhotoDataUrl;
            ghostImg.src = currentPhotoDataUrl;
        };
        img.src = rawPhotoDataUrl;
    }

    if (brightnessSlider) brightnessSlider.addEventListener('input', applyPhotoAdjustments);
    if (contrastSlider) contrastSlider.addEventListener('input', applyPhotoAdjustments);
    if (saturationSlider) saturationSlider.addEventListener('input', applyPhotoAdjustments);

    function showConfigSection() {
        stopWebcam();
        captureSection.style.display = 'none';
        configSection.style.display = 'grid';
        if (brightnessSlider) brightnessSlider.value = 100;
        if (contrastSlider) contrastSlider.value = 100;
        if (saturationSlider) saturationSlider.value = 100;
        photoPreviewImg.src = currentPhotoDataUrl;
        ghostImg.src = currentPhotoDataUrl;
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

    // --- PUZZLE ENGINE & GAMEPLAY ---
    startPuzzleBtn.addEventListener('click', () => {
        configSection.style.display = 'none';
        gameSection.style.display = 'flex';
        headerStats.style.display = 'flex';
        resetAppBtn.style.display = 'inline-flex';
        initPuzzle();
    });

    function initPuzzle() {
        movesCount = 0;
        secondsElapsed = 0;
        isGameActive = true;
        moveDisplay.textContent = '0 Moves';
        timerDisplay.textContent = '00:00';

        clearInterval(gameTimer);
        gameTimer = setInterval(() => {
            if (isGameActive) {
                secondsElapsed++;
                const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
                const secs = String(secondsElapsed % 60).padStart(2, '0');
                timerDisplay.textContent = `${mins}:${secs}`;
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
            tiles.push({
                id: i,
                correctPos: i,
                currentPos: i,
                isEmpty: (puzzleMode === 'sliding' && i === totalTiles - 1)
            });
        }

        // Shuffle tiles with guaranteed solvability
        shuffleTilesSolvable();
        renderTiles();
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

            // Click handling
            tileDiv.addEventListener('click', () => handleTileClick(tile));

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

    function swapTiles(tileA, tileB) {
        [tileA.currentPos, tileB.currentPos] = [tileB.currentPos, tileA.currentPos];
        movesCount++;
        moveDisplay.textContent = `${movesCount} Moves`;
        playSound('snap');
        renderTiles();
        checkWinCondition();
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

    function checkWinCondition() {
        const isSolved = tiles.every(t => t.currentPos === t.correctPos);

        if (isSolved) {
            isGameActive = false;
            clearInterval(gameTimer);
            playSound('win');
            triggerVictory();
        }
    }

    function triggerVictory() {
        finalTime.textContent = timerDisplay.textContent;
        finalMoves.textContent = movesCount;

        // Rating
        let stars = '⭐⭐⭐';
        if (movesCount > selectedGridSize * 15) stars = '⭐⭐';
        if (movesCount > selectedGridSize * 30) stars = '⭐';
        finalStars.textContent = stars;

        saveHighScore(selectedGridSize, puzzleMode, secondsElapsed, movesCount, stars);

        victoryModal.style.display = 'flex';
        startConfetti();
    }

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
    toggleGhostBtn.addEventListener('click', () => {
        const isHidden = ghostOverlay.style.display === 'none';
        ghostOverlay.style.display = isHidden ? 'block' : 'none';
        playSound('click');
    });

    hintBtn.addEventListener('click', () => {
        ghostOverlay.style.display = 'block';
        setTimeout(() => { ghostOverlay.style.display = 'none'; }, 1200);
        playSound('click');
    });

    shuffleBtn.addEventListener('click', () => {
        initPuzzle();
        playSound('click');
    });

    playAgainBtn.addEventListener('click', () => {
        victoryModal.style.display = 'none';
        initPuzzle();
    });

    newPhotoBtn.addEventListener('click', () => {
        victoryModal.style.display = 'none';
        gameSection.style.display = 'none';
        headerStats.style.display = 'none';
        resetAppBtn.style.display = 'none';
        captureSection.style.display = 'flex';
        startWebcam();
    });

    resetAppBtn.addEventListener('click', () => {
        clearInterval(gameTimer);
        gameSection.style.display = 'none';
        configSection.style.display = 'none';
        headerStats.style.display = 'none';
        resetAppBtn.style.display = 'none';
        captureSection.style.display = 'flex';
        startWebcam();
    });

    soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
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

        if (gameSection.style.display !== 'none' && isGameActive) {
            const key = e.key.toLowerCase();
            if (key === 'g') {
                toggleGhostBtn.click();
            } else if (key === 'h') {
                hintBtn.click();
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
    if (downloadScoreCardBtn) {
        downloadScoreCardBtn.addEventListener('click', () => {
            playSound('click');
            const cardCanvas = document.createElement('canvas');
            cardCanvas.width = 800;
            cardCanvas.height = 600;
            const ctx = cardCanvas.getContext('2d');

            // Background Gradient
            const bgGrad = ctx.createLinearGradient(0, 0, 800, 600);
            bgGrad.addColorStop(0, '#090d16');
            bgGrad.addColorStop(1, '#1e1b4b');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, 800, 600);

            // Card Frame
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 4;
            ctx.strokeRect(20, 20, 760, 560);

            // Title
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🧩 SnapPuzzle Champion', 400, 70);

            // Draw Photo
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                ctx.drawImage(img, 240, 100, 320, 320);

                // Stats Section
                ctx.fillStyle = '#94a3b8';
                ctx.font = '20px sans-serif';
                ctx.fillText(`Mode: ${puzzleMode.toUpperCase()} (${selectedGridSize}x${selectedGridSize})`, 400, 460);

                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText(`⏱️ Time: ${timerDisplay.textContent}   |   🎯 Moves: ${movesCount}`, 400, 500);

                ctx.fillStyle = '#facc15';
                ctx.font = '26px sans-serif';
                ctx.fillText(finalStars.textContent, 400, 540);

                // Trigger PNG Download
                const link = document.createElement('a');
                link.download = `SnapPuzzle_Victory_ScoreCard.png`;
                link.href = cardCanvas.toDataURL('image/png');
                link.click();
            };
            img.src = currentPhotoDataUrl;
        });
    }

    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
            playSound('click');
        });
    }

    // Apply initial saved theme
    applyTheme(savedTheme);

    // Auto-start webcam initially
    startWebcam();
});
