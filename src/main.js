import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
const $ = (id) => document.getElementById(id);
console.log('[THE LAST CLUE] main.js loaded');
class DetectiveSoundEngine {
  constructor() { this.ctx = null; this.master = null; this.isMuted = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.isMuted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }
  startAmbient() {
    const c = this.ctx;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = 'sine'; osc.frequency.value = 55; g.gain.value = 0.04;
    osc.connect(g); g.connect(this.master); osc.start();
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const rg = c.createGain(); rg.gain.value = 0.025;
    src.connect(lp); lp.connect(rg); rg.connect(this.master); src.start();
  }
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.master) this.master.gain.value = this.isMuted ? 0 : 1;
    return !this.isMuted;
  }
  tone(freq, type, dur, vol, slideTo = null, delay = 0) {
    if (!this.ctx || this.isMuted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  playInspectSound() { this.tone(587.33, 'triangle', 0.25, 0.12, 880); }
  playContradictionSound() { [220, 277.18, 329.63].forEach(f => this.tone(f, 'sawtooth', 0.5, 0.1)); }
  playFootstep() { this.tone(80, 'sine', 0.08, 0.06, 30); }
  playVictorySound() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 'sine', 0.4, 0.15, null, i * 0.12)); }
  playFailSound() { this.tone(160, 'sawtooth', 0.4, 0.15, 60); }
}
const audio = new DetectiveSoundEngine();
let currentLang = 'en';
function genderOf(voice) {
  const n = (voice.name || '').toLowerCase();
  if (/(female|woman|zira|samantha|victoria|hazel|susan|karen|catherine|serena|fiona|moira|tessa|veena|eva|linda|heera|kalpana|lekha)/.test(n)) return 'f';
  if (/(\bmale\b|\bman\b|david|george|alex|daniel|mark|guy|james|oliver|richard|rishi|tom|aaron|bernard|hemant|ravi)/.test(n)) return 'm';
  return null;
}
class CharacterVoiceManager {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.voiceEnabled = true;
    this.currentUtterance = null;
    this.voiceMap = { en: {}, hi: {} };
    this.profiles = {
      detective: { gender: 'm', prefer: ['guy', 'george', 'david', 'aaron', 'alex'], pitchEn: 0.94, rateEn: 0.90, pitchHi: 0.95, rateHi: 0.89, volume: 1.0 },
      assistant: { gender: 'f', prefer: ['hazel', 'serena', 'samantha', 'zira', 'victoria'], pitchEn: 1.02, rateEn: 0.90, pitchHi: 1.03, rateHi: 0.89, volume: 1.0 },
      eleanor:   { gender: 'f', prefer: ['victoria', 'zira', 'samantha', 'serena', 'hazel'], pitchEn: 1.08, rateEn: 0.89, pitchHi: 1.10, rateHi: 0.88, volume: 1.0 },
      clara:     { gender: 'f', prefer: ['karen', 'susan', 'fiona', 'moira', 'tessa'], pitchEn: 1.16, rateEn: 0.90, pitchHi: 1.18, rateHi: 0.90, volume: 0.95 },
      daniel:    { gender: 'm', prefer: ['daniel', 'oliver', 'tom', 'james', 'rishi'], pitchEn: 1.07, rateEn: 0.95, pitchHi: 1.08, rateHi: 0.94, volume: 1.0 },
      victor:    { gender: 'm', prefer: ['richard', 'mark', 'bernard', 'david'], pitchEn: 0.84, rateEn: 0.88, pitchHi: 0.84, rateHi: 0.87, volume: 1.0 }
    };
    if (this.synth) {
      this.refreshVoices();
      if (this.synth.onvoiceschanged !== undefined) this.synth.onvoiceschanged = () => this.refreshVoices();
    }
  }
  get active() { return this.voiceEnabled && !!this.synth; }
  refreshVoices() {
    this.voices = (this.synth && this.synth.getVoices()) || [];
    this.assignCharacterVoices();
  }
  assignCharacterVoices() {
    if (!this.voices.length) return;
    const en = this.voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
    const hi = this.voices.filter(v => (v.lang || '').toLowerCase().startsWith('hi'));
    const used = new Set();
    const pick = (char, pool) => {
      const p = this.profiles[char];
      const same = pool.filter(v => genderOf(v) === p.gender);
      const neutral = pool.filter(v => genderOf(v) === null);
      for (const pref of p.prefer) {
        const m = same.find(v => v.name.toLowerCase().includes(pref) && !used.has(v.name));
        if (m) { used.add(m.name); return m; }
      }
      const cands = [same, neutral, pool];
      for (const list of cands) {
        const m = list.find(v => !used.has(v.name));
        if (m) { used.add(m.name); return m; }
      }
      return same[0] || pool[0] || null;
    };
    const chars = ['assistant', 'eleanor', 'clara', 'detective', 'victor', 'daniel'];
    const mapEn = {}, mapHi = {};
    chars.forEach(c => { mapEn[c] = pick(c, en.length ? en : this.voices); });
    used.clear();
    if (hi.length) chars.forEach(c => { mapHi[c] = pick(c, hi); });
    this.voiceMap = { en: mapEn, hi: mapHi };
  }
  getCharacterVoice(id, language) {
    const lang = language === 'hi' ? 'hi' : 'en';
    const p = this.profiles[(id || 'detective').toLowerCase()] || this.profiles.detective;
    return {
      voice: (this.voiceMap[lang] && this.voiceMap[lang][id]) || null,
      pitch: lang === 'hi' ? p.pitchHi : p.pitchEn,
      rate: lang === 'hi' ? p.rateHi : p.rateEn,
      volume: p.volume,
      langCode: lang === 'hi' ? 'hi-IN' : 'en-US'
    };
  }
  setVoiceState(on) { this.voiceEnabled = on; if (!on) this.stop(); return on; }
  stop() {
    if (this.currentUtterance) { this.currentUtterance.onend = null; this.currentUtterance.onerror = null; }
    this.currentUtterance = null;
    if (this.synth) this.synth.cancel();
  }
  speakAs(id, text, onEnd = null) {
    if (!this.active || !text || !text.trim()) { this.stop(); if (onEnd) onEnd(); return; }
    this.stop();
    const cfg = this.getCharacterVoice(id, currentLang);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = cfg.langCode; u.rate = cfg.rate; u.pitch = cfg.pitch; u.volume = cfg.volume;
    if (cfg.voice) u.voice = cfg.voice;
    let finished = false;
    const fin = () => { if (finished) return; finished = true; if (this.currentUtterance === u) this.currentUtterance = null; if (onEnd) onEnd(); };
    u.onend = fin; u.onerror = fin;
    this.currentUtterance = u;
    this.synth.speak(u);
  }
}
const voiceEngine = new CharacterVoiceManager();
const i18n = {
  en: {
    langBtn: '🌐 भाषा: HINDI', voiceOn: '🗣️ VOICE: ON', voiceOff: '🔇 VOICE: OFF',
    startLangLabel: 'LANGUAGE / भाषा:', startVoiceLabel: 'VOICE / आवाज़:',
    introSubtitle: 'A 3D Murder Mystery Investigation', introCardTitle: 'CREATE YOUR DETECTIVE',
    introUploadLabel: '📷 Upload Photo / Selfie', introPlaceholder: 'Enter Detective Name...',
    introControlsGuide: '<p><strong>W, A, S, D</strong> — Walk | <strong>Mouse</strong> — Look | <strong>Shift</strong> — Hurry</p><p><strong>E</strong> — Inspect / Interrogate | <strong>N</strong> — Notebook</p><p><strong>K</strong> — Final Accusation | <strong>Voice</strong> — Spoken dialogue (ENG/HIN)</p>',
    startBtnLabel: 'BEGIN INVESTIGATION', skipIntroLabel: '⏩ Skip Intro [Space / E]',
    rank: 'LEAD DETECTIVE', stageStudy: 'Case File: Richard Blackwood', stageReady: 'Level 3: Final Deduction Ready',
    score: 'Score:', clues: 'Evidence:', contra: 'Contradictions:',
    statusStudy: 'Search the study for physical clues', statusParlour: 'Study Cleared — Approach Suspects in the Parlour',
    statusExposed: 'All Lies Exposed — Ready for Final Deduction!',
    hintInspect: '[E] Inspect/Talk', hintNotebook: '[N] Notebook', hintSolve: '[K] Solve Case',
    bannerTitle: 'ALL LIES EXPOSED:', bannerSub: 'Press [K] to Accuse Culprit!',
    dossierLabel: 'CRIME SCENE EVIDENCE', dossierNote: 'Detective Note:', dossierReturn: 'LOG EVIDENCE & RETURN [E]',
    alibiBtnLabel: 'Where were you tonight at 10:15 PM?', motiveBtnLabel: 'Tell me your side of the story regarding Richard.',
    confrontBtnLabel: 'I have evidence that proves you are lying...',
    pickerTitle: 'Select Evidence to Present:', cancelConfront: 'Cancel Confrontation', endQuestion: 'END QUESTIONING [ESC / E]',
    contraExposed: 'CONTRADICTION EXPOSED:', contraSub: "Suspect's statement broken!",
    wrongClaimDetective: 'I have proof this evidence contradicts your timeline!',
    wrongClaimSuspect: 'What does that have to do with me, Detective? That proves nothing!',
    genericConfront: 'Does this evidence mean anything to you?',
    alreadyExposed: "I've already told you the truth, Detective. There is nothing more to say about that.",
    noEvidence: 'You have not collected any evidence yet. Search the study first.',
    readyPrompt: 'You may now question the suspect or present evidence.',
    detIntro: (n) => "I'm Detective " + n + ". I've been called to Blackwood Manor to investigate Richard Blackwood's death. I'd like to ask you a few questions.",
    detTag: 'Detective', notebookTitle: 'CASE NOTEBOOK — EVIDENCE LOG', notebookSub: 'Review collected clues to spot contradictions',
    notebookEmpty: 'No clues discovered yet. Inspect glowing items in the study with [E].', notebookLies: 'Lies Exposed',
    closeNotebook: 'CLOSE NOTEBOOK [N]', officer: 'Officer:', inspectAction: 'Inspect', talkAction: 'Talk to',
    pauseTitle: 'INVESTIGATION PAUSED', pauseSub: 'Take your time to review clues or state your final accusation.',
    resumeBtn: 'RESUME INVESTIGATION', accuseBtn: '⚖️ MAKE FINAL ACCUSATION [K]', openBookBtn: '📒 OPEN CASE NOTEBOOK [N]',
    deduceTitle: 'LEVEL 3: FINAL DEDUCTION BOARD', deduceSub: 'Piece together the evidence, identify the killer, and state your formal accusation.',
    labelWho: '1. THE CULPRIT (WHO):', labelWhy: '2. THE MOTIVE (WHY):', labelHow: '3. SMOKING GUN (EVIDENCE):',
    submitAccuse: 'SUBMIT FORMAL ACCUSATION', returnInvest: 'RETURN TO INVESTIGATION [K]', selectAll: 'SELECT ALL THREE FIELDS FIRST',
    winBadge: 'CASE SOLVED', winTitle: 'VICTOR HALE HAS CONFESSED',
    winStory: 'Faced with the torn balance-sheet ultimatum and the frozen 10:17 PM timeline, Victor Hale broke down under interrogation. When Richard threatened to turn the doctor ed company ledgers over to Scotland Yard, Victor struck him in desperation and locked the study from the outside using the service bypass key.',
    victorConfession: "It was me. Richard found out about the embezzlement and swore he would give the altered books to Scotland Yard. I went to his study, we fought, and I panicked. I locked the door behind me with the brass key.",
    winScoreLabel: 'Final Investigation Score:', winRank: 'Master Detective', winRestart: 'PLAY AGAIN / RESTART CASE',
    failBadge: 'WRONGFUL ACCUSATION', failTitle: 'INVESTIGATION COMPROMISED',
    failWrongPerson: 'The Magistrate rejected your accusation. The person you named could not be tied to the frozen 10:17 PM timeline and the physical evidence. Without conclusive proof, the real killer slipped into the stormy night.',
    failWeakCase: 'You named the right suspect, but your motive or key evidence did not hold up before the Magistrate. Without a proper link between motive and proof, the case collapsed.',
    failPenalty: 'Penalty: -100 Points Deducted', retryBtn: 'RETRY DEDUCTION [K]', fullRestart: 'Restart Entire Investigation'
  },
  hi: {
    langBtn: '🌐 LANG: ENGLISH', voiceOn: '🗣️ आवाज़: चालू', voiceOff: '🔇 आवाज़: बंद',
    startLangLabel: 'भाषा / LANGUAGE:', startVoiceLabel: 'आवाज़ / VOICE:',
    introSubtitle: '3D मर्डर मिस्ट्री इन्वेस्टिगेशन', introCardTitle: 'अपना जासूस प्रोफाइल बनाएँ',
    introUploadLabel: '📷 फोटो / सेल्फी अपलोड करें', introPlaceholder: 'जासूस का नाम दर्ज करें...',
    introControlsGuide: '<p><strong>W, A, S, D</strong> — चलें | <strong>Mouse</strong> — देखें | <strong>Shift</strong> — तेज़ चलें</p><p><strong>E</strong> — जाँच / बातचीत | <strong>N</strong> — डायरी</p><p><strong>K</strong> — अंतिम आरोप | <strong>आवाज़</strong> — बोलकर संवाद (हिंदी/अंग्रेज़ी)</p>',
    startBtnLabel: 'जाँच शुरू करें', skipIntroLabel: '⏩ परिचय छोड़ें [Space / E]',
    rank: 'मुख्य जासूस', stageStudy: 'केस फ़ाइल: रिचर्ड ब्लैकवुड', stageReady: 'लेवल 3: अंतिम आरोप का समय',
    score: 'स्कोर:', clues: 'सुराग:', contra: 'विरोधाभास:',
    statusStudy: 'स्टडी रूम में भौतिक सुराग खोजें', statusParlour: 'स्टडी पूरी हुई — मुख्य हॉल में संदिग्धों से बातचीत करें',
    statusExposed: 'सारे झूठ पकड़े गए — अंतिम आरोप [K] लगाने के लिए तैयार!',
    hintInspect: '[E] जाँच / बात करें', hintNotebook: '[N] डायरी', hintSolve: '[K] केस सुलझाएँ',
    bannerTitle: 'सारे झूठ बेनकाब:', bannerSub: 'हत्यारे पर अंतिम आरोप लगाने के लिए [K] दबाएँ!',
    dossierLabel: 'घटनास्थल का साक्ष्य', dossierNote: 'जासूसी टिप्पणी:', dossierReturn: 'साक्ष्य दर्ज करें और लौटें [E]',
    alibiBtnLabel: 'आप आज रात 10:15 बजे कहाँ थे?', motiveBtnLabel: 'रिचर्ड के बारे में अपनी पूरी कहानी बताइए।',
    confrontBtnLabel: 'मेरे पास सबूत है जो साबित करता है कि आप झूठ बोल रहे हैं...',
    pickerTitle: 'सामने रखने के लिए साक्ष्य चुनें:', cancelConfront: 'सामना रद्द करें', endQuestion: 'पूछताछ समाप्त करें [ESC / E]',
    contraExposed: 'झूठ पकड़ा गया:', contraSub: 'संदिग्ध का बयान झूठा साबित हुआ!',
    wrongClaimDetective: 'मेरे पास सबूत है कि यह साक्ष्य आपके बयान को झूठा साबित करता है!',
    wrongClaimSuspect: 'डिटेक्टिव, इसका मुझसे क्या लेना-देना? यह कुछ भी साबित नहीं करता!',
    genericConfront: 'क्या इस साक्ष्य का आपके लिए कोई मतलब है?',
    alreadyExposed: 'मैं आपको सच बता चुका हूँ, डिटेक्टिव। इस बारे में और कुछ कहने को नहीं है।',
    noEvidence: 'आपने अभी तक कोई साक्ष्य इकट्ठा नहीं किया है। पहले स्टडी रूम की तलाशी लें।',
    readyPrompt: 'अब आप इनसे सवाल पूछ सकते हैं या सबूत पेश कर सकते हैं।',
    detIntro: (n) => 'मैं डिटेक्टिव ' + n + ' हूँ। रिचर्ड ब्लैकवुड की मौत की जाँच के लिए मुझे ब्लैकवुड मैनर बुलाया गया है। मुझे आपसे कुछ सवाल पूछने हैं।',
    detTag: 'जासूस', notebookTitle: 'केस डायरी — सुराग और साक्ष्य', notebookSub: 'झूठ पकड़ने के लिए इकट्ठे किए गए सबूतों को ध्यान से पढ़ें',
    notebookEmpty: 'अभी तक कोई सुराग नहीं मिला। स्टडी में चमकती वस्तुओं को [E] से जाँचें।', notebookLies: 'पकड़े गए झूठ',
    closeNotebook: 'डायरी बंद करें [N]', officer: 'जांच अधिकारी:', inspectAction: 'जाँचें', talkAction: 'बात करें',
    pauseTitle: 'जाँच रोकी गई', pauseSub: 'सबूतों पर विचार करें या अंतिम आरोप दर्ज करें।',
    resumeBtn: 'जाँच जारी रखें', accuseBtn: '⚖️ अंतिम आरोप दर्ज करें [K]', openBookBtn: '📒 केस डायरी खोलें [N]',
    deduceTitle: 'लेवल 3: अंतिम निष्कर्ष बोर्ड', deduceSub: 'सबूतों को जोड़ें, हत्यारे की पहचान करें और औपचारिक आरोप लगाएँ।',
    labelWho: '1. हत्यारा (कौन):', labelWhy: '2. मकसद (क्यों):', labelHow: '3. निर्णायक सबूत:',
    submitAccuse: 'अंतिम कानूनी आरोप दर्ज करें', returnInvest: 'जाँच पर वापस लौटें [K]', selectAll: 'पहले तीनों विकल्प चुनें',
    winBadge: 'केस सुलझा लिया गया', winTitle: 'विक्टर हेल ने जुर्म कबूल किया',
    winStory: 'फटी हुई बैलेंस-शीट की धमकी और टूटी घड़ी के 10:17 बजे के समय के सामने विक्टर हेल टूट गया। जब रिचर्ड ने कंपनी के हेराफेरी किए हुए खाते स्कॉटलैंड यार्ड को सौंपने की धमकी दी, तो विक्टर ने हताशा में उन पर हमला कर दिया और मास्टर-चाबी से कमरा बाहर से बंद करके भाग गया।',
    victorConfession: 'यह मैंने किया था। रिचर्ड को मेरे गबन का पता चल गया था और उसने बदले हुए खाते स्कॉटलैंड यार्ड को देने की कसम खाई थी। मैं उसके कमरे में गया, हमारी हाथापाई हुई और मैं घबरा गया। मैंने पीतल की चाबी से दरवाज़ा बाहर से बंद कर दिया।',
    winScoreLabel: 'अंतिम जासूसी स्कोर:', winRank: 'मास्टर डिटेक्टिव', winRestart: 'दोबारा खेलें / केस रीस्टार्ट करें',
    failBadge: 'गलत आरोप', failTitle: 'जाँच खारिज कर दी गई',
    failWrongPerson: 'मजिस्ट्रेट ने आपका आरोप ठुकरा दिया। आपने जिसका नाम लिया उसे 10:17 बजे के समय और भौतिक सबूतों से नहीं जोड़ा जा सका। ठोस सबूत के बिना असली कातिल तूफ़ानी रात में बच निकला।',
    failWeakCase: 'आपने सही संदिग्ध चुना, लेकिन मकसद या निर्णायक सबूत मजिस्ट्रेट के सामने टिक नहीं पाया। मकसद और सबूत के बीच सही कड़ी के बिना केस ढह गया।',
    failPenalty: 'दंड: 100 अंक काटे गए', retryBtn: 'दोबारा आरोप लगाएँ [K]', fullRestart: 'पूरी जाँच शुरू से रीस्टार्ट करें'
  }
};
const CLUES = {
  watch: {
    img: 'assets/watch.png',
    en: { title: 'Broken Pocket Watch', loc: "Victim's Study — Evidence Table",
      desc: 'An antique gold pocket watch with a cracked crystal casing. Its hands are frozen at exactly 10:17 PM, the moment it was smashed during the struggle.',
      note: 'Richard was attacked at 10:17 PM. Anyone who claims to have seen him alive and well after that is lying.' },
    hi: { title: 'टूटी हुई जेब घड़ी', loc: 'पीड़ित का अध्ययन कक्ष — साक्ष्य मेज़',
      desc: 'एक सुनहरी एंटीक जेब घड़ी जिसका शीशा चटका हुआ है। सुइयाँ ठीक रात 10:17 बजे पर रुकी हैं, यानी संघर्ष के दौरान घड़ी टूटने का समय।',
      note: 'रिचर्ड पर 10:17 बजे हमला हुआ। इसके बाद उन्हें ज़िंदा और ठीक देखने का दावा करने वाला झूठ बोल रहा है।' }
  },
  letter: {
    img: 'assets/letter.png',
    en: { title: 'Torn Disputed Letter', loc: "Victim's Study — Evidence Table",
      desc: "A torn letter in Richard's handwriting addressed to Victor. He threatens to hand the altered balance sheets to Scotland Yard unless Victor meets him in the study by 10:00 PM.",
      note: 'Whoever this letter was written to had a huge motive: exposure of embezzlement and altered audit books.' },
    hi: { title: 'फटी हुई विवादित चिट्ठी', loc: 'पीड़ित का अध्ययन कक्ष — साक्ष्य मेज़',
      desc: 'रिचर्ड की हस्तलिपि में विक्टर के नाम एक फटी हुई चिट्ठी। वह धमकी देते हैं कि अगर विक्टर रात 10:00 बजे तक स्टडी में नहीं मिला तो बदली हुई बैलेंस शीट स्कॉटलैंड यार्ड को सौंप देंगे।',
      note: 'जिसे यह चिट्ठी लिखी गई, उसके पास गबन और बदले हुए ऑडिट खातों के उजागर होने का बड़ा मकसद था।' }
  },
  photo: {
    img: 'assets/photo.png',
    en: { title: 'Half-Burned Photograph', loc: 'Fireplace Ash Ledge — Evidence Table',
      desc: "A half-burned vintage sepia photograph of Richard and Daniel, rescued from the fireplace ash ledge. Daniel's face has been violently scratched out.",
      note: 'Brotherly love does not leave scratches like these. Someone hated Daniel, or Daniel hated being in that picture.' },
    hi: { title: 'अधजली तस्वीर', loc: 'चिमनी की राख की पट्टी — साक्ष्य मेज़',
      desc: 'रिचर्ड और डैनियल की पुरानी सेपिया अधजली तस्वीर, जो चिमनी की राख की पट्टी से मिली। डैनियल का चेहरा बुरी तरह खुरच दिया गया है।',
      note: 'भाईचारे में ऐसी खरोंचें नहीं लगतीं। या तो किसी को डैनियल से नफ़रत थी या डैनियल को इस तस्वीर से।' }
  }
};
const ASSISTANT_BRIEFINGS = {
  en: [
     "Detective, before you begin questioning the suspects, let me brief you on the case file.",
     "The victim is Richard Blackwood, a wealthy industrialist who was found dead tonight in his private study here at Blackwood Manor.",
     "The study was locked from the inside. Forensic indicators show a violent struggle took place right around 10:17 PM.",
     "Four individuals are currently in the manor: Eleanor (his wife), Daniel (his brother), Victor Hale (his business partner), and Clara Morgan (the head housekeeper).",
     "Your objective is to search the study for physical clues, gather evidence, and then interrogate the suspects. Pay close attention to any contradictions between their statements and the physical evidence."
  ],
  hi: [
     "डिटेक्टिव, संदिग्धों से पूछताछ शुरू करने से पहले, आइए मैं आपको केस फ़ाइल की जानकारी दे दूँ।",
     "पीड़ित रिचर्ड ब्लैकवुड हैं, एक अमीर उद्योगपति जो आज रात ब्लैकवुड मैनर के अपने निजी स्टडी रूम में मृत पाए गए।",
     "स्टडी रूम बाहर से बंद था। फोरेंसिक संकेत बताते हैं कि ठीक रात 10:17 बजे एक हिंसक संघर्ष हुआ था।",
     "मैनर में इस समय चार लोग मौजूद हैं: एलेनोर (उनकी पत्नी), डैनियल (भाई), विक्टर हेल (साझेदार), और क्लारा मॉर्गन (परिचारिका)।",
     "आपका उद्देश्य स्टडी रूम में भौतिक सुराग खोजना, साक्ष्य इकट्ठा करना और फिर संदिग्धों से पूछताछ करना है। उनके बयानों और साक्ष्यों के बीच के विरोधाभास पर विशेष ध्यान दें।"
  ]
};
const SUSPECTS = {
  assistant: {
    id: 'assistant', emoji: '📋', nameEn: 'Assistant', nameHi: 'सहायक',
    roleEn: 'Detective Assistant', roleHi: 'जासूस सहायक', contradiction: null, isAssistant: true,
    introEn: "Detective, I have prepared the initial case briefing for you.",
    introHi: 'डिटेक्टिव, मैंने आपके लिए शुरुआती केस ब्रीफिंग तैयार कर ली है।',
    proxEn: "Detective, come over here for the case briefing before you investigate.",
    proxHi: 'डिटेक्टिव, जाँच शुरू करने से पहले केस ब्रीफिंग के लिए यहाँ आइए।'
  },
  eleanor: {
    id: 'eleanor', emoji: '👩', nameEn: 'Eleanor Blackwood', nameHi: 'एलेनोर ब्लैकवुड',
    roleEn: "Richard's Wife", roleHi: 'रिचर्ड की पत्नी', contradiction: 'watch',
    introEn: "I am Eleanor Blackwood, Richard's wife. This night has been dreadful, Detective. Please, ask what you must.",
    introHi: 'मैं एलेनोर ब्लैकवुड हूँ, रिचर्ड की पत्नी। यह रात बहुत भयानक रही है, डिटेक्टिव। जो पूछना है पूछिए।',
    proxEn: "I'm Eleanor Blackwood, Richard's wife. Are you the detective?", proxHi: 'मैं एलेनोर ब्लैकवुड, रिचर्ड की पत्नी हूँ। क्या आप ही जासूस हैं?',
    alibiEn: 'At a quarter to eleven I saw Richard in his study, pacing and drinking his brandy as comfortably as ever.',
    alibiHi: 'पौने ग्यारह बजे मैंने रिचर्ड को उनकी स्टडी में देखा था। वे हमेशा की तरह आराम से टहल रहे थे और ब्रांडी पी रहे थे।',
    motiveEn: 'Richard was a hard but fair man. I cannot imagine anyone wishing him harm.',
    motiveHi: 'रिचर्ड सख़्त ज़रूर थे, पर न्यायप्रिय थे। मैं सोच भी नहीं सकती कि कोई उन्हें नुकसान पहुँचाना चाहेगा।',
    confDetEn: "Mrs. Blackwood, this pocket watch was smashed at 10:17 PM. Richard could not have been pacing and drinking at a quarter to eleven.",
    confDetHi: 'श्रीमती ब्लैकवुड, यह घड़ी 10:17 बजे टूटी थी। रिचर्ड पौने ग्यारह बजे टहल और पी नहीं सकते थे।',
    confessEn: "...Very well. I lied. I was in the garden arguing with Richard's lawyer and I was ashamed. I never saw him at a quarter to eleven. But I did not kill my husband.",
    confessHi: '...ठीक है। मैंने झूठ बोला। मैं बगीचे में रिचर्ड के वकील से बहस कर रही थी और मुझे शर्म आ रही थी। मैंने उन्हें पौने ग्यारह बजे नहीं देखा था। लेकिन मैंने अपने पति को नहीं मारा।'
  },
  daniel: {
    id: 'daniel', emoji: '🧔', nameEn: 'Daniel Blackwood', nameHi: 'डैनियल ब्लैकवुड',
    roleEn: "Richard's Brother", roleHi: 'रिचर्ड का भाई', contradiction: 'photo',
    introEn: "Daniel Blackwood. Richard was my brother. Ask quickly, Detective; I can barely stand to be in this house.",
    introHi: 'डैनियल ब्लैकवुड। रिचर्ड मेरा भाई था। जल्दी पूछिए, डिटेक्टिव; इस घर में खड़े रहना भी मुश्किल है।',
    proxEn: "Daniel Blackwood. Richard was my brother.", proxHi: 'डैनियल ब्लैकवुड। रिचर्ड मेरा भाई था।',
    alibiEn: 'I was in the library all evening with a book. Richard and I were the closest of brothers. We never had a single dispute.',
    alibiHi: 'मैं पूरी शाम एक किताब के साथ पुस्तकालय में था। रिचर्ड और मैं सबसे क़रीबी भाई थे। हमारे बीच कभी कोई विवाद नहीं हुआ।',
    motiveEn: 'There is nothing to tell. He was my brother and I loved him.', motiveHi: 'बताने को कुछ नहीं है। वह मेरा भाई था और मैं उससे प्यार करता था।',
    confDetEn: "Mr. Blackwood, a half-burned photograph of you and Richard, with your face violently scratched out. Is this brotherly love?",
    confDetHi: 'मिस्टर ब्लैकवुड, आपके और रिचर्ड के साथ की अधजली तस्वीर, जिसमें आपका चेहरा बुरी तरह खुरचा गया है। क्या यही भाईचारा है?',
    confessEn: "...Fine! Richard cut me out of Father's estate. I hated him for it, and I scratched that photograph in a rage. But hatred is not murder, Detective.",
    confessHi: '...ठीक है! रिचर्ड ने मुझे पिताजी की जायदाद से बेदख़ल कर दिया था। मैं उससे नफ़रत करता था और गुस्से में वह तस्वीर खुरच दी। लेकिन नफ़रत हत्या नहीं होती, डिटेक्टिव।'
  },
  victor: {
    id: 'victor', emoji: '🕴️', nameEn: 'Victor Hale', nameHi: 'विक्टर हेल',
    roleEn: 'Business Partner', roleHi: 'व्यापारिक साझेदार', contradiction: 'letter',
    introEn: 'Victor Hale, business partner of Richard for twenty years. A terrible loss for the firm, Detective.',
    introHi: 'विक्टर हेल, बीस साल से रिचर्ड का व्यापारिक साझेदार। फ़र्म के लिए बहुत बड़ा नुकसान है, डिटेक्टिव।',
    proxEn: 'Victor Hale. I was Richard\'s partner at the firm.', proxHi: 'विक्टर हेल। मैं फ़र्म में रिचर्ड का साझेदार था।',
    alibiEn: 'I was going over accounts in my office. Richard and I trusted each other completely. Our ledgers are spotless.',
    alibiHi: 'मैं अपने दफ़्तर में खाते देख रहा था। रिचर्ड और मैं एक-दूसरे पर पूरा भरोसा करते थे। हमारे खाते बिल्कुल साफ़ हैं।',
    motiveEn: 'We never had a cross word about money. Richard was the firm, and I was proud to stand beside him.',
    motiveHi: 'पैसों को लेकर हमारे बीच कभी कड़वी बात नहीं हुई। रिचर्ड ही फ़र्म थे और मुझे उनके साथ खड़े होने पर गर्व था।',
    confDetEn: 'Mr. Hale, this torn letter from Richard is addressed to you. He knew you altered the balance sheets to hide your embezzlement.',
    confDetHi: 'मिस्टर हेल, रिचर्ड की यह फटी चिट्ठी आपके नाम है। उन्हें पता था कि आपने गबन छिपाने के लिए बैलेंस शीट बदली थी।',
    confessEn: "Where did you find that?! ...All right. Richard caught me embezzling from the firm. I panicked. But a letter does not prove I killed him!",
    confessHi: 'यह आपको कहाँ मिली?! ...ठीक है। रिचर्ड ने मुझे फ़र्म से गबन करते पकड़ लिया था। मैं घबरा गया था। लेकिन एक चिट्ठी यह साबित नहीं करती कि मैंने उन्हें मारा!'
  },
  clara: {
    id: 'clara', emoji: '👵', nameEn: 'Clara Morgan', nameHi: 'क्लारा मॉर्गन',
    roleEn: 'Head Housekeeper', roleHi: 'मुख्य परिचारिका', contradiction: null,
    introEn: "Clara Morgan, head housekeeper, sir. Thirty years I have served this house. Whatever I can tell you, I will.",
    introHi: 'क्लारा मॉर्गन, मुख्य परिचारिका। तीस साल से मैं इस घर की सेवा कर रही हूँ। जो भी बता सकती हूँ, बताऊँगी।',
    proxEn: 'Clara Morgan, the housekeeper. Mind the wet floors, sir.', proxHi: 'क्लारा मॉर्गन, घर की परिचारिका। गीले फ़र्श का ध्यान रखिए, साहब।',
    alibiEn: 'I was in the kitchen, sir. But I heard raised voices from the study tonight, and later someone sneaking upstairs with a brass key.',
    alibiHi: 'मैं रसोई में थी, साहब। लेकिन आज रात स्टडी से ऊँची आवाज़ें सुनाई दीं और बाद में कोई पीतल की चाबी लेकर चुपके से ऊपर गया।',
    motiveEn: 'Mr. Richard was strict but fair to me. I only know what I heard, sir: arguments, a slammed door, and quiet footsteps.',
    motiveHi: 'रिचर्ड साहब मेरे साथ सख़्त पर न्यायपूर्ण थे। मैं बस वही जानती हूँ जो सुना: बहस, दरवाज़े का पटकना और दबे पाँव की आहट।',
    confDetEn: null, confDetHi: null,
    neutralEn: "I only tell what I heard, sir. That doesn't concern me, but I'm sure you'll find the right person.",
    neutralHi: 'मैं सिर्फ़ वही बताती हूँ जो मैंने सुना, साहब। इसका मुझसे कोई लेना-देना नहीं, पर आप सही इंसान को ज़रूर ढूँढ लेंगे।'
  }
};
let score = 0, cluesDiscovered = 0, contradictionsFound = 0;
const totalClues = 3, totalContradictions = 3;
let gameStarted = false, isInspecting = false, isInterrogating = false, isNotebookOpen = false, isDeducing = false, outcomeOpen = false;
let currentSuspect = null, activeTarget = null;
let collectedClues = [];
let assistantStep = 0;
const exposed = {};
const introDone = { assistant: false, eleanor: false, daniel: false, victor: false, clara: false };
const proxDone = { assistant: false, eleanor: false, daniel: false, victor: false, clara: false };
let isIntroPlaying = false, isTyping = false, typewriterTimer = null, fullCurrentSpeech = '', currentTypeFinish = null;
let seqId = 0, bannerDismissed = false, proximityTimer = null;
const langToggleBtn = $('lang-toggle-btn'), voiceToggleBtn = $('voice-toggle-btn'), audioToggleBtn = $('audio-toggle-btn');
const notebookHudBtn = $('notebook-hud-btn'), solveShortcutBtn = $('solve-shortcut-btn');
const startLangLabel = $('start-lang-label'), startVoiceLabel = $('start-voice-label');
const startLangEn = $('start-lang-en'), startLangHi = $('start-lang-hi'), startVoiceOn = $('start-voice-on'), startVoiceOff = $('start-voice-off');
const introControlsBar = $('intro-controls'), skipIntroBtn = $('skip-intro-btn'), interrogationOptionsGroup = $('interrogation-options-group');
const scoreEl = $('score-display'), clueEl = $('clue-display'), contraEl = $('contra-display'), statusEl = $('level-status'), stageBadgeEl = $('stage-badge');
const promptEl = $('interaction-prompt'), promptActionEl = $('prompt-action'), promptTargetEl = $('prompt-target'), reticleEl = $('reticle');
const deductionReadyBanner = $('deduction-ready-banner');
const proximityBubble = $('proximity-speech-bubble'), bubbleSpeaker = $('bubble-speaker'), bubbleText = $('bubble-text');
const tabLangEn = $('tab-lang-en'), tabLangHi = $('tab-lang-hi'), dialogueTurnSpeaker = $('dialogue-turn-speaker');
const textChoiceAlibi = $('text-choice-alibi'), textChoiceMotive = $('text-choice-motive'), textChoiceConfront = $('text-choice-confront');
const hudRankLabel = $('hud-rank-label'), labelScore = $('label-score'), labelClues = $('label-clues'), labelContra = $('label-contra');
const hintInspect = $('hint-inspect'), hintNotebook = $('hint-notebook'), hintSolve = $('hint-solve'), bannerText = $('banner-text'), bannerSub = $('banner-sub');
const modalEl = $('inspection-modal'), dossierTitleEl = $('dossier-title'), dossierTypeEl = $('dossier-type'), dossierLocEl = $('dossier-location');
const dossierDescEl = $('dossier-desc'), dossierNoteEl = $('dossier-note'), dossierNoteLabel = $('dossier-note-label'), closeModalBtn = $('close-modal-btn'), dossierImgEl = $('dossier-img');
const dialogueModal = $('dialogue-modal'), suspectAvatarEl = $('suspect-avatar'), suspectNameEl = $('suspect-name'), suspectRoleEl = $('suspect-role');
const dialogueSpeechEl = $('dialogue-speech'), typingCursor = $('typing-cursor'), transcriptBox = $('transcript-box');
const contradictionBanner = $('contradiction-banner'), contraAlertTitle = $('contra-alert-title'), contraAlertSub = $('contra-alert-sub');
const choiceAlibi = $('choice-alibi'), choiceMotive = $('choice-motive'), choiceConfront = $('choice-confront');
const pickerTitleLabel = $('picker-title-label'), evidenceSelector = $('evidence-selector'), chipsContainer = $('evidence-chips-container');
const leaveDialogueBtn = $('leave-dialogue-btn'), cancelConfrontBtn = $('cancel-confront-btn'), speakingPulse = $('speaking-pulse'), speakingText = $('speaking-text');
const notebookModal = $('notebook-modal'), notebookTitle = $('notebook-title'), notebookSub = $('notebook-sub'), notebookList = $('notebook-clues-list');
const closeNotebookBtn = $('close-notebook-btn'), notebookInvestigatorTag = $('notebook-investigator-tag');
const blocker = $('blocker'), instructionsMenu = $('instructions'), pauseMenu = $('pause-menu'), pauseTitle = $('pause-title'), pauseSub = $('pause-sub');
const resumeBtn = $('resume-btn'), pauseDeduceBtn = $('pause-deduce-btn'), pauseNotebookBtn = $('pause-notebook-btn');
const introSubtitle = $('intro-subtitle'), introCardTitle = $('intro-card-title'), introUploadLabel = $('intro-upload-label'), introControlsGuide = $('intro-controls-guide'), startBtn = $('start-btn');
const deductionModal = $('deduction-modal'), deduceHeaderTitle = $('deduce-header-title'), deduceHeaderSub = $('deduce-header-sub');
const labelWho = $('label-who'), labelWhy = $('label-why'), labelHow = $('label-how');
const submitAccusationBtn = $('submit-accusation-btn'), cancelDeductionBtn = $('cancel-deduction-btn');
const deduceCulpritEl = $('deduce-culprit'), deduceMotiveEl = $('deduce-motive'), deduceEvidenceEl = $('deduce-evidence');
const winModal = $('win-modal'), lossModal = $('loss-modal'), winBadgeTxt = $('win-badge-txt'), winTitleTxt = $('win-title-txt'), winStoryTxt = $('win-story-txt');
const winScoreLabel = $('win-score-label'), winFinalScoreEl = $('win-final-score'), winRankBadge = $('win-rank-badge'), winRestartBtn = $('win-restart-btn'), nextCaseBtn = $('next-case-btn');
const failBadgeTxt = $('fail-badge-txt'), failTitle = $('fail-title'), failExplanationEl = $('fail-explanation'), failPenaltyTxt = $('fail-penalty-txt');
const retryDeductionBtn = $('retry-deduction-btn'), fullRestartBtn = $('full-restart-btn');
const detectiveNameInput = $('detective-name-input'), avatarFileInput = $('avatar-file-input'), avatarPreview = $('avatar-preview');
const hudAvatarImg = $('hud-avatar-img'), hudDetectiveName = $('hud-detective-name');
const getName = () => detectiveNameInput.value.trim() || 'Vance';
const getNameLocalized = () => (currentLang === 'hi' ? 'डिटेक्टिव ' : 'Det. ') + getName();
function setLanguage(lang) { currentLang = lang; voiceEngine.stop(); updateLanguageUI(); }
function setVoiceState(on) { voiceEngine.setVoiceState(on); updateLanguageUI(); }
langToggleBtn.addEventListener('click', () => setLanguage(currentLang === 'en' ? 'hi' : 'en'));
voiceToggleBtn.addEventListener('click', () => setVoiceState(!voiceEngine.voiceEnabled));
startLangEn.addEventListener('click', () => setLanguage('en'));
startLangHi.addEventListener('click', () => setLanguage('hi'));
startVoiceOn.addEventListener('click', () => setVoiceState(true));
startVoiceOff.addEventListener('click', () => setVoiceState(false));
tabLangEn.addEventListener('click', () => { setLanguage('en'); if (currentSuspect) openDialogue(currentSuspect, false); });
tabLangHi.addEventListener('click', () => { setLanguage('hi'); if (currentSuspect) openDialogue(currentSuspect, false); });
function updateLanguageUI() {
  const t = i18n[currentLang];
  langToggleBtn.textContent = t.langBtn;
  voiceToggleBtn.textContent = voiceEngine.voiceEnabled ? t.voiceOn : t.voiceOff;
  startLangLabel.textContent = t.startLangLabel; startVoiceLabel.textContent = t.startVoiceLabel;
  introSubtitle.textContent = t.introSubtitle; introCardTitle.textContent = t.introCardTitle;
  introUploadLabel.textContent = t.introUploadLabel; detectiveNameInput.placeholder = t.introPlaceholder;
  introControlsGuide.innerHTML = t.introControlsGuide; startBtn.textContent = t.startBtnLabel; skipIntroBtn.textContent = t.skipIntroLabel;
  startLangHi.classList.toggle('active', currentLang === 'hi'); startLangEn.classList.toggle('active', currentLang === 'en');
  tabLangHi.classList.toggle('active', currentLang === 'hi'); tabLangEn.classList.toggle('active', currentLang === 'en');
  startVoiceOn.classList.toggle('active', voiceEngine.voiceEnabled); startVoiceOff.classList.toggle('active', !voiceEngine.voiceEnabled);
  hudRankLabel.textContent = t.rank; labelScore.textContent = t.score; labelClues.textContent = t.clues; labelContra.textContent = t.contra;
  hintInspect.textContent = t.hintInspect; hintNotebook.textContent = t.hintNotebook; hintSolve.textContent = t.hintSolve;
  bannerText.textContent = t.bannerTitle; bannerSub.textContent = t.bannerSub;
  dossierTypeEl.textContent = t.dossierLabel; dossierNoteLabel.textContent = t.dossierNote; closeModalBtn.textContent = t.dossierReturn;
  textChoiceAlibi.textContent = ' "' + t.alibiBtnLabel + '"'; textChoiceMotive.textContent = ' "' + t.motiveBtnLabel + '"'; textChoiceConfront.textContent = ' "' + t.confrontBtnLabel + '"';
  pickerTitleLabel.textContent = t.pickerTitle; cancelConfrontBtn.textContent = t.cancelConfront; leaveDialogueBtn.textContent = t.endQuestion;
  contraAlertTitle.textContent = t.contraExposed; contraAlertSub.textContent = t.contraSub;
  notebookTitle.textContent = t.notebookTitle; notebookSub.textContent = t.notebookSub; closeNotebookBtn.textContent = t.closeNotebook;
  pauseTitle.textContent = t.pauseTitle; pauseSub.textContent = t.pauseSub; resumeBtn.textContent = t.resumeBtn;
  pauseDeduceBtn.textContent = t.accuseBtn; pauseNotebookBtn.textContent = t.openBookBtn;
  deduceHeaderTitle.textContent = t.deduceTitle; deduceHeaderSub.textContent = t.deduceSub;
  labelWho.textContent = t.labelWho; labelWhy.textContent = t.labelWhy; labelHow.textContent = t.labelHow;
  submitAccusationBtn.textContent = t.submitAccuse; cancelDeductionBtn.textContent = t.returnInvest;
  winBadgeTxt.textContent = t.winBadge; winTitleTxt.textContent = t.winTitle; winStoryTxt.textContent = t.winStory;
  winScoreLabel.textContent = t.winScoreLabel; winRankBadge.textContent = t.winRank; winRestartBtn.textContent = t.winRestart;
  failBadgeTxt.textContent = t.failBadge; failTitle.textContent = t.failTitle; failPenaltyTxt.textContent = t.failPenalty;
  retryDeductionBtn.textContent = t.retryBtn; fullRestartBtn.textContent = t.fullRestart;
  notebookInvestigatorTag.textContent = t.officer + ' ' + getName();
  scoreEl.textContent = score; clueEl.textContent = cluesDiscovered + ' / ' + totalClues; contraEl.textContent = contradictionsFound + ' / ' + totalContradictions;
  if (contradictionsFound === totalContradictions) { statusEl.textContent = t.statusExposed; stageBadgeEl.textContent = t.stageReady; }
  else if (cluesDiscovered === totalClues) { statusEl.textContent = t.statusParlour; stageBadgeEl.textContent = t.stageStudy; }
  else { statusEl.textContent = t.statusStudy; stageBadgeEl.textContent = t.stageStudy; }
  if (outcomeOpen === false && winModal.classList.contains('hidden') === false) winFinalScoreEl.textContent = score;
}
function updateHUD() {
  updateLanguageUI();
  const ready = contradictionsFound === totalContradictions && !bannerDismissed && !outcomeOpen;
  deductionReadyBanner.classList.toggle('hidden', !ready);
}
updateLanguageUI();
avatarFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = (ev) => { avatarPreview.src = ev.target.result; hudAvatarImg.src = ev.target.result; };
  r.readAsDataURL(file);
});
audioToggleBtn.addEventListener('click', () => {
  audio.init();
  audioToggleBtn.textContent = audio.toggleMute() ? '🔊 AUDIO: ON' : '🔇 AUDIO: OFF';
});
const container = $('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080e);
scene.fog = new THREE.Fog(0x070912, 8.0, 34.0);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
// LEVEL1_PATCH_V1: custom start pose
camera.position.set(-0.05, 1.65, -1.05);
camera.rotation.set(-4.5 * Math.PI / 180, 180.0 * Math.PI / 180, 0, 'YXZ');
scene.add(camera);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o));
function box(w, h, d, mat, x, y, z, parent = scene) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }
function cyl(rt, rb, h, mat, x, y, z, parent = scene, seg = 16) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); parent.add(m); return m; }
function sphere(r, mat, x, y, z, parent = scene) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat); m.position.set(x, y, z); parent.add(m); return m; }
const colliders = [];
const addBoxCol = (cx, cz, w, d) => colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
const addRawCol = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ });
const addCircleCol = (x, z, r) => { const c = { x, z, r }; colliders.push(c); return c; };
const loader = new THREE.TextureLoader();
const loadTex = (p) => { const t = loader.load(p); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const watchTex = loadTex('assets/watch.png'), letterTex = loadTex('assets/letter.png'), photoTex = loadTex('assets/photo.png');
const floorTex = loadTex('assets/floor_wood.png');
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, 4);
const floorTexP = floorTex.clone(); floorTexP.needsUpdate = true; floorTexP.repeat.set(5, 5);
scene.add(new THREE.AmbientLight(0x3b4668, 1.4));
scene.add(new THREE.HemisphereLight(0x4a5a80, 0x1a1410, 0.9));
const moonLight = new THREE.DirectionalLight(0x4a6fa5, 1.6);
moonLight.position.set(8, 6, 2);
scene.add(moonLight);
const lantern = new THREE.PointLight(0xffe0b0, 6, 7, 1.5);
lantern.position.set(0, 0.1, 0.2);
camera.add(lantern);
const wallMat = M(0x4a4d63, { roughness: 0.88, side: THREE.DoubleSide });
const trimWoodMat = M(0x3a2618, { roughness: 0.45 });
const wainscotMat = M(0x2e1d12, { roughness: 0.55 });
const brassMat = M(0xc5a047, { metalness: 0.85, roughness: 0.25 });
const darkWoodMat = M(0x3b2515, { roughness: 0.5 });
const occluders = [];
function wall(w, h, x, y, z, rotY) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
  m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m); occluders.push(m); return m;
}
wall(12, 5, 0, 2.5, -6, 0);
wall(12, 5, -6, 2.5, 0, Math.PI / 2);
wall(12, 5, 6, 2.5, 0, -Math.PI / 2);
wall(5.2, 5, -4.4, 2.5, 6, 0);
wall(5.2, 5, 4.4, 2.5, 6, 0);
wall(3.6, 1.8, 0, 4.1, 6, 0);
wall(14, 5, -7, 2.5, 13, Math.PI / 2);
wall(14, 5, 7, 2.5, 13, -Math.PI / 2);
wall(14, 5, 0, 2.5, 20, Math.PI);
addRawCol(-8, 8, -7, -6);
addRawCol(-7, -6, -6, 6);
addRawCol(6, 7, -6, 6);
addRawCol(-8, -1.8, 5.85, 6.15);
addRawCol(1.8, 8, 5.85, 6.15);
addRawCol(-8, -7, 6, 21);
addRawCol(7, 8, 6, 21);
addRawCol(-8, 8, 20, 21);
function addWallTrim(x, z, width, rotY) {
  const g = new THREE.Group();
  box(width, 0.22, 0.05, trimWoodMat, 0, 0.11, 0, g);
  box(width, 0.88, 0.03, wainscotMat, 0, 0.66, 0, g);
  box(width, 0.06, 0.06, trimWoodMat, 0, 1.12, 0, g);
  box(width, 0.10, 0.08, trimWoodMat, 0, 4.95, 0, g);
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
}
addWallTrim(0, -5.96, 12, 0);
addWallTrim(-5.96, 0, 12, Math.PI / 2);
addWallTrim(5.96, 0, 12, Math.PI / 2);
addWallTrim(-4.4, 5.96, 5.2, 0);
addWallTrim(4.4, 5.96, 5.2, 0);
addWallTrim(-6.96, 13, 14, Math.PI / 2);
addWallTrim(6.96, 13, 14, Math.PI / 2);
addWallTrim(0, 19.96, 14, 0);
const floorA = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), M(0xffffff, { map: floorTex, roughness: 0.4, metalness: 0.1 }));
floorA.rotation.x = -Math.PI / 2; floorA.receiveShadow = true; scene.add(floorA);
const floorB = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), M(0xffffff, { map: floorTexP, roughness: 0.4, metalness: 0.1 }));
floorB.rotation.x = -Math.PI / 2; floorB.position.set(0, 0, 13); floorB.receiveShadow = true; scene.add(floorB);
const rugA = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.8), M(0x5a1620, { roughness: 0.92 }));
rugA.rotation.x = -Math.PI / 2; rugA.position.set(0, 0.012, 0); rugA.receiveShadow = true; scene.add(rugA);
const rugB = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), M(0x33204a, { roughness: 0.92 }));
rugB.rotation.x = -Math.PI / 2; rugB.position.set(0, 0.012, 13); rugB.receiveShadow = true; scene.add(rugB);
const ceilingMat = M(0x2c2a33, { roughness: 0.82, side: THREE.DoubleSide });
const beamMat = M(0x33220f, { roughness: 0.55 });
const cA = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), ceilingMat); cA.rotation.x = Math.PI / 2; cA.position.set(0, 5, 0); scene.add(cA);
const cB = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), ceilingMat); cB.rotation.x = Math.PI / 2; cB.position.set(0, 5, 13); scene.add(cB);
for (let b = -4; b <= 4; b += 4) { box(12, 0.12, 0.18, beamMat, 0, 4.94, b); box(0.18, 0.12, 12, beamMat, b, 4.94, 0); }
for (let b = 8.5; b <= 17.5; b += 4.5) box(14, 0.12, 0.18, beamMat, 0, 4.94, b);
const ledLens = M(0xffecc4, { emissive: 0xffcc44, emissiveIntensity: 2.2 });
function addCeilingLED(x, z, real) {
  const g = new THREE.Group();
  const bez = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 24), brassMat); bez.rotation.x = Math.PI / 2; g.add(bez);
  cyl(0.13, 0.13, 0.015, ledLens, 0, 0.005, 0, g, 20);
  if (real) { const l = new THREE.PointLight(0xffd066, 14, 8, 1.6); l.position.y = -0.3; g.add(l); }
  g.position.set(x, 4.98, z); scene.add(g);
}
[[-2.6, -2.6, false], [2.6, -2.6, false], [-2.6, 2.6, true], [2.6, 2.6, true],
 [-3.6, 9, true], [3.6, 9, false], [-3.6, 13, false], [3.6, 13, false], [-3.6, 17, false], [3.6, 17, true]].forEach(a => addCeilingLED(...a));
function createWallSconce(x, y, z, rotY) {
  const g = new THREE.Group();
  const glow = M(0xffecc4, { emissive: 0xffaa22, emissiveIntensity: 2.4 });
  const plate = cyl(0.07, 0.07, 0.02, brassMat, 0, 0, 0, g); plate.rotation.x = Math.PI / 2;
  const arm = cyl(0.012, 0.012, 0.12, brassMat, 0, 0.0, 0.06, g, 8); arm.rotation.x = Math.PI / 2;
  cyl(0.045, 0.025, 0.03, brassMat, 0, 0.0, 0.125, g, 12);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.038, 0.12, 16, 1, true), M(0xffdfaa, { transparent: true, opacity: 0.85, roughness: 0.25, side: THREE.DoubleSide }));
  shade.position.set(0, 0.075, 0.125); g.add(shade);
  sphere(0.027, glow, 0, 0.07, 0.125, g);
  g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g);
}
[[-3.2, 2.5, -5.92, 0], [3.2, 2.5, -5.92, 0], [-5.92, 2.5, -3.2, Math.PI / 2], [-5.92, 2.5, 3.2, Math.PI / 2],
 [5.92, 2.5, -2.2, -Math.PI / 2], [5.92, 2.5, 2.2, -Math.PI / 2],
 [-6.92, 2.6, 9.5, Math.PI / 2], [-6.92, 2.6, 16.5, Math.PI / 2], [6.92, 2.6, 9.5, -Math.PI / 2], [6.92, 2.6, 16.5, -Math.PI / 2],
 [-3.6, 2.6, 19.92, Math.PI], [3.6, 2.6, 19.92, Math.PI]].forEach(a => createWallSconce(...a));
const glassMat = M(0x3d5475, { roughness: 0.1, metalness: 0.9, opacity: 0.85, transparent: true });
const winG = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), glassMat); winG.position.set(5.93, 2.5, 0); winG.rotation.y = -Math.PI / 2; scene.add(winG);
const frameMat = M(0x1c120d, { roughness: 0.8 });
box(0.1, 0.1, 1.8, frameMat, 5.92, 3.75, 0); box(0.1, 0.1, 1.8, frameMat, 5.92, 1.25, 0);
box(0.1, 2.6, 0.1, frameMat, 5.92, 2.5, -0.85); box(0.1, 2.6, 0.1, frameMat, 5.92, 2.5, 0.85);
box(0.08, 2.4, 0.05, frameMat, 5.9, 2.5, 0); box(0.08, 0.05, 1.6, frameMat, 5.9, 2.5, 0);
const deskLamp = new THREE.SpotLight(0xffb84d, 60, 9, Math.PI / 4, 0.45, 1.2);
deskLamp.position.set(0, 2.7, 0); deskLamp.target.position.set(0, 0.95, 0); deskLamp.castShadow = true;
scene.add(deskLamp); scene.add(deskLamp.target);
cyl(0.12, 0.12, 0.04, brassMat, 0, 4.98, 0);
cyl(0.015, 0.015, 2.15, M(0x1f1f22, { metalness: 0.9, roughness: 0.3 }), 0, 3.88, 0, scene, 8);
const pendShade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.38, 0.22, 24, 1, true), M(0x1e5a32, { roughness: 0.35, side: THREE.DoubleSide }));
pendShade.position.set(0, 2.78, 0); scene.add(pendShade);
sphere(0.065, M(0xffdf99, { emissive: 0xffaa33, emissiveIntensity: 2.2 }), 0, 2.72, 0);
const stoneMat = M(0x4a3f3a, { roughness: 0.9 });
const fp = new THREE.Group();
box(0.9, 1.3, 0.32, stoneMat, 0, 0.65, -0.85, fp);
box(0.9, 1.3, 0.32, stoneMat, 0, 0.65, 0.85, fp);
box(0.9, 0.3, 2.0, stoneMat, 0, 1.45, 0, fp);
box(1.0, 0.08, 2.2, darkWoodMat, 0, 1.64, 0, fp);
box(0.3, 1.3, 1.4, M(0x0a0806), -0.3, 0.65, 0, fp);
box(0.92, 0.06, 1.4, stoneMat, 0, 0.03, 0, fp);
fp.position.set(-5.5, 0, 0); scene.add(fp);
addRawCol(-6, -4.95, -1.15, 1.15);
const hearth = new THREE.Group();
const grateMat = M(0x1f1f22, { metalness: 0.8, roughness: 0.5 });
const emberMat = M(0xff2200, { emissive: 0xff4400, emissiveIntensity: 2.4, roughness: 0.9 });
const flameMat = M(0xffaa00, { emissive: 0xff7700, emissiveIntensity: 3.0 });
for (let b = -0.45; b <= 0.15; b += 0.14) box(0.48, 0.04, 0.04, grateMat, 0, 0.1, b, hearth);
const log1 = cyl(0.06, 0.07, 0.58, emberMat, 0, 0.16, -0.25, hearth, 8); log1.rotation.z = Math.PI / 2;
const log2 = cyl(0.055, 0.065, 0.55, emberMat, 0, 0.2, -0.05, hearth, 8); log2.rotation.z = Math.PI / 2; log2.rotation.y = 0.25;
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 8), flameMat); flame.position.set(0.0, 0.42, -0.15); hearth.add(flame);
hearth.position.set(-5.55, 0, 0.15); scene.add(hearth);
const fireLight = new THREE.PointLight(0xff5511, 40, 9, 1.6);
fireLight.position.set(-5.0, 0.9, 0); scene.add(fireLight);
function makeBookshelf(x, z, w) {
  const g = new THREE.Group();
  box(w, 2.3, 0.04, darkWoodMat, 0, 1.15, -0.18, g);
  box(0.06, 2.3, 0.4, darkWoodMat, -w / 2, 1.15, 0, g); box(0.06, 2.3, 0.4, darkWoodMat, w / 2, 1.15, 0, g);
  for (let s = 0; s <= 5; s++) box(w, 0.04, 0.4, darkWoodMat, 0, 0.1 + s * 0.44, 0, g);
  const cols = [0x5a1a1a, 0x1a3a5a, 0x2a4a2a, 0x5a4a1a, 0x3a1a4a, 0x4a2a1a];
  for (let s = 0; s < 5; s++) {
    let px = -w / 2 + 0.12;
    while (px < w / 2 - 0.12) {
      const bw = 0.04 + Math.random() * 0.05, bh = 0.26 + Math.random() * 0.12;
      box(bw, bh, 0.26, M(cols[Math.floor(Math.random() * cols.length)], { roughness: 0.8 }), px + bw / 2, 0.12 + s * 0.44 + bh / 2, 0, g);
      px += bw + 0.012;
    }
  }
  g.position.set(x, 0, z); scene.add(g);
  addBoxCol(x, z, w + 0.1, 0.45);
}
makeBookshelf(-3.2, -5.78, 2.2); makeBookshelf(0, -5.78, 2.2); makeBookshelf(3.2, -5.78, 2.2);
const clueTable = new THREE.Group();
box(2.6, 0.12, 1.2, darkWoodMat, 0, 0.95, 0, clueTable).castShadow = true;
[[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]].forEach(p => box(0.1, 0.89, 0.1, darkWoodMat, p[0], 0.445, p[1], clueTable));
box(2.0, 0.005, 0.8, M(0x1c3a2a, { roughness: 0.95 }), 0, 1.012, 0, clueTable);
scene.add(clueTable);
addBoxCol(0, 0, 2.7, 1.3);
const mag = new THREE.Group();
const lens = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 24), brassMat); lens.rotation.x = Math.PI / 2; mag.add(lens);
const glass = new THREE.Mesh(new THREE.CircleGeometry(0.066, 20), M(0x88aacc, { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.6 })); glass.rotation.x = -Math.PI / 2; mag.add(glass);
const handle = cyl(0.009, 0.009, 0.13, darkWoodMat, 0.0, 0, 0.14, mag, 8); handle.rotation.x = Math.PI / 2;
mag.position.set(-0.3, 1.02, -0.3); mag.rotation.y = 0.5; scene.add(mag);
cyl(0.03, 0.03, 0.05, M(0x22262e, { roughness: 0.4 }), -0.95, 1.035, -0.35);
cyl(0.022, 0.022, 0.012, brassMat, -0.95, 1.066, -0.35);
[[-0.68, 0.36, '1'], [0.0, 0.42, '2'], [0.66, 0.36, '3']].forEach(m => {
  const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.05, 0.08, 3), M(0xe8d27a, { roughness: 0.6 }));
  tent.position.set(m[0], 1.05, m[1]); tent.rotation.y = 0.3; scene.add(tent);
});
const tableLamp = new THREE.Group();
const lampShadeMat = M(0x2f6b3c, { roughness: 0.35, side: THREE.DoubleSide });
cyl(0.11, 0.13, 0.025, brassMat, 0, 0.0125, 0, tableLamp, 24);
cyl(0.03, 0.06, 0.025, brassMat, 0, 0.0375, 0, tableLamp);
cyl(0.016, 0.016, 0.36, brassMat, 0, 0.23, 0, tableLamp, 12);
cyl(0.032, 0.025, 0.045, brassMat, 0, 0.43, 0, tableLamp, 14);
sphere(0.04, M(0xffe2a4, { emissive: 0xffaa33, emissiveIntensity: 2.2 }), 0, 0.49, 0, tableLamp);
const lShade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.23, 0.22, 24, 1, true), lampShadeMat); lShade.position.y = 0.51; tableLamp.add(lShade);
const tLampLight = new THREE.PointLight(0xffbe5c, 14, 6, 1.6); tLampLight.position.set(0, 0.55, 0); tableLamp.add(tLampLight);
tableLamp.position.set(1.15, 1.01, -0.42); scene.add(tableLamp);
const desk = new THREE.Group();
box(1.7, 0.1, 0.8, darkWoodMat, 0, 0.95, 0, desk);
[[-0.75, -0.33], [0.75, -0.33], [-0.75, 0.33], [0.75, 0.33]].forEach(p => box(0.08, 0.9, 0.08, darkWoodMat, p[0], 0.45, p[1], desk));
cyl(0.045, 0.035, 0.07, M(0xeeeae0, { roughness: 0.3 }), -0.55, 1.035, 0.05, desk);
const cupHandle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), M(0xeeeae0)); cupHandle.position.set(-0.505, 1.035, 0.05); desk.add(cupHandle);
cyl(0.038, 0.038, 0.004, M(0x2b1808), -0.55, 1.067, 0.05, desk);
box(0.28, 0.03, 0.2, M(0x5a2a16, { roughness: 0.6 }), -0.1, 1.015, 0.1, desk);
box(0.26, 0.025, 0.18, M(0xe6dcc0), -0.09, 1.017, 0.1, desk);
cyl(0.035, 0.04, 0.05, M(0x111118, { roughness: 0.2, metalness: 0.4 }), 0.35, 1.025, 0.15, desk);
const quill = cyl(0.004, 0.002, 0.26, M(0xf2ecdd), 0.40, 1.12, 0.15, desk, 6); quill.rotation.z = -0.5;
box(0.14, 0.12, 0.05, brassMat, 0.62, 1.06, -0.2, desk);
const clockFace = cyl(0.045, 0.045, 0.01, M(0xf3e9cf), 0.62, 1.065, -0.172, desk); clockFace.rotation.x = Math.PI / 2;
desk.position.set(3.6, 0, -4.4); scene.add(desk);
addBoxCol(3.6, -4.4, 1.8, 0.9);
const leather = M(0x3a1c14, { roughness: 0.55 });
function makeArmchair(x, z, rotY, mat) {
  const g = new THREE.Group();
  box(0.85, 0.3, 0.85, mat, 0, 0.35, 0, g); box(0.85, 0.75, 0.2, mat, 0, 0.75, -0.33, g);
  box(0.16, 0.45, 0.85, mat, -0.36, 0.55, 0, g); box(0.16, 0.45, 0.85, mat, 0.36, 0.55, 0, g);
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
}
makeArmchair(-3.9, 0, Math.PI / 2 * -1, leather); addBoxCol(-3.9, 0, 1.0, 1.0);
makeArmchair(3.6, -3.3, Math.PI, leather);
const mirrorG = new THREE.Group();
box(0.95, 1.95, 0.06, M(0x6b5320, { metalness: 0.7, roughness: 0.3 }), 0, 1.1, 0, mirrorG);
const mirrorPane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.8), M(0x9fb4d0, { metalness: 1.0, roughness: 0.05 })); mirrorPane.position.set(0, 1.1, 0.035); mirrorG.add(mirrorPane);
box(0.05, 0.6, 0.05, darkWoodMat, -0.3, 0.3, -0.25, mirrorG).rotation.z = 0.25; box(0.05, 0.6, 0.05, darkWoodMat, 0.3, 0.3, -0.25, mirrorG);
mirrorG.position.set(5.2, 0, 4.2); mirrorG.rotation.y = -Math.PI / 2 + 0.3; scene.add(mirrorG);
addBoxCol(5.2, 4.2, 0.7, 1.1);
const parlourLight = new THREE.PointLight(0xffdf99, 50, 16, 1.5);
parlourLight.position.set(0, 3.4, 13); scene.add(parlourLight);
const chand = new THREE.Group();
const chBrass = M(0x9b781a, { metalness: 0.85, roughness: 0.25 });
const flameGlow = M(0xffecc4, { emissive: 0xffcc77, emissiveIntensity: 2.4 });
cyl(0.35, 0.35, 0.04, chBrass, 0, 4.98, 0, chand, 24);
cyl(0.022, 0.022, 1.15, chBrass, 0, 4.38, 0, chand, 8);
cyl(0.18, 0.24, 0.26, chBrass, 0, 3.68, 0, chand);
sphere(0.06, chBrass, 0, 3.5, 0, chand);
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2, arm = new THREE.Group();
  const bar = cyl(0.014, 0.014, 0.62, chBrass, 0.5, 0, 0, arm, 8); bar.rotation.z = Math.PI / 2;
  cyl(0.065, 0.035, 0.025, chBrass, 0.8, 0.03, 0, arm, 12);
  cyl(0.018, 0.018, 0.09, M(0xefebd9), 0.8, 0.09, 0, arm, 10);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 10), flameGlow); fl.position.set(0.8, 0.17, 0); arm.add(fl);
  arm.rotation.y = -a; arm.position.set(0, 3.70, 0); chand.add(arm);
}
chand.position.set(0, 0, 13); scene.add(chand);
const fabricA = M(0x5a1c2a, { roughness: 0.9 }), fabricB = M(0x1f3a4a, { roughness: 0.9 });
function makeSofa(x, z, rotY, w, mat) {
  const g = new THREE.Group();
  box(w, 0.35, 0.9, mat, 0, 0.3, 0, g); box(w, 0.7, 0.22, mat, 0, 0.7, -0.35, g);
  box(0.22, 0.55, 0.9, mat, -w / 2 + 0.11, 0.5, 0, g); box(0.22, 0.55, 0.9, mat, w / 2 - 0.11, 0.5, 0, g);
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
}
makeSofa(0, 16.6, Math.PI, 2.4, fabricA); addBoxCol(0, 16.6, 2.5, 1.0);
makeSofa(0, 9.4, 0, 2.4, fabricA); addBoxCol(0, 9.4, 2.5, 1.0);
makeArmchair(-3.6, 13, Math.PI / 2, fabricB); addBoxCol(-3.6, 13, 1.0, 1.0);
makeArmchair(3.6, 13, -Math.PI / 2, fabricB); addBoxCol(3.6, 13, 1.0, 1.0);
cyl(0.8, 0.8, 0.06, darkWoodMat, 0, 0.5, 13, scene, 28); cyl(0.12, 0.2, 0.47, darkWoodMat, 0, 0.26, 13, scene, 12);
cyl(0.22, 0.22, 0.02, brassMat, 0, 0.545, 13, scene, 20);
addCircleCol(0, 13, 0.85);
box(0.6, 1.0, 1.6, darkWoodMat, -6.6, 0.5, 17); box(0.64, 0.06, 1.7, trimWoodMat, -6.6, 1.03, 17); addBoxCol(-6.6, 17, 0.7, 1.7);
box(0.5, 1.0, 1.4, darkWoodMat, 6.65, 0.5, 9.8); addBoxCol(6.65, 9.8, 0.6, 1.5);
const PORTRAIT_FRAMES = [];
function addFrame(x, y, z, rotY, w, h, color) {
  const g = new THREE.Group();
  box(w + 0.1, h + 0.1, 0.05, brassMat, 0, 0, 0, g);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M(color, { roughness: 0.9 })); p.position.z = 0.03; g.add(p);
  g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g); PORTRAIT_FRAMES.push({ p, w, h });
}
addFrame(-6.94, 2.6, 13, Math.PI / 2, 1.3, 0.9, 0x3a4a6a); addFrame(6.94, 2.6, 13, -Math.PI / 2, 1.0, 1.3, 0x6a3a3a);
addFrame(0, 2.8, 19.94, Math.PI, 2.0, 1.2, 0x4a5a3a); addFrame(-4, 2.6, 5.92, Math.PI, 0.9, 1.2, 0x5a4a3a);
// LEVEL1_PATCH_V1 :: famous fictional detective portraits for the wall frames
const DETECTIVE_PORTRAITS = [
  { name: 'SHERLOCK HOLMES',  hat: 'deerstalker', prop: 'pipe',     coat: '#4b3d2c', hair: '#2a1d14', skin: '#e2bd9c', hatCol: '#7a6643', tie: '#3b4a2a', hawk: true,  bg: ['#2b3a4a', '#10161d'] },
  { name: 'C. AUGUSTE DUPIN', hat: 'tophat',      prop: 'monocle',  coat: '#1d1d28', hair: '#15110f', skin: '#dfb894', hatCol: '#16161c', tie: '#6a1f2a', stache: true, bg: ['#41293b', '#150d14'] },
  { name: 'FATHER BROWN',     hat: 'round',       prop: 'umbrella', coat: '#1f1d1c', hair: '#3a2a1f', skin: '#e6c3a3', hatCol: '#171514', clerical: true, rosy: true, bg: ['#2f4034', '#0e1511'] },
  { name: 'SERGEANT CUFF',    hat: 'bowler',      prop: 'rose',     coat: '#3b3131', hair: '#a9a9a2', skin: '#d9b08c', hatCol: '#25201e', tie: '#2f3f5a', chops: true, bg: ['#4a3a24', '#17110a'] }
];

function drawDetectivePortrait(ctx, W, H, S) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, S.bg[0]); bg.addColorStop(1, S.bg[1]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.36, 4, W / 2, H * 0.36, Math.max(W, H) * 0.62);
  glow.addColorStop(0, 'rgba(255,222,160,0.32)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  const plaqueH = H * 0.14, areaH = H - plaqueH;
  const s = Math.min(W / 100, areaH / 132);
  ctx.save();
  ctx.translate(W / 2, areaH / 2 + 2 * s);
  ctx.scale(s, s);
  const fill = (c) => { ctx.fillStyle = c; };

  // coat / shoulders
  fill(S.coat);
  ctx.beginPath(); ctx.moveTo(-48, 72); ctx.lineTo(-45, 36); ctx.quadraticCurveTo(-40, 21, -12, 17);
  ctx.lineTo(12, 17); ctx.quadraticCurveTo(40, 21, 45, 36); ctx.lineTo(48, 72); ctx.closePath(); ctx.fill();
  // neck
  fill(S.skin); ctx.fillRect(-6, 4, 12, 16);
  if (S.clerical) {
    fill('#0d0d0d'); ctx.fillRect(-11, 15, 22, 10);
    fill('#f2efe6'); ctx.fillRect(-4.5, 16, 9, 5);
  } else {
    fill('#e9e3d1'); ctx.beginPath(); ctx.moveTo(-11, 17); ctx.lineTo(0, 42); ctx.lineTo(11, 17); ctx.lineTo(5, 11); ctx.lineTo(-5, 11); ctx.closePath(); ctx.fill();
    fill(S.tie || '#7a1c1c'); ctx.beginPath(); ctx.moveTo(-3, 19); ctx.lineTo(3, 19); ctx.lineTo(4.5, 37); ctx.lineTo(0, 43); ctx.lineTo(-4.5, 37); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-12, 17); ctx.lineTo(-7, 52); ctx.moveTo(12, 17); ctx.lineTo(7, 52); ctx.stroke();
  }

  // hair behind head, ears, face
  fill(S.hair); ctx.beginPath(); ctx.ellipse(0, -14, 17, 21, 0, 0, Math.PI * 2); ctx.fill();
  fill(S.skin); [-1, 1].forEach(k => { ctx.beginPath(); ctx.ellipse(k * 15.5, -8, 3, 5, 0, 0, Math.PI * 2); ctx.fill(); });
  ctx.beginPath(); ctx.ellipse(0, -9, 14.5, 18.5, 0, 0, Math.PI * 2); ctx.fill();
  if (S.rosy) { fill('rgba(205,95,85,0.38)'); [-8, 8].forEach(x => { ctx.beginPath(); ctx.arc(x, -1, 4.6, 0, Math.PI * 2); ctx.fill(); }); }
  if (S.chops) { fill(S.hair); [-1, 1].forEach(k => { ctx.beginPath(); ctx.ellipse(k * 12.6, -3, 3.4, 9, k * 0.1, 0, Math.PI * 2); ctx.fill(); }); }
  // eyes, brows, nose, mouth
  fill('#f4efe4'); [-6, 6].forEach(x => { ctx.beginPath(); ctx.ellipse(x, -12, 3.3, 2.1, 0, 0, Math.PI * 2); ctx.fill(); });
  fill('#2a2018'); [-6, 6].forEach(x => { ctx.beginPath(); ctx.arc(x, -12, 1.4, 0, Math.PI * 2); ctx.fill(); });
  ctx.strokeStyle = S.hair; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9.5, -17.5); ctx.lineTo(-2.5, -16.4); ctx.moveTo(9.5, -17.5); ctx.lineTo(2.5, -16.4); ctx.stroke();
  ctx.strokeStyle = 'rgba(110,62,44,0.75)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(S.hawk ? 2.6 : 1.6, S.hawk ? -1 : -3); ctx.lineTo(-1.2, S.hawk ? -0.4 : -2.4); ctx.stroke();
  if (S.stache) { fill(S.hair); [-1, 1].forEach(k => { ctx.beginPath(); ctx.ellipse(k * 4.6, 1.3, 5, 1.9, k * 0.28, 0, Math.PI * 2); ctx.fill(); }); }
  ctx.strokeStyle = '#7a3b32'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-4, 5); ctx.lineTo(4, 5); ctx.stroke();

  // hats
  const hc = S.hatCol;
  if (S.hat === 'deerstalker') {
    fill(hc); ctx.beginPath(); ctx.ellipse(0, -26, 18, 15, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    fill('rgba(0,0,0,0.28)'); ctx.beginPath(); ctx.moveTo(-9, -25); ctx.lineTo(9, -25); ctx.lineTo(12, -19); ctx.lineTo(-12, -19); ctx.closePath(); ctx.fill();
    fill(hc); ctx.fillRect(-19, -27, 5, 13); ctx.fillRect(14, -27, 5, 13);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -41); ctx.lineTo(0, -26); ctx.moveTo(-9, -39); ctx.lineTo(-9, -26); ctx.moveTo(9, -39); ctx.lineTo(9, -26); ctx.stroke();
    fill('rgba(0,0,0,0.5)'); ctx.beginPath(); ctx.arc(0, -41, 2, 0, Math.PI * 2); ctx.fill();
  } else if (S.hat === 'tophat') {
    fill(hc); ctx.fillRect(-14, -62, 28, 38); ctx.beginPath(); ctx.ellipse(0, -24, 25, 5, 0, 0, Math.PI * 2); ctx.fill();
    fill('#2a2a33'); ctx.beginPath(); ctx.ellipse(0, -62, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
    fill('#6a1f2a'); ctx.fillRect(-14, -32, 28, 6);
    fill('rgba(255,255,255,0.08)'); ctx.fillRect(-10, -60, 4, 34);
  } else if (S.hat === 'round') {
    fill(hc); ctx.beginPath(); ctx.ellipse(0, -26, 14, 15, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-14, -34, 28, 9);
    ctx.beginPath(); ctx.ellipse(0, -25, 29, 6, 0, 0, Math.PI * 2); ctx.fill();
    fill('rgba(255,255,255,0.07)'); ctx.beginPath(); ctx.ellipse(-4, -34, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  } else if (S.hat === 'bowler') {
    fill(hc); ctx.beginPath(); ctx.ellipse(0, -26, 17, 17, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -25, 23, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    fill('#0d0b0a'); ctx.fillRect(-17, -31, 34, 5);
  }

  // props
  if (S.prop === 'pipe') {
    ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(3, 5); ctx.quadraticCurveTo(15, 9, 23, 3); ctx.stroke();
    fill('#4d2e18'); ctx.beginPath(); ctx.ellipse(25, -1, 4.4, 5.6, 0.2, 0, Math.PI * 2); ctx.fill();
    fill('#f08a2a'); ctx.beginPath(); ctx.arc(25, -5, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(225,225,225,0.28)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(25, -8); ctx.bezierCurveTo(19, -14, 31, -18, 25, -26); ctx.stroke();
  } else if (S.prop === 'monocle') {
    ctx.strokeStyle = '#d7b24a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(6, -12, 5.2, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(11, -11); ctx.quadraticCurveTo(26, 4, 30, 30); ctx.stroke();
  } else if (S.prop === 'umbrella') {
    ctx.strokeStyle = '#2a1a0f'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(39, 72); ctx.lineTo(39, 36); ctx.arc(35, 36, 4, 0, Math.PI, true); ctx.stroke();
  } else if (S.prop === 'rose') {
    ctx.strokeStyle = '#2f6a35'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-17, 41); ctx.lineTo(-16, 33); ctx.stroke();
    fill('#b3202c'); ctx.beginPath(); ctx.arc(-16, 31, 3.2, 0, Math.PI * 2); ctx.fill();
    fill('#7d1119'); ctx.beginPath(); ctx.arc(-15.4, 30.6, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // brass nameplate
  const px = W * 0.1, pw = W * 0.8, py = H - plaqueH * 0.88, ph = plaqueH * 0.68;
  ctx.fillStyle = '#17100a'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = Math.max(1.5, H * 0.006); ctx.strokeRect(px, py, pw, ph);
  ctx.fillStyle = '#f0cf6a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = ph * 0.52; ctx.font = 'bold ' + fs + 'px Georgia, serif';
  while (ctx.measureText(S.name).width > pw * 0.92 && fs > 6) { fs -= 1; ctx.font = 'bold ' + fs + 'px Georgia, serif'; }
  ctx.fillText(S.name, W / 2, py + ph / 2 + 1);
}

function makePortraitTexture(spec, w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * 300); cv.height = Math.round(h * 300);
  drawDetectivePortrait(cv.getContext('2d'), cv.width, cv.height, spec);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
(function applyDetectivePortraits() {
  const order = [1, 2, 3, 0]; // 4th frame (the study one) gets Sherlock Holmes
  PORTRAIT_FRAMES.forEach((f, i) => {
    const spec = DETECTIVE_PORTRAITS[order[i % order.length]];
    const tex = makePortraitTexture(spec, f.w, f.h);
    f.p.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 });
  });
})();

const MOTES = 320, moteArr = new Float32Array(MOTES * 3), motePh = new Float32Array(MOTES);
for (let i = 0; i < MOTES; i++) {
  const inStudy = Math.random() < 0.45;
  moteArr[i * 3] = (Math.random() - 0.5) * (inStudy ? 11 : 13);
  moteArr[i * 3 + 1] = 0.4 + Math.random() * 4;
  moteArr[i * 3 + 2] = inStudy ? (Math.random() - 0.5) * 11 : 6.5 + Math.random() * 13;
  motePh[i] = Math.random() * Math.PI * 2;
}
const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(moteArr, 3));
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xffe2a8, size: 0.018, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false }));
scene.add(motes);
const interactables = [], clueRings = {};
function makeClue(id, tex, size, x, z, rotY, isRound) {
  const geo = isRound ? new THREE.CircleGeometry(size / 2, 32) : new THREE.PlaneGeometry(size, size);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = rotY; m.position.set(x, 1.015, z); scene.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.62, size * 0.68, 40), new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, 1.02, z); scene.add(ring); clueRings[id] = ring;
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(x, 1.1, z); hit.userData = { interact: true, type: 'clue', id }; scene.add(hit); interactables.push(hit);
}
makeClue('watch', watchTex, 0.26, -0.45, 0.12, 0.2, true);
makeClue('letter', letterTex, 0.35, 0.72, -0.30, -0.35, false);
makeClue('photo', photoTex, 0.30, -0.72, 0.28, 0.45, false);
function makeLabel(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(10,12,18,0.78)'; x.fillRect(0, 8, 256, 48);
  x.strokeStyle = '#d4af37'; x.lineWidth = 2; x.strokeRect(1, 9, 254, 46);
  x.fillStyle = '#ffd700'; x.font = 'bold 24px sans-serif'; x.textAlign = 'center'; x.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.9, 0.225, 1); return s;
}
const npcs = [];
function makeNPC(id, x, z, rotY, o) {
  const g = new THREE.Group();
  const cloth = M(o.cloth, { roughness: 0.75 }), lower = M(o.lower, { roughness: 0.8 }), skin = M(o.skin, { roughness: 0.6 }), hair = M(o.hair, { roughness: 0.9 });
  const legs = cyl(o.dress ? 0.28 : 0.15, o.dress ? 0.2 : 0.2, 0.86, lower, 0, 0.43, 0, g, 16);
  const torso = cyl(0.19, 0.22, 0.6, cloth, 0, 1.16, 0, g, 16);
  const head = sphere(0.13, skin, 0, 1.6, 0, g);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); hairCap.position.set(0, 1.62, -0.01); g.add(hairCap);
  if (o.longHair) box(0.25, 0.3, 0.08, hair, 0, 1.48, -0.1, g);
  [-0.27, 0.27].forEach(s => { const a = cyl(0.045, 0.04, 0.55, cloth, s, 1.12, 0, g, 10); a.rotation.z = s > 0 ? -0.08 : 0.08; sphere(0.045, skin, s * 1.05, 0.83, 0, g); });
  [-0.05, 0.05].forEach(s => sphere(0.014, M(0x111111), s, 1.62, 0.12, g));
  const label = makeLabel(o.label); label.position.set(0, 2.05, 0); g.add(label);
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.9, 10), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(x, 0.95, z); hit.userData = { interact: true, type: 'suspect', id }; scene.add(hit); interactables.push(hit);
  const col = addCircleCol(x, z, o.r);
  npcs.push({ id, group: g, torso, phase: Math.random() * 6, x, z, hit, col });
}
makeNPC('assistant', -3.0, 9.0, Math.PI, { cloth: 0x1e3a5f, lower: 0x0f1d2e, skin: 0xd8b293, hair: 0x333333, dress: false, label: 'ASSISTANT', r: 0.42 });
makeNPC('eleanor', -2.0, 11.2, 0, { cloth: 0x6b1e3a, lower: 0x4a1428, skin: 0xd9b59a, hair: 0x2a1a12, dress: true, longHair: true, label: 'Eleanor Blackwood', r: 0.42 });
makeNPC('daniel', 3.0, 11.2, 0, { cloth: 0x2f3b52, lower: 0x1d2433, skin: 0xd2a98a, hair: 0x5a3a1a, label: 'Daniel Blackwood', r: 0.44 });
makeNPC('victor', 1.8, 14.9, Math.PI, { cloth: 0x1c1c22, lower: 0x121216, skin: 0xd6b090, hair: 0x888888, label: 'Victor Hale', r: 0.45 });
makeNPC('clara', -2.6, 15.0, Math.PI, { cloth: 0x2a2f2a, lower: 0x1f221f, skin: 0xdcbda2, hair: 0xb8b8b8, dress: true, label: 'Clara Morgan', r: 0.42 });
const PLAYER_R = 0.38;
function resolveCollisions(p, r) {
  for (let it = 0; it < 3; it++) {
    for (const c of colliders) {
      if (c.r !== undefined) {
        let dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
        const min = c.r + r;
        if (d < min) { if (d < 1e-5) { dx = 1; dz = 0; d = 1; } p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
      } else {
        const nx = Math.max(c.minX, Math.min(p.x, c.maxX)), nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = nx + dx / d * r; p.z = nz + dz / d * r; }
          else {
            const l = p.x - c.minX, rr = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z, m = Math.min(l, rr, t, b);
            if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === t) p.z = c.minZ - r; else p.z = c.maxZ + r;
          }
        }
      }
    }
  }
}
const controls = new PointerLockControls(camera, document.body);
const keys = {};
const velv = new THREE.Vector3(), fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), wish = new THREE.Vector3();
let stepTimer = 0, bobT = 0;
function movePlayer(dt) {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  camera.getWorldDirection(fwd); fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  fwd.normalize(); rgt.set(-fwd.z, 0, fwd.x);
  wish.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(rgt, s);
  const moving = wish.lengthSq() > 0;
  if (moving) wish.normalize().multiplyScalar(keys.ShiftLeft || keys.ShiftRight ? 5.0 : 3.3);
  velv.lerp(wish, 1 - Math.exp(-dt * (moving ? 9 : 7)));
  const p = { x: camera.position.x + velv.x * dt, z: camera.position.z + velv.z * dt };
  resolveCollisions(p, PLAYER_R);
  camera.position.x = p.x; camera.position.z = p.z;
  const spd = velv.length();
  if (spd > 0.4) { bobT += dt * spd * 2.6; stepTimer += dt; if (stepTimer > 0.5 * 3.3 / Math.max(spd, 1.5)) { stepTimer = 0; audio.playFootstep(); } }
  camera.position.y = 1.65 + Math.sin(bobT) * 0.022 * Math.min(1, spd / 3);
}
const ray = new THREE.Raycaster(); ray.far = 3.6;
const rayTargets = interactables.concat(occluders);
const screenCenter = new THREE.Vector2(0, 0);
const anyUiOpen = () => isInspecting || isInterrogating || isNotebookOpen || isDeducing || outcomeOpen;
function updateInteraction() {
  activeTarget = null;
  if (controls.isLocked && !anyUiOpen()) {
    ray.setFromCamera(screenCenter, camera);
    const hits = ray.intersectObjects(rayTargets, false);
    if (hits.length && hits[0].object.userData.interact) activeTarget = hits[0].object.userData;
  }
  if (activeTarget) {
    const t = i18n[currentLang];
    if (activeTarget.type === 'clue') { promptActionEl.textContent = t.inspectAction; promptTargetEl.textContent = CLUES[activeTarget.id][currentLang].title; }
    else { const s = SUSPECTS[activeTarget.id]; promptActionEl.textContent = t.talkAction; promptTargetEl.textContent = currentLang === 'hi' ? s.nameHi : s.nameEn; }
    promptEl.style.display = 'flex'; reticleEl.classList.add('active');
  } else { promptEl.style.display = 'none'; reticleEl.classList.remove('active'); }
}
function showProximity(s) {
  const line = currentLang === 'hi' ? s.proxHi : s.proxEn;
  bubbleSpeaker.textContent = currentLang === 'hi' ? s.nameHi : s.nameEn;
  bubbleText.textContent = ' "' + line + '"';
  proximityBubble.classList.remove('hidden');
  voiceEngine.speakAs(s.id, line);
  clearTimeout(proximityTimer);
  proximityTimer = setTimeout(() => proximityBubble.classList.add('hidden'), 6500);
}
function hideProximity() { clearTimeout(proximityTimer); proximityBubble.classList.add('hidden'); }
function hideBlocker() { blocker.classList.add('hidden'); }
function showPause() {
  if (!gameStarted || anyUiOpen()) return;
  blocker.classList.remove('hidden'); instructionsMenu.classList.add('hidden'); pauseMenu.classList.remove('hidden');
}
function resumeControl() {
  hideBlocker();
  try { controls.lock(); } catch (e) { showPause(); }
}
controls.addEventListener('lock', () => { hideBlocker(); });
controls.addEventListener('unlock', () => { if (gameStarted && !anyUiOpen()) showPause(); });
document.addEventListener('pointerlockerror', () => { if (gameStarted && !anyUiOpen()) showPause(); });
const releasePointer = () => { if (controls.isLocked) controls.unlock(); };
startBtn.addEventListener('click', () => {
  audio.init(); gameStarted = true;
  hudDetectiveName.textContent = getName();
  instructionsMenu.classList.add('hidden');
  updateLanguageUI(); resumeControl();
  startAssistantWalk();
});
resumeBtn.addEventListener('click', resumeControl);
pauseDeduceBtn.addEventListener('click', () => openDeduction());
pauseNotebookBtn.addEventListener('click', () => openNotebook());
container.addEventListener('click', () => { if (gameStarted && !anyUiOpen() && !controls.isLocked) resumeControl(); });
function openInspection(id) {
  const clue = CLUES[id], d = clue[currentLang];
  isInspecting = true; hideProximity(); promptEl.style.display = 'none';
  if (!collectedClues.includes(id)) {
    collectedClues.push(id); cluesDiscovered++; score += 100; audio.playInspectSound();
    if (clueRings[id]) clueRings[id].material.opacity = 0.25;
    updateHUD();
  }
  dossierTitleEl.textContent = d.title; dossierLocEl.textContent = d.loc; dossierDescEl.textContent = d.desc; dossierNoteEl.textContent = d.note;
  dossierImgEl.classList.remove('hidden'); dossierImgEl.src = clue.img;
  modalEl.classList.remove('hidden'); hideBlocker(); releasePointer();
}
function closeInspection() { isInspecting = false; modalEl.classList.add('hidden'); resumeControl(); }
closeModalBtn.addEventListener('click', closeInspection);
function beginSeq() {
  seqId++; voiceEngine.stop();
  if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
  isTyping = false; currentTypeFinish = null;
  return seqId;
}
function typewriterWithVoice(text, charId, onComplete, id) {
  fullCurrentSpeech = ' "' + text + '"';
  dialogueSpeechEl.textContent = '';
  typingCursor.classList.remove('hidden'); isTyping = true; speakingPulse.classList.remove('hidden');
  const active = voiceEngine.active;
  let voiceDone = !active, typingDone = false, done = false, idx = 0;
  const tryFinish = () => {
    if (done || id !== seqId) return;
    if (voiceDone && typingDone) { done = true; speakingPulse.classList.add('hidden'); if (onComplete) onComplete(); }
  };
  if (active) {
    voiceEngine.speakAs(charId, text, () => { voiceDone = true; tryFinish(); });
    setTimeout(() => { voiceDone = true; tryFinish(); }, text.length * (currentLang === 'hi' ? 130 : 100) + 3500);
  } else voiceEngine.stop();
  if (typewriterTimer) clearInterval(typewriterTimer);
  const finishTyping = () => {
    if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
    dialogueSpeechEl.textContent = fullCurrentSpeech; isTyping = false; typingCursor.classList.add('hidden'); typingDone = true;
    if (active) tryFinish(); else setTimeout(tryFinish, 900);
  };
  currentTypeFinish = finishTyping;
  typewriterTimer = setInterval(() => {
    if (id !== seqId) { clearInterval(typewriterTimer); typewriterTimer = null; return; }
    if (idx < fullCurrentSpeech.length) { dialogueSpeechEl.textContent += fullCurrentSpeech[idx]; idx++; }
    else finishTyping();
  }, 25);
}
transcriptBox.addEventListener('click', () => { if (isTyping && currentTypeFinish) currentTypeFinish(); });
function suspectLabel(s) { return (currentLang === 'hi' ? s.nameHi : s.nameEn) + ' [' + (currentLang === 'hi' ? s.roleHi : s.roleEn) + ']'; }
function detectiveLabel() { return getName() + ' [' + i18n[currentLang].detTag + ']'; }
function playSuspectIntro(s, id) {
  isIntroPlaying = true;
  introControlsBar.classList.remove('hidden'); interrogationOptionsGroup.classList.add('hidden');
  contradictionBanner.classList.add('hidden'); evidenceSelector.classList.add('hidden');
  const t = i18n[currentLang];
  dialogueTurnSpeaker.textContent = detectiveLabel(); speakingText.textContent = getName() + '...';
  typewriterWithVoice(t.detIntro(getName()), 'detective', () => {
    setTimeout(() => {
      if (id !== seqId) return;
      dialogueTurnSpeaker.textContent = suspectLabel(s); speakingText.textContent = (currentLang === 'hi' ? s.nameHi : s.nameEn) + '...';
      typewriterWithVoice(currentLang === 'hi' ? s.introHi : s.introEn, s.id, () => {
        setTimeout(() => { if (id === seqId) finishSuspectIntro(s); }, 500);
      }, id);
    }, 400);
  }, id);
}
function finishSuspectIntro(s) {
  isIntroPlaying = false; introDone[s.id] = true;
  introControlsBar.classList.add('hidden'); interrogationOptionsGroup.classList.remove('hidden'); speakingPulse.classList.add('hidden');
  dialogueTurnSpeaker.textContent = currentLang === 'hi' ? s.nameHi : s.nameEn;
  dialogueSpeechEl.textContent = ' "' + i18n[currentLang].readyPrompt + '"'; typingCursor.classList.add('hidden');
}
function skipSuspectIntro() { if (!isIntroPlaying || !currentSuspect) return; beginSeq(); finishSuspectIntro(currentSuspect); }
skipIntroBtn.addEventListener('click', skipSuspectIntro);
function runTwoWayDialogue(detLine, suspLine, s, onSuspectStart) {
  const id = beginSeq();
  contradictionBanner.classList.add('hidden');
  dialogueTurnSpeaker.textContent = detectiveLabel(); speakingText.textContent = getName() + '...';
  typewriterWithVoice(detLine, 'detective', () => {
    setTimeout(() => {
      if (id !== seqId) return;
      dialogueTurnSpeaker.textContent = suspectLabel(s); speakingText.textContent = (currentLang === 'hi' ? s.nameHi : s.nameEn) + '...';
      if (onSuspectStart) onSuspectStart();
      typewriterWithVoice(suspLine, s.id, () => {}, id);
    }, 350);
  }, id);
}
function openDialogue(s, withIntro = true) {
  currentSuspect = s; isInterrogating = true; hideProximity(); promptEl.style.display = 'none';
  suspectAvatarEl.textContent = s.emoji;
  suspectNameEl.textContent = currentLang === 'hi' ? s.nameHi : s.nameEn; suspectRoleEl.textContent = currentLang === 'hi' ? s.roleHi : s.roleEn;
  dialogueModal.classList.remove('hidden'); hideBlocker(); releasePointer();
  contradictionBanner.classList.add('hidden'); evidenceSelector.classList.add('hidden');
  if (s.id === 'assistant') {
    assistantStep = 0;
    choiceMotive.style.display = 'none';
    choiceConfront.style.display = 'none';
    choiceAlibi.style.display = 'flex';
    const briefing = ASSISTANT_BRIEFINGS[currentLang];
    textChoiceAlibi.textContent = currentLang === 'hi' ? 'अगला भाग सुनें...' : 'Listen to next briefing part...';
    const id = beginSeq();
    dialogueTurnSpeaker.textContent = suspectLabel(s);
    typewriterWithVoice(briefing[0], 'assistant', () => {}, id);
    return;
  } else {
    choiceMotive.style.display = 'flex';
    choiceConfront.style.display = 'flex';
  }
  const id = beginSeq();
  if (withIntro && !introDone[s.id]) playSuspectIntro(s, id);
  else finishSuspectIntro(s);
}
function closeDialogue() {
  beginSeq(); isInterrogating = false; isIntroPlaying = false; currentSuspect = null;
  speakingPulse.classList.add('hidden'); dialogueModal.classList.add('hidden'); resumeControl();
}
leaveDialogueBtn.addEventListener('click', closeDialogue);
choiceAlibi.addEventListener('click', () => {
  if (isIntroPlaying || !currentSuspect) return;
  const s = currentSuspect;
  if (s.id === 'assistant') {
    assistantStep++;
    const briefing = ASSISTANT_BRIEFINGS[currentLang];
    if (assistantStep < briefing.length) {
      const id = beginSeq();
      dialogueTurnSpeaker.textContent = suspectLabel(s);
      typewriterWithVoice(briefing[assistantStep], 'assistant', () => {}, id);
      if (assistantStep === briefing.length - 1) {
        textChoiceAlibi.textContent = currentLang === 'hi' ? 'ब्रीफिंग समाप्त करें और जाँच शुरू करें' : 'End Briefing & Begin Investigation';
      }
    } else {
      closeDialogue();
    }
    return;
  }
  runTwoWayDialogue(i18n[currentLang].alibiBtnLabel, currentLang === 'hi' ? s.alibiHi : s.alibiEn, s);
});
choiceMotive.addEventListener('click', () => {
  if (isIntroPlaying || !currentSuspect) return; const s = currentSuspect;
  runTwoWayDialogue(i18n[currentLang].motiveBtnLabel, currentLang === 'hi' ? s.motiveHi : s.motiveEn, s);
});
choiceConfront.addEventListener('click', () => {
  if (isIntroPlaying || !currentSuspect) return;
  const t = i18n[currentLang];
  if (!collectedClues.length) { beginSeq(); dialogueTurnSpeaker.textContent = currentLang === 'hi' ? currentSuspect.nameHi : currentSuspect.nameEn; dialogueSpeechEl.textContent = ' "' + t.noEvidence + '"'; return; }
  chipsContainer.innerHTML = '';
  collectedClues.forEach(cid => {
    const b = document.createElement('button'); b.className = 'evidence-chip'; b.textContent = CLUES[cid][currentLang].title;
    b.addEventListener('click', () => { evidenceSelector.classList.add('hidden'); interrogationOptionsGroup.classList.remove('hidden'); doConfront(currentSuspect, cid); });
    chipsContainer.appendChild(b);
  });
  interrogationOptionsGroup.classList.add('hidden'); evidenceSelector.classList.remove('hidden');
});
cancelConfrontBtn.addEventListener('click', () => { evidenceSelector.classList.add('hidden'); interrogationOptionsGroup.classList.remove('hidden'); });
function doConfront(s, clueId) {
  const t = i18n[currentLang], hi = currentLang === 'hi';
  if (!s.contradiction) {
    runTwoWayDialogue(t.genericConfront, hi ? s.neutralHi : s.neutralEn, s); return;
  }
  if (s.contradiction !== clueId) { runTwoWayDialogue(t.wrongClaimDetective, t.wrongClaimSuspect, s); return; }
  if (exposed[s.id]) { runTwoWayDialogue(hi ? s.confDetHi : s.confDetEn, t.alreadyExposed, s); return; }
  runTwoWayDialogue(hi ? s.confDetHi : s.confDetEn, hi ? s.confessHi : s.confessEn, s, () => {
    exposed[s.id] = true; contradictionsFound++; score += 150; audio.playContradictionSound();
    contradictionBanner.classList.remove('hidden'); updateHUD();
  });
}
function renderNotebook() {
  const t = i18n[currentLang]; notebookList.innerHTML = '';
  if (!collectedClues.length) { const p = document.createElement('p'); p.style.color = '#8c92a4'; p.textContent = t.notebookEmpty; notebookList.appendChild(p); }
  collectedClues.forEach(id => {
    const c = CLUES[id], d = c[currentLang], card = document.createElement('div'); card.className = 'clue-entry-card';
    card.innerHTML = '<img class="notebook-clue-img" src="' + c.img + '" alt=""><div class="clue-entry-content"><h4></h4><p></p><span class="note"></span></div>';
    card.querySelector('h4').textContent = d.title; card.querySelector('p').textContent = d.desc; card.querySelector('.note').textContent = d.note;
    notebookList.appendChild(card);
  });
  const ids = Object.keys(exposed).filter(k => exposed[k]);
  if (ids.length) {
    const h = document.createElement('h4'); h.style.color = '#f87171'; h.textContent = '⚡ ' + t.notebookLies; notebookList.appendChild(h);
    ids.forEach(k => {
      const s = SUSPECTS[k], card = document.createElement('div'); card.className = 'clue-entry-card';
      const d = CLUES[s.contradiction][currentLang];
      card.innerHTML = '<div class="clue-entry-content"><h4></h4><p></p></div>';
      card.querySelector('h4').textContent = currentLang === 'hi' ? s.nameHi : s.nameEn;
      card.querySelector('p').textContent = (currentLang === 'hi' ? s.confessHi : s.confessEn) + '  [' + d.title + ']';
      notebookList.appendChild(card);
    });
  }
}
function openNotebook() {
  if (!gameStarted || isInspecting || isInterrogating || isDeducing || outcomeOpen || isNotebookOpen) return;
  isNotebookOpen = true; hideProximity(); renderNotebook();
  notebookModal.classList.remove('hidden'); hideBlocker(); releasePointer();
}
function closeNotebook() { isNotebookOpen = false; notebookModal.classList.add('hidden'); resumeControl(); }
const toggleNotebook = () => (isNotebookOpen ? closeNotebook() : openNotebook());
closeNotebookBtn.addEventListener('click', closeNotebook);
notebookHudBtn.addEventListener('click', () => { if (gameStarted) toggleNotebook(); });
function openDeduction() {
  if (!gameStarted || isInspecting || isInterrogating || isNotebookOpen || outcomeOpen || isDeducing) return;
  isDeducing = true; bannerDismissed = true; deductionReadyBanner.classList.add('hidden'); hideProximity();
  deductionModal.classList.remove('hidden'); hideBlocker(); releasePointer();
}
function closeDeduction() { isDeducing = false; deductionModal.classList.add('hidden'); resumeControl(); }
const toggleDeduction = () => (isDeducing ? closeDeduction() : openDeduction());
cancelDeductionBtn.addEventListener('click', closeDeduction);
solveShortcutBtn.addEventListener('click', () => { if (gameStarted) toggleDeduction(); });
submitAccusationBtn.addEventListener('click', () => {
  const t = i18n[currentLang];
  const c = deduceCulpritEl.value, m = deduceMotiveEl.value, e = deduceEvidenceEl.value;
  if (!c || !m || !e) {
    submitAccusationBtn.textContent = t.selectAll;
    setTimeout(() => { submitAccusationBtn.textContent = i18n[currentLang].submitAccuse; }, 1800); return;
  }
  isDeducing = false; deductionModal.classList.add('hidden'); outcomeOpen = true;
  if (c === 'victor' && m === 'embezzle' && e === 'letter') {
    score += 500; audio.playVictorySound(); updateHUD();
    winFinalScoreEl.textContent = score; winModal.classList.remove('hidden');
    beginSeq(); voiceEngine.speakAs('victor', t.victorConfession);
  } else {
    score = Math.max(0, score - 100); audio.playFailSound(); updateHUD();
    failExplanationEl.textContent = c === 'victor' ? t.failWeakCase : t.failWrongPerson;
    lossModal.classList.remove('hidden');
  }
});
retryDeductionBtn.addEventListener('click', () => { lossModal.classList.add('hidden'); outcomeOpen = false; openDeduction(); });
fullRestartBtn.addEventListener('click', () => location.reload());
winRestartBtn.addEventListener('click', () => location.reload());
nextCaseBtn.addEventListener('click', () => { window.location.href = 'case2.html'; });
window.addEventListener('keydown', (e) => {
  if (!gameStarted) return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && !(e.target && e.target.tagName === 'SELECT')) e.preventDefault();
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyE':
      if (isInspecting) closeInspection();
      else if (isIntroPlaying) skipSuspectIntro();
      else if (isInterrogating) closeDialogue();
      else if (activeTarget && controls.isLocked && !anyUiOpen()) {
        if (activeTarget.type === 'clue') openInspection(activeTarget.id); else openDialogue(SUSPECTS[activeTarget.id], true);
      }
      break;
    case 'KeyN': if (!isInspecting && !isInterrogating) toggleNotebook(); break;
    case 'KeyK': if (!isInspecting && !isInterrogating && !isNotebookOpen) toggleDeduction(); break;
    case 'Space': if (isIntroPlaying) skipSuspectIntro(); break;
    case 'Escape':
      if (isInspecting) closeInspection(); else if (isInterrogating) closeDialogue();
      else if (isNotebookOpen) closeNotebook(); else if (isDeducing) closeDeduction();
      break;
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const clock = new THREE.Clock();
let time = 0;
const PROX_DIST = 3.4;
function animateNPCs(dt) {
  for (const n of npcs) {
    const dx = camera.position.x - n.x, dz = camera.position.z - n.z, dist = Math.hypot(dx, dz);
    if (dist < 7) {
      let diff = Math.atan2(dx, dz) - n.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      n.group.rotation.y += diff * Math.min(1, dt * 3);
    }
    n.torso.scale.y = 1 + Math.sin(time * 1.6 + n.phase) * 0.012;
    if (controls.isLocked && !anyUiOpen() && !proxDone[n.id] && dist <= PROX_DIST) { proxDone[n.id] = true; showProximity(SUSPECTS[n.id]); }
  }
}
// LEVEL1_PATCH_V1 :: Assistant Vance walks in from the parlour and starts the briefing by himself
const ASSISTANT_WALK = {
  state: 'idle', i: 0, timer: 0, stepT: 0,
  delay: 1.2,        // seconds after BEGIN INVESTIGATION before he starts walking
  speed: 1.5,        // metres / second
  stopDist: 2.0,     // how close he comes to the player (2.0 keeps him on the far side of the desk)
  wp: [{ x: -1.5, z: 7.2 }, { x: 0, z: 6.4 }]   // route to the doorway (avoids the sofa next to the door)
};
function startAssistantWalk() {
  if (ASSISTANT_WALK.state !== 'idle') return;
  proxDone.assistant = true;                       // no separate proximity bubble for him
  ASSISTANT_WALK.state = 'wait'; ASSISTANT_WALK.timer = ASSISTANT_WALK.delay;
}
function updateAssistantWalk(dt) {
  const W = ASSISTANT_WALK;
  if (W.state === 'idle' || W.state === 'done') return;
  const a = npcs.find(n => n.id === 'assistant');
  if (!a) { W.state = 'done'; return; }
  // player already started talking to him manually -> cancel the scripted walk
  if (isInterrogating && currentSuspect && currentSuspect.id === 'assistant') { W.state = 'done'; return; }
  if (!controls.isLocked || anyUiOpen()) return;   // pause while paused / any window is open
  if (W.state === 'wait') { W.timer -= dt; if (W.timer <= 0) W.state = 'walk'; return; }

  const px = camera.position.x, pz = camera.position.z;
  if (Math.hypot(px - a.x, pz - a.z) <= W.stopDist) {   // arrived -> speak the first briefing line
    W.state = 'done'; a.group.position.y = 0; a.group.rotation.z = 0;
    openDialogue(SUSPECTS.assistant, true);
    return;
  }
  let tx = px, tz = pz;
  if (a.z > 6.0 && pz < 6.0 && W.wp[W.i]) {              // player is in the study: go through the doorway first
    const wp = W.wp[W.i]; tx = wp.x; tz = wp.z;
    if (Math.hypot(wp.x - a.x, wp.z - a.z) < 0.2) W.i++;
  }
  const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
  if (d < 1e-4) return;
  const step = Math.min(d, W.speed * dt);
  a.x += dx / d * step; a.z += dz / d * step;
  a.group.position.set(a.x, Math.abs(Math.sin(time * 9)) * 0.045, a.z);
  a.group.rotation.z = Math.sin(time * 9) * 0.025;
  let diff = Math.atan2(dx, dz) - a.group.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  a.group.rotation.y += diff * Math.min(1, dt * 8);
  a.hit.position.set(a.x, 0.95, a.z);
  a.col.x = a.x; a.col.z = a.z;
  W.stepT += dt; if (W.stepT > 0.55) { W.stepT = 0; try { audio.playFootstep(); } catch (e) {} }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); time += dt;
  if (controls.isLocked && !anyUiOpen()) movePlayer(dt); else velv.set(0, 0, 0);
  fireLight.intensity = 40 + Math.sin(time * 23) * 6 + Math.sin(time * 11.7) * 4;
  flame.scale.set(1 + Math.sin(time * 18) * 0.12, 1 + Math.sin(time * 14 + 1) * 0.2, 1 + Math.sin(time * 16) * 0.12);
  for (const id in clueRings) { const r = clueRings[id]; const base = collectedClues.includes(id) ? 0.2 : 0.7; r.material.opacity = base + Math.sin(time * 3.2) * (collectedClues.includes(id) ? 0.05 : 0.25); }
  const pa = moteGeo.attributes.position.array;
  for (let i = 0; i < MOTES; i++) {
    pa[i * 3] += Math.sin(time * 0.3 + motePh[i]) * 0.0015;
    pa[i * 3 + 1] += Math.cos(time * 0.4 + motePh[i]) * 0.0012;
    pa[i * 3 + 2] += Math.sin(time * 0.25 + motePh[i] * 1.3) * 0.0015;
  }
  moteGeo.attributes.position.needsUpdate = true;
  animateNPCs(dt);
  updateAssistantWalk(dt);
  updateInteraction();
  renderer.render(scene, camera);
}
animate();