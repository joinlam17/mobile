import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Switch, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar 
} from 'react-native';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import axios from 'axios';

// 鎖入全新 DeepSeek API Key
const DEEPSEEK_API_KEY = 'sk-5bf4ab1fed514d0382f7755b0145476d';
const db = SQLite.openDatabaseSync('brain_memory.db');

export default function App() {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: '😈 新 API Key 已掛載！全螢幕鍵盤適配完成，輸入框不會再被擋住。' }
  ]);
  const [inputText, setInputText] = useState('');
  const [locationText, setLocationText] = useState('定位中...');
  
  const [isFloatingMode, setIsFloatingMode] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);   
  const [isAutoClick, setIsAutoClick] = useState(false);       
  const [rejectLongDistance, setRejectLongDistance] = useState(true);

  useEffect(() => {
    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS Experience (id INTEGER PRIMARY KEY AUTOINCREMENT, rule TEXT, date TEXT);
      `);
    } catch (e) {
      console.log('DB Init Error:', e);
    }

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationText('GPS 未授權');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setLocationText(`Lat:${location.coords.latitude.toFixed(2)} Lon:${location.coords.longitude.toFixed(2)}`);
    })();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg = { id: Date.now(), sender: 'user', text: inputText };
    setMessages((prev) => [...prev, userMsg]);
    const currentInput = inputText;
    setInputText('');

    try {
      let memoryContext = '';
      try {
        const memory = db.getAllSync('SELECT * FROM Experience ORDER BY id DESC LIMIT 3');
        memoryContext = memory.map(m => m.rule).join('; ');
      } catch (e) {
        console.log('DB Read Error:', e);
      }

      const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是極客外賣搶單大腦。當前位置：${locationText}。記憶庫：${memoryContext}。
            【搶單過濾鐵律】：
            1. 認准黃色按鈕文字：['搶柯打', '收到', '接2張訂單', '先搶先得']。
            2. 地址與金額算盤：如果送達地址為遠區/跨區/上山，且金額 < $50，輸出 [IGNORE]！` 
          },
          { role: 'user', content: currentInput }
        ]
      }, {
        headers: { 
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const aiReply = response.data.choices[0].message.content;
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiReply }]);
      
      if (currentInput.includes('遠單') || currentInput.includes('加價') || currentInput.includes('黑店')) {
        try {
          db.runSync('INSERT INTO Experience (rule, date) VALUES (?, ?)', [currentInput, new Date().toISOString()]);
        } catch (e) {
          console.log('DB Write Error:', e);
        }
      }

    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || '連線失敗';
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: `⚠️ DeepSeek API 報錯: ${errMsg}` }]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* 頂部控制面板 */}
        <View style={styles.dashboard}>
          <Text style={styles.gpsText}>📍 {locationText} | 🔑 新 Key 已掛載</Text>
          
          <View style={styles.switchContainer}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>浮遊 HUD</Text>
              <Switch value={isFloatingMode} onValueChange={setIsFloatingMode} trackColor={{ true: '#00FF66' }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>自動手刷刷新</Text>
              <Switch value={isAutoRefresh} onValueChange={setIsAutoRefresh} trackColor={{ true: '#00FF66' }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>AI 搶單 (先搶先得)</Text>
              <Switch value={isAutoClick} onValueChange={setIsAutoClick} trackColor={{ true: '#FF3366' }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>自動濾掉低價遠單</Text>
              <Switch value={rejectLongDistance} onValueChange={setRejectLongDistance} trackColor={{ true: '#00FF66' }} />
            </View>
          </View>
        </View>

        {/* 聊天與日誌對話區 */}
        <ScrollView 
          style={styles.chatBox}
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => (
            <View key={m.id} style={[styles.msgBubble, m.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={styles.msgText}>{m.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* 底部輸入框 */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="輸入指令/對話..."
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Text style={styles.sendBtnText}>發送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A0A0A' },
  keyboardContainer: { flex: 1 },
  dashboard: { padding: 15, backgroundColor: '#1A1A1A', borderBottomWidth: 1, borderColor: '#333' },
  gpsText: { color: '#00FF66', fontSize: 13, fontWeight: 'bold', marginBottom: 10 },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, width: '48%' },
  switchLabel: { color: '#FFF', fontSize: 12, marginRight: 8 },
  chatBox: { flex: 1, padding: 10 },
  msgBubble: { padding: 12, borderRadius: 10, marginBottom: 10, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#005bb5' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#444' },
  msgText: { color: '#E0E0E0', fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: 'row', padding: 10, backgroundColor: '#1A1A1A', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#2C2C2E', color: '#FFF', paddingHorizontal: 15, borderRadius: 20, height: 45 },
  sendBtn: { backgroundColor: '#00FF66', paddingHorizontal: 20, height: 45, justifyContent: 'center', marginLeft: 10, borderRadius: 20 },
  sendBtnText: { color: '#000', fontWeight: 'bold' }
});