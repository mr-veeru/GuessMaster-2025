import random
import json
import os

# File to store high scores
SCORES_FILE = "singleplayer_scores.json"
MAX_ATTEMPTS = 6  # Set the maximum number of attempts per round

def load_high_score():
    """Load high scores from file."""
    try:
        if os.path.exists(SCORES_FILE):
            with open(SCORES_FILE, "r") as file:
                scores = json.load(file)
                # Validate scores format
                if not isinstance(scores, dict):
                    print("⚠️ Invalid scores file format. Starting with empty scores.")
                    return {}
                # Ensure all values are positive integers and less than MAX_ATTEMPTS
                return {k: v for k, v in scores.items() 
                       if isinstance(v, int) and 0 < v <= MAX_ATTEMPTS}
    except (IOError, json.JSONDecodeError):
        print("⚠️ Error reading high scores file. Starting with empty scores.")
    return {}

def save_high_score(level, attempts):
    """Save new high score if it's lower than the previous best."""
    if not isinstance(attempts, int) or attempts <= 0:
        print("⚠️ Invalid score value")
        return
        
    try:
        scores = load_high_score()
        if level not in scores or attempts < scores[level]:
            # Create backup of current scores
            if os.path.exists(SCORES_FILE):
                os.replace(SCORES_FILE, f"{SCORES_FILE}.backup")
            
            scores[level] = attempts
            with open(SCORES_FILE, "w") as file:
                json.dump(scores, file)
                
            # Clean up backup file after successful save
            if os.path.exists(f"{SCORES_FILE}.backup"):
                os.remove(f"{SCORES_FILE}.backup")
    except IOError:
        print("⚠️ Unable to save high score. File access error.")
        # Restore from backup if available
        if os.path.exists(f"{SCORES_FILE}.backup"):
            os.replace(f"{SCORES_FILE}.backup", SCORES_FILE)
    except Exception as e:
        print(f"⚠️ An error occurred while saving the score: {e}")

def get_valid_number(prompt, min_val=None, max_val=None):
    """Get a valid integer input within a range."""
    while True:
        try:
            num = int(input(prompt).strip())  # Add strip() to handle whitespace
            if min_val is not None and num < min_val:
                print(f"Please enter a number greater than or equal to {min_val}.")
            elif max_val is not None and num > max_val:
                print(f"Please enter a number less than or equal to {max_val}.")
            else:
                return num
        except ValueError:
            print("Invalid input! Please enter a valid integer.")
        except KeyboardInterrupt:
            print("\n\n👋 Game interrupted. Thanks for playing! 🎉")
            exit()
            
def choose_difficulty():
    """Let the user choose a difficulty level."""
    print("\n🎯 Choose a Difficulty Level 🎯")
    print("1. Easy (1 to 50)")
    print("2. Medium (1 to 100)")
    print("3. Hard (1 to 500)")
    print("4. Custom Range")

    level_choice = get_valid_number("Enter 1-4: ", 1, 4)
    if level_choice == 1:
        return "Easy", 1, 50
    elif level_choice == 2:
        return "Medium", 1, 100
    elif level_choice == 3:
        return "Hard", 1, 500
    else:
        MAX_CUSTOM = 1000000  # Reasonable upper limit
        min_num = get_valid_number("Enter the starting number: ", 1, MAX_CUSTOM)
        max_num = get_valid_number(f"Enter a number greater than {min_num}: ", 
                                 min_num + 1, MAX_CUSTOM)
        return "Custom", min_num, max_num
    

def play_singleplayer():
    """Runs Single Player Mode"""
    print("🎉 Welcome to Single Player Mode! 🎉")

    # Select difficulty
    level, n1, n2 = choose_difficulty()

    # Generate a random number
    random_num = random.randint(n1, n2)
    attempts = 0

    print(f"\n🤔 I have chosen a number between {n1} and {n2}. You have {MAX_ATTEMPTS} attempts!")

    while attempts < MAX_ATTEMPTS:
        guess = get_valid_number(f"Enter your guess: ", n1, n2)
        attempts += 1

        if guess == random_num:
            print(f"🎉 Congratulations! You guessed the number in {attempts} attempts!")
            save_high_score(level, attempts)
            break
        else:
            if guess > random_num:
                print(f"⬇️ Too high! {MAX_ATTEMPTS - attempts} attempts remaining.")
            else:
                print(f"⬆️ Too low! {MAX_ATTEMPTS - attempts} attempts remaining.")
        if attempts == MAX_ATTEMPTS:
            print(f"❌ Out of attempts! The number was {random_num}. Better luck next time!")

def show_high_scores():
    """Display the high scores."""
    scores = load_high_score()
    if not scores:
        print("🏆 No high scores yet. Be the first to set one!")
    else:
        print("\n🏆 High Scores 🏆")
        for level, score in scores.items():
            print(f"{level}: {score} attempts")

def reset_high_scores():
    """Reset all high scores after confirmation."""
    print("\n⚠️ Warning: This will delete all high scores!")
    try:
        confirmation = input("Type 'RESET' to confirm: ").upper().strip()
        if confirmation == "RESET":
            try:
                if os.path.exists(SCORES_FILE):
                    os.remove(SCORES_FILE)
                if os.path.exists(f"{SCORES_FILE}.backup"):
                    os.remove(f"{SCORES_FILE}.backup")
                print("🗑️ High scores have been reset!")
            except OSError as e:
                print(f"❌ Error deleting scores file: {e}")
        else:
            print("Reset cancelled.")
    except KeyboardInterrupt:
        print("\nReset cancelled.")

if __name__ == "__main__":
    try:
        while True:
            print("\n🎮 GuessMaster 2025 🎮")
            print("1. Play Game")
            print("2. View High Scores")
            print("3. Reset High Scores")
            print("4. Exit")

            choice = get_valid_number("Enter your choice (1-4): ", 1, 4)

            if choice == 1:
                play_singleplayer()
            elif choice == 2:
                show_high_scores()
            elif choice == 3:
                reset_high_scores()
            else:
                print("🚪 Exiting GuessMaster 2025. Thanks for playing! 🎉")
                break
    except KeyboardInterrupt:
        print("\n\n👋 Game interrupted. Thanks for playing! 🎉")
        