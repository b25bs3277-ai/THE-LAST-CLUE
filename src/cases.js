import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
const $ = (id) => document.getElementById(id);
const caseNum = parseInt(document.body.dataset.case || '2', 10);
console.log(`[THE LAST CLUE] Initializing Case Module ${caseNum}`);
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
    osc.type = 'sine'; osc.frequency.value = caseNum === 2 ? 60 : 50; g.gain.value = 0.035;
    osc.connect(g); g.connect(this.master); osc.start();
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
let currentLang = (() => { try { return localStorage.getItem('tlc_lang') === 'hi' ? 'hi' : 'en'; } catch (e) { return 'en'; } })(); // CASE_HI_V1
class CharacterVoiceManager {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.voiceEnabled = true;
    this.currentUtterance = null;
  }
  get active() { return this.voiceEnabled && !!this.synth; }
  setVoiceState(on) { this.voiceEnabled = on; if (!on) this.stop(); return on; }
  stop() { if (this.synth) this.synth.cancel(); }
  speakAs(charId, text, onEnd = null) {
    if (!this.active || !text || !text.trim()) { this.stop(); if (onEnd) onEnd(); return; }
    this.stop();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = currentLang === 'hi' ? 'hi-IN' : 'en-US';
    u.rate = 0.92;
    u.pitch = charId === 'vivienne' ? 1.15 : charId === 'finch' ? 1.05 : 0.90;
    u.onend = () => { if (onEnd) onEnd(); };
    u.onerror = () => { if (onEnd) onEnd(); };
    this.synth.speak(u);
  }
}
const voiceEngine = new CharacterVoiceManager();
const CASE_REGISTRY = {
  2: {
    titleEn: "St. Jude's Clock Tower", titleHi: "सेंट ज्यूड क्लॉक टॉवर",
    statusEn: "Search the maintenance gear room for evidence", statusHi: "क्लॉक टॉवर में सबूत खोजें",
    briefings: {
      en: [
         "Detective Vance, step carefully around the pendulum drive housing.",
         "Master horologist Horace Vance was discovered dead tonight among the great brass escapement gears.",
         "The city clock mechanism jammed violently at 11:42 PM after high-tensile gear teeth were sheared with an iron crowbar.",
         "Alistair Finch, his ambitious apprentice, is right here by the workbench. Cross-examine his timeline and search the platform."
      ],
      hi: [
         "डिटेक्टिव वेंस, पेंडुलम हाउसिंग के पास संभलकर चलें।",
         "मास्टर घड़ीसाज़ होरेस वेंस आज रात पीतल के गियरों के बीच मृत पाए गए।",
         "रात 11:42 बजे शहर की मुख्य घड़ी को लोहे के रॉड से गियर तोड़कर रोक दिया गया था।",
         "उनका महत्वाकांक्षी शिष्य एलिस्टर फिंच वर्कबेंच के पास मौजूद है। उससे पूछताछ करें और सबूत जुटाएँ।"
      ]
    },
    clues: {
      cog: {
        img: 'assets/case2_cog.png',
        en: { title: 'Bent Escapement Cog', loc: 'Clockwork Maintenance Bench',
          desc: 'A heavy brass escapement cogwheel with sheared teeth. Broken deliberately at 11:42 PM.',
          note: 'The clock tower did not break by accident. It was sabotaged right when Horace was struck down.' },
        hi: { title: 'टूटा हुआ गियर चक्र', loc: 'घड़ी मरम्मत बेंच',
          desc: 'टूटे हुए दाँतों वाला पीतल का गियर। रात 11:42 पर जानबूझकर तोड़ा गया।',
          note: 'घड़ी दुर्घटना से नहीं रुकी, इसे तोड़फोड़ करके रोका गया था।' }
      },
      rag: {
        img: 'assets/case2_rag.png',
        en: { title: 'Grease-Soaked Silk Rag', loc: 'Drive Shaft Axle',
          desc: "A fine monogrammed silk cloth smeared with fresh mineral gear grease. Bears the initials 'AF'.",
          note: "Alistair Finch claims he wasn't touching the machinery after sunset." },
        hi: { title: 'ग्रीस लगा रेशमी रूमाल', loc: 'ड्राइव शाफ्ट धुरी',
          desc: "रेशमी रूमाल जिस पर ताज़ा मशीन ग्रीस लगा है और 'AF' लिखा है।",
          note: 'फिंच का दावा है कि उसने शाम के बाद मशीन को हाथ नहीं लगाया था।' }
      },
      blueprint: {
        img: 'assets/case2_blueprint.png',
        en: { title: 'Stolen Patent Blueprint', loc: 'Drafting Lectern',
          desc: "Vance's revolutionary perpetual escapement design, registered solely under Finch's forged signature.",
          note: 'The motive is intellectual property theft and royal contract appropriation.' },
        hi: { title: 'चुराया हुआ पेटेंट ब्लूप्रिंट', loc: 'ड्राफ्टिंग डेस्क',
          desc: 'वेंस का क्रांतिकारी डिज़ाइन, जिस पर फिंच ने अपने फर्जी हस्ताक्षर कर रखे हैं।',
          note: 'मकसद पेटेंट और शाही अनुबंध चुराना था।' }
      }
    },
    suspects: {
      assistant: {
        id: 'assistant', emoji: '📋', nameEn: 'Officer Higgins', nameHi: 'अधिकारी हिगिंस',
        roleEn: 'Tower Patrol Lead', roleHi: 'टॉवर सुरक्षा प्रमुख', isAssistant: true
      },
      finch: {
        id: 'finch', emoji: '🔧', nameEn: 'Alistair Finch', nameHi: 'एलिस्टर फिंच',
        roleEn: 'Horologist Apprentice', roleHi: 'घड़ीसाज़ शिष्य', contradiction: 'rag',
        introEn: "I loved Master Vance like a father! I spent the entire evening downstairs at the Golden Anchor pub.",
        introHi: 'मैं वेंस साहब का बहुत सम्मान करता था! मैं पूरी शाम गोल्डन एंकर पब में था।',
        alibiEn: 'I clocked out at 6:00 PM and never climbed back up the spiral stairs tonight.',
        alibiHi: 'मैं शाम 6 बजे चला गया था और दोबारा टॉवर की सीढ़ियाँ नहीं चढ़ा।',
        motiveEn: 'Master Vance was going to make me full partner next month.',
        motiveHi: 'मास्टर वेंस मुझे अगले महीने साझेदार बनाने वाले थे।',
        confDetEn: 'Finch, this silk rag soaked in fresh gear grease has your initials and was caught in the axle tonight!',
        confDetHi: 'फिंच, इस रेशमी रूमाल पर ताज़ा ग्रीस लगा है और तुम्हारे हस्ताक्षर हैं!',
        confessEn: "...Blast it! I was up here! We fought over the patent credit. He fell against the flywheel, so I panicked and jammed the gears!",
        confessHi: '...धिक्कार है! हम पेटेंट को लेकर लड़ रहे थे। वह पहिए से टकरा गए और मैंने घबराकर गियर तोड़ दिए!'
      }
    },
    solution: { culprit: 'finch', motive: 'patent', evidence: 'rag' },
    deductionOptions: {
      culprits: [{ val: 'finch', label: 'Alistair Finch (Apprentice / शिष्य)' }],
      motives: [{ val: 'patent', label: 'Patent Theft & Royal Guild Contract / पेटेंट और अनुबंध चोरी' }],
      evidence: [
        { val: 'rag', label: 'Grease-Soaked Monogrammed Silk Rag' },
        { val: 'cog', label: 'Bent Escapement Cogwheel' },
        { val: 'blueprint', label: 'Stolen Patent Blueprint' }
      ]
    },
    confessionVoice: 'finch',
    confessionText: "I stole the perpetual patent drawings. When he threatened to ruin me, I struck him with the winding bar and jammed the gears at 11:42 to fake an accidental malfunction!",
    winStory: "Confronted with his grease-soaked monogrammed handkerchief and the forged patent papers, Alistair Finch broke down and confessed to sabotaging the clock tower and murdering Master Vance.",
    nextUrl: "case3.html"
  },
  3: {
    titleEn: "The Botanical Conservatory", titleHi: "बॉटनिकल कंज़र्वेटरी",
    statusEn: "Inspect greenhouse tables for toxic nightshade samples", statusHi: "ग्रीनहाउस में ज़हर के नमूनों की जाँच करें",
    briefings: {
      en: [
         "Detective Vance, step carefully among the exotic glass flora.",
         "Lord Evelyn Cross, master botanist, collapsed in agony beside his rare nightshade orchids.",
         "His evening herbal tea was laced with concentrated Atropa belladonna extract.",
         "Dr. Julian Sterling, his longtime academic rival, is right across the potting table. Uncover the truth."
      ],
      hi: [
         "डिटेक्टिव वेंस, संभलकर चलें।",
         "लॉर्ड एवलिन क्रॉस अपनी दुर्लभ आर्किड वाटिका के पास मृत पाए गए।",
         "उनकी शाम की हर्बल चाय में घातक बेलाडोना का अर्क मिलाया गया था।",
         "उनके प्रतिद्वंद्वी डॉ. जूलियन स्टर्लिंग सामने मौजूद हैं। सच का पता लगाएँ।"
      ]
    },
    clues: {
      vial: {
        img: 'assets/case3_vial.png',
        en: { title: 'Crushed Belladonna Vial', loc: 'Potting Bench Soil',
          desc: 'An amber glass pharmaceutical dropper vial containing concentrated deadly nightshade alkaloid.',
          note: 'Matches the exact lethal dose found in the victim’s porcelain teacup.' },
        hi: { title: 'बेलाडोना की शीशी', loc: 'मिट्टी की क्यारी',
          desc: 'घातक विषैले पौधे का अर्क रखने वाली दवा की शीशी।',
          note: 'पीड़ित के चाय के प्याले में पाए गए ज़हर से मेल खाती है।' }
      },
      journal: {
        img: 'assets/case3_journal.png',
        en: { title: 'Burnt Research Formula', loc: 'Incinerator Grate',
          desc: "Lord Cross's miraculous heart-remedy orchid synthesis notes, half-destroyed in the coal burner.",
          note: 'Whoever took this wanted to publish the revolutionary cure under their own name.' },
        hi: { title: 'जली हुई शोध डायरी', loc: 'अंगीठी की जाली',
          desc: 'हृदय रोग की क्रांतिकारी दवा का गुप्त फ़ॉर्मूला।',
          note: 'हत्यारा इस फ़ॉर्मूले को अपने नाम से प्रकाशित करना चाहता था।' }
      },
      glasses: {
        img: 'assets/case3_glasses.png',
        en: { title: 'Gold-Rimmed Spectacles', loc: 'Fern Planter Base',
          desc: 'Fine prescription spectacles stamped by Dr. Sterling’s private Harley Street optometrist.',
          note: 'Dr. Sterling swore he never stepped into the glasshouse tonight.' },
        hi: { title: 'सोने का चश्मा', loc: 'फर्न के गमले के पास',
          desc: 'डॉ. स्टर्लिंग का चश्मा जो मिट्टी में गिरा हुआ मिला।',
          note: 'डॉ. स्टर्लिंग का दावा था कि वे आज यहाँ आए ही नहीं थे।' }
      }
    },
    suspects: {
      assistant: {
        id: 'assistant', emoji: '📋', nameEn: 'Constable Higgins', nameHi: 'कांस्टेबल हिगिंस',
        roleEn: 'Coroner Guard', roleHi: 'सुरक्षा दल', isAssistant: true
      },
      sterling: {
        id: 'sterling', emoji: '🧪', nameEn: 'Dr. Julian Sterling', nameHi: 'डॉ. जूलियन स्टर्लिंग',
        roleEn: 'Botanical Physician', roleHi: 'वनस्पति चिकित्सक', contradiction: 'glasses',
        introEn: "A dreadful tragedy! Lord Cross and I merely engaged in friendly intellectual discourse.",
        introHi: 'बहुत दुखद घटना है! लॉर्ड क्रॉस और मेरे बीच केवल बौद्धिक चर्चाएँ होती थीं।',
        alibiEn: 'I was dining at the Royal College until midnight. I lost my spectacles days ago!',
        alibiHi: 'मैं आधी रात तक कॉलेज में भोजन कर रहा था। मेरा चश्मा कई दिन पहले खो गया था!',
        motiveEn: 'I had no envy of Evelyn. My own treatises are universally celebrated.',
        motiveHi: 'मुझे एवलिन से कोई ईर्ष्या नहीं थी।',
        confDetEn: 'Dr. Sterling, these gold spectacles were stamped into fresh wet peat under the poison table tonight!',
        confDetHi: 'डॉक्टर, यह चश्मा आज रात की ताज़ा गीली मिट्टी में दबा हुआ मिला है!',
        confessEn: "...Curse your sharp eyes! He was going to expose that I stole his heart formula. I slipped the belladonna drops into his chamomile tea!",
        confessHi: '...उसने मेरा पर्दाफाश करने की धमकी दी थी। मैंने उसकी चाय में बेलाडोना मिला दिया!'
      }
    },
    solution: { culprit: 'sterling', motive: 'formula', evidence: 'glasses' },
    deductionOptions: {
      culprits: [{ val: 'sterling', label: 'Dr. Julian Sterling (Physician / चिकित्सक)' }],
      motives: [{ val: 'formula', label: 'Theft of Miracle Heart Remedy Formula / फ़ॉर्मूला चोरी' }],
      evidence: [
        { val: 'glasses', label: 'Gold-Rimmed Spectacles in Wet Peat' },
        { val: 'vial', label: 'Crushed Belladonna Dropper Vial' },
        { val: 'journal', label: 'Burnt Research Formula Notes' }
      ]
    },
    confessionVoice: 'sterling',
    confessionText: "I could not let him publish the formula first. It was my lifetime of prestige at stake! I poisoned his tea and burnt his journal in the furnace.",
    winStory: "Exposed by his prescription spectacles recovered from the fresh greenhouse peat, Dr. Julian Sterling confessed to poisoning Lord Evelyn Cross.",
    nextUrl: "case4.html"
  },
  4: {
    titleEn: "Royal Opera House", titleHi: "रॉयल ओपेरा हाउस",
    statusEn: "Search backstage rigging and dressing rooms for clues", statusHi: "मंच के पीछे सुराग खोजें",
    briefings: {
      en: [
         "Detective Vance, the velvet curtains conceal a brutal homicide.",
         "Renowned Maestro Anthony Belmont was crushed on stage just before the final overture.",
         "The fly-system counterweight rope was intentionally severed with a razor-sharp blade.",
         "Madame Vivienne Laurent, the prima donna soprano, is standing right by her dressing vanity."
      ],
      hi: [
         "डिटेक्टिव वेंस, मखमली पर्दों के पीछे एक भयानक हत्या हुई है।",
         "संगीत निर्देशक एंथोनी बेलमोंट पर भारी मंच भार गिराकर उनकी जान ले ली गई।",
         "रस्सियों को धारदार औजार से जानबूझकर काटा गया था।",
         "गायिका विविएन लॉरेंट मंच के पास मौजूद हैं।"
      ]
    },
    clues: {
      rope: {
        img: 'assets/case4_rope.png',
        en: { title: 'Severed Rigging Rope', loc: 'Fly-Gallery Counterweight Rig',
          desc: 'Heavy braided hemp rope cleanly sliced at a 45-degree angle, dropping a two-hundred-pound sandbag.',
          note: 'This was not frayed wear and tear; it was calculated murder.' },
        hi: { title: 'कटी हुई भारी रस्सी', loc: 'मंच का रोपवे सिस्टम',
          desc: 'तेज़ धार से काटी गई भारी रस्सी जिससे वज़नदार भार नीचे गिरा।',
          note: 'यह हादसा नहीं बल्कि सुनियोजित हत्या थी।' }
      },
      telegram: {
        img: 'assets/case4_telegram.png',
        en: { title: 'Extortion Telegram', loc: 'Vanity Mirror Table',
          desc: 'A demanding message from Belmont extorting half of Vivienne’s international royalties.',
          note: 'Threatened to expose her forged Parisian conservatory degree if she refused.' },
        hi: { title: 'धमकी भरा टेलीग्राम', loc: 'श्रृंगार मेज़',
          desc: 'बेलमोंट द्वारा विविएन से उसकी आधी कमाई वसूलने की धमकी भरा संदेश।',
          note: 'डिग्री का सच उजागर करने की धमकी दी गई थी।' }
      },
      dagger: {
        img: 'assets/case4_dagger.png',
        en: { title: 'Blood-Tipped Prop Dagger', loc: 'Wardrobe Prop Trunk',
          desc: 'A stage prop rapier refitted with a razor-sharp tempered steel edge.',
          note: 'Used backstage to cut through the heavy counterweight lines.' },
        hi: { title: 'धारदार प्रोप खंजर', loc: 'वेशभूषा बक्सा',
          desc: 'नाटकीय खंजर जिसमें असली धारदार ब्लेड लगाया गया था।',
          note: 'मंच की रस्सियाँ काटने के लिए इस्तेमाल किया गया।' }
      }
    },
    suspects: {
      assistant: {
        id: 'assistant', emoji: '📋', nameEn: 'Inspector Higgins', nameHi: 'इंस्पेक्टर हिगिंस',
        roleEn: 'Theater Division Lead', roleHi: 'थिएटर प्रभाग प्रमुख', isAssistant: true
      },
      vivienne: {
        id: 'vivienne', emoji: '🎭', nameEn: 'Vivienne Laurent', nameHi: 'विविएन लॉरेंट',
        roleEn: 'Prima Donna Soprano', roleHi: 'मुख्य गायिका', contradiction: 'telegram',
        introEn: "My poor Maestro! I was warming my vocal scales in the lower auditorium the entire intermission.",
        introHi: 'मेरे बेचारे उस्ताद! मैं पूरे अंतराल के दौरान अभ्यास कर रही थी।',
        alibiEn: 'I never went near the fly gallery rigging stairs. Belmont and I had nothing but adoration.',
        alibiHi: 'मैं रस्सियों के पास कभी नहीं गई। हम दोनों एक-दूसरे का बहुत आदर करते थे।',
        motiveEn: 'He made me a star. Why would I ever harm him?',
        motiveHi: 'उन्होंने मुझे सितारा बनाया। मैं उन्हें क्यों मारती?',
        confDetEn: 'Madame Laurent, this extortion telegram proves Belmont was blackmailing you for half your royalties!',
        confDetHi: 'मैडम, यह टेलीग्राम साबित करता है कि बेलमोंट आपको ब्लैकमेल कर रहे थे!',
        confessEn: "...He was a leech! He threatened to ruin my career and take everything I earned. I used the prop knife to sever the rigging rope during the lights blackout!",
        confessHi: '...वह खून चूस रहा था! उसने मेरा करियर बर्बाद करने की धमकी दी थी। बत्ती गुल होते ही मैंने रस्सियाँ काट दीं!'
      }
    },
    solution: { culprit: 'vivienne', motive: 'blackmail', evidence: 'telegram' },
    deductionOptions: {
      culprits: [{ val: 'vivienne', label: 'Vivienne Laurent (Prima Donna / मुख्य गायिका)' }],
      motives: [{ val: 'blackmail', label: 'Blackmail & Career Ruin Threat / ब्लैकमेल और करियर का खतरा' }],
      evidence: [
        { val: 'telegram', label: 'Extortion Telegram from Belmont' },
        { val: 'rope', label: 'Severed Fly-System Rigging Rope' },
        { val: 'dagger', label: 'Modified Razor Prop Dagger' }
      ]
    },
    confessionVoice: 'vivienne',
    confessionText: "He demanded half of every pound I sang for! I severed the fly-rope during the blackout. I had to protect my life and my name!",
    winStory: "Faced with her blackmail telegram and the severed fly-gallery rope, Madame Vivienne Laurent confessed to killing Maestro Belmont.",
    nextUrl: "case5.html"
  },
  5: {
    titleEn: "Harbor Smuggler Vault", titleHi: "हार्बर स्मगलर वॉल्ट",
    statusEn: "Search customs dock and shipping manifests for clues", statusHi: "तस्करी की पेटियों और जहाज़ के दस्तावेज़ों की जाँच करें",
    briefings: {
      en: [
         "Detective Vance, watch your step on the wet harbor stone.",
         "Captain Silas Reed was found lifeless inside Customs Vault 4 at the East India Docks.",
         "An imperial shipment of uncut diamonds was forged as raw timber on maritime manifests.",
         "Harbormaster Marcus 'Gull' Thorne is right here standing by the customs desk."
      ],
      hi: [
         "डिटेक्टिव वेंस, बंदरगाह के गीले पत्थरों पर संभलकर चलें।",
         "कैप्टन साइलास रीड का शव वॉल्ट 4 में मृत पाया गया।",
         "हीरों की एक बड़ी खेप को दस्तावेज़ों में लकड़ी बताकर हेराफेरी की गई थी।",
         "हार्बर मास्टर मार्कस थोर्न कस्टम्स डेस्क के पास खड़ा है।"
      ]
    },
    clues: {
      manifest: {
        img: 'assets/case5_manifest.png',
        en: { title: 'Altered Shipping Manifest', loc: 'Customs Desk Ledger',
          desc: 'A maritime manifest doctored to classify a priceless uncut diamond cache as scrap Baltic timber.',
          note: 'Signed with the harbor master’s private wax validation mark.' },
        hi: { title: 'बदला हुआ शिपिंग घोषणापत्र', loc: 'कस्टम्स डेस्क',
          desc: 'दस्तावेज़ जिसमें कीमती हीरों को रद्दी लकड़ी लिखा गया था।',
          note: 'हार्बर मास्टर की निजी मुहर से सत्यापित किया गया।' }
      },
      wax: {
        img: 'assets/case5_wax.png',
        en: { title: 'Counterfeit Customs Seal', loc: 'Contraband Salt Barrel',
          desc: 'A brass seal used to stamp illicit crates through the naval blockade without inspection.',
          note: 'Hidden inside a brine barrel right next to Thorne’s desk.' },
        hi: { title: 'फर्जी सीमा शुल्क मुहर', loc: 'नमक का पीपा',
          desc: 'पीतल की मुहर जिससे बिना जाँच के पेटियाँ पास की जाती थीं।',
          note: 'थोर्न की डेस्क के पास नमक के पीपे में छुपाई गई थी।' }
      },
      key: {
        img: 'assets/case5_key.png',
        en: { title: 'Blood-Stained Vault Key', loc: 'Dock Tackle Box',
          desc: "Captain Reed’s brass master bypass key with fresh blood and Thorne’s tarred thumbprint.",
          note: 'Proves Thorne took the key directly from the dying captain.' },
        hi: { title: 'खून से सनी चाबी', loc: 'टूल बॉक्स',
          desc: 'कैप्टन रीड की तिजोरी की चाबी जिस पर खून और थोर्न के फिंगरप्रिंट हैं।',
          note: 'साबित करता है कि चाबी सीधे कैप्टन से छीनी गई थी।' }
      }
    },
    suspects: {
      assistant: {
        id: 'assistant', emoji: '📋', nameEn: 'Sergeant Higgins', nameHi: 'सार्जेंट हिगिंस',
        roleEn: 'Waterfront Guard', roleHi: 'तटीय सुरक्षा गार्ड', isAssistant: true
      },
      thorne: {
        id: 'thorne', emoji: '⚓', nameEn: 'Marcus Thorne', nameHi: 'मार्कस थोर्न',
        roleEn: 'Harbormaster', roleHi: 'हार्बर मास्टर', contradiction: 'key',
        introEn: "Captain Reed was an honest seaman, Detective. I only clear standard timber shipments here.",
        introHi: 'कैप्टन रीड एक ईमानदार नाविक थे, डिटेक्टिव। मैं यहाँ सिर्फ़ सामान्य लकड़ी की जाँच करता हूँ।',
        alibiEn: 'I was stamping permits in the harbor watchtower all night. I never possessed Reed’s private vault keys!',
        alibiHi: 'मैं पूरी रात वॉचटॉवर में था। मेरे पास रीड की चाबी कभी नहीं थी!',
        motiveEn: 'Why would a civil port official want anything from a cargo captain?',
        motiveHi: 'एक सरकारी अधिकारी का किसी मालवाहक कैप्टन से क्या लेना-देना?',
        confDetEn: 'Thorne, this bloodied brass vault key was hidden in your tackle box with your fresh pitch thumbprint!',
        confDetHi: 'थोर्न, यह खून से सनी चाबी तुम्हारे टूल बॉक्स में मिली है जिस पर तुम्हारे अंगूठे का निशान है!',
        confessEn: "...Curse your eyes! Reed refused to let me swap the diamond crates out of Vault 4. He drew a cutlass and I struck him down!",
        confessHi: '...धिक्कार है! रीड हीरों की पेटियाँ बदलने नहीं दे रहा था। उसने तलवार निकाली और मैंने उसे मार दिया!'
      }
    },
    solution: { culprit: 'thorne', motive: 'diamonds', evidence: 'key' },
    deductionOptions: {
      culprits: [{ val: 'thorne', label: 'Marcus Thorne (Harbormaster / हार्बर मास्टर)' }],
      motives: [{ val: 'diamonds', label: 'Theft of Contraband Imperial Diamonds / हीरों की चोरी' }],
      evidence: [
        { val: 'key', label: 'Blood-Stained Vault Key with Thumbprint' },
        { val: 'manifest', label: 'Altered Shipping Manifest Ledger' },
        { val: 'wax', label: 'Counterfeit Customs Brass Seal' }
      ]
    },
    confessionVoice: 'thorne',
    confessionText: "Those diamonds were worth fifty years of naval wages! Reed tried to lock the vault against me, so I took the key by force.",
    winStory: "Confronted with the blood-stained vault key carrying his tarred fingerprint, Marcus Thorne admitted to killing Captain Silas Reed for the imperial diamonds.",
    nextUrl: "case6.html"
  },
  6: {
    titleEn: "Royal Antiquities Archive", titleHi: "रॉयल पुरातत्व अभिलेखागार",
    statusEn: "Search the subterranean vault and relic displays for clues", statusHi: "प्राचीन अवशेषों और संग्रहालय की पेटियों की जाँच करें",
    briefings: {
      en: [
         "Detective Vance, you stand in the high sanctum of ancient history.",
         "Chief Curator Dr. Arthur Pendelton died instantaneously in the Dynasty Vault.",
         "A priceless obsidian scarab was swapped with a counterfeit paste duplicate.",
         "Professor Jonathan Sterling, visiting antiquities appraiser, is right here beside the central vitrine."
      ],
      hi: [
         "डिटेक्टिव वेंस, आप प्राचीन इतिहास के गुप्त तहखाने में खड़े हैं।",
         "मुख्य क्यूरेटर डॉ. आर्थर पेंडलटन की रहस्यमयी परिस्थितियों में मृत्यु हो गई।",
         "एक बेशकीमती प्राचीन ताबीज को नकली कांच के टुकड़े से बदल दिया गया था।",
         "प्रोफेसर जोनाथन स्टर्लिंग केंद्रीय शोकेस के पास खड़े हैं।"
      ]
    },
    clues: {
      scarab: {
        img: 'assets/case6_scarab.png',
        en: { title: 'Poison-Tipped Obsidian Scarab', loc: 'Velvet Display Plinth',
          desc: 'An ancient obsidian amulet with a spring-loaded hollow needle tipped with lethal curare alkaloid.',
          note: 'Triggered when Pendelton attempted to stop the thief from stealing the genuine relic.' },
        hi: { title: 'विषैला आबनूसी ताबीज', loc: 'मखमली डिस्प्ले टेबल',
          desc: 'प्राचीन ताबीज जिसमें घातक जहर से बुझी सुई लगी हुई है।',
          note: 'जब पेंडलटन ने चोर को रोकने की कोशिश की तो यह सुई चुभ गई।' }
      },
      papyrus: {
        img: 'assets/case6_papyrus.png',
        en: { title: 'Forged Dynasty Papyrus', loc: 'Scholar Reading Lectern',
          desc: 'A fabricated provenance document designed to smuggle the genuine royal scarab abroad to a private collector.',
          note: 'Written with modern chemical iron-gall ink disguised as ancient soot.' },
        hi: { title: 'फर्जी प्राचीन पांडुलिपि', loc: 'अध्ययन डेस्क',
          desc: 'नकली दस्तावेज़ जिससे असली ताबीज को विदेश तस्करी किया जा सके।',
          note: 'आधुनिक स्याही से लिखा गया फर्जी प्रमाण पत्र।' }
      },
      shard: {
        img: 'assets/case6_shard.png',
        en: { title: 'Blood-Smeared Vitrine Glass', loc: 'Marble Archive Floor',
          desc: 'Shattered safety display glass bearing a crimson smear from a fresh wrist laceration.',
          note: 'Matches the bandage Sterling is currently wearing under his coat sleeve.' },
        hi: { title: 'खून से सना कांच का टुकड़ा', loc: 'संगमरमर का फ़र्श',
          desc: 'टूटा हुआ कांच जिस पर ताज़ा खून लगा हुआ है।',
          note: 'स्टर्लिंग की कलाई पर बंधी पट्टी से मेल खाता है।' }
      }
    },
    suspects: {
      assistant: {
        id: 'assistant', emoji: '📋', nameEn: 'Chief Inspector Higgins', nameHi: 'चीफ इंस्पेक्टर हिगिंस',
        roleEn: 'Antiquities Squad', roleHi: 'पुरातत्व दस्ता', isAssistant: true
      },
      sterling: {
        id: 'sterling', emoji: '📜', nameEn: 'Prof. Jonathan Sterling', nameHi: 'प्रोफेसर जोनाथन स्टर्लिंग',
        roleEn: 'Visiting Antiquities Appraiser', roleHi: 'पुरातत्व विशेषज्ञ', contradiction: 'shard',
        introEn: "A profound loss to archaeology! Pendelton and I were cataloging harmless pottery shards.",
        introHi: 'पुरातत्व जगत के लिए बहुत बड़ी क्षति! पेंडलटन और मैं केवल बर्तनों के टुकड़ों की सूची बना रहे थे।',
        alibiEn: 'I was in the public gallery admiring roman busts until closing. I never entered the vault after dusk!',
        alibiHi: 'मैं शाम तक मुख्य दीर्घा में था। मैं सूर्यास्त के बाद तहखाने में कभी नहीं आया!',
        motiveEn: 'I am a distinguished academician. I have no interest in stolen trinkets.',
        motiveHi: 'मैं एक सम्मानित विद्वान हूँ।',
        confDetEn: 'Professor, this shattered vitrine glass carries your blood, matching the fresh cut under your left cuff!',
        confDetHi: 'प्रोफेसर, इस टूटे कांच पर आपका खून है जो आपकी कलाई के ताज़ा ज़ख्म से मेल खाता है!',
        confessEn: "...Confound you! Pendelton caught me replacing the obsidian scarab with a paste replica. In the struggle, the spring needle discharged and struck him!",
        confessHi: '...पेंडलटन ने मुझे असली ताबीज बदलते हुए पकड़ लिया था। हाथापाई में ज़हरीली सुई उसे चुभ गई!'
      }
    },
    solution: { culprit: 'sterling', motive: 'relic', evidence: 'shard' },
    deductionOptions: {
      culprits: [{ val: 'sterling', label: 'Prof. Jonathan Sterling (Appraiser / विशेषज्ञ)' }],
      motives: [{ val: 'relic', label: 'Relic Forgery & Black Market Smuggling / प्राचीन अवशेष की तस्करी' }],
      evidence: [
        { val: 'shard', label: 'Blood-Smeared Shattered Vitrine Glass' },
        { val: 'scarab', label: 'Poison-Tipped Obsidian Scarab' },
        { val: 'papyrus', label: 'Forged Dynasty Provenance Papyrus' }
      ]
    },
    confessionVoice: 'sterling',
    confessionText: "A private buyer offered fifty thousand sovereigns for the authentic 12th Dynasty scarab! Pendelton tried to stop me, and the spring-loaded curare needle triggered in the scuffle.",
    winStory: "Confronted with the bloodied vitrine glass shard matching his wrist wound, Professor Jonathan Sterling confessed to the theft and killing of Dr. Arthur Pendelton.",
    nextUrl: "menu.html"
  }
};
const activeCase = CASE_REGISTRY[caseNum] || CASE_REGISTRY[2];
const container = $('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080e);
scene.fog = new THREE.Fog(0x070912, 8.0, 36.0);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
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
const addCircleCol = (x, z, r) => colliders.push({ x, z, r });
scene.add(new THREE.AmbientLight(0x384260, 1.4));
scene.add(new THREE.HemisphereLight(0x4a5a80, 0x1a1410, 0.8));
const lantern = new THREE.PointLight(0xffe0b0, 5, 8, 1.5);
lantern.position.set(0, 0.1, 0.2);
camera.add(lantern);
const loader = new THREE.TextureLoader();
const loadTex = (p) => { const t = loader.load(p); t.colorSpace = THREE.SRGBColorSpace; return t; };
const floorWoodTex = loadTex('assets/floor_wood.png');
floorWoodTex.wrapS = floorWoodTex.wrapT = THREE.RepeatWrapping; floorWoodTex.repeat.set(4, 4);
const interactables = [], clueRings = {}, npcs = [], occluders = [];
function makeLabel(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(10,12,18,0.85)'; x.fillRect(0, 8, 256, 48);
  x.strokeStyle = '#d4af37'; x.lineWidth = 2; x.strokeRect(1, 9, 254, 46);
  x.fillStyle = '#ffd700'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.9, 0.225, 1); return s;
}
function spawnClue(id, texPath, size, x, y, z, rotY = 0, isRound = false) {
  const tex = loadTex(texPath);
  const geo = isRound ? new THREE.CircleGeometry(size / 2, 32) : new THREE.PlaneGeometry(size, size);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = rotY; m.position.set(x, y + 0.005, z);
  scene.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.6, size * 0.68, 36),
    new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.01, z);
  scene.add(ring);
  clueRings[id] = ring;
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(x, y + 0.1, z);
  hit.userData = { interact: true, type: 'clue', id };
  scene.add(hit);
  interactables.push(hit);
}
function spawnNPC(id, name, x, z, rotY, opt = {}) {
  const g = new THREE.Group();
  const cloth = M(opt.cloth || 0x1e3a5f);
  const lower = M(opt.lower || 0x11141c);
  const skin = M(0xd8b293);
  const hair = M(opt.hair || 0x332211);
  cyl(opt.dress ? 0.28 : 0.15, opt.dress ? 0.2 : 0.2, 0.86, lower, 0, 0.43, 0, g);
  const torso = cyl(0.19, 0.22, 0.6, cloth, 0, 1.16, 0, g);
  sphere(0.13, skin, 0, 1.6, 0, g);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.position.set(0, 1.62, -0.01); g.add(hairCap);
  [-0.26, 0.26].forEach(s => {
    const arm = cyl(0.045, 0.04, 0.55, cloth, s, 1.12, 0, g);
    arm.rotation.z = s > 0 ? -0.08 : 0.08;
    sphere(0.045, skin, s * 1.05, 0.83, 0, g);
  });
  const label = makeLabel(name);
  label.position.set(0, 2.05, 0); g.add(label);
  g.position.set(x, 0, z); g.rotation.y = rotY;
  scene.add(g);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.9, 10), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(x, 0.95, z);
  hit.userData = { interact: true, type: 'suspect', id };
  scene.add(hit);
  interactables.push(hit);
  addCircleCol(x, z, 0.42);
  npcs.push({ id, group: g, torso, phase: Math.random() * 6, x, z });
}
camera.position.set(0, 1.65, 3.8);
if (caseNum === 2) { camera.position.set(0.0, 1.65, -1.2); camera.rotation.set(-6.0 * Math.PI / 180, 180.0 * Math.PI / 180, 0, 'YXZ'); } // CASE2_PATCH_V1
if (caseNum === 3) { camera.position.set(0.0, 1.65, -1.2); camera.rotation.set(-1.5 * Math.PI / 180, 180.0 * Math.PI / 180, 0, 'YXZ'); } // CASE3_PATCH_V1
if (caseNum === 4) { camera.position.set(0.0, 1.65, -1.2); camera.rotation.set(-1.5 * Math.PI / 180, 180.0 * Math.PI / 180, 0, 'YXZ'); } // CASE456_PATCH_V1
if (caseNum === 5) { camera.position.set(0.0, 1.65, -1.2); camera.rotation.set(-3.0 * Math.PI / 180, 180.0 * Math.PI / 180, 0, 'YXZ'); } // CASE456_PATCH_V1
if (caseNum === 6) { camera.position.set(0.0, 1.65, -1.2); camera.rotation.set(-1.5 * Math.PI / 180, 180.0 * Math.PI / 180, 0, 'YXZ'); } // CASE456_PATCH_V1
const roomMat = M(caseNum === 2 ? 0x3d434d : caseNum === 3 ? 0x243329 : caseNum === 4 ? 0x3d1c24 : caseNum === 5 ? 0x2a2d33 : 0x363840);
box(14, 5, 0.4, roomMat, 0, 2.5, -6);
box(14, 5, 0.4, roomMat, 0, 2.5, 6);
box(0.4, 5, 12, roomMat, -7, 2.5, 0);
box(0.4, 5, 12, roomMat, 7, 2.5, 0);
addBoxCol(0, -6, 14, 0.5); addBoxCol(0, 6, 14, 0.5);
addBoxCol(-7, 0, 0.5, 12); addBoxCol(7, 0, 0.5, 12);
const fl = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), M(0xffffff, { map: floorWoodTex, roughness: 0.5 }));
fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
const tableMat = M(0x2d1e12);
box(2.8, 0.12, 1.4, tableMat, 0, 0.95, 0);
[[-1.2, -0.55], [1.2, -0.55], [-1.2, 0.55], [1.2, 0.55]].forEach(p => box(0.1, 0.89, 0.1, tableMat, p[0], 0.445, p[1]));
addBoxCol(0, 0, 3.0, 1.6);
if (caseNum === 2) {
  const gearMat = M(0xb8860b, { metalness: 0.8, roughness: 0.3 });
  cyl(1.4, 1.4, 0.15, gearMat, 0, 3.2, -5.6).rotation.x = Math.PI / 2;
  cyl(0.8, 0.8, 0.12, gearMat, 2.2, 2.5, -5.6).rotation.x = Math.PI / 2;
  const l = new THREE.PointLight(0xffbe44, 25, 9); l.position.set(0, 3.0, 0); scene.add(l);
} else if (caseNum === 3) {
  const glassMat = M(0x55aa77, { roughness: 0.2, transparent: true, opacity: 0.5 });
  box(10, 0.1, 8, glassMat, 0, 4.8, 0);
  cyl(0.3, 0.2, 0.8, M(0x8b4513), -3, 0.4, -2);
  cyl(0.3, 0.2, 0.8, M(0x8b4513), 3, 0.4, -2);
  const l = new THREE.PointLight(0x77dd99, 22, 9); l.position.set(0, 2.8, 0); scene.add(l);
} else if (caseNum === 4) {
  const velvetMat = M(0x800020, { roughness: 0.85 });
  box(3, 4.5, 0.2, velvetMat, -4.5, 2.25, -5.6);
  box(3, 4.5, 0.2, velvetMat, 4.5, 2.25, -5.6);
  const l = new THREE.PointLight(0xffaa55, 26, 9); l.position.set(0, 3.2, 0); scene.add(l);
} else if (caseNum === 5) {
  const crateMat = M(0x4a3728);
  box(1.2, 1.2, 1.2, crateMat, -3.8, 0.6, -3.5);
  box(1.0, 1.0, 1.0, crateMat, -3.6, 1.6, -3.5);
  box(1.4, 1.4, 1.4, crateMat, 3.8, 0.7, -3.5);
  const l = new THREE.PointLight(0x4488bb, 22, 9); l.position.set(0, 2.8, 0); scene.add(l);
} else if (caseNum === 6) {
  const goldMat = M(0xd4af37, { metalness: 0.9, roughness: 0.2 });
  cyl(0.4, 0.5, 2.2, M(0xeeeae0), -4, 1.1, -4);
  cyl(0.4, 0.5, 2.2, M(0xeeeae0), 4, 1.1, -4);
  box(0.8, 0.8, 0.8, goldMat, 0, 1.4, -4.5);
  const l = new THREE.PointLight(0xffdf88, 25, 9); l.position.set(0, 3.0, 0); scene.add(l);
}
// CASE2_PATCH_V1 :: furniture + desk props (case 2 + 3, visual only)
if (caseNum >= 2 && caseNum <= 6) {
  const wood = M(0x3b2614), darkWood = M(0x241609);
  const brass = M(0xb8860b, { metalness: 0.8, roughness: 0.35 });
  const steel = M(0x8a8f96, { metalness: 0.85, roughness: 0.4 });
  // bookshelf on the left wall
  box(0.5, 3.2, 2.6, darkWood, -6.55, 1.6, 1.5);
  const bookCols = [M(0x5a1f1f), M(0x1f3a5a), M(0x2f4a2a), M(0x6a4a1f), M(0x3a2a4a)];
  for (let s = 0; s < 4; s++) {
    const base = 0.35 + s * 0.78;
    box(0.3, 0.04, 2.5, wood, -6.15, base - 0.02, 1.5);
    for (let k = 0; k < 10; k++) {
      const h = 0.36 + ((k * 7 + s * 3) % 4) * 0.05;
      box(0.16, h, 0.17, bookCols[(k + s) % 5], -6.2, base + h / 2, 0.4 + k * 0.23);
    }
  }
  addBoxCol(-6.55, 1.5, 0.6, 2.6);
  // drawer cabinet on the right wall
  box(0.6, 1.9, 1.8, darkWood, 6.5, 0.95, -2.2);
  box(0.7, 0.06, 1.9, wood, 6.5, 1.93, -2.2);
  for (let d = 0; d < 3; d++) {
    box(0.02, 0.42, 1.5, wood, 6.19, 0.4 + d * 0.55, -2.2);
    sphere(0.03, brass, 6.17, 0.4 + d * 0.55, -2.2);
  }
  addBoxCol(6.5, -2.2, 0.7, 1.9);
  // clockmaker's workbench on the back wall (right side) with gears + clock face
  box(3.0, 0.1, 0.8, wood, 2.4, 0.95, 5.4);
  [[-1.4, -0.3], [1.4, -0.3], [-1.4, 0.3], [1.4, 0.3]].forEach(p => box(0.08, 0.9, 0.08, wood, 2.4 + p[0], 0.45, 5.4 + p[1]));
  cyl(0.22, 0.22, 0.04, brass, 1.7, 1.02, 5.4);
  cyl(0.14, 0.14, 0.04, brass, 2.15, 1.02, 5.5);
  cyl(0.4, 0.4, 0.06, M(0xe9dfc2), 3.1, 1.35, 5.6).rotation.x = Math.PI / 2;
  addBoxCol(2.4, 5.4, 3.1, 0.9);
  // two chairs behind the table
  [-0.6, 0.6].forEach(cx => {
    box(0.5, 0.05, 0.5, wood, cx, 0.5, 1.25);
    box(0.5, 0.6, 0.05, wood, cx, 0.82, 1.5);
    [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(p => box(0.05, 0.5, 0.05, wood, cx + p[0], 0.25, 1.25 + p[1]));
    addBoxCol(cx, 1.3, 0.5, 0.5);
  });
  // door in the back wall (the assistant walks in through it)
  box(0.12, 2.6, 0.14, wood, -4.2, 1.3, 5.74); box(0.12, 2.6, 0.14, wood, -2.8, 1.3, 5.74);
  box(1.52, 0.14, 0.14, wood, -3.5, 2.67, 5.74); box(1.3, 2.55, 0.05, M(0x07070a), -3.5, 1.28, 5.77);
  // desk props: lantern, inkpot + quill, books, gear + wrench
  cyl(0.09, 0.1, 0.04, darkWood, -1.1, 1.03, 0.35);
  cyl(0.065, 0.065, 0.2, M(0xffd27a, { emissive: 0xffa530, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 }), -1.1, 1.15, 0.35);
  cyl(0.02, 0.085, 0.05, brass, -1.1, 1.275, 0.35);
  const lp = new THREE.PointLight(0xffb060, 3, 3.5); lp.position.set(-1.1, 1.35, 0.35); scene.add(lp);
  cyl(0.05, 0.058, 0.07, M(0x0d0d12, { roughness: 0.3 }), 1.1, 1.045, 0.4);
  cyl(0.004, 0.006, 0.3, M(0xe8e0cc), 1.16, 1.19, 0.4).rotation.z = -0.5;
  box(0.3, 0.05, 0.22, M(0x5a1f1f), 1.1, 1.035, -0.5);
  box(0.27, 0.045, 0.2, M(0x1f3a5a), 1.1, 1.0825, -0.5).rotation.y = 0.15;
  box(0.24, 0.04, 0.18, M(0x2f4a2a), 1.1, 1.125, -0.5).rotation.y = -0.1;
  cyl(0.09, 0.09, 0.025, brass, -1.0, 1.0225, -0.45);
  box(0.2, 0.015, 0.035, steel, -0.8, 1.02, -0.55).rotation.y = 0.6;
}
// CASE2_LIGHT_V1 BEGIN :: ceiling, ceiling LEDs, wall sconces, windows, moonlight (case 2 + 3)
if (caseNum >= 2 && caseNum <= 6) {
  const c2Brass = M(0xb8860b, { metalness: 0.8, roughness: 0.35 });
  const c2Frame = M(0x1c120d, { roughness: 0.8 });
  const c2Beam = M(0x33220f, { roughness: 0.55 });
  const c2Ceil = M(0x2c2a33, { roughness: 0.82, side: THREE.DoubleSide });
  const c2Glass = M(0x3d5475, { roughness: 0.1, metalness: 0.9, opacity: 0.85, transparent: true, side: THREE.DoubleSide, emissive: 0x16233d, emissiveIntensity: 0.8 });
  // ceiling + beams
  const cc = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), c2Ceil); cc.rotation.x = Math.PI / 2; cc.position.set(0, 5, 0); scene.add(cc);
  for (let b = -4; b <= 4; b += 4) { box(14, 0.12, 0.18, c2Beam, 0, 4.94, b); box(0.18, 0.12, 12, c2Beam, b, 4.94, 0); }
  // ceiling LED lights (some with a real light)
  const ledLens = M(0xffecc4, { emissive: 0xffcc44, emissiveIntensity: 2.2 });
  function c2LED(x, z, real) {
    const g = new THREE.Group();
    const bez = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 24), c2Brass); bez.rotation.x = Math.PI / 2; g.add(bez);
    cyl(0.13, 0.13, 0.015, ledLens, 0, 0.005, 0, g, 20);
    if (real) { const l = new THREE.PointLight(0xffd066, 10, 8, 1.6); l.position.y = -0.3; g.add(l); }
    g.position.set(x, 4.98, z); scene.add(g);
  }
  [[-2.6, -2.6, false], [2.6, -2.6, true], [-2.6, 2.6, true], [2.6, 2.6, false], [-4.6, 0, false], [4.6, 0, true]].forEach(a => c2LED(...a));
  // hanging brass lamp over the desk (visual)
  cyl(0.012, 0.012, 1.8, c2Brass, 0, 4.1, 0, scene, 8);
  cyl(0.12, 0.3, 0.22, c2Brass, 0, 3.1, 0, scene, 20);
  sphere(0.07, ledLens, 0, 3.02, 0);
  // wall sconces (same design as Level 1)
  function c2Sconce(x, y, z, rotY) {
    const g = new THREE.Group();
    const glow = M(0xffecc4, { emissive: 0xffaa22, emissiveIntensity: 2.4 });
    const plate = cyl(0.07, 0.07, 0.02, c2Brass, 0, 0, 0, g); plate.rotation.x = Math.PI / 2;
    const arm = cyl(0.012, 0.012, 0.12, c2Brass, 0, 0, 0.06, g, 8); arm.rotation.x = Math.PI / 2;
    cyl(0.045, 0.025, 0.03, c2Brass, 0, 0, 0.125, g, 12);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.038, 0.12, 16, 1, true), M(0xffdfaa, { transparent: true, opacity: 0.85, roughness: 0.25, side: THREE.DoubleSide }));
    shade.position.set(0, 0.075, 0.125); g.add(shade);
    sphere(0.027, glow, 0, 0.07, 0.125, g);
    g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g);
  }
  [[-2.15, 2.5, 5.78, Math.PI], [0.5, 2.5, 5.78, Math.PI], [4.6, 2.5, 5.78, Math.PI],
   [-3.2, 2.5, -5.78, 0], [3.2, 2.5, -5.78, 0],
   [-6.78, 2.5, -4.3, Math.PI / 2], [-6.78, 2.5, -0.9, Math.PI / 2], [-6.78, 2.5, 3.9, Math.PI / 2],
   [6.78, 2.6, -2.2, -Math.PI / 2], [6.78, 2.6, -0.2, -Math.PI / 2], [6.78, 2.6, 4.2, -Math.PI / 2]].forEach(a => c2Sconce(...a));
  // windows + moonlight
  function c2Window(x, y, z, rotY, w, h) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), c2Glass));
    box(w + 0.2, 0.1, 0.1, c2Frame, 0, h / 2 + 0.05, 0, g); box(w + 0.2, 0.1, 0.1, c2Frame, 0, -h / 2 - 0.05, 0, g);
    box(0.1, h + 0.2, 0.1, c2Frame, -w / 2 - 0.05, 0, 0, g); box(0.1, h + 0.2, 0.1, c2Frame, w / 2 + 0.05, 0, 0, g);
    box(0.05, h, 0.05, c2Frame, 0, 0, 0, g); box(w, 0.05, 0.05, c2Frame, 0, 0, 0, g);
    box(w + 0.4, 0.06, 0.22, c2Frame, 0, -h / 2 - 0.13, 0.06, g);
    g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g);
  }
  c2Window(-0.8, 2.6, 5.76, Math.PI, 1.4, 2.0);
  c2Window(-6.76, 2.6, -2.5, Math.PI / 2, 1.4, 2.0);
  c2Window(6.76, 2.6, 2.0, -Math.PI / 2, 1.4, 2.0);
  [[-0.8, 2.6, 5.2], [-6.2, 2.7, -2.5], [6.2, 2.7, 2.0]].forEach(p => { const l = new THREE.PointLight(0x7aa0e0, 8, 7, 1.6); l.position.set(p[0], p[1], p[2]); scene.add(l); });
  const c2Moon = new THREE.DirectionalLight(0x4a6fa5, 1.2); c2Moon.position.set(8, 6, 2); scene.add(c2Moon);
}
// CASE2_LIGHT_V1 END
// CASE456_PATCH_V1 BEGIN :: story-themed extras (4 Opera House, 5 Smuggler's Vault, 6 Antiquities Archive)
if (caseNum >= 4 && caseNum <= 6) {
  const gold = M(0xd4af37, { metalness: 0.85, roughness: 0.3 });
  const iron = M(0x2a2d33, { metalness: 0.8, roughness: 0.5 });
  const dark = M(0x0b0b0e, { roughness: 0.35 });
  const paper = M(0xf1ead8, { roughness: 0.8 });
  const AX = -0.15, AZ = -0.5, BX = 0.5, BZ = 0.5;   // two free spots on the desk
  if (caseNum === 4) {            // ROYAL OPERA HOUSE: velvet curtains, grand piano, opera mask + glasses
    const velvet = M(0x6b0f1a, { roughness: 0.9 });
    [-1.75, 0.15].forEach(x => box(0.5, 3.6, 0.12, velvet, x, 2.4, 5.72));
    [-3.45, -1.55].forEach(z => box(0.12, 3.6, 0.5, velvet, -6.72, 2.4, z));
    [1.05, 2.95].forEach(z => box(0.12, 3.6, 0.5, velvet, 6.72, 2.4, z));
    box(1.3, 0.9, 1.6, dark, 5.35, 0.6, 4.1); box(1.35, 0.05, 1.65, dark, 5.35, 1.075, 4.1);
    box(0.25, 0.04, 1.3, paper, 4.62, 1.07, 4.1); box(0.12, 0.03, 1.0, dark, 4.66, 1.095, 4.1);
    [[-0.55, -0.7], [-0.55, 0.7], [0.55, -0.7], [0.55, 0.7]].forEach(p => box(0.08, 0.15, 0.08, dark, 5.35 + p[0], 0.075, 4.1 + p[1]));
    box(0.45, 0.06, 1.0, velvet, 4.05, 0.5, 4.1); box(0.06, 0.5, 0.06, dark, 4.05, 0.25, 3.7); box(0.06, 0.5, 0.06, dark, 4.05, 0.25, 4.5);
    addBoxCol(5.3, 4.1, 1.5, 1.7);
    cyl(0.105, 0.105, 0.01, gold, AX, 1.012, AZ); cyl(0.1, 0.1, 0.02, paper, AX, 1.025, AZ);
    box(0.03, 0.006, 0.016, dark, AX - 0.035, 1.037, AZ); box(0.03, 0.006, 0.016, dark, AX + 0.035, 1.037, AZ);
    cyl(0.03, 0.03, 0.07, gold, BX - 0.05, 1.045, BZ); cyl(0.03, 0.03, 0.07, gold, BX + 0.05, 1.045, BZ); box(0.05, 0.015, 0.015, gold, BX, 1.05, BZ);
    const op = new THREE.PointLight(0xff6a4a, 5, 6); op.position.set(5.0, 2.6, 3.2); scene.add(op);
  } else if (caseNum === 5) {     // HARBOR SMUGGLER'S VAULT: barred windows, crates, barrels, rope + coins
    const crate = M(0x6a4a24, { roughness: 0.85 }), wood = M(0x5a3a1c, { roughness: 0.85 });
    for (let k = -3; k <= 3; k++) {
      box(0.03, 2.0, 0.03, iron, -0.8 + k * 0.2, 2.6, 5.7);
      box(0.03, 2.0, 0.03, iron, -6.7, 2.6, -2.5 + k * 0.2);
      box(0.03, 2.0, 0.03, iron, 6.7, 2.6, 2.0 + k * 0.2);
    }
    box(1.0, 1.0, 1.0, crate, -5.9, 0.5, -5.0); box(0.9, 0.9, 0.9, crate, -5.9, 1.45, -5.0).rotation.y = 0.3;
    box(1.0, 1.0, 1.0, crate, -4.8, 0.5, -5.1); box(1.02, 0.08, 1.02, iron, -5.9, 0.5, -5.0); box(1.02, 0.08, 1.02, iron, -4.8, 0.5, -5.1);
    addBoxCol(-5.35, -5.05, 2.2, 1.2);
    [[5.9, -5.0], [5.0, -5.2], [5.6, -4.1]].forEach(p => {
      cyl(0.4, 0.4, 0.9, wood, p[0], 0.45, p[1]); cyl(0.41, 0.41, 0.05, iron, p[0], 0.25, p[1]); cyl(0.41, 0.41, 0.05, iron, p[0], 0.65, p[1]);
      addCircleCol(p[0], p[1], 0.45);
    });
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 20), M(0xb89a63, { roughness: 0.95 })); rope.rotation.x = Math.PI / 2; rope.position.set(AX, 1.03, AZ); scene.add(rope);
    cyl(0.03, 0.03, 0.012, gold, BX, 1.016, BZ); cyl(0.03, 0.03, 0.012, gold, BX, 1.028, BZ); cyl(0.03, 0.03, 0.012, gold, BX + 0.07, 1.016, BZ + 0.03);
    cyl(0.06, 0.06, 0.02, gold, BX - 0.15, 1.02, BZ);
    const vl = new THREE.PointLight(0x4fa3a0, 6, 7); vl.position.set(-5, 1.6, -4.5); scene.add(vl);
  } else {                        // ROYAL ANTIQUITIES ARCHIVE: display cases, marble bust, columns, sarcophagus, scroll + ring
    const marble = M(0xd9d6cf, { roughness: 0.4 }), stone = M(0x6b645a, { roughness: 0.9 });
    const glassC = M(0xaad4ff, { transparent: true, opacity: 0.25, roughness: 0.05 });
    [[-4.8, -4.4], [-5.6, 4.4]].forEach(p => {
      box(0.8, 0.9, 0.8, marble, p[0], 0.45, p[1]); box(0.7, 0.6, 0.7, glassC, p[0], 1.2, p[1]);
      cyl(0.12, 0.16, 0.2, gold, p[0], 1.0, p[1]); addBoxCol(p[0], p[1], 0.9, 0.9);
    });
    cyl(0.25, 0.3, 1.0, marble, 5.6, 0.5, 0.6); box(0.34, 0.25, 0.2, marble, 5.6, 1.12, 0.6); sphere(0.13, marble, 5.6, 1.36, 0.6);
    addCircleCol(5.6, 0.6, 0.35);
    [[-6.2, -5.2], [6.2, -5.2]].forEach(p => { cyl(0.3, 0.3, 5, marble, p[0], 2.5, p[1]); addCircleCol(p[0], p[1], 0.32); });
    box(0.9, 0.6, 2.0, stone, 5.2, 0.3, -3.9); box(1.0, 0.2, 2.1, gold, 5.2, 0.7, -3.9); addBoxCol(5.2, -3.9, 1.1, 2.2);
    cyl(0.025, 0.025, 0.3, paper, AX, 1.035, AZ).rotation.z = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), gold); ring.rotation.x = Math.PI / 2; ring.position.set(BX, 1.03, BZ); scene.add(ring);
    cyl(0.01, 0.01, 0.14, gold, BX + 0.13, 1.03, BZ).rotation.z = Math.PI / 2;
    box(0.18, 0.03, 0.12, stone, BX - 0.18, 1.025, BZ - 0.02).rotation.y = 0.3;
    const al = new THREE.PointLight(0xcfe0ff, 6, 7); al.position.set(-5, 2.0, -4.4); scene.add(al);
  }
}
// CASE456_PATCH_V1 END
const cKeys = Object.keys(activeCase.clues);
spawnClue(cKeys[0], activeCase.clues[cKeys[0]].img, 0.28, -0.65, 1.01, 0.1, 0.2, true);
spawnClue(cKeys[1], activeCase.clues[cKeys[1]].img, 0.32, 0.65, 1.01, -0.2, -0.3, false);
spawnClue(cKeys[2], activeCase.clues[cKeys[2]].img, 0.30, 0.0, 1.01, 0.3, 0.1, false);
spawnNPC('assistant', activeCase.suspects.assistant.nameEn, (caseNum >= 2 && caseNum <= 6) ? -3.5 : -1.8, (caseNum >= 2 && caseNum <= 6) ? 5.45 : 1.5, (caseNum >= 2 && caseNum <= 6) ? Math.PI : Math.PI / 4, { cloth: 0x1e3a5f, lower: 0x0f1d2e });
if (caseNum >= 2 && caseNum <= 6) { const __n = npcs[npcs.length - 1]; __n.hit = interactables[interactables.length - 1]; __n.col = colliders[colliders.length - 1]; }
const sKey = Object.keys(activeCase.suspects).find(k => k !== 'assistant');
const primeSuspect = activeCase.suspects[sKey];
spawnNPC(sKey, primeSuspect.nameEn, 1.8, 1.5, -Math.PI / 4, { cloth: 0x5a2a22, lower: 0x1a1a24 });
const MOTES = 260, moteArr = new Float32Array(MOTES * 3), motePh = new Float32Array(MOTES);
for (let i = 0; i < MOTES; i++) {
  moteArr[i * 3] = (Math.random() - 0.5) * 14;
  moteArr[i * 3 + 1] = 0.5 + Math.random() * 4.0;
  moteArr[i * 3 + 2] = (Math.random() - 0.5) * 12;
  motePh[i] = Math.random() * Math.PI * 2;
}
const moteGeo = new THREE.BufferGeometry();
moteGeo.setAttribute('position', new THREE.BufferAttribute(moteArr, 3));
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xffd780, size: 0.02, transparent: true, opacity: 0.6 }));
scene.add(motes);
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
          const d = Math.sqrt(d2);
          if (d > 1e-8) { p.x = nx + dx / d * r; p.z = nz + dz / d * r; }
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
  if (moving) wish.normalize().multiplyScalar(keys.ShiftLeft || keys.ShiftRight ? 4.8 : 3.2);
  velv.lerp(wish, 1 - Math.exp(-dt * (moving ? 9 : 7)));
  const p = { x: camera.position.x + velv.x * dt, z: camera.position.z + velv.z * dt };
  resolveCollisions(p, PLAYER_R);
  camera.position.x = p.x; camera.position.z = p.z;
  const spd = velv.length();
  if (spd > 0.4) {
    bobT += dt * spd * 2.6;
    stepTimer += dt;
    if (stepTimer > 0.5 * 3.3 / Math.max(spd, 1.5)) { stepTimer = 0; audio.playFootstep(); }
  }
  camera.position.y = 1.65 + Math.sin(bobT) * 0.02 * Math.min(1, spd / 3);
}
const ray = new THREE.Raycaster(); ray.far = 3.6;
const screenCenter = new THREE.Vector2(0, 0);
let activeTarget = null;
const anyUiOpen = () => isInspecting || isInterrogating || isNotebookOpen || isDeducing || outcomeOpen;
function updateInteraction() {
  activeTarget = null;
  if (controls.isLocked && !anyUiOpen()) {
    ray.setFromCamera(screenCenter, camera);
    const hits = ray.intersectObjects(interactables, false);
    if (hits.length && hits[0].object.userData.interact) activeTarget = hits[0].object.userData;
  }
  if (activeTarget) {
    if (activeTarget.type === 'clue') {
      promptActionEl.textContent = currentLang === 'hi' ? 'जाँचें' : 'Inspect';
      promptTargetEl.textContent = activeCase.clues[activeTarget.id][currentLang].title;
    } else {
      const s = activeCase.suspects[activeTarget.id];
      promptActionEl.textContent = currentLang === 'hi' ? 'बात करें' : 'Talk to';
      promptTargetEl.textContent = currentLang === 'hi' ? s.nameHi : s.nameEn;
    }
    promptEl.style.display = 'flex'; reticleEl.classList.add('active');
  } else {
    promptEl.style.display = 'none'; reticleEl.classList.remove('active');
  }
}
let score = 0, cluesDiscovered = 0, contradictionsFound = 0;
let gameStarted = false, isInspecting = false, isInterrogating = false, isNotebookOpen = false, isDeducing = false, outcomeOpen = false;
let currentSuspect = null, collectedClues = [], exposed = {}, assistantStep = 0;
let seqId = 0, typewriterTimer = null;
const promptEl = $('interaction-prompt'), promptActionEl = $('prompt-action'), promptTargetEl = $('prompt-target'), reticleEl = $('reticle');
const blocker = $('blocker'), instructionsMenu = $('instructions'), pauseMenu = $('pause-menu');
const startBtn = $('start-btn'), resumeBtn = $('resume-btn'), pauseDeduceBtn = $('pause-deduce-btn'), pauseNotebookBtn = $('pause-notebook-btn');
const modalEl = $('inspection-modal'), dossierTitleEl = $('dossier-title'), dossierLocEl = $('dossier-location'), dossierDescEl = $('dossier-desc'), dossierNoteEl = $('dossier-note'), dossierImgEl = $('dossier-img'), closeModalBtn = $('close-modal-btn');
const dialogueModal = $('dialogue-modal'), suspectAvatarEl = $('suspect-avatar'), suspectNameEl = $('suspect-name'), suspectRoleEl = $('suspect-role'), dialogueSpeechEl = $('dialogue-speech'), typingCursor = $('typing-cursor');
const choiceAlibi = $('choice-alibi'), choiceMotive = $('choice-motive'), choiceConfront = $('choice-confront'), textChoiceAlibi = $('text-choice-alibi'), textChoiceMotive = $('text-choice-motive'), textChoiceConfront = $('text-choice-confront');
const evidenceSelector = $('evidence-selector'), chipsContainer = $('evidence-chips-container'), cancelConfrontBtn = $('cancel-confront-btn'), leaveDialogueBtn = $('leave-dialogue-btn'), contradictionBanner = $('contradiction-banner');
const notebookModal = $('notebook-modal'), notebookList = $('notebook-clues-list'), closeNotebookBtn = $('close-notebook-btn'), notebookHudBtn = $('notebook-hud-btn'), solveShortcutBtn = $('solve-shortcut-btn');
const deductionModal = $('deduction-modal'), deduceCulpritEl = $('deduce-culprit'), deduceMotiveEl = $('deduce-motive'), deduceEvidenceEl = $('deduce-evidence'), submitAccusationBtn = $('submit-accusation-btn'), cancelDeductionBtn = $('cancel-deduction-btn');
const winModal = $('win-modal'), lossModal = $('loss-modal'), winFinalScoreEl = $('win-final-score'), winStoryTxt = $('win-story-txt'), failExplanationEl = $('fail-explanation');
const winRestartBtn = $('win-restart-btn'), nextCaseBtn = $('next-case-btn'), retryDeductionBtn = $('retry-deduction-btn'), fullRestartBtn = $('full-restart-btn');
const detectiveNameInput = $('detective-name-input'), hudDetectiveName = $('hud-detective-name'), scoreEl = $('score-display'), clueEl = $('clue-display'), contraEl = $('contra-display');
const langToggleBtn = $('lang-toggle-btn'), voiceToggleBtn = $('voice-toggle-btn'), audioToggleBtn = $('audio-toggle-btn');
const deductionReadyBanner = $('deduction-ready-banner');
const getName = () => detectiveNameInput.value.trim() || 'Vance';
function updateHUD() {
  scoreEl.textContent = score;
  clueEl.textContent = `${cluesDiscovered} / 3`;
  contraEl.textContent = `${contradictionsFound} / 1`;
  hudDetectiveName.textContent = getName();
  if (contradictionsFound >= 1) deductionReadyBanner.classList.remove('hidden');
}
deduceCulpritEl.innerHTML = '<option value="">-- Choose Suspect --</option>' +
  activeCase.deductionOptions.culprits.map(c => `<option value="${c.val}">${c.label}</option>`).join('');
deduceMotiveEl.innerHTML = '<option value="">-- Choose Motive --</option>' +
  activeCase.deductionOptions.motives.map(m => `<option value="${m.val}">${m.label}</option>`).join('');
deduceEvidenceEl.innerHTML = '<option value="">-- Choose Key Evidence --</option>' +
  activeCase.deductionOptions.evidence.map(e => `<option value="${e.val}">${e.label}</option>`).join('');
function typewriter(text, charId, onComplete) {
  seqId++; const id = seqId;
  if (typewriterTimer) clearInterval(typewriterTimer);
  dialogueSpeechEl.textContent = '';
  typingCursor.classList.remove('hidden');
  voiceEngine.speakAs(charId, text, () => {});
  let idx = 0;
  typewriterTimer = setInterval(() => {
    if (id !== seqId) { clearInterval(typewriterTimer); return; }
    if (idx < text.length) { dialogueSpeechEl.textContent += text[idx]; idx++; }
    else { clearInterval(typewriterTimer); typingCursor.classList.add('hidden'); if (onComplete) onComplete(); }
  }, 24);
}
function openDialogue(s) {
  currentSuspect = s; isInterrogating = true; promptEl.style.display = 'none';
  suspectAvatarEl.textContent = s.emoji || '👤';
  suspectNameEl.textContent = currentLang === 'hi' ? s.nameHi : s.nameEn;
  suspectRoleEl.textContent = currentLang === 'hi' ? s.roleHi : s.roleEn;
  dialogueModal.classList.remove('hidden'); blocker.classList.add('hidden');
  if (controls.isLocked) controls.unlock();
  contradictionBanner.classList.add('hidden'); evidenceSelector.classList.add('hidden');
  if (s.isAssistant) {
    assistantStep = 0;
    choiceMotive.style.display = 'none'; choiceConfront.style.display = 'none';
    choiceAlibi.style.display = 'flex';
    textChoiceAlibi.textContent = currentLang === 'hi' ? 'अगला भाग सुनें...' : 'Listen to next briefing part...';
    typewriter(activeCase.briefings[currentLang][0], 'assistant');
    return;
  }
  choiceMotive.style.display = 'flex'; choiceConfront.style.display = 'flex';
  textChoiceAlibi.textContent = currentLang === 'hi' ? 'आप घटना के समय कहाँ थे?' : 'Where were you at the time of the incident?';
  textChoiceMotive.textContent = currentLang === 'hi' ? 'पीड़ित के साथ आपके संबंध कैसे थे?' : 'What was your connection to the victim?';
  textChoiceConfront.textContent = currentLang === 'hi' ? 'मेरे पास सबूत है...' : 'I have evidence that contradicts you...';
  typewriter(currentLang === 'hi' ? s.introHi : s.introEn, s.id);
}
function closeDialogue() {
  isInterrogating = false; dialogueModal.classList.add('hidden');
  try { controls.lock(); } catch (e) {}
}
leaveDialogueBtn.addEventListener('click', closeDialogue);
choiceAlibi.addEventListener('click', () => {
  if (!currentSuspect) return;
  const s = currentSuspect;
  if (s.isAssistant) {
    assistantStep++;
    const b = activeCase.briefings[currentLang];
    if (assistantStep < b.length) {
      typewriter(b[assistantStep], 'assistant');
      if (assistantStep === b.length - 1) textChoiceAlibi.textContent = currentLang === 'hi' ? 'ब्रीफिंग समाप्त करें' : 'Conclude Briefing';
    } else closeDialogue();
    return;
  }
  typewriter(currentLang === 'hi' ? s.alibiHi : s.alibiEn, s.id);
});
choiceMotive.addEventListener('click', () => {
  if (currentSuspect && !currentSuspect.isAssistant) typewriter(currentLang === 'hi' ? currentSuspect.motiveHi : currentSuspect.motiveEn, currentSuspect.id);
});
choiceConfront.addEventListener('click', () => {
  if (!currentSuspect || currentSuspect.isAssistant) return;
  if (!collectedClues.length) {
    typewriter(currentLang === 'hi' ? 'पहले साक्ष्य इकट्ठा करें!' : 'You have no collected evidence yet!', currentSuspect.id);
    return;
  }
  chipsContainer.innerHTML = '';
  collectedClues.forEach(cid => {
    const b = document.createElement('button'); b.className = 'evidence-chip';
    b.textContent = activeCase.clues[cid][currentLang].title;
    b.addEventListener('click', () => {
      evidenceSelector.classList.add('hidden');
      if (currentSuspect.contradiction === cid) {
        if (!exposed[currentSuspect.id]) {
          exposed[currentSuspect.id] = true;
          contradictionsFound++; score += 150; audio.playContradictionSound();
          contradictionBanner.classList.remove('hidden'); updateHUD();
        }
        typewriter(currentLang === 'hi' ? currentSuspect.confessHi : currentSuspect.confessEn, currentSuspect.id);
      } else {
        typewriter(currentLang === 'hi' ? 'डिटेक्टिव, इसका मुझसे कोई संबंध नहीं!' : 'What does that have to do with me, Detective?', currentSuspect.id);
      }
    });
    chipsContainer.appendChild(b);
  });
  evidenceSelector.classList.remove('hidden');
});
cancelConfrontBtn.addEventListener('click', () => evidenceSelector.classList.add('hidden'));
function openInspection(id) {
  const clue = activeCase.clues[id], d = clue[currentLang];
  isInspecting = true; promptEl.style.display = 'none';
  if (!collectedClues.includes(id)) {
    collectedClues.push(id); cluesDiscovered++; score += 100;
    audio.playInspectSound();
    if (clueRings[id]) clueRings[id].material.opacity = 0.25;
    updateHUD();
  }
  dossierTitleEl.textContent = d.title; dossierLocEl.textContent = d.loc;
  dossierDescEl.textContent = d.desc; dossierNoteEl.textContent = d.note;
  dossierImgEl.src = clue.img; dossierImgEl.classList.remove('hidden');
  modalEl.classList.remove('hidden');
  if (controls.isLocked) controls.unlock();
}
closeModalBtn.addEventListener('click', () => {
  isInspecting = false; modalEl.classList.add('hidden');
  try { controls.lock(); } catch (e) {}
});
function openNotebook() {
  isNotebookOpen = true; notebookList.innerHTML = '';
  if (!collectedClues.length) notebookList.innerHTML = `<p style="color:#8c92a4;">${currentLang === 'hi' ? 'कोई साक्ष्य नहीं मिला।' : 'No clues collected yet.'}</p>`;
  else {
    collectedClues.forEach(cid => {
      const c = activeCase.clues[cid], d = c[currentLang];
      const card = document.createElement('div'); card.className = 'clue-entry-card';
      card.innerHTML = `<img class="notebook-clue-img" src="${c.img}" alt="" /><div class="clue-entry-content"><h4>${d.title}</h4><p>${d.desc}</p><span class="note">${d.note}</span></div>`;
      notebookList.appendChild(card);
    });
  }
  notebookModal.classList.remove('hidden');
  if (controls.isLocked) controls.unlock();
}
closeNotebookBtn.addEventListener('click', () => { isNotebookOpen = false; notebookModal.classList.add('hidden'); try { controls.lock(); } catch (e) {} });
notebookHudBtn.addEventListener('click', () => { if (isNotebookOpen) { isNotebookOpen = false; notebookModal.classList.add('hidden'); try { controls.lock(); } catch (e) {} } else openNotebook(); });
function openDeduction() {
  isDeducing = true; deductionReadyBanner.classList.add('hidden');
  deductionModal.classList.remove('hidden');
  if (controls.isLocked) controls.unlock();
}
cancelDeductionBtn.addEventListener('click', () => { isDeducing = false; deductionModal.classList.add('hidden'); try { controls.lock(); } catch (e) {} });
solveShortcutBtn.addEventListener('click', openDeduction);
submitAccusationBtn.addEventListener('click', () => {
  const c = deduceCulpritEl.value, m = deduceMotiveEl.value, e = deduceEvidenceEl.value;
  if (!c || !m || !e) return;
  isDeducing = false; deductionModal.classList.add('hidden'); outcomeOpen = true;
  const sol = activeCase.solution;
  if (c === sol.culprit && m === sol.motive && e === sol.evidence) {
    score += 500; audio.playVictorySound();
    winFinalScoreEl.textContent = score; winStoryTxt.textContent = caseText('winStory');
    winModal.classList.remove('hidden');
    voiceEngine.speakAs(activeCase.confessionVoice, caseText('confessionText'));
  } else {
    score = Math.max(0, score - 100); audio.playFailSound();
    failExplanationEl.textContent = currentLang === 'hi' ? 'मजिस्ट्रेट ने अपर्याप्त सबूत के कारण आरोप खारिज कर दिया।' : 'The Magistrate rejected your accusation due to insufficient physical proof.';
    lossModal.classList.remove('hidden');
  }
  updateHUD();
});
retryDeductionBtn.addEventListener('click', () => { lossModal.classList.add('hidden'); outcomeOpen = false; openDeduction(); });
fullRestartBtn.addEventListener('click', () => location.reload());
winRestartBtn.addEventListener('click', () => location.reload());
nextCaseBtn.addEventListener('click', () => { window.location.href = activeCase.nextUrl; });
startBtn.addEventListener('click', () => {
  audio.init(); gameStarted = true; startAssistantWalk();
  blocker.classList.add('hidden'); instructionsMenu.classList.add('hidden');
  try { controls.lock(); } catch (e) {}
  updateHUD();
});
controls.addEventListener('unlock', () => {
  if (gameStarted && !anyUiOpen()) {
    blocker.classList.remove('hidden'); instructionsMenu.classList.add('hidden'); pauseMenu.classList.remove('hidden');
  }
});
resumeBtn.addEventListener('click', () => {
  pauseMenu.classList.add('hidden'); blocker.classList.add('hidden');
  try { controls.lock(); } catch (e) {}
});
window.addEventListener('keydown', (e) => {
  if (!gameStarted) return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && !(e.target && e.target.tagName === 'SELECT')) e.preventDefault();
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyE':
      if (isInspecting) { isInspecting = false; modalEl.classList.add('hidden'); try { controls.lock(); } catch (err) {} }
      else if (isInterrogating) closeDialogue();
      else if (activeTarget && controls.isLocked && !anyUiOpen()) {
        if (activeTarget.type === 'clue') openInspection(activeTarget.id);
        else openDialogue(activeCase.suspects[activeTarget.id]);
      }
      break;
    case 'KeyN': if (!anyUiOpen()) openNotebook(); else if (isNotebookOpen) { isNotebookOpen = false; notebookModal.classList.add('hidden'); try { controls.lock(); } catch (err) {} } break;
    case 'KeyK': if (!anyUiOpen()) openDeduction(); break;
    case 'Escape':
      if (isInspecting) { isInspecting = false; modalEl.classList.add('hidden'); try { controls.lock(); } catch (err) {} }
      else if (isInterrogating) closeDialogue();
      else if (isNotebookOpen) { isNotebookOpen = false; notebookModal.classList.add('hidden'); try { controls.lock(); } catch (err) {} }
      else if (isDeducing) { isDeducing = false; deductionModal.classList.add('hidden'); try { controls.lock(); } catch (err) {} }
      break;
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
langToggleBtn.addEventListener('click', () => {
  currentLang = currentLang === 'en' ? 'hi' : 'en';
  langToggleBtn.textContent = currentLang === 'hi' ? '🌐 LANG: ENGLISH' : '🌐 भाषा: HINDI';
});
voiceToggleBtn.addEventListener('click', () => {
  const on = voiceEngine.setVoiceState(!voiceEngine.voiceEnabled);
  voiceToggleBtn.textContent = on ? '🗣️ VOICE: ON' : '🔇 VOICE: OFF';
});
audioToggleBtn.addEventListener('click', () => {
  audio.init();
  audioToggleBtn.textContent = audio.toggleMute() ? '🔊 AUDIO: ON' : '🔇 AUDIO: OFF';
});
// CASE2_PATCH_V1 :: assistant walks in through the back door and starts the briefing
const ASSISTANT_WALK = {
  state: 'idle', i: 0, timer: 0, stepT: 0, delay: 1.2, speed: 1.5, stopDist: 1.7,
  route: [{ x: -3.5, z: 3.2 }, { x: -2.4, z: -0.2 }, { x: -2.0, z: -1.2 }]
};
function startAssistantWalk() {
  if (!(caseNum >= 2 && caseNum <= 6) || ASSISTANT_WALK.state !== 'idle') return;
  ASSISTANT_WALK.state = 'wait'; ASSISTANT_WALK.timer = ASSISTANT_WALK.delay;
}
function updateAssistantWalk(dt) {
  const W = ASSISTANT_WALK;
  if (W.state === 'idle' || W.state === 'done') return;
  const a = npcs.find(n => n.id === 'assistant');
  if (!a) { W.state = 'done'; return; }
  if (isInterrogating && currentSuspect && currentSuspect.id === 'assistant') { W.state = 'done'; a.walking = false; return; }
  if (!controls.isLocked || anyUiOpen()) return;
  if (W.state === 'wait') { W.timer -= dt; if (W.timer <= 0) { W.state = 'walk'; a.walking = true; } return; }
  const px = camera.position.x, pz = camera.position.z;
  if (Math.hypot(px - a.x, pz - a.z) <= W.stopDist) {
    W.state = 'done'; a.walking = false; a.group.position.y = 0; a.group.rotation.z = 0;
    openDialogue(activeCase.suspects.assistant);
    return;
  }
  let tx = px, tz = pz;
  const wp = W.route[W.i];
  if (wp) { tx = wp.x; tz = wp.z; if (Math.hypot(wp.x - a.x, wp.z - a.z) < 0.2) W.i++; }
  const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
  if (d < 1e-4) return;
  const step = Math.min(d, W.speed * dt);
  a.x += dx / d * step; a.z += dz / d * step;
  a.group.position.set(a.x, Math.abs(Math.sin(animTime * 9)) * 0.045, a.z);
  a.group.rotation.z = Math.sin(animTime * 9) * 0.025;
  let diff = Math.atan2(dx, dz) - a.group.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  a.group.rotation.y += diff * Math.min(1, dt * 8);
  if (a.hit) a.hit.position.set(a.x, 0.95, a.z);
  if (a.col) { a.col.x = a.x; a.col.z = a.z; }
  W.stepT += dt; if (W.stepT > 0.55) { W.stepT = 0; try { audio.playFootstep(); } catch (e) {} }
}

// CASE_HI_V1 BEGIN :: full Hindi UI for cases 2-6 (same behaviour as Level 1)
const CASE_HI = {
  2: { subtitle: 'रात 11:42 बजे तोड़फोड़ — मास्टर होरेस वेंस की मौत',
       winStory: 'ग्रीस से सने मोनोग्राम वाले रूमाल और जाली पेटेंट कागज़ातों के सामने एलिस्टर फिंच टूट गया और उसने क्लॉक टॉवर में तोड़फोड़ करने और मास्टर वेंस की हत्या करने का जुर्म कबूल कर लिया।',
       confessionText: 'मैंने परपेचुअल पेटेंट के ड्रॉइंग चुराए थे। जब उसने मुझे बर्बाद करने की धमकी दी, तो मैंने उसे वाइंडिंग बार से मारा और रात 11:42 बजे गियर जाम कर दिए ताकि यह एक दुर्घटना लगे!',
       evidence: { rag: 'ग्रीस से सना मोनोग्राम वाला रेशमी कपड़ा', cog: 'मुड़ा हुआ एस्केपमेंट गियर-चक्र', blueprint: 'चोरी किया गया पेटेंट ब्लूप्रिंट' } },
  3: { subtitle: 'नाइटशेड ज़हर — लॉर्ड एवलिन क्रॉस बेहोश होकर गिरे',
       winStory: 'ताज़ी ग्रीनहाउस पीट में मिले अपने प्रिस्क्रिप्शन चश्मे के सामने डॉ. जूलियन स्टर्लिंग टूट गया और उसने लॉर्ड एवलिन क्रॉस को ज़हर देने का जुर्म कबूल कर लिया।',
       confessionText: 'मैं उसे फ़ॉर्मूला पहले प्रकाशित नहीं करने दे सकता था। मेरी ज़िंदगी भर की प्रतिष्ठा दाँव पर थी! मैंने उसकी चाय में ज़हर मिलाया और उसकी डायरी भट्ठी में जला दी।',
       evidence: { glasses: 'गीली पीट में मिला सुनहरे फ्रेम वाला चश्मा', vial: 'टूटी हुई बेलाडोना ड्रॉपर शीशी', journal: 'जले हुए शोध फ़ॉर्मूले के नोट्स' } },
  4: { subtitle: 'कटा हुआ काउंटरवेट — मेस्ट्रो बेलमॉन्ट मंच पर कुचले गए',
       winStory: 'ब्लैकमेल टेलीग्राम और कटी हुई फ्लाई-गैलरी रस्सी के सामने मैडम विवियन लॉरेंट टूट गईं और उन्होंने मेस्ट्रो बेलमॉन्ट की हत्या करने का जुर्म कबूल कर लिया।',
       confessionText: 'वह मेरी हर गायी हुई पाउंड की कमाई का आधा हिस्सा माँगता था! ब्लैकआउट के दौरान मैंने फ्लाई-रस्सी काट दी। मुझे अपनी जान और अपना नाम बचाना था!',
       evidence: { telegram: 'बेलमॉन्ट का जबरन वसूली वाला टेलीग्राम', rope: 'कटी हुई फ्लाई-सिस्टम रिगिंग रस्सी', dagger: 'बदला हुआ रेज़र प्रॉप खंजर' } },
  5: { subtitle: 'ईस्ट इंडिया हीरों का भंडार — कैप्टन रीड की हत्या',
       winStory: 'खून से सनी तिजोरी की चाबी, जिस पर उसकी तारकोल लगी उँगलियों के निशान थे, के सामने मार्कस थॉर्न ने कैप्टन साइलस रीड की हीरों के लिए हत्या करने की बात मान ली।',
       confessionText: 'वे हीरे नौसेना की पचास साल की तनख्वाह के बराबर थे! रीड ने मेरे खिलाफ़ तिजोरी बंद करनी चाही, इसलिए मैंने ज़बरदस्ती चाबी छीन ली।',
       evidence: { key: 'अँगूठे के निशान वाली खून से सनी तिजोरी की चाबी', manifest: 'बदला हुआ शिपिंग मैनिफ़ेस्ट बही', wax: 'नकली सीमा-शुल्क पीतल की मुहर' } },
  6: { subtitle: 'क्यूरारे वाला स्कारब — राजवंश तिजोरी में मौत',
       winStory: 'उसकी कलाई के ज़ख्म से मेल खाते खून से सने काँच के टुकड़े के सामने प्रोफ़ेसर जोनाथन स्टर्लिंग ने डॉ. आर्थर पेंडल्टन की चोरी और हत्या का जुर्म कबूल कर लिया।',
       confessionText: 'एक निजी खरीदार ने असली 12वें राजवंश के स्कारब के लिए पचास हज़ार सॉवरेन देने की पेशकश की थी! पेंडल्टन ने मुझे रोकने की कोशिश की और हाथापाई में स्प्रिंग वाली क्यूरारे की सुई चल गई।',
       evidence: { shard: 'खून से सना टूटा हुआ विट्रिन का काँच', scarab: 'ज़हर-बुझा ऑब्सीडियन स्कारब', papyrus: 'जाली राजवंश उत्पत्ति पपाइरस' } }
};
function caseText(key) { return (currentLang === 'hi' && CASE_HI[caseNum] && CASE_HI[caseNum][key]) || activeCase[key]; }

const HI_UI = [
  ['#hud-rank-label', 'मुख्य जासूस'], ['#label-score', 'स्कोर:'], ['#label-clues', 'सुराग:'], ['#label-contra', 'विरोधाभास:'],
  ['#hint-inspect', '[E] जाँच / बात करें'], ['#hint-notebook', '[N] डायरी'], ['#hint-solve', '[K] केस सुलझाएँ'],
  ['#banner-text', 'सारे झूठ बेनकाब:'], ['#banner-sub', 'हत्यारे पर अंतिम आरोप लगाने के लिए [K] दबाएँ!'],
  ['#dossier-type', 'घटनास्थल का साक्ष्य'], ['#dossier-note-label', 'जासूसी टिप्पणी:'], ['#close-modal-btn', 'साक्ष्य दर्ज करें और लौटें [E]'],
  ['#speaking-text', 'बोल रहे हैं...'], ['#skip-intro-btn', '⏩ परिचय छोड़ें [Space / E]'],
  ['#choice-alibi .speaker-tag', '🗣 आप पूछें:'], ['#choice-motive .speaker-tag', '🗣 आप पूछें:'], ['#choice-confront .speaker-tag', '⚖️ आप सामना करें:'],
  ['#picker-title-label', 'सामने रखने के लिए साक्ष्य चुनें:'], ['#cancel-confront-btn', 'सामना रद्द करें'], ['#leave-dialogue-btn', 'पूछताछ समाप्त करें [ESC / E]'],
  ['#contra-alert-title', 'झूठ पकड़ा गया:'], ['#contra-alert-sub', 'संदिग्ध का बयान झूठा साबित हुआ!'],
  ['#notebook-title', 'केस डायरी — सुराग और साक्ष्य'], ['#notebook-sub', 'झूठ पकड़ने के लिए इकट्ठे किए गए सबूतों को ध्यान से पढ़ें'], ['#close-notebook-btn', 'डायरी बंद करें [N]'],
  ['#pause-title', 'जाँच रोकी गई'], ['#pause-sub', 'सबूतों पर विचार करें या अंतिम आरोप दर्ज करें।'], ['#resume-btn', 'जाँच जारी रखें'],
  ['#pause-deduce-btn', '⚖️ अंतिम आरोप दर्ज करें [K]'], ['#pause-notebook-btn', '📒 केस डायरी खोलें [N]'],
  ['#deduce-header-title', 'अंतिम निष्कर्ष बोर्ड'], ['#deduce-header-sub', 'सबूतों को जोड़ें, हत्यारे की पहचान करें और औपचारिक आरोप लगाएँ।'],
  ['#label-who', '1. हत्यारा (कौन):'], ['#label-why', '2. मकसद (क्यों):'], ['#label-how', '3. निर्णायक सबूत:'],
  ['#submit-accusation-btn', 'अंतिम कानूनी आरोप दर्ज करें'], ['#cancel-deduction-btn', 'जाँच पर वापस लौटें [K]'],
  ['#win-badge-txt', 'केस सुलझा लिया गया'], ['#win-score-label', 'अंतिम जासूसी स्कोर:'], ['#win-rank-badge', 'मास्टर डिटेक्टिव'],
  ['#next-case-btn', 'अगला केस ➔'], ['#win-restart-btn', 'केस दोबारा खेलें'],
  ['#fail-badge-txt', 'गलत आरोप'], ['#fail-title', 'जाँच खारिज कर दी गई'], ['#fail-penalty-txt', 'दंड: 100 अंक काटे गए'],
  ['#retry-deduction-btn', 'दोबारा आरोप लगाएँ [K]'], ['#full-restart-btn', 'जाँच शुरू से रीस्टार्ट करें'],
  ['#start-lang-label', 'भाषा / LANGUAGE:'], ['#start-voice-label', 'आवाज़ / VOICE:'], ['#intro-card-title', 'अपना जासूस प्रोफाइल बनाएँ'],
  ['#intro-upload-label', '📷 फोटो / सेल्फी अपलोड करें'], ['#start-btn', 'जाँच शुरू करें'],
  ['a.nav-btn', '🏠 केस 1'], ['#notebook-hud-btn', '📒 डायरी [N]'], ['#solve-shortcut-btn', '⚖️ आरोप [K]'],
  ['#case-guide-open', '🕵️ जासूसी गाइड'], ['.case-guide-kicker', 'फील्ड असिस्टेंट'], ['#case-guide-briefing', '📌 केस की जानकारी'],
  ['#case-guide-hint', '💡 अगला संकेत'], ['#case-guide-clues', '🔎 सबूतों की सूची'], ['#case-guide-speak', '🔊 पढ़कर सुनाएँ'],
  ['.case-guide-foot', 'संकेत एक-एक करके खुलते हैं। घटनास्थल की जाँच करें और हर संदिग्ध के बयान से सबूत मिलाएँ।']
];
const HI_GUIDE_HTML = '<p><strong>W, A, S, D</strong> — चलें | <strong>Mouse</strong> — देखें | <strong>Shift</strong> — तेज़ चलें</p><p><strong>E</strong> — जाँच / बातचीत | <strong>N</strong> — डायरी</p><p><strong>K</strong> — अंतिम आरोप | <strong>आवाज़</strong> — बोलकर संवाद (हिंदी/अंग्रेज़ी)</p>';

const __origHi = {};
const __cap = (sel, prop) => { const el = document.querySelector(sel); if (el && !((sel + '|' + prop) in __origHi)) __origHi[sel + '|' + prop] = el[prop]; };
HI_UI.forEach(r => __cap(r[0], 'textContent'));
['#stage-badge', '#level-status', '#instructions h2', '#intro-subtitle', '#win-title-txt', '#notebook-investigator-tag'].forEach(s => __cap(s, 'textContent'));
__cap('#intro-controls-guide', 'innerHTML'); __cap('#detective-name-input', 'placeholder');

function rebuildDeduceSelects() {
  const hi = currentLang === 'hi', keep = [deduceCulpritEl.value, deduceMotiveEl.value, deduceEvidenceEl.value];
  const ev = e => (hi && CASE_HI[caseNum] && CASE_HI[caseNum].evidence[e.val]) || e.label;
  deduceCulpritEl.innerHTML = '<option value="">' + (hi ? '-- संदिग्ध चुनें --' : '-- Choose Suspect --') + '</option>' +
    activeCase.deductionOptions.culprits.map(c => `<option value="${c.val}">${c.label}</option>`).join('');
  deduceMotiveEl.innerHTML = '<option value="">' + (hi ? '-- मकसद चुनें --' : '-- Choose Motive --') + '</option>' +
    activeCase.deductionOptions.motives.map(m => `<option value="${m.val}">${m.label}</option>`).join('');
  deduceEvidenceEl.innerHTML = '<option value="">' + (hi ? '-- निर्णायक सबूत चुनें --' : '-- Choose Key Evidence --') + '</option>' +
    activeCase.deductionOptions.evidence.map(e => `<option value="${e.val}">${ev(e)}</option>`).join('');
  deduceCulpritEl.value = keep[0]; deduceMotiveEl.value = keep[1]; deduceEvidenceEl.value = keep[2];
}

function updateCaseLanguageUI() {
  const hi = currentLang === 'hi';
  document.documentElement.lang = hi ? 'hi' : 'en';
  const put = (sel, prop, hiVal) => {
    const el = document.querySelector(sel); if (!el) return;
    __cap(sel, prop); el[prop] = hi ? hiVal : __origHi[sel + '|' + prop];
  };
  HI_UI.forEach(r => put(r[0], 'textContent', r[1]));
  const cd = CASE_HI[caseNum] || {}, cul = activeCase.suspects[activeCase.solution.culprit] || {};
  put('#stage-badge', 'textContent', 'केस ' + caseNum + ': ' + activeCase.titleHi);
  put('#level-status', 'textContent', activeCase.statusHi);
  put('#instructions h2', 'textContent', 'केस ' + caseNum + ': ' + activeCase.titleHi);
  if (cd.subtitle) put('#intro-subtitle', 'textContent', cd.subtitle);
  put('#win-title-txt', 'textContent', (cul.nameHi || '') + ' ने जुर्म कबूल किया');
  put('#notebook-investigator-tag', 'textContent', 'जांच अधिकारी: ' + getName());
  put('#intro-controls-guide', 'innerHTML', HI_GUIDE_HTML);
  put('#detective-name-input', 'placeholder', 'जासूस का नाम दर्ज करें...');
  // toggle buttons keep their ON/OFF state
  const vOn = voiceEngine.voiceEnabled, aOn = /ON|चालू/.test(audioToggleBtn.textContent);
  voiceToggleBtn.textContent = hi ? (vOn ? '🗣️ आवाज़: चालू' : '🔇 आवाज़: बंद') : (vOn ? '🗣️ VOICE: ON' : '🔇 VOICE: OFF');
  audioToggleBtn.textContent = hi ? (aOn ? '🔊 ऑडियो: चालू' : '🔇 ऑडियो: बंद') : (aOn ? '🔊 AUDIO: ON' : '🔇 AUDIO: OFF');
  langToggleBtn.textContent = hi ? '🌐 LANG: ENGLISH' : '🌐 भाषा: HINDI';
  [['start-lang-hi', hi], ['start-lang-en', !hi], ['tab-lang-hi', hi], ['tab-lang-en', !hi], ['start-voice-on', vOn], ['start-voice-off', !vOn]]
    .forEach(p => { const b = document.getElementById(p[0]); if (b) b.classList.toggle('active', p[1]); });
  const gt = document.getElementById('case-guide-title'), gi = document.getElementById('case-guide-intro');
  if (gt) gt.textContent = hi ? 'जाँच सहायक' : 'Investigation Guide';
  if (gi) gi.textContent = hi ? `केस ${caseNum}: सबूत देखें, संदिग्धों से बात करें और बयानों में विरोधाभास खोजें।` : `Case ${caseNum}: inspect evidence, speak to suspects, and look for contradictions in their statements.`;
  const bh = document.querySelector('#proximity-speech-bubble .bubble-header');
  if (bh) { const tn = Array.from(bh.childNodes).filter(n => n.nodeType === 3).pop(); if (tn) tn.nodeValue = hi ? ' बोल रहे हैं:' : ' speaking:'; }
  rebuildDeduceSelects();
}
const __persistLang = () => { try { localStorage.setItem('tlc_lang', currentLang); } catch (e) {} };
function setCaseLang(lang) { currentLang = lang; voiceEngine.stop(); __persistLang(); updateCaseLanguageUI(); }
// the existing top-bar handler already flipped currentLang, so only refresh the screen here
langToggleBtn.addEventListener('click', () => { __persistLang(); updateCaseLanguageUI(); });
voiceToggleBtn.addEventListener('click', updateCaseLanguageUI);
audioToggleBtn.addEventListener('click', updateCaseLanguageUI);
[['start-lang-en', 'en'], ['start-lang-hi', 'hi']].forEach(p => { const b = document.getElementById(p[0]); if (b) b.addEventListener('click', () => setCaseLang(p[1])); });
[['tab-lang-en', 'en'], ['tab-lang-hi', 'hi']].forEach(p => { const b = document.getElementById(p[0]); if (b) b.addEventListener('click', () => { setCaseLang(p[1]); if (currentSuspect && isInterrogating) openDialogue(currentSuspect); }); });
[['start-voice-on', true], ['start-voice-off', false]].forEach(p => { const b = document.getElementById(p[0]); if (b) b.addEventListener('click', () => { voiceEngine.setVoiceState(p[1]); updateCaseLanguageUI(); }); });
if (currentLang === 'hi') updateCaseLanguageUI();
// CASE_HI_V1 END

const clock = new THREE.Clock();
let animTime = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); animTime += dt;
  if (controls.isLocked && !anyUiOpen()) movePlayer(dt);
  else velv.set(0, 0, 0);
  for (const id in clueRings) {
    clueRings[id].material.opacity = (collectedClues.includes(id) ? 0.2 : 0.7) + Math.sin(animTime * 3.5) * 0.15;
  }
  for (const n of npcs) {
    n.torso.scale.y = 1 + Math.sin(animTime * 1.8 + n.phase) * 0.012;
    const dist = Math.hypot(camera.position.x - n.x, camera.position.z - n.z);
    if (dist < 6.5 && !n.walking) {
      let diff = Math.atan2(camera.position.x - n.x, camera.position.z - n.z) - n.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      n.group.rotation.y += diff * Math.min(1, dt * 2.8);
    }
  }
  updateAssistantWalk(dt);
  updateInteraction();
  renderer.render(scene, camera);
}
animate();

// === DETECTIVE GUIDE PATCH (Cases 2–6 only) ===
(() => {
  const openBtn = document.getElementById('case-guide-open');
  const panel = document.getElementById('case-guide-panel');
  if (!openBtn || !panel) return;
  const closeBtn = document.getElementById('case-guide-close');
  const titleEl = document.getElementById('case-guide-title');
  const introEl = document.getElementById('case-guide-intro');
  const outputEl = document.getElementById('case-guide-output');
  const langBtn = document.getElementById('case-guide-briefing');
  const hintBtn = document.getElementById('case-guide-hint');
  const cluesBtn = document.getElementById('case-guide-clues');
  const speakBtn = document.getElementById('case-guide-speak');
  let hintIndex = 0;
  let lastSpoken = '';
  const lang = () => currentLang === 'hi' ? 'hi' : 'en';
  const getText = (obj, key) => obj && (obj[key] || obj.en || obj.hi) || '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const say = (text) => {
    lastSpoken = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!lastSpoken || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(lastSpoken);
    u.lang = lang() === 'hi' ? 'hi-IN' : 'en-US';
    u.rate = 0.88;
    window.speechSynthesis.speak(u);
  };
  const show = (html, speakText = '') => {
    outputEl.innerHTML = html;
    if (speakText) lastSpoken = speakText;
  };
  const briefing = () => {
    const lines = getText(activeCase.briefings, lang());
    const list = Array.isArray(lines) ? lines : [lines];
    const heading = lang() === 'hi' ? 'केस की जानकारी' : 'Case briefing';
    show(`<h3>${heading}</h3><ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, list.join(' '));
  };
  const evidence = () => {
    const heading = lang() === 'hi' ? 'जाँचने वाले सबूत' : 'Evidence to inspect';
    const entries = Object.entries(activeCase.clues || {});
    const rows = entries.map(([id, clue]) => {
      const d = clue[lang()] || clue.en || clue.hi || {};
      return `<li><strong>${esc(d.title || id)}</strong>${d.loc ? ` — <em>${esc(d.loc)}</em>` : ''}<br>${esc(d.desc || '')}${d.note ? `<br><span>${esc(d.note)}</span>` : ''}</li>`;
    });
    show(`<h3>${heading}</h3><ul>${rows.join('')}</ul>`,
      entries.map(([id,c]) => { const d=c[lang()]||c.en||c.hi||{}; return `${d.title||id}. ${d.loc||''}. ${d.desc||''}. ${d.note||''}`; }).join(' '));
  };
  const hint = () => {
    const clues = Object.entries(activeCase.clues || {});
    if (!clues.length) {
      const fallback = lang()==='hi' ? 'पहले कमरे में मौजूद वस्तुओं और लोगों की जाँच करें।' : 'Inspect the objects and people in the room first.';
      show(`<p>${esc(fallback)}</p>`, fallback); return;
    }
    const [id, clue] = clues[hintIndex % clues.length];
    const d = clue[lang()] || clue.en || clue.hi || {};
    const label = lang() === 'hi' ? `संकेत ${hintIndex + 1}` : `Hint ${hintIndex + 1}`;
    const text = d.note || d.desc || (lang()==='hi' ? 'सबूत को संदिग्धों के बयानों से मिलाएँ।' : 'Compare evidence with the suspects’ statements.');
    const next = lang() === 'hi' ? 'सोचें: यह सबूत किसके बयान या मकसद से जुड़ता है?' : 'Ask yourself: which suspect’s statement or motive connects to this evidence?';
    hintIndex++;
    show(`<h3>${label}</h3><p>${esc(text)}</p><p>${esc(next)}</p>`, `${label}. ${text}. ${next}`);
  };
  titleEl.textContent = lang() === 'hi' ? 'जाँच सहायक' : 'Investigation Guide';
  introEl.textContent = lang() === 'hi'
    ? `केस ${caseNum}: सबूत देखें, संदिग्धों से बात करें और बयानों में विरोधाभास खोजें।`
    : `Case ${caseNum}: inspect evidence, speak to suspects, and look for contradictions in their statements.`;
  openBtn.addEventListener('click', () => { panel.hidden = false; briefing(); });
  closeBtn.addEventListener('click', () => { panel.hidden = true; if (window.speechSynthesis) window.speechSynthesis.cancel(); });
  langBtn.addEventListener('click', briefing);
  hintBtn.addEventListener('click', hint);
  cluesBtn.addEventListener('click', evidence);
  speakBtn.addEventListener('click', () => say(lastSpoken || (lang()==='hi' ? 'केस की जानकारी, संकेत या सबूत की सूची चुनें।' : 'Choose case briefing, next hint, or evidence list.')));
  panel.addEventListener('pointerdown', e => e.stopPropagation());
  panel.addEventListener('click', e => e.stopPropagation());
  openBtn.addEventListener('pointerdown', e => e.stopPropagation());
  const existingLangBtn = document.getElementById('lang-toggle-btn');
  if (existingLangBtn) existingLangBtn.addEventListener('click', () => {
    titleEl.textContent = lang() === 'hi' ? 'जाँच सहायक' : 'Investigation Guide';
    introEl.textContent = lang() === 'hi'
      ? `केस ${caseNum}: सबूत देखें, संदिग्धों से बात करें और बयानों में विरोधाभास खोजें।`
      : `Case ${caseNum}: inspect evidence, speak to suspects, and look for contradictions in their statements.`;
    if (!panel.hidden) briefing();
  });
})();
