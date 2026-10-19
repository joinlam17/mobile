import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Switch, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, Alert, Linking 
} from 'react-native';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import axios from 'axios';

const DEEPSEEK_API_KEY = 'sk-' + '5bf4ab1fed514d0382f7755b0145476d';
const db = SQLite.openDatabaseSync('brain_memory.db');

export default function App() {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: '😈 上帝模式思考日誌與極簡懸浮側邊欄系統 Ready！' },
    { id: 2, sender: 'ai', text: '[23:39:40][系統初始化] AI 思考流引擎啟動，實時監控香港地址與黃鈕中...' }
  ]);
  const [inputText, setInputText] = useState('');
  const [locationText, setLocationText] = useState('定位中...');
  
  // 開關狀態
  const [isFloatingMode, setIsFloatingMode] = useState(false); // 跨 App 懸浮側邊欄
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);   // 自動手刷 F5 (3-5s 真人頻率)
  const [isAutoClick, setIsAutoClick] = useState(false);       // 有單才觸控 (單次點擊)
  const [rejectLongDistance, setRejectLongDistance] = useState(true); // 自動濾掉低價遠單

  useEffect(() => {
    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS Experience (id INTEGER PRIMARY KEY AUTOINCREMENT, rule TEXT, date TEXT);
      `);
    } catch (e) { console.log('DB Init Error:', e); }

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

  const toggleFloatingHUD = (value) => {
    setIsFloatingMode(value);
    if (value) {
      Alert.alert(
        '🔑 開啟側邊欄懸浮窗',
        '請確保已允許【顯示在其他應用程式上層】與【無障礙服務】，側邊懸浮控制條才會生效！',
        [
          { text: '前往設定', onPress: () => Linking.openSettings() },
          { text: '確定' }
        ]
      );
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const timeStr = new Date().toTimeString().split(' ')[0];
    const userMsg = { id: Date.now(), sender: 'user', text: inputText };
    
    // 注入 AI 思考流前置 Log
    const thinkingLog = { id: Date.now() + 1, sender: 'ai', text: `[${timeStr}][思考] 收到指令/單據圖片，正在調用香港地址算盤與記憶庫分析...` };
    setMessages((prev) => [...prev, userMsg, thinkingLog]);
    
    const currentInput = inputText;
    setInputText('');

    try {
      let memoryContext = '';
      try {
        const memory = db.getAllSync('SELECT * FROM Experience ORDER BY id DESC LIMIT 3');
        memoryContext = memory.map(m => m.rule).join('; ');
      } catch (e) { console.log('DB Read Error:', e); }

      const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是專屬於香港外賣騎手的極客搶單大腦。當前 GPS：${locationText}。記憶庫：${memoryContext}。

【思考日誌與決策格式】：
1. 請模仿專業日誌格式輸出思考過程：
   [HH:MM:SS][思考] 分析餐廳名稱、送達地址與金額...
   [HH:MM:SS][決策] 判定為 [ACCEPT] 或 [IGNORE] (理由：金額不足/不在白名單/靚單)。
2. 黃色按鈕識別：['搶柯打', '收到', '接2張訂單', '先搶先得']。
3. 清理彈窗：若出現『有人搶走』、『知道了』，輸出 [DISMISS]！
4. 點擊節奏：無單靜默，有靚單才輸出 [CLICK_ONCE]！` 
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
      setMessages((prev) => [...prev, { id: Date.now() + 2, sender: 'ai', text: aiReply }]);

      if (currentInput.includes('遠單') || currentInput.includes('加價') || currentInput.includes('黑店')) {
        try {
          db.runSync('INSERT INTO Experience (rule, date) VALUES (?, ?)', [currentInput, new Date().toISOString()]);
        } catch (e) { console.log('DB Write Error:', e); }
      }

    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || '連線失敗';
      setMessages((prev) => [...prev, { id: Date.now() + 2, sender: 'ai', text: `[${timeStr}][異常] ⚠️ DeepSeek: ${errMsg}` }]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        
        {/* 控制台頂欄 */}
        <View style={styles.dashboard}>
          <Text style={styles.gpsText}>📍 {locationText} | 🧠 AI 思考流 Ready</Text>
          
          <View style={styles.switchContainer}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>極簡側邊欄 HUD</Text>
              <Switch value={isFloatingMode} onValueChange={toggleFloatingHUD} trackColor={{ true: '#00FF66' }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>自動手刷 F5 (3-5s)</Text>
              <Switch value={isAutoRefresh} onValueChange={setIsAutoRefresh} trackColor={{ true: '#00FF66' }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>有單才觸控 (單點)</Text>
              <Switch value={isAutoClick} onValueChange={setIsAutoClick} trackColor={{ true: '#FF3366' }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>自動清理『知道了』</Text>
              <Switch value={rejectLongDistance} onValueChange={setRejectLongDistance} trackColor={{ true: '#00FF66' }} />
            </View>
          </View>
        </View>

        {/* 參照圖二：極簡懸浮側邊欄 UI 預覽 */}
        {isFloatingMode && (
          <View style={styles.sideBarPreview}>
            <Text style={styles.sideBarIcon}>▶️</Text>
            <Text style={styles.sideBarIcon}>➕</Text>
            <Text style={styles.sideBarIcon}>🔄</Text>
            <Text style={styles.sideBarIcon}>⚙️</Text>
            <Text style={styles.sideBarIcon}>🏠</Text>
          </View>
        )}

        {/* 主介面：AI 思考流 Log (參照圖一與圖三) */}
        <ScrollView style={styles.chatBox} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
          {messages.map((m) => (
            <View key={m.id} style={[styles.msgBubble, m.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={m.sender === 'user' ? styles.userMsgText : styles.aiLogText}>{m.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* 底部打字輸入框 */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="輸入指令，如『大埔肯德基 low 過 \$30 唔接』..."
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
  
  // 側邊欄懸浮視窗樣式 (參照圖二)
  sideBarPreview: { 
    position: 'absolute', left: 10, top: 180, zIndex: 999, 
    backgroundColor: '#000', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 8,
    borderWidth: 1, borderColor: '#00FF66', alignItems: 'center' 
  },
  sideBarIcon: { color: '#00FF66', fontSize: 16, marginVertical: 8 },

  chatBox: { flex: 1, padding: 10 },
  msgBubble: { padding: 12, borderRadius: 10, marginBottom: 10, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#005bb5' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#151515', borderWidth: 1, borderColor: '#333' },
  userMsgText: { color: '#FFF', fontSize: 14 },
  aiLogText: { color: '#00FF66', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 18 },
  
  inputRow: { flexDirection: 'row', padding: 10, paddingBottom: Platform.OS === 'android' ? 25 : 10, backgroundColor: '#1A1A1A', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#2C2C2E', color: '#FFF', paddingHorizontal: 15, borderRadius: 20, height: 45 },
  sendBtn: { backgroundColor: '#00FF66', paddingHorizontal: 20, height: 45, justifyContent: 'center', marginLeft: 10, borderRadius: 20 },
  sendBtnText: { color: '#000', fontWeight: 'bold' }
});