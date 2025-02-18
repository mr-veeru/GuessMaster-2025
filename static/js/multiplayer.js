let multiplayerGameActive = false;
let currentPlayers = { chooser: null, guesser: null };
let round = 1;
let scores = {};

// Add state tracking
let isProcessing = false;
let isSettingTarget = false;

// Handle enter key for inputs
document.getElementById('secret-number')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        setSecretNumber();
    }
});

document.getElementById('multi-guess')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && multiplayerGameActive) {
        makeMultiplayerGuess();
    }
});

async function startMultiplayerGame() {
    const player1 = document.getElementById('player1-name').value.trim();
    const player2 = document.getElementById('player2-name').value.trim();

    if (!player1 || !player2) {
        showNotification('Error', 'Both player names are required!', 'error');
        return;
    }

    if (player1 === player2) {
        showNotification('Error', 'Players must have different names!', 'error');
        return;
    }

    // Add regex validation for names
    if (!/^[a-zA-Z0-9\s]{1,20}$/.test(player1) || !/^[a-zA-Z0-9\s]{1,20}$/.test(player2)) {
        showNotification('Error', 'Names must be 1-20 characters long and contain only letters, numbers, and spaces', 'error');
        return;
    }

    try {
        const data = await fetchWithErrorHandling('/api/start-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mode: 'multi',
                player1: player1,
                player2: player2
            })
        });
        
        if (data.error) {
            showNotification('Error', data.error, 'error');
            return;
        }

        // Initialize game state
        multiplayerGameActive = true;
        currentPlayers.chooser = player1;
        currentPlayers.guesser = player2;
        scores[player1] = 0;
        scores[player2] = 0;
        round = 1;

        // Save game session data
        saveGameSession({
            gameId: data.game_id,
            active: true,
            players: currentPlayers,
            round: round
        });

        // Update UI
        document.getElementById('player-setup').style.display = 'none';
        document.getElementById('multiplayer-game').style.display = 'block';
        document.getElementById('number-selection').style.display = 'block';
        document.getElementById('guessing-interface').style.display = 'none';
        
        updateGameStatus();
        showNotification('Game Started', `${currentPlayers.chooser}, enter a secret number for ${currentPlayers.guesser} to guess!`, 'info');

    } catch (error) {
        showNotification('Error', 'Failed to start game. Please try again.', 'error');
        multiplayerGameActive = false;
    }
}

function updateGameStatus() {
    document.getElementById('current-round').textContent = round;
    document.getElementById('current-players').textContent = 
        `${currentPlayers.chooser} vs ${currentPlayers.guesser}`;
}

async function setSecretNumber() {
    if (isProcessing || isSettingTarget) return;
    isSettingTarget = true;

    const gameSession = checkGameSession();
    if (!gameSession || !gameSession.active) {
        showNotification('Error', 'No active game session. Please start a new game.', 'error');
        // Automatically reset the game after a short delay
        setTimeout(() => {
            resetMultiplayerGame();
            showNotification('Info', 'Game has been reset. You can start a new game.', 'info');
        }, 2000);
        isSettingTarget = false;
        return;
    }

    const secretInput = document.getElementById('secret-number');
    const number = parseInt(secretInput.value);

    if (isNaN(number) || number < 1 || number > 100) {
        showNotification('Error', 'Please enter a valid number between 1 and 100', 'error');
        isSettingTarget = false;
        return;
    }

    try {
        const response = await fetchWithErrorHandling('/api/set-target', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ number: number })
        });

        if (response.error) {
            showNotification('Error', response.error, 'error');
            // If there's a session error, reset the game
            if (response.error.includes('session')) {
                setTimeout(() => {
                    resetMultiplayerGame();
                    showNotification('Info', 'Game has been reset. You can start a new game.', 'info');
                }, 2000);
            }
            return;
        }

        // Switch to guessing interface
        document.getElementById('number-selection').style.display = 'none';
        document.getElementById('guessing-interface').style.display = 'block';
        secretInput.value = '';
        
        showNotification('Success', `${currentPlayers.guesser}, start guessing!`, 'success');
        document.getElementById('multi-guess').focus();

    } catch (error) {
        showNotification('Error', 'Failed to set target number. Please try again.', 'error');
        // Reset game on error
        setTimeout(() => {
            resetMultiplayerGame();
            showNotification('Info', 'Game has been reset. You can start a new game.', 'info');
        }, 2000);
    } finally {
        isSettingTarget = false;
    }
}

async function makeMultiplayerGuess() {
    if (!multiplayerGameActive || isProcessing) return;
    isProcessing = true;

    const gameSession = checkGameSession();
    if (!gameSession || !gameSession.active) {
        showNotification('Error', 'Game session has expired. Starting new game...', 'error');
        setTimeout(() => {
            resetMultiplayerGame();
            showNotification('Info', 'Game has been reset. You can start a new game.', 'info');
        }, 2000);
        isProcessing = false;
        return;
    }

    const guessInput = document.getElementById('multi-guess');
    const guess = parseInt(guessInput.value);

    if (isNaN(guess) || guess < 1 || guess > 100) {
        showMultiMessage('Please enter a valid number between 1 and 100', 'error');
        isProcessing = false;
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
            showMultiMessage(data.error, 'error');
            if (data.error.includes('session')) {
                setTimeout(() => {
                    resetMultiplayerGame();
                    showNotification('Info', 'Game has been reset. You can start a new game.', 'info');
                }, 2000);
            }
            return;
        }

        document.getElementById('multi-attempts').textContent = data.attempts;

        if (data.result === 'win' || data.result === 'lose') {
            handleRoundEnd(data.result === 'win', data);
        } else {
            showMultiMessage(`Try ${data.hint}! ${data.remaining} attempts remaining.`, 'hint');
            guessInput.value = '';
            guessInput.focus();
        }

    } catch (error) {
        showMultiMessage('Failed to process guess. Please try again.', 'error');
        setTimeout(() => {
            resetMultiplayerGame();
            showNotification('Info', 'Game has been reset. You can start a new game.', 'info');
        }, 2000);
    } finally {
        isProcessing = false;
    }
}

function handleRoundEnd(won, data) {
    if (!scores) {
        scores = {};
    }
    const currentAttempts = parseInt(document.getElementById('multi-attempts').textContent);
    
    if (won) {
        scores[currentPlayers.guesser] = currentAttempts;
        showMultiMessage(`${currentPlayers.guesser} guessed correctly in ${currentAttempts} attempts!`, 'success');
    } else {
        // When player loses, they get the maximum attempts as their score
        scores[currentPlayers.guesser] = data.max_attempts || 8;
        showMultiMessage(`${currentPlayers.guesser} ran out of attempts! The number was ${data.target}`, 'error');
    }

    if (round === 1) {
        // Show round 1 results before starting round 2
        setTimeout(() => {
            showMultiMessage(`Round 1 Results: ${currentPlayers.guesser} took ${scores[currentPlayers.guesser]} attempts`, 'info');
            
            // Switch players and start round 2
            round = 2;
            const temp = currentPlayers.chooser;
            currentPlayers.chooser = currentPlayers.guesser;
            currentPlayers.guesser = temp;
            
            // Start new game session for round 2
            startNewRound();
        }, 2000);
    } else {
        // Game Over - Show detailed results and save scores
        const finalScores = {};
        finalScores[currentPlayers.chooser] = scores[currentPlayers.chooser] || 0;
        finalScores[currentPlayers.guesser] = scores[currentPlayers.guesser] || 0;
        
        // Save the game scores
        saveGameScores(finalScores);
        
        let resultMessage = `Game Over!\n\n`;
        resultMessage += `${currentPlayers.chooser}: ${finalScores[currentPlayers.chooser]} attempts\n`;
        resultMessage += `${currentPlayers.guesser}: ${finalScores[currentPlayers.guesser]} attempts\n\n`;
        
        if (finalScores[currentPlayers.chooser] === finalScores[currentPlayers.guesser]) {
            resultMessage += "It's a tie!";
        } else {
            const winner = finalScores[currentPlayers.chooser] < finalScores[currentPlayers.guesser] ? 
                currentPlayers.chooser : currentPlayers.guesser;
            const winningScore = Math.min(finalScores[currentPlayers.chooser], finalScores[currentPlayers.guesser]);
            resultMessage += `${winner} wins with ${winningScore} attempts!`;
        }
        
        showMultiMessage(resultMessage, 'success');
        multiplayerGameActive = false;
        
        // Add a slight delay before showing the play again prompt
        setTimeout(() => {
            if (confirm('Play another game?')) {
                resetMultiplayerGame();
            } else {
                window.location.href = '/';
            }
        }, 3000);
    }

    try {
        // ... existing code ...
    } catch (error) {
        console.error('Error handling round end:', error);
        showNotification('Error', 'Failed to process round end', 'error');
        resetMultiplayerGame();
    }
}

async function saveGameScores(finalScores) {
    try {
        const response = await fetch('/api/scores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mode: 'multi',
                scores: finalScores
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save scores');
        }

        // Refresh the scores display
        loadMultiplayerScores();
    } catch (error) {
        console.error('Error saving scores:', error);
        showMultiMessage('Failed to save game scores', 'error');
    }
}

// Add new function to start a new round
async function startNewRound() {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
        // Clear previous round messages
        document.getElementById('multi-message').textContent = '';
        
        // End the previous game session before starting a new one
        await fetch('/api/end-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const response = await fetch('/api/start-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mode: 'multi',
                player1: currentPlayers.chooser,
                player2: currentPlayers.guesser
            })
        });

        const data = await response.json();
        
        if (data.error) {
            showMultiMessage(data.error, 'error');
            return;
        }

        // Clear previous round's data
        document.getElementById('number-selection').style.display = 'block';
        document.getElementById('guessing-interface').style.display = 'none';
        document.getElementById('multi-attempts').textContent = '0';
        document.getElementById('multi-guess').value = ''; // Clear guess input
        document.getElementById('secret-number').value = ''; // Clear secret number input
        
        updateGameStatus();
        showMultiMessage(`Round 2: ${currentPlayers.chooser}, enter your secret number!`, 'hint');

    } catch (error) {
        showMultiMessage('Failed to start round 2. Please try again.', 'error');
        console.error('Error starting round 2:', error);
    } finally {
        isProcessing = false;
    }
}

function showMultiMessage(message, type) {
    const messageDiv = document.getElementById('multi-message');
    if (!messageDiv) return;
    
    // Clear any existing messages
    messageDiv.innerHTML = '';
    
    // Force a reflow to ensure animation plays
    void messageDiv.offsetWidth;
    
    // Replace \n with <br> for line breaks in HTML
    messageDiv.innerHTML = message.replace(/\n/g, '<br>');
    messageDiv.className = 'game-message ' + type;
    
    // Scroll message into view if needed
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetGameState() {
    isProcessing = false;
    isSettingTarget = false;
    multiplayerGameActive = false;
    clearGameSession();
}

function resetMultiplayerGame() {
    // Reset all state variables
    isProcessing = false;
    isSettingTarget = false;
    multiplayerGameActive = false;
    
    // Clear all game state
    document.getElementById('player-setup').style.display = 'block';
    document.getElementById('multiplayer-game').style.display = 'none';
    document.getElementById('player1-name').value = '';
    document.getElementById('player2-name').value = '';
    
    // Reset game elements
    document.getElementById('number-selection').style.display = 'none';
    document.getElementById('guessing-interface').style.display = 'none';
    document.getElementById('multi-message').textContent = '';
    document.getElementById('multi-attempts').textContent = '0';
    document.getElementById('current-round').textContent = '1';
    document.getElementById('current-players').textContent = '';
    
    // Clear inputs
    document.getElementById('secret-number').value = '';
    document.getElementById('multi-guess').value = '';
    
    // Reset game state variables
    currentPlayers = { chooser: null, guesser: null };
    scores = {};
    round = 1;
    
    // Clear session storage
    clearGameSession();
    
    // Clean up any existing toasts
    const toastEl = document.getElementById('toast-notification');
    const toast = bootstrap.Toast.getInstance(toastEl);
    if (toast) {
        toast.hide();
    }
}

async function loadMultiplayerScores() {
    try {
        const response = await fetch('/api/scores?mode=multi');
        const scores = await response.json();
        const scoresDiv = document.getElementById('multi-scores-body');
        
        if (Object.keys(scores).length === 0) {
            scoresDiv.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center">
                        <i class="fas fa-info-circle"></i> No matches played yet!
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        Object.values(scores)
            .slice(-5) // Show only last 5 games
            .forEach(gameScores => {
                const players = Object.keys(gameScores);
                const player1Score = gameScores[players[0]];
                const player2Score = gameScores[players[1]];
                const winner = player1Score < player2Score ? players[0] : 
                             player2Score < player1Score ? players[1] : 'Tie';
                
                html += `
                    <tr>
                        <td>
                            <i class="fas fa-user"></i> ${players[0]}
                            <span class="text-muted">vs</span>
                            <i class="fas fa-user"></i> ${players[1]}
                        </td>
                        <td>
                            <span class="${player1Score < player2Score ? 'text-success' : ''}">${player1Score}</span>
                            <span class="text-muted">:</span>
                            <span class="${player2Score < player1Score ? 'text-success' : ''}">${player2Score}</span>
                        </td>
                        <td>
                            ${winner === 'Tie' ? 
                                '<span class="badge bg-secondary">Tie</span>' : 
                                `<span class="badge bg-success"><i class="fas fa-crown"></i> ${winner}</span>`}
                        </td>
                    </tr>`;
            });
        
        scoresDiv.innerHTML = html;

    } catch (error) {
        console.error('Failed to load multiplayer scores:', error);
        document.getElementById('multi-scores-body').innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-danger">
                    <i class="fas fa-exclamation-circle"></i> Failed to load scores
                </td>
            </tr>
        `;
    }
}

// Load scores when page loads
document.addEventListener('DOMContentLoaded', loadMultiplayerScores);

// Update visibility change handler
document.addEventListener('visibilitychange', async () => {
    // Only handle visibility change if we're not in the middle of setting a target
    if (document.hidden && !isSettingTarget && multiplayerGameActive) {
        const gameSession = checkGameSession();
        if (gameSession && gameSession.active) {
            try {
                await fetch('/api/end-game', {
                    method: 'POST',
                    keepalive: true
                });
                multiplayerGameActive = false;
                clearGameSession();
            } catch (error) {
                console.error('Failed to cleanup game:', error);
            }
        }
    }
});

// Update cleanup handler
window.addEventListener('beforeunload', async (event) => {
    // Only handle unload if we're not in the middle of setting a target
    if (!isSettingTarget && multiplayerGameActive) {
        try {
            await fetch('/api/end-game', {
                method: 'POST',
                keepalive: true
            });
            multiplayerGameActive = false;
            clearGameSession();
        } catch (error) {
            console.error('Failed to cleanup game:', error);
        }
    }
});

// Add session restoration on page load
document.addEventListener('DOMContentLoaded', () => {
    const gameSession = checkGameSession();
    if (gameSession && gameSession.active) {
        currentPlayers = gameSession.players;
        round = gameSession.round;
        multiplayerGameActive = true;
        
        document.getElementById('player-setup').style.display = 'none';
        document.getElementById('multiplayer-game').style.display = 'block';
        updateGameStatus();
    }
});

// Add cleanup on page unload
window.addEventListener('unload', () => {
    if (multiplayerGameActive) {
        clearGameSession();
    }
});
