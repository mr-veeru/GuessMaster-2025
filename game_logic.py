import json
import os
import uuid
from datetime import datetime
import threading
from typing import Dict, Any, Optional
import logging
import random

class GameError(Exception):
    """Custom exception for game-related errors."""
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code

class GameManager:
    def __init__(self):
        self.active_games = {}
        self.SINGLE_SCORES_FILE = "data/singleplayer_scores.json"
        self.MULTI_SCORES_FILE = "data/multiplayer_scores.json"
        self.MAX_ATTEMPTS = {'single': 6, 'multi': 8}
        self.RANGES = {
            'easy': (1, 50),
            'medium': (1, 100),
            'hard': (1, 500)
        }
        self.SESSION_TIMEOUT = 30 * 60  # 30 minutes
        self._lock = threading.Lock()
        self._setup_data_directory()
        self._cleanup_timer = threading.Timer(300, self._cleanup_expired_sessions)
        self._cleanup_timer.daemon = True  # Ensure thread doesn't block program exit
        self._cleanup_timer.start()
        
    def _setup_data_directory(self):
        """Ensure data directory exists."""
        os.makedirs('data', exist_ok=True)
        for file in [self.SINGLE_SCORES_FILE, self.MULTI_SCORES_FILE]:
            if not os.path.exists(file):
                with open(file, 'w') as f:
                    json.dump({}, f)

    def _validate_game_id(self, game_id: str) -> None:
        """Validate game ID exists and game is active."""
        if not game_id in self.active_games:
            raise GameError("Invalid or expired game session")

    def _validate_number_range(self, number: int, range_min: int, range_max: int) -> None:
        """Validate number is within acceptable range."""
        if not isinstance(number, int) or number < range_min or number > range_max:
            raise GameError(f"Number must be between {range_min} and {range_max}")

    def _validate_game_session(self, game_id: str) -> dict:
        """Validate and return game session."""
        if not game_id:
            raise GameError("No active game session")
        
        game = self.active_games.get(game_id)
        if not game:
            raise GameError("Game session expired or invalid")
            
        # Check session timeout
        start_time = datetime.fromisoformat(game['start_time'])
        if (datetime.now() - start_time).seconds > self.SESSION_TIMEOUT:
            self.end_game(game_id)
            raise GameError("Game session has expired")
            
        return game

    def _validate_custom_range(self, range_min: int, range_max: int) -> None:
        """Validate custom range values."""
        if not isinstance(range_min, int) or not isinstance(range_max, int):
            raise GameError("Range values must be integers")
            
        if range_min < 1:
            raise GameError("Minimum value must be at least 1")
            
        if range_max <= range_min:
            raise GameError("Maximum value must be greater than minimum value")
            
        if range_max > 1000000:
            raise GameError("Maximum value cannot exceed 1,000,000")

    def _cleanup_expired_sessions(self):
        """Clean up expired game sessions."""
        now = datetime.now()
        with self._lock:
            expired = [
                game_id for game_id, game in self.active_games.items()
                if (now - datetime.fromisoformat(game['start_time'])).seconds > self.SESSION_TIMEOUT
            ]
            for game_id in expired:
                try:
                    self.end_game(game_id)
                except Exception as e:
                    logging.error(f"Error cleaning up game {game_id}: {str(e)}")
        
        # Schedule next cleanup
        self._cleanup_timer = threading.Timer(300, self._cleanup_expired_sessions)
        self._cleanup_timer.daemon = True
        self._cleanup_timer.start()

    def start_singleplayer(self, difficulty: str, custom_range: Optional[tuple] = None) -> dict:
        """Start a new singleplayer game with enhanced error handling."""
        try:
            if difficulty == 'custom':
                if not custom_range or len(custom_range) != 2:
                    raise GameError("Invalid custom range format")
                    
                range_min, range_max = custom_range
                self._validate_custom_range(range_min, range_max)
            elif difficulty in self.RANGES:
                range_min, range_max = self.RANGES[difficulty]
            else:
                raise GameError(f"Invalid difficulty level: {difficulty}")

            game_id = str(uuid.uuid4())
            target = random.randint(range_min, range_max)
            print(f"Target: {target}")
            
            with self._lock:
                self.active_games[game_id] = {
                    'mode': 'single',
                    'target': target,
                    'attempts': 0,
                    'max_attempts': self.MAX_ATTEMPTS['single'],
                    'range': (range_min, range_max),
                    'difficulty': difficulty,
                    'start_time': datetime.now().isoformat()
                }
            
            return {
                'game_id': game_id,
                'range': (range_min, range_max),
                'max_attempts': self.MAX_ATTEMPTS['single']
            }

        except Exception as e:
            logging.error(f"Error starting singleplayer game: {str(e)}")
            raise GameError(f"Failed to start game: {str(e)}")

    def start_multiplayer(self, player1: str, player2: str) -> dict:
        """Start a new multiplayer game."""
        if not player1 or not player2:
            raise GameError("Both player names are required")
        if player1 == player2:
            raise GameError("Players must have different names")

        game_id = str(uuid.uuid4())
        game = {
            'mode': 'multi',
            'current_round': 1,
            'player1': player1,
            'player2': player2,
            'scores': {player1: 0, player2: 0},
            'attempts': 0,
            'max_attempts': self.MAX_ATTEMPTS['multi'],
            'status': 'waiting_for_number',
            'range': (1, 100),
            'start_time': datetime.now().isoformat(),
            'target': None  # Initialize target as None until set
        }
        
        with self._lock:
            self.active_games[game_id] = game
            
        return {
            'game_id': game_id,
            'max_attempts': game['max_attempts'],
            'range': game['range']
        }

    def set_target_number(self, game_id: str, number: int) -> None:
        """Set the target number for a multiplayer game."""
        self._validate_game_id(game_id)
        game = self.active_games[game_id]
        
        if game['status'] != 'waiting_for_number':
            raise GameError("Cannot set target number at this time")
            
        self._validate_number_range(number, game['range'][0], game['range'][1])
        
        game['target'] = number
        game['status'] = 'in_progress'
        game['attempts'] = 0

    def process_guess(self, game_id: str, guess: int) -> dict:
        """Process a player's guess with enhanced error handling."""
        try:
            game = self._validate_game_session(game_id)
            
            if not isinstance(guess, int):
                raise GameError("Guess must be an integer")
                
            range_min, range_max = game['range']
            if guess < range_min or guess > range_max:
                raise GameError(f"Guess must be between {range_min} and {range_max}")
                
            game['attempts'] += 1
            
            if guess == game['target']:
                result = self._handle_win(game)
                self.active_games.pop(game_id)
                return result
                
            if game['attempts'] >= game['max_attempts']:
                result = self._handle_loss(game)
                self.active_games.pop(game_id)
                return result
                
            return self._handle_continue(game, guess)

        except Exception as e:
            logging.error(f"Error processing guess: {str(e)}")
            raise GameError(f"Failed to process guess: {str(e)}")

    def _handle_win(self, game: dict) -> dict:
        """Handle win condition."""
        if 'mode' not in game:
            game['mode'] = 'single'
        
        if game['mode'] == 'single':
            self._save_score('single', game['difficulty'], game['attempts'])
        return {
            'result': 'win',
            'attempts': game['attempts'],
            'message': f'Correct! The number was {game["target"]}'
        }

    def _handle_loss(self, game: dict) -> dict:
        """Handle loss condition."""
        return {
            'result': 'lose',
            'target': game['target'],
            'message': f'Game Over! The number was {game["target"]}'
        }

    def _handle_continue(self, game: dict, guess: int) -> dict:
        """Handle continue condition."""
        return {
            'result': 'continue',
            'hint': 'lower' if guess > game['target'] else 'higher',
            'attempts': game['attempts'],
            'remaining': game['max_attempts'] - game['attempts']
        }

    def end_game(self, game_id: str) -> None:
        """End a game session with enhanced cleanup."""
        try:
            with self._lock:
                if game_id in self.active_games:
                    game = self.active_games[game_id]
                    # Perform any necessary cleanup for the specific game mode
                    if game.get('mode') == 'multi':
                        # Clean up multiplayer specific resources
                        pass
                    self.active_games.pop(game_id, None)
                    logging.info(f"Game session {game_id} ended successfully")
        except Exception as e:
            logging.error(f"Error ending game {game_id}: {str(e)}")
            raise GameError(f"Failed to end game: {str(e)}")

    def get_scores(self, mode: str) -> dict:
        """Retrieve scores for the specified mode."""
        if mode not in ['single', 'multi']:
            raise GameError("Invalid score mode")
            
        filename = self.SINGLE_SCORES_FILE if mode == 'single' else self.MULTI_SCORES_FILE
        try:
            with open(filename, 'r') as f:
                scores = json.load(f)
            return scores
        except Exception as e:
            logging.error(f"Error loading scores: {e}")
            return {}

    def _save_score(self, mode: str, identifier: str, score_data: Any) -> None:
        """Save a game score with enhanced error handling and logging."""
        filename = self.SINGLE_SCORES_FILE if mode == 'single' else self.MULTI_SCORES_FILE
        try:
            with self._lock:
                with open(filename, 'r') as f:
                    scores = json.load(f)
                
                if mode == 'single':
                    if identifier not in scores or score_data < scores[identifier]:
                        scores[identifier] = score_data
                        logging.info(f"New high score saved for {identifier}: {score_data}")
                else:
                    scores[identifier] = score_data
                    logging.info(f"Multiplayer score saved: {score_data}")
                
                # Atomic write using temporary file
                temp_file = f"{filename}.tmp"
                with open(temp_file, 'w') as f:
                    json.dump(scores, f)
                os.replace(temp_file, filename)
        except Exception as e:
            logging.error(f"Error saving score: {str(e)}")
            raise GameError(f"Failed to save score: {str(e)}")
