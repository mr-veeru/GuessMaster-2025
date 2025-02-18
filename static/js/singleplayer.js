let gameState = {
    active: false,
    difficulty: null,
    range: null,
    maxAttempts: 0,
    currentAttempts: 0,
    gameId: null
};

// Initialize game components
document.addEventListener('DOMContentLoaded', function() {
    loadHighScores();
    
    // Restore game state if it exists
    const savedState = checkGameSession();
    if (savedState) {
        gameState = savedState;
        if (gameState.active) {
            showGameScreen();
            updateGameStatus();
        }
    }

    // Add keyboard event listener
    document.getElementById('guess-input').addEventListener('keypress', function(event) {
        handleEnterKey(event, makeGuess);
    });
});

async function startGame(difficulty) {
    try {
        const data = await fetchWithErrorHandling('/api/start-game', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'single',
                difficulty: difficulty
            })
        });

        // Initialize game state
        gameState = {
            active: true,
            difficulty: difficulty,
            range: data.range,
            maxAttempts: data.max_attempts,
            currentAttempts: 0,
            gameId: data.game_id
        };

        showGameScreen();
        updateGameStatus();
        
        // Set input constraints
        const input = document.getElementById('guess-input');
        input.min = gameState.range[0];
        input.max = gameState.range[1];
        input.value = '';
        input.focus();
        input.disabled = false;

        // Load and display the current best score for this difficulty
        const scores = await loadHighScores();
        const bestScore = scores[difficulty] || '-';
        document.getElementById('best-score').textContent = 
            typeof bestScore === 'number' ? formatScore(bestScore) : bestScore;

        showNotification('Game Started', 
            `Guess a number between ${gameState.range[0]} and ${gameState.range[1]}`, 
            'info');

    } catch (error) {
        console.error('Failed to start game:', error);
        gameState.active = false;
        hideLoading();
    }
}

async function makeGuess() {
    if (!validateGameState()) {
        // Show error message and reset after delay
        showErrorMessage(
            'Error', 
            'No active game session. Please start a new game.',
            resetGame,
            5000  // 5 second delay before reset
        );
        return;
    }

    const guessInput = document.getElementById('guess-input');
    const guess = parseInt(guessInput.value);

    if (!validateGuess(guess, gameState.range[0], gameState.range[1])) {
        return;
    }

    try {
        const data = await fetchWithErrorHandling('/api/guess', {
            method: 'POST',
            body: JSON.stringify({ 
                guess,
                game_id: gameState.gameId
            })
        });

        if (!data || !data.result) {
            throw new Error('Invalid response from server');
        }

        handleGuessResponse(data);

    } catch (error) {
        console.error('Failed to process guess:', error);
        showErrorMessage(
            'Error',
            'Failed to process guess. Starting new game...',
            resetGame,
            5000
        );
    } finally {
        hideLoading();
    }
}

function handleWin(data) {
    try {
        gameState.active = false;
        clearGameSession();
        
        const modal = new bootstrap.Modal(document.getElementById('gameOverModal'));
        document.getElementById('gameOverTitle').innerHTML = 
            '<i class="fas fa-trophy text-success"></i> Congratulations!';
        document.getElementById('gameOverMessage').innerHTML = `
            <div class="text-center">
                <h4 class="text-success">You Won!</h4>
                <p>${data.message}</p>
                <p>Difficulty: ${gameState.difficulty}</p>
            </div>
        `;

        // Update modal buttons and their handlers
        const modalFooter = document.querySelector('#gameOverModal .modal-footer');
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="window.location.href='/'">Close</button>
            <button type="button" class="btn btn-primary" onclick="handlePlayAgain()">Play Again</button>
        `;

        modal.show();
        
        // Refresh high scores after win
        loadHighScores();
    } catch (error) {
        console.error('Error handling win:', error);
        showNotification('Error', 'Something went wrong. Please try again.', 'error');
    } finally {
        hideLoading();
        document.getElementById('guess-input').value = '';
        document.getElementById('guess-input').disabled = true;
    }
}

function handleLose(data) {
    gameState.active = false;
    clearGameSession();
    
    const modal = new bootstrap.Modal(document.getElementById('gameOverModal'));
    document.getElementById('gameOverTitle').innerHTML = 
        '<i class="fas fa-times-circle text-danger"></i> Game Over';
    document.getElementById('gameOverMessage').innerHTML = `
        <div class="text-center">
            <h4 class="text-danger">You Lost!</h4>
            <p>${data.message}</p>
            <p>Difficulty: ${gameState.difficulty}</p>
        </div>
    `;

    // Update modal buttons and their handlers
    const modalFooter = document.querySelector('#gameOverModal .modal-footer');
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" onclick="window.location.href='/'">Close</button>
        <button type="button" class="btn btn-primary" onclick="handlePlayAgain()">Play Again</button>
    `;

    modal.show();
}

// Add new function to handle "Play Again" action
function handlePlayAgain() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('gameOverModal'));
    modal.hide();
    document.getElementById('setup-screen').style.display = 'block';
    document.getElementById('game-screen').style.display = 'none';
}

function handleContinue(data) {
    const messageDiv = document.getElementById('game-message');
    messageDiv.className = 'game-message hint';
    messageDiv.innerHTML = `
        <i class="fas fa-arrow-${data.hint === 'lower' ? 'down' : 'up'}"></i>
        Try ${data.hint}! ${data.remaining} attempts remaining.
    `;
}

function updateGameStatus() {
    document.getElementById('attempts').textContent = gameState.currentAttempts;
    document.getElementById('remaining').textContent = 
        gameState.maxAttempts - gameState.currentAttempts;
}

// Add lock for score updates
let isUpdatingScores = false;
async function loadHighScores() {
    if (isUpdatingScores) return;
    isUpdatingScores = true;
    
    try {
        const scores = await fetchWithErrorHandling('/api/scores?mode=single');
        const tbody = document.getElementById('scores-table-body');
        
        if (Object.keys(scores).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center">No high scores yet!</td>
                </tr>
            `;
            return scores;
        }

        tbody.innerHTML = Object.entries(scores)
            .map(([difficulty, score]) => `
                <tr>
                    <td>
                        <i class="fas fa-star text-warning"></i>
                        ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                    </td>
                    <td>${formatScore(score)}</td>
                </tr>
            `).join('');

        // Update best score if in game
        if (gameState.active && gameState.difficulty) {
            const bestScore = scores[gameState.difficulty] || '-';
            document.getElementById('best-score').textContent = 
                typeof bestScore === 'number' ? formatScore(bestScore) : bestScore;
        }

        return scores;

    } catch (error) {
        console.error('Failed to load high scores:', error);
        return {};
    } finally {
        isUpdatingScores = false;
    }
}

function showGameScreen() {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
}

async function resetGame() {
    if (gameState.active) {
        try {
            await fetchWithErrorHandling('/api/end-game', { method: 'POST' });
        } catch (error) {
            console.error('Failed to end game:', error);
        }
    }

    // Reset game state
    gameState = {
        active: false,
        difficulty: null,
        range: null,
        maxAttempts: 0,
        currentAttempts: 0,
        gameId: null
    };

    clearGameSession();
    
    // Reset UI
    document.getElementById('setup-screen').style.display = 'block';
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('game-message').textContent = '';
    document.getElementById('guess-input').value = '';
    document.getElementById('guess-input').disabled = true;
    
    // Close modal if open
    const modal = bootstrap.Modal.getInstance(document.getElementById('gameOverModal'));
    if (modal) modal.hide();

    // Clear any existing notifications
    const toastEl = document.getElementById('toast-notification');
    const toast = bootstrap.Toast.getInstance(toastEl);
    if (toast) toast.hide();
}

// Add cleanup handler
window.addEventListener('beforeunload', async (event) => {
    if (gameState.active) {
        try {
            await fetch('/api/end-game', {
                method: 'POST',
                keepalive: true
            });
        } catch (error) {
            console.error('Failed to cleanup game:', error);
        }
        gameState.active = false;
        clearGameSession();
    }
});

// Enhance visibility change handler
document.addEventListener('visibilitychange', async () => {
    if (document.hidden && gameState.active) {
        try {
            await fetch('/api/end-game', {
                method: 'POST',
                keepalive: true
            });
        } catch (error) {
            console.error('Failed to cleanup game:', error);
        }
        gameState.active = false;
        clearGameSession();
    }
});

// Update the fetchWithErrorHandling function in utils.js to ensure loading state is cleared
async function fetchWithErrorHandling(url, options = {}) {
    showLoading();
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'An unexpected error occurred');
        }

        return data;
    } catch (error) {
        showNotification('Error', error.message, 'error');
        throw error;
    } finally {
        hideLoading(); // Ensure loading is always hidden
    }
}

function saveGameSession(state) {
    const savedState = {
        ...state,
        timestamp: Date.now()
    };
    sessionStorage.setItem('gameState', JSON.stringify(savedState));
}

function showCustomModeSetup() {
    const customSetup = document.getElementById('custom-mode-setup');
    customSetup.style.display = customSetup.style.display === 'none' ? 'block' : 'none';
}

async function startCustomGame() {
    try {
        const minValue = parseInt(document.getElementById('custom-min').value);
        const maxValue = parseInt(document.getElementById('custom-max').value);

        // Enhanced input validation
        if (!validateCustomRange(minValue, maxValue)) {
            return;
        }

        const data = await fetchWithErrorHandling('/api/start-game', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'single',
                difficulty: 'custom',
                range: [minValue, maxValue]
            })
        });

        if (!data || !data.game_id) {
            throw new Error('Invalid response from server');
        }

        // Initialize game state with error checking
        initializeGameState('custom', [minValue, maxValue], data);

    } catch (error) {
        console.error('Failed to start custom game:', error);
        showNotification('Error', 
            'Failed to start custom game. Please try again.', 
            'error');
        gameState.active = false;
    } finally {
        hideLoading();
    }
}

// New validation function
function validateCustomRange(min, max) {
    if (isNaN(min) || isNaN(max)) {
        showNotification('Error', 
            'Please enter valid numbers for both minimum and maximum values', 
            'error');
        return false;
    }

    if (min < 1) {
        showNotification('Error', 
            'Minimum value must be at least 1', 
            'error');
        return false;
    }

    if (max <= min) {
        showNotification('Error', 
            'Maximum value must be greater than minimum value', 
            'error');
        return false;
    }

    if (max > 1000000) {
        showNotification('Error', 
            'Maximum value cannot exceed 1,000,000', 
            'error');
        return false;
    }

    return true;
}

// New function to initialize game state
function initializeGameState(difficulty, range, data) {
    try {
        if (!data.max_attempts) {
            throw new Error('Invalid game configuration');
        }

        gameState = {
            active: true,
            difficulty: difficulty,
            range: range,
            maxAttempts: data.max_attempts,
            currentAttempts: 0,
            gameId: data.game_id
        };

        showGameScreen();
        updateGameStatus();
        
        const input = document.getElementById('guess-input');
        if (!input) {
            throw new Error('Game interface elements not found');
        }

        input.min = gameState.range[0];
        input.max = gameState.range[1];
        input.value = '';
        input.disabled = false;
        input.focus();

        showNotification('Game Started', 
            `Guess a number between ${gameState.range[0]} and ${gameState.range[1]}`, 
            'info');

    } catch (error) {
        console.error('Failed to initialize game:', error);
        showNotification('Error', 
            'Failed to initialize game. Please refresh the page.', 
            'error');
        gameState.active = false;
    }
}

// New validation functions
function validateGameState() {
    if (!gameState.active || !gameState.gameId) {
        showErrorMessage(
            'Error',
            'No active game. Please start a new game.',
            resetGame,
            5000
        );
        return false;
    }
    return true;
}

// Add input sanitization
function validateGuess(guess, min, max) {
    guess = parseInt(guess, 10);
    if (isNaN(guess)) {
        showNotification('Error', 'Please enter a valid number', 'error');
        return false;
    }

    if (guess < min || guess > max) {
        showNotification('Error', 
            `Please enter a number between ${min} and ${max}`, 
            'error');
        return false;
    }

    return true;
}

// New function to handle guess response
function handleGuessResponse(data) {
    gameState.currentAttempts = data.attempts;
    updateGameStatus();

    switch (data.result) {
        case 'win':
            handleWin(data);
            break;
        case 'lose':
            handleLose(data);
            break;
        case 'continue':
            handleContinue(data);
            break;
        default:
            throw new Error('Invalid game result');
    }

    const guessInput = document.getElementById('guess-input');
    guessInput.value = '';
    guessInput.focus();
} 