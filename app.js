/* ==========================================================================
   SnapPuzzle Application Engine
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE VARIABLES ---
    let cameraStream = null;
    let currentPhotoDataUrl = null;
    let selectedGridSize = 3; // 3x3 default
    let puzzleMode = 'sliding'; // 'sliding' or 'jigsaw'
    let soundEnabled = true;
    
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
    const snapPhotoBtn = document.getElementById('snapPhotoBtn');
    
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

        // Draw video frame horizontally mirrored
        ctx.translate(canvasEl.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

        currentPhotoDataUrl = canvasEl.toDataURL('image/jpeg', 0.95);
        showConfigSection();
    }

    // --- UPLOAD & SAMPLE PHOTO HANDLING ---
    browseFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                currentPhotoDataUrl = evt.target.result;
                showConfigSection();
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Sample cards click
    document.querySelectorAll('.sample-card').forEach(card => {
        card.addEventListener('click', () => {
            const img = card.querySelector('img');
            currentPhotoDataUrl = img.src;
            showConfigSection();
        });
    });

    function showConfigSection() {
        stopWebcam();
        captureSection.style.display = 'none';
        configSection.style.display = 'grid';
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

    function renderTiles() {
        puzzleBoard.innerHTML = '';
        const size = selectedGridSize;

        // Sort tiles by currentPos so they render in grid order
        const sortedTiles = [...tiles].sort((a, b) => a.currentPos - b.currentPos);

        sortedTiles.forEach((tile) => {
            const tileDiv = document.createElement('div');
            tileDiv.classList.add('puzzle-tile');
            tileDiv.dataset.id = tile.id;

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

            tileDiv.addEventListener('click', () => handleTileClick(tile));
            puzzleBoard.appendChild(tileDiv);
        });
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
                // Swap positions
                [clickedTile.currentPos, emptyTile.currentPos] = [emptyTile.currentPos, clickedTile.currentPos];
                movesCount++;
                moveDisplay.textContent = `${movesCount} Moves`;
                playSound('snap');
                renderTiles();
                checkWinCondition();
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

        victoryModal.style.display = 'flex';
        startConfetti();
    }

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

    // Auto-start webcam initially
    startWebcam();
});
