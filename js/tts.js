// js/tts.js
import { kvGet, kvSet } from './indexedStore.js';

const VOICES = [
  // Chirp3-HD (최신 최고 품질)
  { name: 'ko-KR-Chirp3-HD-Aoede', type: 'Chirp3-HD', gender: '여성', tier: 'premium' },
  { name: 'ko-KR-Chirp3-HD-Charon', type: 'Chirp3-HD', gender: '남성', tier: 'premium' },
  { name: 'ko-KR-Chirp3-HD-Fenrir', type: 'Chirp3-HD', gender: '남성', tier: 'premium' },
  { name: 'ko-KR-Chirp3-HD-Kore', type: 'Chirp3-HD', gender: '여성', tier: 'premium' },
  { name: 'ko-KR-Chirp3-HD-Leda', type: 'Chirp3-HD', gender: '여성', tier: 'premium' },
  { name: 'ko-KR-Chirp3-HD-Orus', type: 'Chirp3-HD', gender: '남성', tier: 'premium' },
  { name: 'ko-KR-Chirp3-HD-Puck', type: 'Chirp3-HD', gender: '남성', tier: 'premium' },
  { name: 'ko-KR-Chirp3-HD-Zephyr', type: 'Chirp3-HD', gender: '여성', tier: 'premium' },
  // Neural2 (고품질)
  { name: 'ko-KR-Neural2-A', type: 'Neural2', gender: '여성', tier: 'premium' },
  { name: 'ko-KR-Neural2-B', type: 'Neural2', gender: '여성', tier: 'premium' },
  { name: 'ko-KR-Neural2-C', type: 'Neural2', gender: '남성', tier: 'premium' },
];

const FREE_TIER = {
  standard: 4000000,
  premium: 1000000,
};

const state = {
  apiKey: null,
  isBusy: false,
  currentMonth: new Date().toISOString().slice(0, 7),
  monthlyUsage: {
    standard: 0,
    premium: 0,
  },
  // [추가] 스마트 캐싱을 위한 상태 변수
  lastGeneratedAudio: null,
  lastGeneratedText: '',
  lastGeneratedVoice: '',
};

const UI = {
  root: null,
  textarea: null,
  voiceSelect: null,
  previewBtn: null,
  downloadBtn: null,
  usageDisplayStandard: null,
  usageDisplayPremium: null,
  charCount: null,
};

async function loadUsage() {
  const usageData = await kvGet('tts:usage');
  if (usageData && usageData.month === state.currentMonth) {
    state.monthlyUsage.standard = usageData.standard || 0;
    state.monthlyUsage.premium = usageData.premium || 0;
  } else {
    state.monthlyUsage = { standard: 0, premium: 0 };
    await saveUsage();
  }
  updateUsageUI();
}

async function saveUsage() {
  await kvSet('tts:usage', { 
    month: state.currentMonth, 
    standard: state.monthlyUsage.standard,
    premium: state.monthlyUsage.premium,
  });
}

function updateUsageUI() {
  if (!UI.root) return;
  const textLength = UI.textarea?.value.length || 0;
  
  UI.usageDisplayPremium.textContent = `프리미엄 사용량: ${state.monthlyUsage.premium.toLocaleString()} / ${FREE_TIER.premium.toLocaleString()} 자`;
  UI.charCount.textContent = `현재 글자 수: ${textLength.toLocaleString()} 자`;

  const isOverLimit = state.monthlyUsage.premium + textLength > FREE_TIER.premium;

  UI.previewBtn.disabled = state.isBusy || isOverLimit;
  UI.downloadBtn.disabled = state.isBusy || isOverLimit;
  UI.usageDisplayPremium.classList.toggle('limit-exceeded', isOverLimit);

  if (isOverLimit && textLength > 0) {
    window.toast(`프리미엄 등급의 무료 사용량을 초과합니다.`, 'warning', 3000);
  }
}

async function synthesizeSpeech() {
  if (state.isBusy) return null;
  
  const text = UI.textarea.value.trim();
  const voice = UI.voiceSelect.value;

  // [수정] 스마트 캐싱 로직 추가
  if (state.lastGeneratedAudio && state.lastGeneratedText === text && state.lastGeneratedVoice === voice) {
    window.toast('캐시된 음성을 사용합니다.', 'success', 1000);
    return state.lastGeneratedAudio;
  }
  
  if (!text) {
    window.toast('음성으로 변환할 텍스트를 입력하세요.', 'warning');
    return null;
  }
  
  if (!state.apiKey) {
    window.toast('Text-to-Speech API 키가 설정되지 않았습니다.', 'error');
    return null;
  }

  if (state.monthlyUsage.premium + text.length > FREE_TIER.premium) {
    window.toast(`프리미엄 등급의 무료 사용량을 초과하여 변환할 수 없습니다.`, 'error', 3000);
    return null;
  }

  state.isBusy = true;
  UI.previewBtn.textContent = '변환 중...';
  UI.downloadBtn.textContent = '변환 중...';
  updateUsageUI();

  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${state.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text },
        voice: { languageCode: 'ko-KR', name: voice },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message || '알 수 없는 오류가 발생했습니다.');
    }

    const data = await response.json();
    
    state.monthlyUsage.premium += text.length;
    await saveUsage();
    
    // [추가] 변환된 오디오와 정보를 캐시에 저장
    state.lastGeneratedAudio = data.audioContent;
    state.lastGeneratedText = text;
    state.lastGeneratedVoice = voice;

    updateUsageUI();
    window.toast('음성 변환 성공!', 'success');
    return data.audioContent;

  } catch (error) {
    console.error('TTS API Error:', error);
    window.toast(`음성 변환 실패: ${error.message}`, 'error', 3000);
    return null;
  } finally {
    state.isBusy = false;
    UI.previewBtn.textContent = '미리듣기';
    UI.downloadBtn.textContent = 'MP3 다운로드';
    updateUsageUI();
  }
}

function playAudio(base64Audio) {
  if (!base64Audio) return;
  const audioSrc = `data:audio/mp3;base64,${base64Audio}`;
  const audio = new Audio(audioSrc);
  audio.play();
}

function downloadAudio(base64Audio) {
    if (!base64Audio) return;
    const byteCharacters = atob(base64Audio);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {type: 'audio/mp3'});

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `voice_${new Date().getTime()}.mp3`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

export async function initTTS({ mount }) {
  const root = document.querySelector(mount);
  root.innerHTML = `
    <div class="section">
        <div class="section-header">
            <div class="section-title">음성합성 (Text-to-Speech)</div>
        </div>
        <div class="tts-grid">
            <div class="tts-main">
                <textarea id="tts-textarea" placeholder="이곳에 음성으로 변환할 텍스트를 입력하세요..."></textarea>
            </div>
            <div class="tts-controls">
                <div class="control-group">
                    <label for="tts-voice-select">목소리 선택</label>
                    <select id="tts-voice-select" class="btn-outline"></select>
                </div>
                <div class="control-group">
                    <div id="tts-char-count" class="char-count">현재 글자 수: 0 자</div>
                    <div id="tts-usage-premium" class="usage-display">프리미엄 사용량: 0 / 1,000,000 자</div>
                </div>
                <div class="control-group action-buttons">
                    <button id="tts-preview-btn" class="btn btn-outline">미리듣기</button>
                    <button id="tts-download-btn" class="btn btn-primary">MP3 다운로드</button>
                </div>
            </div>
        </div>
    </div>
  `;

  UI.root = root;
  UI.textarea = root.querySelector('#tts-textarea');
  UI.voiceSelect = root.querySelector('#tts-voice-select');
  UI.previewBtn = root.querySelector('#tts-preview-btn');
  UI.downloadBtn = root.querySelector('#tts-download-btn');
  UI.usageDisplayPremium = root.querySelector('#tts-usage-premium');
  UI.charCount = root.querySelector('#tts-char-count');

  const femaleVoices = VOICES.filter(voice => voice.gender === '여성');
  const maleVoices = VOICES.filter(voice => voice.gender === '남성');

  const createOption = (voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.gender} (${voice.type}, ${voice.name.split('-').pop()})`;
    return option;
  };

  const femaleGroup = document.createElement('optgroup');
  femaleGroup.label = '--- 여성 목소리 ---';
  femaleVoices.forEach(voice => femaleGroup.appendChild(createOption(voice)));

  const maleGroup = document.createElement('optgroup');
  maleGroup.label = '--- 남성 목소리 ---';
  maleVoices.forEach(voice => maleGroup.appendChild(createOption(voice)));

  UI.voiceSelect.appendChild(femaleGroup);
  UI.voiceSelect.appendChild(maleGroup);
  
  UI.voiceSelect.onchange = updateUsageUI;
  UI.previewBtn.onclick = async () => {
      const audioContent = await synthesizeSpeech();
      playAudio(audioContent);
  };
  UI.downloadBtn.onclick = async () => {
      const audioContent = await synthesizeSpeech();
      downloadAudio(audioContent);
  };
  UI.textarea.oninput = updateUsageUI;

  state.apiKey = await kvGet('ttsApiKey');
  await loadUsage();
  if (!state.apiKey) {
    window.toast("'음성합성' 탭을 사용하려면 인증 정보 설정에서 Text-to-Speech API 키를 입력해주세요.", 'warning', 3500);
  }
}