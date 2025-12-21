# 🧠 AI Study Buddy

**A Full-Stack AI Study Assistant that reads notes, summarizes concepts, and tests your knowledge.**

![Project Status](https://img.shields.io/badge/Status-Prototype-orange)
![Tech Stack](https://img.shields.io/badge/Stack-Full%20Stack-blue)

## 🚀 Overview
StudyBuddy is a smart productivity app designed to help students learn faster. It combines **Computer Vision (OCR)** to read physical textbooks and **Natural Language Processing (AI)** to summarize complex topics and generate automated quizzes.

It also features a built-in **Pomodoro Timer** to manage focus sessions and uses **Spaced Repetition** logic to schedule reviews.

## 🛠️ Tech Stack
* **Frontend:** React Native (Expo)
* **Backend:** Python (Flask)
* **Database:** SQLite
* **AI/NLP:** NLTK, Sumy (TextRank Algorithm)
* **Computer Vision:** Tesseract OCR (via Pytesseract)
* **API:** Axios

## ✨ Key Features
* **📸 Text-to-Digital:** Scan physical notes or screenshots using the camera.
* **🧠 AI Summarizer:** Instantly condenses long articles into 3 key sentences.
* **❓ Auto-Quiz:** Automatically generates multiple-choice questions from your notes.
* **⏱️ Focus Timer:** Integrated Pomodoro timer (25m Focus / 5m Break).
* **📅 Study Scheduler:** Saves notes and tells you exactly when to review them next.

## 💻 How to Run Locally

### 1. Backend Setup (Python)
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install flask flask-cors nltk sumy pytesseract pillow
python backend_api.py