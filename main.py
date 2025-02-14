import singleplayer
import multiplayer

def main():
    """Main menu to choose between Single Player and Multiplayer."""
    try:
        while True:
            print("\n🎮 Welcome to GuessMaster-2025_v1 🎮")
            print("1. Play Single Player")
            print("2. View Single Player High Scores")
            
            print("3. Play Multiplayer")
            print("4. View Multiplayer High Scores")
            
            print("5. Exit")

            choice = input("Enter your choice (1-5): ").strip()

            if choice == "1":
                singleplayer.play_singleplayer()
            elif choice == "2":
                singleplayer.show_high_scores()
            elif choice == "3":
                multiplayer.play_multiplayer()
            elif choice == "4":
                multiplayer.show_multiplayer_scores()
            elif choice == "5":
                print("🚪 Exiting GuessMaster 2025. Thanks for playing! 🎉")
                break
            else:
                print("❌ Invalid choice! Please enter 1, 2, 3, 4, or 5.")
    except KeyboardInterrupt:
        print("\n\n🚪 Game interrupted. Thanks for playing! 🎉")

if __name__ == "__main__":
    main()
