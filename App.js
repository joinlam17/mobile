import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Switch, Alert, NativeModules } from 'react-native';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import axios from 'axios';

// 初始化 SQLite 本地記憶大腦
const db = SQLite.openDatabaseSync('brain_memory.db');

export default function App() {
  // --- 系統狀態與切換開關 ---
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: '😈 終極大腦已啟動！支援 GPS、記憶庫與 DeepSeek 視覺。不開工時隨便傾計，開工時我幫你𥄫實畫面！' }
  ]);
  const [inputText, setInputText] = useState('');
  const [locationText, setLocationText] = useState('定位中...');
  
  // 核心功能開關
  const [isFloatingMode, setIsFloatingMode] = useState(false); // 浮遊視窗模式 (HUD)
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);   // 自動下拉刷新 (代替影片中的人手狂刷)
  const [isAutoClick, setIsAutoClick] = useState(false);       // 自動點擊 (防風控擬真手勢)

  // --- 1. 啟動初始化 (GPS 與 資料庫) ---
  useEffect(() => {
    // 建立記憶資料表
    db.execSync(`
      CREATE TABLE IF NOT EXISTS Experience (id INTEGER PRIMARY KEY AUTOINCREMENT, rule TEXT, date TEXT);
    `);

    // 獲取 GPS 實時定位
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationText('GPS 未授權');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      // 假設將經緯度轉換為地區，這裡簡單顯示
      setLocationText(`Lat:${location.coords.latitude.toFixed(2)} Lon:${location.coords.longitude.toFixed(2)}`);
    })();
  }, []);

  // --- 2. 狀態同步：發送指令給底層 Kotlin 無障礙服務 ---
  useEffect(() => {
    // 這裡的概念是透過 React Native Bridge 通知底層 Android 啟動反偵測點擊/滑動
    // NativeModules.AccessibilityController.updateConfig(isAutoRefresh, isAutoClick);
    console.log(`[系統底層同步] 自動刷新: ${isAutoRefresh}, 自動點擊: ${isAutoClick}`);
  }, [isAutoRefresh, isAutoClick]);

  // --- 3. 聊天與 DeepSeek API (多模態大腦) ---
  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg = { id: Date.now(), sender: 'user', text: inputText };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // 觸發 DeepSeek API (包含 GPS 與 歷史記憶上下文)
    try {
      // 讀取最新 3 條記憶
      const memory = db.getAllSync('SELECT * FROM Experience ORDER BY id DESC LIMIT 3');
      const memoryContext = memory.map(m => m.rule).join('; ');

      const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat', // 若需看圖可切換為支援 vision 的模型
        messages: [
          { 
            role: 'system', 
            content: `你是極客外賣助手。當前 GPS：${locationText}。
            你的記憶體包含：${memoryContext}。
            如果用戶提供截圖，請識別黃色按鈕（如"搶柯打", "收到", "接2張訂單"）。用簡短廣東話或二次元語氣回覆。` 
          },
          { role: 'user', content: inputText }
        ]
      }, {
        headers: { 'Authorization': 'Bearer YOUR_DEEPSEEK_API_KEY' }
      });

      const aiReply = response.data.choices[0].message.content;
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiReply }]);
      
      // AI 自主學習：如果對話中包含新規則，自動寫入 SQLite
      if (inputText.includes('黑店') || inputText.includes('記得')) {
        db.runSync('INSERT INTO Experience (rule, date) VALUES (?, ?)', [inputText, new Date().toISOString()]);
      }

    } catch (err) {
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: '⚠️ DeepSeek 連線失敗，啟動本機降級回應。' }]);
    }
  };

  return (
    <View style={styles.container}>
      {/* 頂部控制面板 */}
      <View style={styles.dashboard}>
        <Text style={styles.gpsText}>📍 {locationText} | 🧠 SQLite就緒</Text>
        
        <View style={styles.switchContainer}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>浮遊視窗 (HUD)</Text>
            <Switch value={isFloatingMode} onValueChange={setIsFloatingMode} trackColor={{ true: '#00FF66' }} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>自動刷新 (代替手刷)</Text>
            <Switch value={isAutoRefresh} onValueChange={setIsAutoRefresh} trackColor={{ true: '#00FF66' }} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>AI 自動搶單 (擬真點擊)</Text>
            <Switch value={isAutoClick} onValueChange={setIsAutoClick} trackColor={{ true: '#FF3366' }} />
          </View>
        </View>
      </View>

      {/* 聊天與日誌區 (休閒傾計 / 開工日誌) */}
      <ScrollView style={styles.chatBox}>
        {messages.map((m) => (
          <View key={m.id} style={[styles.msgBubble, m.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.msgText}>{m.text}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 底部對話框 */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="輸入開工指令、新規則或日常傾計..."
          placeholderTextColor="#888"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>發送 / 記憶</Text>
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