import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import axios from 'axios';
// 👇 NEW IMPORT FOR THE CAMERA
import * as ImagePicker from 'expo-image-picker';

// --- 1. TIME CONSTANTS ---
const FOCUS_TIME = 25 * 60;
const SHORT_BREAK = 5 * 60;

const PomodoroTimer = () => {
    // ⚠️ CRUCIAL: Replace with your IP if testing on a real phone!
    const BASE_URL = 'http://127.0.0.1:5000'; 

    // --- 2. STATE ---
    const [timeRemaining, setTimeRemaining] = useState(FOCUS_TIME);
    const [isRunning, setIsRunning] = useState(false);
    const [sessionType, setSessionType] = useState('Focus'); 
    
    // AI States
    const [noteText, setNoteText] = useState(''); 
    const [aiSummary, setAiSummary] = useState(''); 
    const [aiKeywords, setAiKeywords] = useState([]); 
    const [aiQuiz, setAiQuiz] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // History States
    const [historyList, setHistoryList] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    // --- 3. HELPER FUNCTIONS ---
    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const handlePhaseTransition = () => {
        const nextType = sessionType === 'Focus' ? 'Break' : 'Focus';
        const nextTime = nextType === 'Focus' ? FOCUS_TIME : SHORT_BREAK;
        setSessionType(nextType);
        setTimeRemaining(nextTime);
        setIsRunning(true);
    };

    // --- 4. TEXT ANALYSIS FUNCTION ---
    const analyzeUserNote = async () => {
        if (!noteText.trim()) {
            Alert.alert("Empty Note", "Please paste some notes first!");
            return;
        }

        setIsLoading(true); 
        setAiSummary(''); setAiKeywords([]); setAiQuiz(null);

        try {
            const response = await axios.post(`${BASE_URL}/notes/upload`, {
                content: noteText, 
                source_type: 'UserAppInput' 
            });
            
            // Save Results
            setAiSummary(response.data.summary); 
            setAiKeywords(response.data.keywords); 
            setAiQuiz(response.data.quiz);
        } catch (error) {
            console.error("Error:", error);
            Alert.alert("Error", "Could not analyze text. Check server.");
        } finally {
            setIsLoading(false); 
        }
    };

    // --- 5. UPDATED IMAGE SCANNING (WEB COMPATIBLE) ---
    const pickAndAnalyzeImage = async () => {
        // A. Request Permission
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permission Required", "You need to allow access to photos!");
            return;
        }

        // B. Open Gallery
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled) {
            setIsLoading(true);
            setAiSummary(''); setAiKeywords([]); setAiQuiz(null);
            setNoteText('Scanning Image... 📸'); 

            const asset = result.assets[0];
            const formData = new FormData();

            // 👇 NEW: Check if we are on Web or Mobile
            if (Platform.OS === 'web') {
                // 🌍 WEB FIX: Fetch the image as a Blob first
                const res = await fetch(asset.uri);
                const blob = await res.blob();
                formData.append('file', blob, 'upload.jpg');
            } else {
                // 📱 MOBILE LOGIC (Android/iOS)
                const localUri = asset.uri;
                const filename = localUri.split('/').pop();
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : `image`;
                formData.append('file', { uri: localUri, name: filename, type });
            }

            try {
                // D. Send to Python Endpoint
                const response = await axios.post(`${BASE_URL}/notes/upload-image`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });

                // E. Show Results
                setNoteText(response.data.original_text); 
                setAiSummary(response.data.summary);
                setAiKeywords(response.data.keywords);
                setAiQuiz(response.data.quiz);
                Alert.alert("Success", "Image Scanned Successfully!");

            } catch (error) {
                console.error("OCR Error:", error);
                setNoteText("Error scanning image.");
                Alert.alert("OCR Error", "Check Python Terminal for details.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    // --- 6. HISTORY FUNCTION ---
    const fetchHistory = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/notes/history`);
            setHistoryList(response.data);
            setShowHistory(!showHistory);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Could not load history");
        }
    };

    // --- 7. TIMER ENGINE ---
    useEffect(() => {
        let interval = null;
        if (isRunning && timeRemaining > 0) {
            interval = setInterval(() => {
                setTimeRemaining(prevTime => prevTime - 1); 
            }, 1000);
        } else if (timeRemaining === 0 && isRunning) {
            clearInterval(interval);
            handlePhaseTransition(); 
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isRunning, timeRemaining, sessionType]); 

    // --- 8. RENDER (UI) ---
    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{flex: 1}}
        >
            <ScrollView contentContainerStyle={styles.container}>
                
                {/* TIMER */}
                <Text style={styles.sessionText}>
                    {sessionType === 'Focus' ? '🧠 FOCUS TIME' : '☕ SHORT BREAK'}
                </Text>
                <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
                
                <TouchableOpacity style={styles.button} onPress={() => setIsRunning(prev => !prev)}>
                    <Text style={styles.buttonText}>{isRunning ? 'PAUSE' : 'START'}</Text>
                </TouchableOpacity>

                {/* INPUT SECTION */}
                <View style={styles.inputSection}>
                    <Text style={styles.sectionTitle}>📝 Study Notes</Text>
                    <TextInput 
                        style={styles.inputBox}
                        placeholder="Paste notes OR scan an image..."
                        placeholderTextColor="#888"
                        multiline={true} 
                        numberOfLines={4}
                        value={noteText}
                        onChangeText={setNoteText} 
                    />
                    
                    {/* BUTTON ROW */}
                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                        <TouchableOpacity 
                            style={[styles.analyzeButton, {flex: 1, marginRight: 10}]} 
                            onPress={analyzeUserNote} 
                            disabled={isLoading} 
                        >
                            <Text style={styles.buttonText}>
                                {isLoading ? '⏳' : '✨ ANALYZE'}
                            </Text>
                        </TouchableOpacity>

                        {/* 👇 NEW SCAN BUTTON 👇 */}
                        <TouchableOpacity 
                            style={[styles.scanButton, {flex: 1}]} 
                            onPress={pickAndAnalyzeImage} 
                            disabled={isLoading} 
                        >
                            <Text style={styles.buttonText}>
                                {isLoading ? '📸...' : '📷 SCAN'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* QUIZ SECTION */}
                {aiQuiz ? (
                    <View style={styles.quizContainer}>
                        <Text style={styles.quizTitle}>📝 Quick Quiz:</Text>
                        <Text style={styles.questionText}>{aiQuiz.question}</Text>
                        <View style={styles.optionsWrapper}>
                            {aiQuiz.options.map((option, index) => (
                                <TouchableOpacity 
                                    key={index} 
                                    style={styles.optionButton}
                                    onPress={() => {
                                        if (option === aiQuiz.answer) Alert.alert("✅ Correct!");
                                        else Alert.alert(`❌ Wrong! Answer: ${aiQuiz.answer}`);
                                    }}
                                >
                                    <Text style={styles.optionText}>{option}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : null}

                {/* SUMMARY SECTION */}
                {aiSummary ? (
                    <View style={styles.summaryContainer}>
                        <Text style={styles.summaryTitle}>✨ AI Summary:</Text>
                        <Text style={styles.summaryText}>{aiSummary}</Text>
                        {aiKeywords.length > 0 && (
                            <View style={styles.keywordsContainer}>
                                <Text style={styles.keywordsLabel}>Keywords:</Text>
                                <View style={styles.tagsWrapper}>
                                    {aiKeywords.map((word, index) => (
                                        <View key={index} style={styles.tag}>
                                            <Text style={styles.tagText}>{word}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                ) : null}

                {/* HISTORY SECTION */}
                <View style={{width: '100%', marginTop: 40, borderTopWidth: 1, borderColor: '#444', paddingTop: 20}}>
                    <TouchableOpacity style={styles.historyButton} onPress={fetchHistory}>
                        <Text style={styles.buttonText}>{showHistory ? '🙈 HIDE HISTORY' : '📜 VIEW HISTORY'}</Text>
                    </TouchableOpacity>

                    {showHistory && historyList.map((item, index) => (
                        <TouchableOpacity 
                            key={index} 
                            style={styles.historyCard}
                            onPress={() => {
                                setAiSummary(item.summary);
                                setAiKeywords(item.keywords);
                                setAiQuiz(item.quiz);
                                Alert.alert("Loaded!", "Note active.");
                                setShowHistory(false);
                            }}
                        >
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}>
                                <Text style={styles.historyDate}>📅 {item.date.substring(0, 10)}</Text>
                                <Text style={{color: '#FFD700', fontSize: 12, fontWeight: 'bold'}}>
                                    ⏰ Review: {item.next_review ? item.next_review.substring(0, 10) : 'N/A'}
                                </Text>
                            </View>
                            <Text style={styles.historySummary}>{item.content_snippet}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default PomodoroTimer;

const styles = StyleSheet.create({
    container: { flexGrow: 1, alignItems: 'center', backgroundColor: '#1E1E1E', paddingVertical: 40, paddingHorizontal: 20 },
    timerText: { fontSize: 80, fontWeight: '900', marginVertical: 10, color: '#FFFFFF' },
    sessionText: { fontSize: 24, fontWeight: '700', color: '#FFD700' },
    button: { backgroundColor: '#4CAF50', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10, marginBottom: 30 },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    
    inputSection: { width: '100%', marginTop: 10 },
    sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '600', marginBottom: 10, marginLeft: 5 },
    inputBox: { backgroundColor: '#2C2C2C', color: '#FFF', borderRadius: 10, padding: 15, fontSize: 16, borderWidth: 1, borderColor: '#444', minHeight: 100, textAlignVertical: 'top' },
    
    analyzeButton: { backgroundColor: '#2196F3', paddingVertical: 15, borderRadius: 10, marginTop: 15 },
    scanButton: { backgroundColor: '#9C27B0', paddingVertical: 15, borderRadius: 10, marginTop: 15 }, // Purple button for scan

    summaryContainer: { marginTop: 30, padding: 20, backgroundColor: '#333', borderRadius: 15, width: '100%', borderLeftWidth: 4, borderLeftColor: '#FFD700' },
    summaryTitle: { color: '#FFD700', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    summaryText: { color: '#E0E0E0', fontSize: 16, lineHeight: 24 },
    
    keywordsContainer: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#555', paddingTop: 15 },
    keywordsLabel: { color: '#AAA', fontSize: 14, marginBottom: 10, fontStyle: 'italic' },
    tagsWrapper: { flexDirection: 'row', flexWrap: 'wrap' },
    tag: { backgroundColor: '#4CAF50', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, marginBottom: 8 },
    tagText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

    quizContainer: { marginTop: 20, padding: 20, backgroundColor: '#444', borderRadius: 15, width: '100%', borderLeftWidth: 4, borderLeftColor: '#2196F3' },
    quizTitle: { color: '#2196F3', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    questionText: { color: '#FFF', fontSize: 18, fontStyle: 'italic', marginBottom: 15 },
    optionsWrapper: { gap: 10 },
    optionButton: { backgroundColor: '#555', padding: 12, borderRadius: 8 },
    optionText: { color: '#FFF', textAlign: 'center', fontWeight: 'bold' },

    historyButton: { backgroundColor: '#607D8B', paddingVertical: 12, borderRadius: 10, marginBottom: 20, width: '100%' },
    historyCard: { backgroundColor: '#252525', padding: 15, borderRadius: 10, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#AAA', width: '100%' },
    historyDate: { color: '#888', fontSize: 12 },
    historySummary: { color: '#DDD', fontSize: 14 },
});