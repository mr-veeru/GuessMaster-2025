let gameActive = false;
let currentRange = null;

// Handle enter key for guessing
document.getElementById('guess-input')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && gameActive) {
        makeGuess();
    }
});

async function startGame(difficulty) {
    try {
        const response = await fetch('/api/start-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mode: 'single',
                difficulty: difficulty
            })
        });

        const data = await response.json();
        
        if (data.error) {
            showMessage(data.error, 'error');
            return;
        }

        // Setup game state
        gameActive = true;
        currentRange = data.range;
        
        // Update UI
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        document.getElementById('remaining').textContent = data.max_attempts;
        document.getElementById('attempts').textContent = '0';
        
        // Set input constraints
        const input = document.getElementById('guess-input');
        input.min = currentRange[0];
        input.max = currentRange[1];
        input.value = '';
        input.focus();

        showMessage(`Guess a number between ${currentRange[0]} and ${currentRange[1]}`, 'hint');
        
    } catch (error) {
        showMessage('Failed to start game. Please try again.', 'error');
    }
}

async function makeGuess() {
    if (!gameActive) return;

    const guessInput = document.getElementById('guess-input');
    const guess = parseInt(guessInput.value);

    // Validate input
    if (isNaN(guess) || guess < currentRange[0] || guess > currentRange[1]) {
        showMessage(`Please enter a valid number between ${currentRange[0]} and ${currentRange[1]}`, 'error');
        return;
    }

    try {
        const response = await fetch('/api/guess', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ guess })
        });

        const data = await response.json();
        
        if (data.error) {
            showMessage(data.error, 'error');
            return;
        }

        // Update attempts display
        if (data.attempts) {
            document.getElementById('attempts').textContent = data.attempts;
            document.getElementById('remaining').textContent = data.remaining;
        }

        // Handle different results
        if (data.result === 'win') {
            gameActive = false;
            showMessage(data.message, 'success');
            document.getElementById('guess-input').disabled = true;
            loadHighScores();
            setTimeout(() => {
                if (confirm('Play again?')) {
                    resetGame();
                }
            }, 1500);
        } else if (data.result === 'lose') {
            gameActive = false;
            showMessage(data.message, 'error');
            document.getElementById('guess-input').disabled = true;
            setTimeout(() => {
                if (confirm('Try again?')) {
                    resetGame();
                }
            }, 1500);
        } else {
            // Continue game
            showMessage(`Try ${data.hint}! ${data.remaining} attempts remaining.`, 'hint');
            guessInput.value = '';
            guessInput.focus();
        }

    } catch (error) {
        showMessage('Failed to process guess. Please try again.', 'error');
    }
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('game-message');
    messageDiv.textContent = message;
    messageDiv.className = 'game-message ' + type;
}

async function loadHighScores() {
    try {
        const response = await fetch('/api/scores?mode=single');
        const scores = await response.json();
        
        const scoresDiv = document.getElementById('high-scores');
        if (Object.keys(scores).length === 0) {
            scoresDiv.innerHTML = '<p>No high scores yet!</p>';
            return;
        }

        let html = '<ul class="list-group">';
        for (const [difficulty, attempts] of Object.entries(scores)) {
            html += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                    <span class="badge bg-primary rounded-pill">${attempts} attempts</span>
                </li>`;
        }
        html += '</ul>';
        scoresDiv.innerHTML = html;

    } catch (error) {
        console.error('Failed to load high scores:', error);
    }
}

function resetGame() {
    document.getElementById('setup-screen').style.display = 'block';
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('guess-input').disabled = false;
    gameActive = false;
    currentRange = null;
}

// Load high scores when page loads
document.addEventListener('DOMContentLoaded', loadHighScores);
