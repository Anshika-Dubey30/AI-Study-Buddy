from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import platform
import json # 👈 Crucial for saving lists to DB
from datetime import datetime, timedelta

# AI Libraries
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer
import nltk
from nltk.tokenize import sent_tokenize
import pytesseract
from pytesseract import image_to_string
from PIL import Image

# --- ⚙️ SETUP ---
if platform.system() == "Windows":
    # Update this path if Tesseract is installed elsewhere
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Download NLTK data (only runs once)
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('stopwords')
nltk.download('wordnet')
nltk.download('averaged_perceptron_tagger')

app = Flask(__name__)

# Bulletproof CORS
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

# --- 🗄️ DATABASE SETUP ---
def init_db():
    conn = sqlite3.connect('studybuddy.db')
    c = conn.cursor()
    
    # 1. Create Users Table
    c.execute('''CREATE TABLE IF NOT EXISTS users
                (id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL)''')

    # 2. Create Notes Table (With Flashcards support)
    c.execute('''CREATE TABLE IF NOT EXISTS notes
                (id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT,
                summary TEXT,
                keywords TEXT,
                quiz_data TEXT,
                flashcards TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
                
    conn.commit()
    conn.close()

init_db()

# --- 🧠 AI LOGIC ---

def generate_flashcards(text, keywords):
    """Creates flashcards: Front = Keyword, Back = Sentence containing it"""
    try:
        sentences = sent_tokenize(text)
        flashcards = []
        for keyword in keywords:
            for sentence in sentences:
                if keyword.lower() in sentence.lower() and 20 < len(sentence) < 300:
                    flashcards.append({
                        "front": keyword,
                        "back": sentence.strip()
                    })
                    break 
        return flashcards
    except Exception as e:
        print(f"Flashcard Error: {e}")
        return []

# --- 🔐 AUTH ROUTES ---

@app.route('/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password: return jsonify({"error": "Missing fields"}), 400

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

    if user and user[2] == password:
        return jsonify({"message": "Login successful", "user_id": user[0], "username": user[1]}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

# --- 📝 NOTE ROUTES ---

@app.route('/notes/upload', methods=['POST'])
def upload_note():
    data = request.json
    text = data.get('content', '')

    if not text: return jsonify({"error": "No text provided"}), 400

    # 1. Summarize
    parser = PlaintextParser.from_string(text, Tokenizer("english"))
    summarizer = TextRankSummarizer()
    summary_sentences = summarizer(parser.document, 3) 
    summary = " ".join([str(s) for s in summary_sentences])

    # 2. Extract Keywords
    words = nltk.word_tokenize(text)
    keywords = [w for w in set(words) if len(w) > 6][:5]

    # 3. Generate Quiz
    sentences = sent_tokenize(text)
    quiz = None
    if len(sentences) > 0:
        question_sentence = sentences[0]
        q_words = nltk.word_tokenize(question_sentence)
        if len(q_words) > 3:
            answer = q_words[-1]
            options = [answer, "Python", "React", "Data"]
            quiz = {"question": question_sentence.replace(answer, "______"), "answer": answer, "options": options}

    # 4. Generate Flashcards
    flashcards = generate_flashcards(text, keywords)

    # Save to DB
    conn = sqlite3.connect('studybuddy.db')
    c = conn.cursor()
    c.execute("INSERT INTO notes (content, summary, keywords, quiz_data, flashcards) VALUES (?, ?, ?, ?, ?)", 
            (text, summary, json.dumps(keywords), json.dumps(quiz), json.dumps(flashcards)))
    conn.commit()
    conn.close()

    return jsonify({
        "summary": summary,
        "keywords": keywords,
        "quiz": quiz,
        "flashcards": flashcards
    })

@app.route('/notes/upload-image', methods=['POST'])
def upload_image():
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    
    try:
        image = Image.open(file.stream)
        text = image_to_string(image)
    except Exception as e:
        return jsonify({"error": f"OCR Failed: {str(e)}"}), 500

    # Reuse Logic
    parser = PlaintextParser.from_string(text, Tokenizer("english"))
    summarizer = TextRankSummarizer()
    summary_sentences = summarizer(parser.document, 3) 
    summary = " ".join([str(s) for s in summary_sentences])
    
    keywords = [w for w in set(nltk.word_tokenize(text)) if len(w) > 6][:5]
    flashcards = generate_flashcards(text, keywords)

    return jsonify({
        "original_text": text,
        "summary": summary,
        "keywords": keywords,
        "quiz": None,
        "flashcards": flashcards
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
            "keywords": json.loads(row[3]) if row[3] else [],
            "quiz": json.loads(row[4]) if row[4] else None,
            "flashcards": json.loads(row[5]) if row[5] else [],
            "date": row[6]
        })
    
    return jsonify(history)

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')