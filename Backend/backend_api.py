# backend_api.py

from flask import Flask, request, jsonify
from datetime import datetime, timedelta
from flask_cors import CORS
import random
import sqlite3
import json
import os

# 👇 NEW IMPORTS FOR OCR (THE EYES)
import pytesseract
from PIL import Image

# --- NLP IMPORTS ---
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize, sent_tokenize
from collections import Counter
import string
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer

app = Flask(__name__)
CORS(app) 
app.config['JSON_SORT_KEYS'] = False 

# 👇 CRITICAL: TELL PYTHON WHERE TESSERACT IS
# Make sure this path is correct for YOUR computer!
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# --- 1. DATABASE SETUP ---
def init_db():
    conn = sqlite3.connect('studybuddy.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT,
            summary TEXT,
            keywords TEXT,
            quiz_data TEXT,
            created_at TEXT,
            next_review_date TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# --- 2. AI FUNCTIONS (Helpers) ---
def summarize_text_with_ai(raw_text, sentence_count=3):
    try:
        parser = PlaintextParser.from_string(raw_text, Tokenizer("english"))
        summarizer = TextRankSummarizer()
        summary_sentences = summarizer(parser.document, sentence_count)
        final_summary = " ".join([str(s) for s in summary_sentences])
        return final_summary if final_summary else "Text too short."
    except:
        return "Could not generate summary."

def extract_keywords(text, num_keywords=5):
    try:
        words = word_tokenize(text.lower())
        stop_words = set(stopwords.words('english'))
        punctuation = set(string.punctuation)
        filtered_words = [w for w in words if w not in stop_words and w not in punctuation and w.isalnum()]
        word_counts = Counter(filtered_words)
        return [w[0].capitalize() for w in word_counts.most_common(num_keywords)]
    except:
        return []

def generate_quiz(text, keywords):
    try:
        sentences = sent_tokenize(text)
        target_sentence = ""
        correct_answer = ""
        for keyword in keywords:
            for sentence in sentences:
                if keyword.lower() in sentence.lower() and 10 < len(sentence) < 200:
                    target_sentence = sentence
                    correct_answer = keyword
                    break
            if target_sentence: break
        
        if not target_sentence: return None

        import re
        question_text = re.sub(re.escape(correct_answer), "_______", target_sentence, flags=re.IGNORECASE)
        options = [correct_answer]
        for k in keywords:
            if k.lower() != correct_answer.lower() and k not in options:
                options.append(k)
        options = options[:4]
        random.shuffle(options)
        return {"question": question_text, "options": options, "answer": correct_answer}
    except:
        return None

# --- HELPER: SAVE TO DB ---
def save_note_to_db(raw_text, ai_summary, ai_keywords, ai_quiz):
    review_date = (datetime.now() + timedelta(days=1)).isoformat()
    created_at = datetime.now().isoformat()
    
    conn = sqlite3.connect('studybuddy.db')
    c = conn.cursor()
    c.execute('''
        INSERT INTO notes (content, summary, keywords, quiz_data, created_at, next_review_date)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (raw_text, ai_summary, json.dumps(ai_keywords), json.dumps(ai_quiz), created_at, review_date))
    new_id = c.lastrowid
    conn.commit()
    conn.close()
    return new_id

# --- 3. ENDPOINTS ---

@app.route('/notes/upload', methods=['POST'])
def upload_note():
    if not request.is_json: return jsonify({"status": "error"}), 400
    data = request.get_json()
    raw_text = data.get('content', '').strip()
    
    if not raw_text: return jsonify({"status": "error"}), 400

    ai_summary = summarize_text_with_ai(raw_text)
    ai_keywords = extract_keywords(raw_text)
    ai_quiz = generate_quiz(raw_text, ai_keywords)
    new_id = save_note_to_db(raw_text, ai_summary, ai_keywords, ai_quiz)

    return jsonify({
        "status": "success",
        "note_id": new_id,
        "summary": ai_summary,
        "keywords": ai_keywords,
        "quiz": ai_quiz
    }), 201

# 👇 UPDATED ENDPOINT: IMAGE UPLOAD WITH DEBUGGING 👇
@app.route('/notes/upload-image', methods=['POST'])
def upload_image_note():
    print("📸 DEBUG: Receiving Image Request...") 
    
    # Check 1: Is the file there?
    if 'file' not in request.files:
        print("❌ DEBUG Error: No 'file' key in request.files") 
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    print(f"📂 DEBUG: File received: {file.filename}") 

    # Check 2: Does it have a name?
    if file.filename == '':
        print("❌ DEBUG Error: Empty filename") 
        return jsonify({"error": "No file selected"}), 400

    try:
        # Check 3: Can Tesseract read it?
        image = Image.open(file)
        print("🖼️ DEBUG: Image opened successfully via Pillow") 
        
        extracted_text = pytesseract.image_to_string(image)
        # Show the first 50 characters found
        print(f"📝 DEBUG: Raw Text Found (First 50 chars): '{extracted_text[:50]}...'") 
        
        if not extracted_text.strip():
            print("❌ DEBUG Error: Tesseract returned empty text. Image might be blank or blurry.") 
            return jsonify({"error": "No text found in image"}), 400

        print("✅ DEBUG: Text found! Processing AI...") 

        # 4. Run the AI Pipeline
        ai_summary = summarize_text_with_ai(extracted_text)
        ai_keywords = extract_keywords(extracted_text)
        ai_quiz = generate_quiz(extracted_text, ai_keywords)
        
        new_id = save_note_to_db(extracted_text, ai_summary, ai_keywords, ai_quiz)

        return jsonify({
            "status": "success",
            "message": "Image processed successfully!",
            "note_id": new_id,
            "original_text": extracted_text,
            "summary": ai_summary,
            "keywords": ai_keywords,
            "quiz": ai_quiz
        }), 201

    except Exception as e:
        print(f"🔥 DEBUG: OCR Crash Error: {e}") 
        return jsonify({"error": str(e)}), 500

@app.route('/notes/history', methods=['GET'])
def get_history():
    try:
        conn = sqlite3.connect('studybuddy.db')
        c = conn.cursor()
        c.execute("SELECT id, content, summary, keywords, quiz_data, created_at, next_review_date FROM notes ORDER BY id DESC LIMIT 10")
        rows = c.fetchall()
        history_list = []
        for row in rows:
            history_list.append({
                "id": row[0],
                "content_snippet": row[1][:50] + "...",
                "summary": row[2],
                "keywords": json.loads(row[3]) if row[3] else [],
                "quiz": json.loads(row[4]) if row[4] else None,
                "date": row[5],
                "next_review": row[6]
            })
        conn.close()
        return jsonify(history_list), 200
    except:
        return jsonify({"status": "error"}), 500

if __name__ == '__main__':
    # Initial download check
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt')
        nltk.download('stopwords')
        
    app.run(debug=True, port=5000)