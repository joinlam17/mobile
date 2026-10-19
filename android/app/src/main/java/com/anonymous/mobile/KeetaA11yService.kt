package com.anonymous.mobile

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlin.random.Random

class KeetaA11yService : AccessibilityService() {

    private var lastClickTime = 0L

    private val blacklist = listOf(
        "KFC", "肯德基",
        "Pizza Hut", "必勝客",
        "麥當勞", "McDonald",
        "流浮山", "Wetland", "輞井圍"
    )

    private val whitelist = listOf(
        "頌富", "T Town", "天瑞", "天澤", "嘉湖", "天耀", "天盛"
    )

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val rootNode = rootInActiveWindow ?: return

        val dismissNodes = rootNode.findAccessibilityNodeInfosByText("知道了")
        if (!dismissNodes.isNullOrEmpty()) {
            clickNodeRandomly(dismissNodes[0])
            return
        }

        val screenText = StringBuilder()
        extractText(rootNode, screenText)
        val fullText = screenText.toString()

        if (!fullText.contains("搶單") || fullText.contains("訂單搜尋中")) return

        for (badWord in blacklist) {
            if (fullText.contains(badWord, ignoreCase = true)) return
        }

        for (goodWord in whitelist) {
            if (fullText.contains(goodWord, ignoreCase = true)) {
                val grabButtons = rootNode.findAccessibilityNodeInfosByText("搶單")
                for (btn in grabButtons) {
                    if (btn.text?.toString() == "搶單" || btn.isClickable) {
                        clickNodeRandomly(btn)
                        break
                    }
                }
                break
            }
        }
    }

    private fun extractText(node: AccessibilityNodeInfo?, sb: StringBuilder) {
        if (node == null) return
        if (!node.text.isNullOrEmpty()) {
            sb.append(node.text).append(" ")
        }
        for (i in 0 until node.childCount) {
            extractText(node.getChild(i), sb)
        }
    }

    private fun clickNodeRandomly(node: AccessibilityNodeInfo) {
        val now = System.currentTimeMillis()
        if (now - lastClickTime < 1500) return
        lastClickTime = now

        val rect = Rect()
        node.getBoundsInScreen(rect)
        if (rect.isEmpty) return

        val targetX = rect.centerX() + Random.nextInt(-10, 11)
        val targetY = rect.centerY() + Random.nextInt(-10, 11)
        val duration = Random.nextLong(60, 130)

        val path = Path().apply { moveTo(targetX.toFloat(), targetY.toFloat()) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, duration))
            .build()

        dispatchGesture(gesture, null, null)
    }

    override fun onInterrupt() {}
}