# 🎮 GuessMaster-2025_v2  
🚀 A full-stack web-based number guessing game built with **Flask**, **JavaScript**, and **Bootstrap**!  

## 📌 Features  
✅ **Single Player Mode** – Guess a random number within a given range.  
✅ **Multiplayer Mode** – Two players take turns picking and guessing numbers.  
✅ **Score Tracking** – Stores and displays high scores.  
✅ **Max Attempts Limit** – Players must guess within a fixed number of tries.  
✅ **Error Handling & Logging** – Uses `RotatingFileHandler` for logs.  
✅ **Interactive UI** – Built with Bootstrap & FontAwesome.  

---

## 🛠 Tech Stack  
- **Backend:** Flask (Python)  
- **Frontend:** HTML, CSS (Bootstrap), JavaScript  
- **Data Storage:** JSON (Future: PostgreSQL)  
- **Logging:** RotatingFileHandler  

---

## 🎮 How to Play?  
1️⃣ **Clone the Repository**  
```sh
git clone --branch webapp-version https://github.com/mr-veeru/GuessMaster-2025.git
cd GuessMaster-2025
```

2️⃣ **Create a Virtual Environment & Install Dependencies**  
```sh
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3️⃣ **Run the Flask App**  
```sh
python app.py
```
🔗 **Go to:** `http://127.0.0.1:5000/` in your browser.

---

## 📂 Folder Structure  
```
GuessMaster-2025_v2/
│── app.py                  # Main Flask app
│── game_logic.py           # Game logic handling
│── data/                   # Score storage (JSON)
│   ├── multiplayer_scores.json
│   ├── singleplayer_scores.json
│── static/                 # Frontend assets
│   ├── css/style.css
│   ├── js/game.js
│   ├── js/multiplayer.js
│   ├── js/singleplayer.js
│   ├── js/utils.js
│── templates/              # HTML templates
│   ├── base.html
│   ├── singleplayer.html
│   ├── multiplayer.html
│── requirements.txt        # Python dependencies
│── README.md               # Project documentation
```

---

## 🚀 Future Enhancements  
📌 **Deploy Online** 
📌 **Replace JSON with PostgreSQL**  
📌 **Add Flask-Login for User Authentication**  
📌 **Use WebSockets for Real-Time Multiplayer**  

---

## 🤝 Contributing  
Feel free to **fork** this repo and submit a **Pull Request** with improvements!  
⭐ **Star this repo** if you like it!  

---

## 📬 Contact  
📧 Email: mr.veeru68@gmail.com  
🔗 LinkedIn: https://www.linkedin.com/in/veerendra-bannuru-900934215  

---
