import random
import os
import json

# File to store player scores
SCORES_FILE = "multiplayer_scores.json"
MAX_ATTEMPTS = 8  # Set the maximum number of attempts per round

def clear_screen():
    """Clear the terminal screen across different operating systems."""
    os.system('cls' if os.name == 'nt' else 'clear')

def load_scores():
    """Load multiplayer scores from file."""
    try:
        if os.path.exists(SCORES_FILE):
            with open(SCORES_FILE, "r") as file:
                scores = json.load(file)
                # Enhanced validation
                if not isinstance(scores, dict):
                    print("⚠️ Invalid scores file format")
                    return {}
                # Validate individual scores
                validated_scores = {}
                for player, score in scores.items():
                    if isinstance(player, str) and isinstance(score, int) and 1 <= score <= MAX_ATTEMPTS:
                        validated_scores[player] = score
                return validated_scores
    except (json.JSONDecodeError, IOError) as e:
        print(f"⚠️ Error loading scores: {e}")
    return {}

def save_score(player, attempts):
    """Save the player's score if it's the best one."""
    try:
        if attempts > MAX_ATTEMPTS:
            return
        # Use file locking if available
        scores = load_scores()
        if player not in scores or attempts < scores[player]:
            scores[player] = attempts
            # Atomic write using temporary file
            temp_file = f"{SCORES_FILE}.tmp"
            with open(temp_file, "w") as file:
                json.dump(scores, file)
            os.replace(temp_file, SCORES_FILE)  # Atomic operation
    except IOError as e:
        print(f"⚠️ Error saving score: {e}")

def get_valid_number(prompt, min_val=None, max_val=None, hide_input=False):
    """Get a valid integer input, optionally hidden (for Player 1's number)."""
    while True:
        try:
            if hide_input:
                try:
                    import getpass
                    num = int(getpass.getpass(prompt))
                except ImportError:
                    # Fallback if getpass is not available
                    print("⚠️ Secure input not available. Input will be visible.")
                    num = int(input(prompt))
            else:
                num = int(input(prompt))
                
            if min_val is not None and num < min_val:
                print(f"❌ Please enter a number greater than or equal to {min_val}.")
            elif max_val is not None and num > max_val:
                print(f"❌ Please enter a number less than or equal to {max_val}.")
            else:
                return num
        except ValueError:
            print("⚠️ Invalid input! Please enter a valid integer.")

def play_round(chooser, guesser):
    """Handles a single round where one player chooses and the other guesses."""
    print(f"\n🔵 {chooser}, pick a secret number for {guesser} to guess!")
    secret_number = get_valid_number("Enter a secret number (1-100): ", 1, 100, hide_input=True)
    clear_screen()  # Clear screen for secrecy

    attempts = 0
    while attempts < MAX_ATTEMPTS:
        guess = get_valid_number(f"{guesser}, enter your guess: ", 1, 100)
        attempts += 1

        if guess == secret_number:
            print(f"🎉 {guesser} guessed it in {attempts} attempts!")
            save_score(guesser, attempts)
            return attempts
        elif guess > secret_number:
            print(f"⬇️ Too high! {MAX_ATTEMPTS - attempts} attempts remaining.")
        else:
            print(f"⬆️ Too low! {MAX_ATTEMPTS - attempts} attempts remaining.")

    print(f"\n❌ {guesser} ran out of attempts! The correct number was {secret_number}.")
    print(f"🏆 {chooser} wins this round by default!")
    return MAX_ATTEMPTS

def get_valid_player_name(player_num):
    """Get a valid player name that isn't empty and contains only letters."""
    while True:
        name = input(f"Enter Player {player_num}'s name: ").strip()
        if not name:
            print("❌ Player name cannot be empty! Try again.")
        elif not name.replace(" ", "").isalpha():
            print("❌ Player name should only contain letters! Try again.")
        else:
            return name

def play_multiplayer():
    """Multiplayer mode: Two players take turns guessing."""
    try:
        print("\n🎮 Multiplayer Mode: Player vs. Player 🎮")

        # Get player names and ensure they are different
        player1 = get_valid_player_name(1)
        while True:
            player2 = get_valid_player_name(2)
            if player2 == player1:
                print("❌ Player 2 must have a different name! Try again.")
            else:
                break

        # Round 1: Player 1 picks, Player 2 guesses
        attempts_p2 = play_round(player1, player2)

        # Round 2: Player 2 picks, Player 1 guesses
        attempts_p1 = play_round(player2, player1)

        # Determine the winner
        print("\n🏆 Game Over! Final Results:")
        print(f"{player1} took {attempts_p1} attempts.")
        print(f"{player2} took {attempts_p2} attempts.")

        if attempts_p1 < attempts_p2:
            print(f"🎉 {player1} wins!")
        elif attempts_p1 > attempts_p2:
            print(f"🎉 {player2} wins!")
        else:
            print("🤝 It's a tie!")
    except KeyboardInterrupt:
        print("\n\n👋 Game interrupted. Thanks for playing!")
        return


def show_multiplayer_scores():
    """Display top scores from multiplayer mode."""
    try:  # Added try-except block
        scores = load_scores()
        if not scores:
            print("🏆 No scores yet! Play Multiplayer Mode to set records.")
            return
        else:
            print("\n🏆 Multiplayer High Scores 🏆")
            sorted_scores = sorted(scores.items(), key=lambda x: x[1])    
            
        SCORES_PER_PAGE = 10
        total_pages = (len(sorted_scores) + SCORES_PER_PAGE - 1) // SCORES_PER_PAGE
            
        if total_pages > 1:
            try:
                page = get_valid_number(f"Enter page number (1-{total_pages}): ", 1, total_pages)
            except KeyboardInterrupt:
                print("\nReturning to main menu...")
                return
            start_idx = (page - 1) * SCORES_PER_PAGE
            end_idx = min(start_idx + SCORES_PER_PAGE, len(sorted_scores))
            display_scores = sorted_scores[start_idx:end_idx]
        else:
            display_scores = sorted_scores
            
        for player, score in display_scores:
            print(f"{player}: {score} attempts")
    except KeyboardInterrupt:
        print("\nReturning to main menu...")
        return
        
if __name__ == "__main__":
    try:
        while True:
            print("\n🎮 GuessMaster 2025: Multiplayer Edition 🎮")
            print("1. Play Multiplayer Mode")
            print("2. View Multiplayer High Scores")
            print("3. Exit")

            try:
                choice = get_valid_number("Enter your choice (1-3): ", 1, 3)

                if choice == 1:
                    play_multiplayer()
                elif choice == 2:
                    show_multiplayer_scores()
                else:
                    confirm = input("Are you sure you want to exit? (y/n): ").lower().strip()
                    if confirm in ['y', 'yes']:
                        print("🚪 Exiting Multiplayer Mode. Thanks for playing! 🎉")
                        break
            except KeyboardInterrupt:
                print("\n\n👋 Thanks for playing!")
                break
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        print("The game will now exit.")