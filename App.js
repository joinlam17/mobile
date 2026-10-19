import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Switch } from 'react-native';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import axios from 'axios';

// 鎖入 DeepSeek API Key 鎖匙
const DEEPSEEK_API_KEY = 'Sk-560d90c0c5054500be5d21ade4d3af2d';

// 初始化 SQLite 本地記憶大腦
const db = SQLite.openDatabaseSync('brain_memory.db');

export default function App() {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: '😈 DeepSeek API 鎖匙已成功解鎖！地址算盤、先搶先得與 SQLite 記憶庫全面升級。' }
  ]);
  const [inputText, setInputText] = useState('');
  const [locationText, setLocationText] = useState('定位中...');
  
  // 核心功能開關
  const [isFloatingMode, setIsFloatingMode] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);   
  const [isAutoClick, setIsAutoClick] = useState(false);       
  const [rejectLongDistance, setRejectLongDistance] = useState(true);

  useEffect(() => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS Experience (id INTEGER PRIMARY KEY AUTOINCREMENT, rule TEXT, date TEXT);
    `);

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
    setInputText('');

    try {
      const memory = db.getAllSync('SELECT * FROM Experience ORDER BY id DESC LIMIT 3');
      const memoryContext = memory.map(m => m.rule).join('; ');

      const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是極客外賣搶單大腦。當前位置：${locationText}。
            記憶庫：${memoryContext}。
            
            【搶單過濾鐵律】：
            1. 認准黃色按鈕文字：['搶柯打', '收到', '接2張訂單', '先搶先得']。
            2. 地址與金額算盤：
               - 識別畫面中的『取餐地址』與『送達地址』。
               - 如果送達地址為遠區/跨區/上山（如薄扶林、山頂、長途），且金額 < $50，輸出 [IGNORE] 拒絕！
               - 如果距離近、單價符合標準，或包含『先搶先得』，立即觸發點擊！` 
          },
          { role: 'user', content: inputText }
        ]
      }, {
        headers: { 
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const aiReply = response.data.choices[0].message.content;
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiReply }]);
      
      if (inputText.includes('遠單') || inputText.includes('加價') || inputText.includes('黑店')) {
        db.runSync('INSERT INTO Experience (rule, date) VALUES (?, ?)', [inputText, new Date().toISOString()]);
      }

    } catch (err) {
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: '⚠️ DeepSeek API 連線失敗，請檢查網路或 Token。' }]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dashboard}>
        <Text style={styles.gpsText}>📍 {locationText} | 🔑 API 鎖匙已掛載</Text>
        
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

      <ScrollView style={styles.chatBox}>
        {messages.map((m) => (
          <View key={m.id} style={[styles.msgBubble, m.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.msgText}>{m.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="輸入指令，例如：『記得黃埔永年士多出餐慢』..."
          placeholderTextColor="#888"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>記憶/對話</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', paddingTop: 40 },
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
  inputRow: { flexDirection: 'row', padding: 10, backgroundColor: '#1A1A1A' },
  input: { flex: 1, backgroundColor: '#2C2C2E', color: '#FFF', paddingHorizontal: 15, borderRadius: 20, height: 45 },
  sendBtn: { backgroundColor: '#00FF66', paddingHorizontal: 15, justifyContent: 'center', marginLeft: 10, borderRadius: 20 },
  sendBtnText: { color: '#000', fontWeight: 'bold' }
});