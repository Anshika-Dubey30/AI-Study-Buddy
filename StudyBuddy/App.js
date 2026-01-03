import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';

// ⚠️ CHECK YOUR IP!
const BASE_URL = 'http://10.112.73.9:5000'; 

// --- 🔐 AUTH COMPONENT (Login/Signup) ---
const AuthScreen = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Signup
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async () => {
        if (!username || !password) { Alert.alert("Error", "Please fill in all fields"); return; }
        setLoading(true);
        const endpoint = isLogin ? '/auth/login' : '/auth/register';

        try {
            const response = await axios.post(`${BASE_URL}${endpoint}`, { username, password });
            
            if (isLogin) {
                // Login Success -> Pass user data up to App
                onLogin(response.data);
            } else {
                // Register Success -> Switch to login mode
                Alert.alert("Success", "Account created! Please log in.");
                setIsLogin(true);
            }
        } catch (error) {
            const msg = error.response?.data?.error || "Connection Failed";
            Alert.alert("Error", msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.authContainer}>
            <Text style={styles.authTitle}>🧠 StudyBuddy</Text>
            <Text style={styles.authSubtitle}>{isLogin ? 'Welcome Back, Genius.' : 'Join the Squad.'}</Text>

            <TextInput style={styles.authInput} placeholder="Username" placeholderTextColor="#888" value={username} onChangeText={setUsername} autoCapitalize="none" />
            <TextInput style={styles.authInput} placeholder="Password" placeholderTextColor="#888" value={password} onChangeText={setPassword} secureTextEntry />

            <TouchableOpacity style={styles.authButton} onPress={handleAuth} disabled={loading}>
                {loading ? <ActivityIndicator color="#000"/> : <Text style={styles.authButtonText}>{isLogin ? 'LOG IN' : 'SIGN UP'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{marginTop: 20}}>
                <Text style={styles.switchText}>
                    {isLogin ? "New here? Create Account" : "Already have an account? Log In"}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

// --- 🧠 MAIN APP COMPONENT ---
const MainApp = ({ user, onLogout }) => {
    // CONSTANTS
    const FOCUS_TIME = 25 * 60;
    const SHORT_BREAK = 5 * 60;

    // STATES
    const [timeRemaining, setTimeRemaining] = useState(FOCUS_TIME);
    const [isRunning, setIsRunning] = useState(false);
    const [sessionType, setSessionType] = useState('Focus'); 
    
    const [noteText, setNoteText] = useState(''); 
    const [aiSummary, setAiSummary] = useState(''); 
    const [aiKeywords, setAiKeywords] = useState([]); 
    const [aiQuiz, setAiQuiz] = useState(null);
    // 👇 NEW STATE FOR FLASHCARDS
    const [aiFlashcards, setAiFlashcards] = useState([]); 
    const [flippedCardIndex, setFlippedCardIndex] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    
    // HELPER FUNCTIONS
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const speakSummary = () => {
        if (!aiSummary) return;
        Speech.isSpeakingAsync().then(speaking => {
            speaking ? Speech.stop() : Speech.speak(aiSummary, { rate: 0.9 });
        });
    };

    const analyzeNote = async () => {
        if (!noteText.trim()) return;
        setIsLoading(true);
        try {
            const res = await axios.post(`${BASE_URL}/notes/upload`, { content: noteText });
            setAiSummary(res.data.summary); 
            setAiKeywords(res.data.keywords); 
            setAiQuiz(res.data.quiz);
            setAiFlashcards(res.data.flashcards); // 👈 Capture Flashcards
        } catch (err) { Alert.alert("Error", "Analysis failed."); }
        finally { setIsLoading(false); }
    };

    const pickImage = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return Alert.alert("Need Permission");
        
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, base64: true });
        
        if (!res.canceled) {
            setIsLoading(true); setNoteText("Scanning...");
            const formData = new FormData();
            
            // Mobile vs Web Logic
            if (Platform.OS === 'web') {
                const r = await fetch(res.assets[0].uri);
                const blob = await r.blob();
                formData.append('file', blob, 'upload.jpg');
            } else {
                formData.append('file', {
                    uri: res.assets[0].uri,
                    name: 'upload.jpg',
                    type: 'image/jpeg'
                });
            }

            try {
                const response = await axios.post(`${BASE_URL}/notes/upload-image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                setNoteText(response.data.original_text);
                setAiSummary(response.data.summary);
                setAiKeywords(response.data.keywords);
                setAiQuiz(response.data.quiz);
                setAiFlashcards(response.data.flashcards); // 👈 Capture Flashcards
            } catch (err) { setNoteText("Error"); Alert.alert("Scan Failed"); }
            finally { setIsLoading(false); }
        }
    };

    useEffect(() => {
        let interval = null;
        if (isRunning && timeRemaining > 0) interval = setInterval(() => setTimeRemaining(t => t - 1), 1000);
        else if (timeRemaining === 0) { setIsRunning(false); setSessionType(prev => prev === 'Focus' ? 'Break' : 'Focus'); setTimeRemaining(sessionType === 'Focus' ? SHORT_BREAK : FOCUS_TIME); }
        return () => clearInterval(interval);
    }, [isRunning, timeRemaining]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 5) return "Up Late, Genius?";
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={{flexDirection:'row', justifyContent:'space-between', width:'100%', alignItems:'center', marginBottom: 20}}>
                <Text style={styles.title}>{getGreeting()}, {user.username}</Text>
                <TouchableOpacity onPress={onLogout} style={{backgroundColor:'#94B4C1', padding:8, borderRadius:5}}>
                    <Text style={{color:'black', fontWeight:'bold'}}>LOGOUT</Text>
                </TouchableOpacity>
            </View>

            {/* TIMER */}
            <Text style={styles.sessionText}>{sessionType === 'Focus' ? '🧠 FOCUS' : '☕ BREAK'}</Text>
            <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
            <TouchableOpacity style={styles.button} onPress={() => setIsRunning(!isRunning)}>
                <Text style={styles.buttonText}>{isRunning ? 'PAUSE' : 'START'}</Text>
            </TouchableOpacity>

            {/* INPUTS */}
            <View style={styles.inputSection}>
                <TextInput style={styles.inputBox} placeholder="Paste notes..." placeholderTextColor="#888" multiline value={noteText} onChangeText={setNoteText} />
                <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                    <TouchableOpacity style={[styles.analyzeButton, {flex: 1}]} onPress={analyzeNote} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.buttonText}>✨ ANALYZE</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.scanButton, {flex: 1}]} onPress={pickImage} disabled={isLoading}>
                        <Text style={styles.buttonText}>📷 SCAN</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* AI OUTPUT */}
            {aiSummary ? (
                <View style={styles.summaryContainer}>
                    <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                        <Text style={styles.summaryTitle}>✨ Summary:</Text>
                        <TouchableOpacity onPress={speakSummary}><Text style={{fontSize:22}}>🗣️</Text></TouchableOpacity>
                    </View>
                    <Text style={styles.summaryText}>{aiSummary}</Text>
                    <View style={{flexDirection:'row', flexWrap:'wrap', gap:5, marginTop:10}}>
                        {aiKeywords.map((k,i)=><Text key={i} style={styles.tag}>#{k}</Text>)}
                    </View>
                </View>
            ) : null}

            {/* 🗂️ FLASHCARDS SECTION (New) */}
            {aiFlashcards.length > 0 && (
                <View style={styles.flashcardsContainer}>
                    <Text style={styles.quizTitle}>Flashcards:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flashcardsScroll}>
                        {aiFlashcards.map((card, index) => (
                            <TouchableOpacity 
                                key={index} 
                                style={[styles.flashcard, flippedCardIndex === index ? styles.flashcardBack : null]}
                                onPress={() => setFlippedCardIndex(flippedCardIndex === index ? null : index)}
                            >
                                <Text style={flippedCardIndex === index ? styles.flashcardTextBack : styles.flashcardTextFront}>
                                    {flippedCardIndex === index ? card.back : card.front}
                                </Text>
                                <Text style={styles.flipHint}>
                                    {flippedCardIndex === index ? "Tap to see term" : "Tap to flip"}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* QUIZ */}
            {aiQuiz && (
                <View style={styles.quizContainer}>
                    <Text style={styles.quizTitle}>📝 Quiz</Text>
                    <Text style={styles.questionText}>{aiQuiz.question}</Text>
                    {aiQuiz.options.map((opt, i) => (
                        <TouchableOpacity key={i} style={styles.optionButton} onPress={() => Alert.alert(opt === aiQuiz.answer ? "✅ Correct!" : "❌ Wrong")}>
                            <Text style={styles.optionText}>{opt}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </ScrollView>
    );
};

// --- 🚀 ROOT COMPONENT ---
export default function App() {
    const [user, setUser] = useState(null); // null = Logged Out

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1, backgroundColor: '#213448'}}>
            {user ? (
                <MainApp user={user} onLogout={() => setUser(null)} />
            ) : (
                <AuthScreen onLogin={(userData) => setUser(userData)} />
            )}
        </KeyboardAvoidingView>
    );
}

// --- STYLES ---
const styles = StyleSheet.create({
    container: { flexGrow: 1, alignItems: 'center', backgroundColor: '#213448', padding: 20, paddingTop: 50 },
    authContainer: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0F2854' },
    authTitle: { fontSize: 36, fontWeight: 'bold', color: '#FFE2AF', textAlign: 'center', marginBottom: 10 },
    authSubtitle: { fontSize: 18, color: '#FFE2AF', textAlign: 'center', marginBottom: 40 },
    authInput: { backgroundColor: '#4988C4', color: '#FFF', borderRadius: 10, padding: 15, marginBottom: 15, fontSize: 16 },
    authButton: { backgroundColor: '#BDE8F5', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    authButtonText: { color: 'black', fontWeight: 'bold', fontSize: 18 },
    switchText: { color: '#2196F3', textAlign: 'center', marginTop: 10, fontSize: 16 },
    
    title: { fontSize: 24, fontWeight: 'bold', color: '#FFE2AF' },
    timerText: { fontSize: 70, fontWeight: '900', color: '#FFE2AF' },
    sessionText: { fontSize: 20, color: '#FFE2AF', marginBottom: 5 },
    button: { backgroundColor: '#94B4C1', padding: 10, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 20 },
    buttonText: { color: 'black', fontWeight: 'bold' },
    inputSection: { width: '100%' },
    inputBox: { backgroundColor: '#547792', color: '#FFF', borderRadius: 10, padding: 15, minHeight: 80, textAlignVertical: 'top' },
    analyzeButton: { backgroundColor: '#94B4C1', padding: 15, borderRadius: 10, alignItems: 'center' },
    scanButton: { backgroundColor: '#94B4C1', padding: 15, borderRadius: 10, alignItems: 'center' },
    summaryContainer: { marginTop: 20, padding: 15, backgroundColor: '#547792', borderRadius: 10, width: '100%', borderLeftWidth: 4, borderLeftColor: '#FFD700' },
    summaryTitle: { color: 'white', fontWeight: 'bold', fontSize: 18 },
    summaryText: { color: 'white', lineHeight: 22, fontSize: 16 },
    tag: { backgroundColor: '#EAE0CF', color: '#213448', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontSize: 12 },
    quizContainer: { marginTop: 20, padding: 15, backgroundColor: '#1C4D8D', borderRadius: 10, width: '100%' },
    quizTitle: { color: '#BDE8F5', fontWeight: 'bold', marginBottom: 10 },
    questionText: { color: '#FFF', marginBottom: 15, fontStyle: 'italic' },
    optionButton: { backgroundColor: '#4988C4', padding: 12, borderRadius: 8, marginBottom: 8 },
    optionText: { color: '#FFF', textAlign: 'center', fontWeight: 'bold' },


    flashcardsContainer: { marginTop: 20, width: '100%' },
    flashcardsScroll: { paddingRight: 20 },
    flashcard: {
        backgroundColor: '#FFE2AF',
        width: 200,
        height: 150,
        padding: 15,
        borderRadius: 15,
        marginRight: 15,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3, 
    },
    flashcardBack: {
        backgroundColor: '#4988C4', // Blue (Back)
    },
    flashcardTextFront: {
        color: '#213448', // Dark text on light card
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    flashcardTextBack: {
        color: '#FFF', // White text on blue card
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    flipHint: {
        color: 'rgba(0,0,0,0.4)',
        fontSize: 10,
        marginTop: 5
    },
});