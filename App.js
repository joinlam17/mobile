import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Switch } from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';

export default function App() {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: '大腦 Ready！開工前可以同我講今日規則，或者切換模式。' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isCloudMode, setIsCloudMode] = useState(false); // false: 本地 3B, true: DeepSeek 雲端
  const [locationText, setLocationText] = useState('定位中...');

  // 1. 自動取得 GPS 輕量位置
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationText('GPS 權限被拒');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setLocationText(`Lat: ${location.coords.latitude.toFixed(2)}, Lon: ${location.coords.longitude.toFixed(2)}`);
    })();
  }, []);

  // 2. 發送對話 / 呼叫 API
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg = { id: Date.now(), sender: 'user', text: inputText };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    if (isCloudMode) {
      // 雲端 DeepSeek API 模式 (帶 GPS Context)
      try {
        const response = await axios.post('https://api.deepseek.com/chat/completions', {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: `你是專屬外賣助手。當前位置：${locationText}。請用短句回答。` },
            { role: 'user', content: inputText }
          ]
        }, {
          headers: { 'Authorization': 'Bearer YOUR_DEEPSEEK_API_KEY' }
        });

        const aiReply = response.data.choices[0].message.content;
        setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiReply }]);
      } catch (err) {
        setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'DeepSeek API 連線失敗，請檢查 Key。' }]);
      }
    } else {
      // 本地 3B 極速回應模式
      setMessages((prev) => [...prev, { 
        id: Date.now() + 1, 
        sender: 'ai', 
        text: `[本地 3B 模式]: 已將指令「${inputText}」加入當日前景規則！` 
      }]);
    }
  };

  return (
    <View style={styles.container}>
      {/* 頂部 HUD 狀態列 */}
      <View style={styles.hudHeader}>
        <Text style={styles.hudText}>📍 {locationText}</Text>
        <View style={styles.switchRow}>
          <Text style={styles.hudText}>{isCloudMode ? '雲端 DeepSeek' : '本地 3B'}</Text>
          <Switch value={isCloudMode} onValueChange={setIsCloudMode} />
        </View>
      </View>

      {/* 訊息對話列表 */}
      <ScrollView style={styles.chatBox}>
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
          placeholder="輸入開工指令 / 對話..."
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>發送</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 40 },
  hudHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#1E1E1E' },
  hudText: { color: '#00FF66', fontSize: 12, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatBox: { flex: 1, padding: 10 },
  msgBubble: { padding: 10, borderRadius: 8, marginBottom: 8, maxWidth: '80%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#2C2C2E' },
  msgText: { color: '#FFF' },
  inputRow: { flexDirection: 'row', padding: 10, backgroundColor: '#1E1E1E' },
  input: { flex: 1, backgroundColor: '#2C2C2E', color: '#FFF', paddingHorizontal: 12, borderRadius: 6 },
  sendBtn: { backgroundColor: '#00FF66', padding: 12, marginLeft: 8, borderRadius: 6 },
  sendBtnText: { color: '#000', fontWeight: 'bold' }
});