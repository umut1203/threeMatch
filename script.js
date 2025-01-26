const colors = ['🍎', '🍇', '🍊', '🍋', '🍉', '🍓'];
const boardSize = 8;
const DRAG_THRESHOLD = 30;
const MAX_OBJECTIVES = 5;
const BASE_SWAP_MULTIPLIER = 2.5;

let currentLevel = 0;
let remainingSwaps = 0;
let objectives = [];
let collected = {};
let selectedCandy = null;
let board = [];
let isProcessing = false;
let dragStartPosition = { x: 0, y: 0 };
let validSwapTarget = null;

function generateLevel(levelNumber) {
    const numObjectives = Math.min(MAX_OBJECTIVES, Math.ceil(levelNumber / 3) + 1);
    const availableFruits = [...colors];
    const selectedFruits = [];

    for(let i = 0; i < numObjectives; i++) {
        const randomIndex = Math.floor(Math.random() * availableFruits.length);
        selectedFruits.push(availableFruits.splice(randomIndex, 1)[0]);
    }

    const levelObjectives = selectedFruits.map(fruit => {
        const baseTarget = Math.floor((levelNumber * 2) + (Math.random() * levelNumber) + 3);
        return {
            type: fruit,
            target: Math.min(baseTarget, 25 + Math.floor(levelNumber / 3) * 5)
        };
    });

    const totalTargets = levelObjectives.reduce((sum, obj) => sum + obj.target, 0);
    const swaps = Math.floor(
        (totalTargets * BASE_SWAP_MULTIPLIER) * (0.9 + Math.random() * 0.2) - (levelNumber * 0.7)
    );

    return {
        swaps: Math.max(swaps, Math.floor(totalTargets * 1.5)),
        objectives: levelObjectives
    };
}

function initializeLevel() {
    const levelData = generateLevel(currentLevel + 1);
    remainingSwaps = levelData.swaps;
    objectives = levelData.objectives;
    collected = {};
    objectives.forEach(obj => collected[obj.type] = 0);

    updateUI();
    createBoard();
}

function updateUI() {
    document.getElementById('current-level').textContent = currentLevel + 1;
    document.getElementById('swaps-left').textContent = remainingSwaps;

    const objectivesContainer = document.getElementById('objectives');
    objectivesContainer.innerHTML = '';

    objectives.forEach(obj => {
        const div = document.createElement('div');
        div.className = `objective-item ${collected[obj.type] >= obj.target ? 'completed' : ''}`;
        div.innerHTML = `
            <span>${obj.type}</span>
            <span>${collected[obj.type] || 0}/${obj.target}</span>
        `;
        objectivesContainer.appendChild(div);
    });
}

function checkObjectives() {
    return objectives.every(obj => collected[obj.type] >= obj.target);
}

function createBoard() {
    const gameBoard = document.getElementById('game-board');
    gameBoard.innerHTML = '';
    board = [];

    for(let row = 0; row < boardSize; row++) {
        board[row] = [];
        for(let col = 0; col < boardSize; col++) {
            const candy = document.createElement('div');
            candy.className = 'candy';
            candy.dataset.row = row;
            candy.dataset.col = col;
            candy.textContent = getValidCandy(row, col);

            candy.addEventListener('mousedown', startDrag);
            candy.addEventListener('touchstart', startDrag, { passive: false });

            gameBoard.appendChild(candy);
            board[row][col] = candy;
        }
    }
}

function getValidCandy(row, col) {
    let validCandy;
    do {
        validCandy = colors[Math.floor(Math.random() * colors.length)];
    } while (
        (row >= 2 && board[row-1][col]?.textContent === validCandy &&
         board[row-2][col]?.textContent === validCandy) ||
        (col >= 2 && board[row][col-1]?.textContent === validCandy &&
         board[row][col-2]?.textContent === validCandy)
    );
    return validCandy;
}

function startDrag(event) {
    if(isProcessing || remainingSwaps <= 0) return;

    event.preventDefault();
    const candy = event.target.closest('.candy');
    if(!candy) return;

    selectedCandy = candy;
    const { clientX, clientY } = event.touches ? event.touches[0] : event;
    dragStartPosition = { x: clientX, y: clientY };

    candy.classList.add('dragging');

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
}

function handleDragMove(event) {
    if(!selectedCandy) return;
    event.preventDefault();

    const { clientX, clientY } = event.touches ? event.touches[0] : event;
    const dx = clientX - dragStartPosition.x;
    const dy = clientY - dragStartPosition.y;

    // Clear previous valid target
    if(validSwapTarget) {
        validSwapTarget.classList.remove('valid-swap');
        validSwapTarget = null;
    }

    // Only consider horizontal/vertical swaps
    if(Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;

    const row = parseInt(selectedCandy.dataset.row);
    const col = parseInt(selectedCandy.dataset.col);
    let targetRow = row;
    let targetCol = col;

    if(Math.abs(dx) > Math.abs(dy)) { // Horizontal
        targetCol += dx > 0 ? 1 : -1;
    } else { // Vertical
        targetRow += dy > 0 ? 1 : -1;
    }

    // Validate target position
    if(targetRow >= 0 && targetRow < boardSize &&
       targetCol >= 0 && targetCol < boardSize) {
        validSwapTarget = board[targetRow][targetCol];
        validSwapTarget.classList.add('valid-swap');
    }
}

function handleDragEnd(event) {
    if(!selectedCandy) return;
    event.preventDefault();

    // Cleanup event listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);

    selectedCandy.classList.remove('dragging');
    if(validSwapTarget) {
        validSwapTarget.classList.remove('valid-swap');
        executeSwap(validSwapTarget);
        validSwapTarget = null;
    }
}

function executeSwap(targetCandy) {
    // Guard checks
    if(!selectedCandy || !targetCandy) {
        selectedCandy = null;
        return;
    }
    if(isProcessing) {
        selectedCandy = null;
        return;
    }

    // Store references to avoid them becoming null in delayed callbacks
    const candy1 = selectedCandy;
    const candy2 = targetCandy;

    // We can safely reset the global selectedCandy now.
    selectedCandy = null;

    const row1 = parseInt(candy1.dataset.row);
    const col1 = parseInt(candy1.dataset.col);
    const row2 = parseInt(candy2.dataset.row);
    const col2 = parseInt(candy2.dataset.col);

    // Only allow adjacent swaps
    if(Math.abs(row1 - row2) + Math.abs(col1 - col2) !== 1) return;

    isProcessing = true;
    swapCandies(candy1, candy2, (success) => {
        if(!success) {
            // Animate invalid swap
            candy1.classList.add('shake', 'invalid');
            candy2.classList.add('shake', 'invalid');
            setTimeout(() => {
                candy1.classList.remove('shake', 'invalid');
                candy2.classList.remove('shake', 'invalid');
                isProcessing = false;
            }, 600);
        }
    });
}

function swapCandies(candy1, candy2, callback) {
    if (remainingSwaps <= 0) return;

    const original1 = candy1.textContent;
    const original2 = candy2.textContent;

    candy1.textContent = original2;
    candy2.textContent = original1;

    setTimeout(() => {
        const hadMatch = checkMatches();

        if(hadMatch) {
            remainingSwaps--;
            callback(true);
            setTimeout(fillBoard, 500);
        } else {
            // Revert swap
            candy1.textContent = original1;
            candy2.textContent = original2;
            remainingSwaps--;
            callback(false);
        }

        updateUI();

        if (remainingSwaps <= 0 && !checkObjectives()) {
            setTimeout(() => alert('Oyun Bitti! Hamle kalmadı!'), 500);
        }
    }, 200);
}

function checkMatches() {
    let matched = Array.from({length: boardSize}, () => Array(boardSize).fill(false));
    let totalMatched = 0;

    // Horizontal check
    for(let row = 0; row < boardSize; row++) {
        for(let col = 0; col < boardSize; col++) {
            if(matched[row][col] || board[row][col].textContent === '') continue;

            let matchLength = 1;
            while(col + matchLength < boardSize &&
                  board[row][col + matchLength].textContent === board[row][col].textContent) {
                matchLength++;
            }

            if(matchLength >= 3) {
                totalMatched += matchLength;
                for(let i = 0; i < matchLength; i++) {
                    matched[row][col + i] = true;
                }
            }
        }
    }

    // Vertical check
    for(let col = 0; col < boardSize; col++) {
        for(let row = 0; row < boardSize; row++) {
            if(matched[row][col] || board[row][col].textContent === '') continue;

            let matchLength = 1;
            while(row + matchLength < boardSize &&
                  board[row + matchLength][col].textContent === board[row][col].textContent) {
                matchLength++;
            }

            if(matchLength >= 3) {
                totalMatched += matchLength;
                for(let i = 0; i < matchLength; i++) {
                    matched[row + i][col] = true;
                }
            }
        }
    }

    if(totalMatched > 0) {
        const matchedCandies = [];
        for(let row = 0; row < boardSize; row++) {
            for(let col = 0; col < boardSize; col++) {
                if(matched[row][col]) {
                    matchedCandies.push(board[row][col]);
                }
            }
        }

        animateAndClearMatches(matched);
        handleMatch(matchedCandies);
        return true;
    }
    return false;
}

function handleMatch(matchedCandies) {
    matchedCandies.forEach(candy => {
        const type = candy.textContent;
        if (collected.hasOwnProperty(type)) {
            collected[type]++;
        }
    });

    updateUI();

    if (checkObjectives()) {
        currentLevel++;
        setTimeout(() => {
            alert(`Seviye ${currentLevel} tamamlandı! Bir sonraki seviyeye geçiliyor!`);
            initializeLevel();
        }, 500);
    }
}

function animateAndClearMatches(matched) {
    for(let row = 0; row < boardSize; row++) {
        for(let col = 0; col < boardSize; col++) {
            if(matched[row][col]) {
                board[row][col].classList.add('matched');
                setTimeout(() => {
                    board[row][col].textContent = '';
                    board[row][col].classList.remove('matched');
                }, 500);
            }
        }
    }
}

function fillBoard() {
    for(let col = 0; col < boardSize; col++) {
        let emptySpots = 0;

        for(let row = boardSize - 1; row >= 0; row--) {
            if(board[row][col].textContent === '') {
                emptySpots++;
            } else if(emptySpots > 0) {
                board[row + emptySpots][col].textContent = board[row][col].textContent;
                board[row][col].textContent = '';
            }
        }

        for(let row = 0; row < emptySpots; row++) {
            board[row][col].textContent = colors[Math.floor(Math.random() * colors.length)];
        }
    }

    setTimeout(() => {
        if(checkMatches()) {
            setTimeout(fillBoard, 500);
        } else {
            isProcessing = false;
        }
    }, 100);
}

function resetGame() {
    currentLevel = 0;
    initializeLevel();
}

// Initialize the game
initializeLevel();
