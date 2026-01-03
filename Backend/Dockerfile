# 1. Base Layer: The OS
# We start with a super-lightweight version of Linux (Debian) that has Python 3.9 pre-installed.
# Think of this as buying a blank laptop with just the OS.
FROM python:3.9-slim

# 2. System Tools (The "apt-get" Layer)
# Since this is Linux, we use 'apt-get' instead of 'brew'.
# We install Tesseract (for OCR) and GCC (compilers) because some Python libraries need them.
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    gcc \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 3. Setup Workspace
# We create a folder named 'app' inside the container so we don't dump files in the root folder.
WORKDIR /app

# 4. Install Libraries (The "Pip" Layer)
# We copy ONLY requirements.txt first. Why? 
# Docker caches steps. If you change your code but not your libraries, Docker skips this slow step next time!
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Download AI Brains
# We run the NLTK downloader NOW so the app doesn't try to download 50MB of data every time it starts.
RUN python -m nltk.downloader punkt punkt_tab stopwords wordnet averaged_perceptron_tagger

# 6. Copy Source Code
# Now we move your actual python files (backend_api.py, etc.) into the container.
COPY . .

# 7. Document the Port
# This is mostly for humans. It says "Hey, this app speaks on port 5000".
EXPOSE 5000

# 8. Start Button
# This is the command that runs automatically when the container starts.
CMD ["python", "backend_api.py"]