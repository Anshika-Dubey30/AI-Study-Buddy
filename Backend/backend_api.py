from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import platform
# 👇 NEW: Security tools for passwords
from werkzeug.security import generate_password_hash, check_password_hash

# AI Libraries
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer
import nltk
import pytesseract
from pytesseract import image_to_string
from PIL import Image

if platform.system() == "Windows":
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# Download NLTK data (only runs once)
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('stopwords')
nltk.download('wordnet')
nltk.download('averaged_perceptron_tagger')

app = Flask(__name__)

# 👇 REPLACE THIS SECTION COMPLETELY 👇
# The "Bulletproof" CORS setup
CORS(app, resources={r"/*": {
    "origins": "*", 
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})
# 👆 ------------------------------- 👆# --- 🗄️ DATABASE SETUP ---
def init_db():
    conn = sqlite3.connect('studybuddy.db')
    c = conn.cursor()
    
    # 1. Create Notes Table (Existing)
    c.execute('''CREATE TABLE IF NOT EXISTS notes
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  content TEXT,
                  summary TEXT,
                  keywords TEXT,
                  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    # 2. 👇 NEW: Create Users Table
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  password TEXT NOT NULL)''')
                  
    conn.commit()
    conn.close()

init_db()

# --- 🔐 NEW: AUTH ROUTES ---

@app.route('/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Missing fields"}), 400

    # 🛑 DELETED HASHING LINE
    # Just save the password exactly as typed
    try:
        conn = sqlite3.connect('studybuddy.db')
        c = conn.cursor()
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
        conn.commit()
        conn.close()
        return jsonify({"message": "User created!"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409
    
@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = sqlite3.connect('studybuddy.db')
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username=?", (username,))
    user = c.fetchone()
    conn.close()

    # 🛑 CHANGED CHECK: Direct string comparison
    # user[2] is the password column in the DB
    if user and user[2] == password:
        return jsonify({"message": "Login successful", "user_id": user[0], "username": user[1]}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401
    
# --- 🧠 EXISTING AI ROUTES ---

@app.route('/notes/upload', methods=['POST'])
def upload_note():
    data = request.json
    text = data.get('content', '')

    if not text:
        return jsonify({"error": "No text provided"}), 400

    # 1. Summarize
    parser = PlaintextParser.from_string(text, Tokenizer("english"))
    summarizer = TextRankSummarizer()
    summary_sentences = summarizer(parser.document, 3) 
    summary = " ".join([str(s) for s in summary_sentences])

    # 2. Extract Keywords (Simple method)
    words = nltk.word_tokenize(text)
    keywords = [w for w in set(words) if len(w) > 6][:5]

    # 3. Generate Quiz
    sentences = nltk.sent_tokenize(text)
    quiz = None
    if len(sentences) > 0:
        question_sentence = sentences[0]
        words = nltk.word_tokenize(question_sentence)
        if len(words) > 3:
            answer = words[-1] # Simple logic: take the last word
            options = [answer, "Python", "React", "Data"]
            quiz = {"question": question_sentence.replace(answer, "______"), "answer": answer, "options": options}

    # Save to DB
    conn = sqlite3.connect('studybuddy.db')
    c = conn.cursor()
    c.execute("INSERT INTO notes (content, summary, keywords) VALUES (?, ?, ?)", 
              (text, summary, str(keywords)))
    conn.commit()
    conn.close()

    return jsonify({
        "summary": summary,
        "keywords": keywords,
        "quiz": quiz
    })

@app.route('/notes/history', methods=['GET'])
def get_history():
    conn = sqlite3.connect('studybuddy.db')
    c = conn.cursor()
    c.execute("SELECT * FROM notes ORDER BY date DESC")
    rows = c.fetchall()
    conn.close()

    history = []
    for row in rows:
        history.append({
            "id": row[0],
            "content_snippet": row[1][:50] + "...",
            "summary": row[2],
            "keywords": eval(row[3]), 
            "date": row[4]
        })
    
    return jsonify(history)

@app.route('/notes/upload-image', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    image = Image.open(file.stream)
    
    # 1. OCR (Image to Text)
    # ⚠️ Windows Users: Need tesseract.exe installed and path set
    try:
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        text = image_to_string(image)
    except Exception as e:
        return jsonify({"error": f"OCR Failed: {str(e)}"}), 500

    # 2. Reuse the logic (Call the internal function logic)
    # Ideally refactor, but for now we copy-paste the summary logic
    parser = PlaintextParser.from_string(text, Tokenizer("english"))
    summarizer = TextRankSummarizer()
    summary_sentences = summarizer(parser.document, 3) 
    summary = " ".join([str(s) for s in summary_sentences])
    
    keywords = [w for w in set(nltk.word_tokenize(text)) if len(w) > 6][:5]

    return jsonify({
        "original_text": text,
        "summary": summary,
        "keywords": keywords,
        "quiz": None 
    })

if __name__ == '__main__':
    # ✅ Keeping the fix that lets your phone connect
    app.run(debug=True, port=5000, host='0.0.0.0')