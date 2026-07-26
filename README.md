# 🎙️ VoiceLedger — Voice-First Udhaar & Debt Tracker

> **Live Application URL:** [https://YOUR-VERCEL-APP-URL.vercel.app](https://YOUR-VERCEL-APP-URL.vercel.app)  
> **GitHub Repository:** [https://github.com/mubashra-imtiaz/VoiceLedger](https://github.com/mubashra-imtiaz/VoiceLedger)

---

## 📌 Problem & Target Audience
In traditional retail environments, micro-merchants and local shopkeepers rely on physical paper notebooks (*khata*) to track customer sales, outstanding credit (*udhaar*), and payment settlements. These paper ledgers present critical challenges:
* Physical notebooks are easily misplaced, damaged, or destroyed.
* Manual bookkeeping is prone to human calculation errors.
* Recording transactions during busy peak hours slows down customer flow.

**VoiceLedger** solves this problem by providing a voice-first, PWA-enabled digital ledger. It allows shopkeepers to record transactions by speaking naturally, automatically converting spoken audio into structured financial records—works seamlessly online and offline.

---

## ⚡ Key Features
* 🎙️ **Voice-First Input Processing:** Log debt additions and payment settlements using natural speech.
* 📖 **Digital Khata Management:** Real-time customer profile tracking with aggregate debt balances and transaction logs.
* 📲 **Progressive Web App (PWA):** Fully installable on Android, iOS, and Desktop homescreens.
* 💾 **Offline Synchronization:** Powered by Service Workers and local caching to guarantee performance without internet connectivity.
* 📊 **Merchant Analytics:** Live overview cards summarizing total outstanding collections and transaction counts.
* 🌐 **Localization Support:** Designed to handle multilingual natural phrasing used by local shopkeepers.

---

## 🤖 AI Feature & System Instructions

### Overview
VoiceLedger integrates **Google Gemini API via Google AI Studio** to eliminate manual form filling. The shopkeeper records a short voice note describing the transaction. The app transcribes the audio and submits the raw text to Gemini, which extracts entity data and outputs a strictly formatted JSON structure for database storage.

### System Prompt / Instructions
```text
You are an expert financial assistant for VoiceLedger, a digital khata application for micro-merchants.
Your task is to analyze the user's spoken voice entry and convert it into a structured JSON payload.

Extract the following entities:
1. "customerName": Name of the individual mentioned (string, capitalized).
2. "amount": The total numerical monetary value (number).
3. "type": Transaction type, strictly either "DEBT" (credit/item taken) or "PAYMENT" (settlement/cash given).
4. "notes": Brief description of items purchased or payment notes (string).

Rules:
- Respond strictly with valid JSON. Do not include markdown formatting, conversational responses, or preambles.
- If the transaction type is ambiguous, default based on action verbs ("gave", "paid" -> PAYMENT; "took", "bought", "credit" -> DEBT).

Example Input: "Ahmed took 450 rupees worth of rice on credit"
Example Output: {"customerName": "Ahmed", "amount": 450, "type": "DEBT", "notes": "Rice"}
