from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash, send_from_directory
from werkzeug.exceptions import HTTPException
import secrets
from game_logic import GameManager, GameError
import logging
from logging.handlers import RotatingFileHandler
import os
from datetime import datetime
from typing import Tuple, Dict, Any, Optional

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)
game_manager = GameManager()

# Consider moving configuration to a separate config.py file
class Config:
    SECRET_KEY = secrets.token_hex(16)
    LOG_DIR = 'logs'
    LOG_FILE = 'guessmaster.log'
    LOG_FORMAT = '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    LOG_MAX_BYTES = 10240
    LOG_BACKUP_COUNT = 10

def setup_logging(app: Flask) -> None:
    """Configure application logging."""
    if not os.path.exists(Config.LOG_DIR):
        os.makedirs(Config.LOG_DIR)

    file_handler = RotatingFileHandler(
        os.path.join(Config.LOG_DIR, Config.LOG_FILE),
        maxBytes=Config.LOG_MAX_BYTES,
        backupCount=Config.LOG_BACKUP_COUNT
    )
    file_handler.setFormatter(logging.Formatter(Config.LOG_FORMAT))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('GuessMaster startup')

@app.errorhandler(Exception)
def handle_error(error: Exception) -> Tuple[str, int]:
    """Global error handler with improved error handling."""
    code = 500
    message = "An unexpected error occurred. Please try again."

    if isinstance(error, GameError):
        message = str(error)
        code = error.status_code
    elif isinstance(error, HTTPException):
        message = error.description
        code = error.code
    
    # Log error with more context
    app.logger.error(f"Error {code}: {message}", exc_info=True)
    
    return render_template('base.html', error=message), code

@app.route('/')
def index():
    return render_template('base.html')  

@app.route('/singleplayer')
def singleplayer():
    """Render the singleplayer page."""
    return render_template('singleplayer.html')

@app.route('/multiplayer')
def multiplayer():
    """Render the multiplayer page."""
    return render_template('multiplayer.html')

@app.route('/api/start-game', methods=['POST'])
def start_game() -> Tuple[Dict[str, Any], int]:
    """Start a new game session with improved validation."""
    try:
        data = request.get_json()
        if not data:
            raise GameError("Invalid request data")

        mode = data.get('mode')
        if mode not in ['single', 'multi']:
            raise GameError("Invalid game mode")

        if mode == 'single':
            return handle_singleplayer_start(data)
        else:
            return handle_multiplayer_start(data)

    except GameError as e:
        app.logger.warning(f'Game error: {str(e)}')
        return jsonify(error=str(e)), 400
    except Exception as e:
        app.logger.error(f'Unexpected error in start_game: {str(e)}', exc_info=True)
        return jsonify(error="Failed to start game"), 500

def handle_singleplayer_start(data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """Handle singleplayer game start."""
    difficulty = data.get('difficulty')
    if not difficulty:
        raise GameError("Difficulty level required")
    
    custom_range = None
    if difficulty == 'custom':
        custom_range = data.get('range')
        if not custom_range or len(custom_range) != 2:
            raise GameError("Invalid custom range")
    
    game_data = game_manager.start_singleplayer(difficulty, custom_range)
    session['game_id'] = game_data['game_id']
    return jsonify(game_data), 200

def handle_multiplayer_start(data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """Handle multiplayer game start."""
    player1 = data.get('player1')
    player2 = data.get('player2')
    if not player1 or not player2:
        raise GameError("Both player names required")
    
    game_data = game_manager.start_multiplayer(player1, player2)
    session['game_id'] = game_data['game_id']
    return jsonify(game_data), 200

@app.route('/api/guess', methods=['POST'])
def make_guess():
    """Process a player's guess."""
    try:
        data = request.get_json()
        if not data or 'guess' not in data:
            raise GameError("Invalid guess data")

        game_id = session.get('game_id')
        if not game_id:
            raise GameError("No active game session", status_code=440)
            
        if game_id not in game_manager.active_games:
            session.pop('game_id', None)
            raise GameError("Game session expired", status_code=440)

        guess = data.get('guess')
        if not isinstance(guess, (int, float)):
            raise GameError("Guess must be a number")

        result = game_manager.process_guess(game_id, int(guess))
        
        if result.get('result') in ['win', 'lose']:
            session.pop('game_id', None)
            
        return jsonify(result)

    except GameError as e:
        app.logger.warning(f'Game error: {str(e)}')
        status_code = getattr(e, 'status_code', 400)
        return jsonify(error=str(e)), status_code
    except Exception as e:
        app.logger.error(f'Unexpected error in make_guess: {str(e)}')
        return jsonify(error="Failed to process guess"), 500

@app.route('/api/scores', methods=['GET', 'POST'])
def get_scores():
    """Retrieve or save game scores."""
    try:
        if request.method == 'GET':
            mode = request.args.get('mode', 'single')
            if mode not in ['single', 'multi']:
                raise GameError("Invalid score mode")
            scores = game_manager.get_scores(mode)
            return jsonify(scores)
        
        # Handle POST request for saving scores
        data = request.get_json()
        if not data or 'mode' not in data or 'scores' not in data:
            raise GameError("Invalid score data")
            
        mode = data['mode']
        scores = data['scores']
        
        if mode == 'multi':
            # For multiplayer, save scores with timestamp
            timestamp = datetime.now().isoformat()
            game_manager._save_score(mode, timestamp, scores)
        
        return jsonify({"success": True})

    except GameError as e:
        app.logger.warning(f'Game error: {str(e)}')
        return jsonify(error=str(e)), 400
    except Exception as e:
        app.logger.error(f'Unexpected error in get_scores: {str(e)}')
        return jsonify(error="Failed to process scores"), 500

@app.route('/api/end-game', methods=['POST'])
def end_game():
    """End the current game session."""
    try:
        if 'game_id' in session:
            game_manager.end_game(session['game_id'])
            session.pop('game_id', None)
        return jsonify(success=True)
    except Exception as e:
        app.logger.error(f'Error ending game: {str(e)}')
        return jsonify(error="Failed to end game"), 500

@app.route('/api/set-target', methods=['POST'])
def set_target():
    """Set the target number for multiplayer game."""
    try:
        data = request.get_json()
        if not data or 'number' not in data:
            raise GameError("Target number is required")

        game_id = session.get('game_id')
        if not game_id:
            raise GameError("No active game session")

        number = data.get('number')
        if not isinstance(number, (int, float)):
            raise GameError("Target must be a number")

        game_manager.set_target_number(game_id, int(number))
        return jsonify(success=True)

    except GameError as e:
        app.logger.warning(f'Game error: {str(e)}')
        return jsonify(error=str(e)), 400
    except Exception as e:
        app.logger.error(f'Unexpected error in set_target: {str(e)}')
        return jsonify(error="Failed to set target number"), 500

def validate_game_session() -> str:
    """Validate and return game session ID."""
    game_id = session.get('game_id')
    if not game_id:
        raise GameError("No active game session", status_code=440)
    
    if game_id not in game_manager.active_games:
        session.pop('game_id', None)
        raise GameError("Game session expired", status_code=440)
    
    return game_id

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                             'favicon.ico', mimetype='image/vnd.microsoft.icon')

if __name__ == '__main__':
    app.run(debug=True)
