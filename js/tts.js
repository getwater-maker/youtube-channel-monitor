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

const API_BYTE_LIMIT = 5000;

const state = {
  apiKey: null,
  isBusy: false,
  currentMonth: new Date().toISOString().slice(0, 7),
  monthlyUsage: {
    standard: 0,
    premium: 0,
  },
  lastGeneratedAudio: null,
  lastGeneratedText: '',
  lastGeneratedVoice: '',
  // 음성 옵션 상태
  speakingRate: 1.0,
  pitch: 0.0,
  volumeGainDb: 0.0,
  // 오디오 플레이어 상태
  currentAudio: null, 
  // 다운로드 카운터
  downloadCounter: 0,
};

const UI = {
  root: null,
  textarea: null,
  voiceSelect: null,
  downloadBtn: null,
  usageDisplayPremium: null,
  charCount: null,
  byteCount: null, // [추가] 바이트 카운트 UI 요소
  // 오디오 플레이어 UI 요소
  playPauseBtn: null,
  stopBtn: null,
  timeline: null,
  timeDisplay: null,
  // [추가] 음성 옵션 UI 요소
  rateSlider: null,
  rateValue: null,
  pitchSlider: null,
  pitchValue: null,
  volumeSlider: null,
  volumeValue: null,
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
  const text = UI.textarea?.value || '';
  const textLength = text.length;
  const byteLength = new Blob([text]).size;

  // 사용량 및 글자 수 업데이트
  UI.usageDisplayPremium.textContent = `프리미엄 사용량: ${state.monthlyUsage.premium.toLocaleString()} / ${FREE_TIER.premium.toLocaleString()} 자`;
  UI.charCount.textContent = `현재 글자 수: ${textLength.toLocaleString()} 자`;
  
  // [수정] 바이트 수 업데이트
  UI.byteCount.textContent = `${byteLength.toLocaleString()} / ${API_BYTE_LIMIT.toLocaleString()} bytes`;
  UI.byteCount.classList.toggle('limit-exceeded', byteLength > API_BYTE_LIMIT);

  const isOverCharLimit = state.monthlyUsage.premium + textLength > FREE_TIER.premium;
  const isOverByteLimit = byteLength > API_BYTE_LIMIT;
  const hasText = textLength > 0;

  // 버튼 상태 업데이트
  UI.downloadBtn.disabled = state.isBusy || isOverCharLimit || isOverByteLimit || !hasText;
  UI.playPauseBtn.disabled = state.isBusy || isOverCharLimit || isOverByteLimit || !hasText;
  
  UI.usageDisplayPremium.classList.toggle('limit-exceeded', isOverCharLimit);

  if (isOverCharLimit && hasText) {
    window.toast(`프리미엄 등급의 월간 무료 사용량을 초과합니다.`, 'warning', 3000);
  }
  if (isOverByteLimit && hasText) {
    window.toast(`1회 변환 가능한 텍스트 용량(5,000 bytes)을 초과했습니다.`, 'warning', 3000);
  }
}

async function synthesizeSpeech() {
  if (state.isBusy) return null;
  
  const text = UI.textarea.value.trim();
  const voice = UI.voiceSelect.value;
  
  // 옵션 값이 변경되었는지 확인하기 위해 현재 옵션 상태를 문자열로 만듭니다.
  const currentOptions = `${state.speakingRate}-${state.pitch}-${state.volumeGainDb}`;
  const lastOptions = state.lastGeneratedOptions || '';

  if (state.lastGeneratedAudio && state.lastGeneratedText === text && state.lastGeneratedVoice === voice && lastOptions === currentOptions) {
    window.toast('캐시된 음성을 사용합니다.', 'success', 1000);
    return state.lastGeneratedAudio;
  }
  
  if (!text) {
    window.toast('음성으로 변환할 텍스트를 입력하세요.', 'warning');
    return null;
  }

  // API 호출 전 바이트 크기 최종 확인
  const byteLength = new Blob([text]).size;
  if (byteLength > API_BYTE_LIMIT) {
    window.toast(`텍스트가 ${API_BYTE_LIMIT}바이트를 초과하여 변환할 수 없습니다. (현재: ${byteLength.toLocaleString()} 바이트)`, 'error', 4000);
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
  UI.playPauseBtn.textContent = '변환 중...';
  UI.downloadBtn.textContent = '변환 중...';
  updateUsageUI();

  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${state.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text },
        voice: { languageCode: 'ko-KR', name: voice },
        // [수정] 음성 옵션 추가
        audioConfig: { 
          audioEncoding: 'MP3',
          speakingRate: state.speakingRate,
          pitch: state.pitch,
          volumeGainDb: state.volumeGainDb,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message || '알 수 없는 오류가 발생했습니다.');
    }

    const data = await response.json();
    
    state.monthlyUsage.premium += text.length;
    await saveUsage();
    
    // 캐시에 오디오 및 현재 상태 저장
    state.lastGeneratedAudio = data.audioContent;
    state.lastGeneratedText = text;
    state.lastGeneratedVoice = voice;
    state.lastGeneratedOptions = currentOptions; // 옵션 상태도 캐시에 저장

    updateUsageUI();
    window.toast('음성 변환 성공!', 'success');
    return data.audioContent;

  } catch (error) {
    console.error('TTS API Error:', error);
    window.toast(`음성 변환 실패: ${error.message}`, 'error', 5000);
    return null;
  } finally {
    state.isBusy = false;
    UI.playPauseBtn.textContent = '▶️ 재생';
    UI.downloadBtn.textContent = 'MP3 다운로드';
    updateUsageUI();
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function stopAndResetPlayer() {
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
  }
  UI.playPauseBtn.textContent = '▶️ 재생';
  UI.timeline.value = 0;
  UI.timeDisplay.textContent = '0:00 / 0:00';
}

async function handlePlayPreview() {
  if (state.currentAudio && !state.currentAudio.paused) {
    state.currentAudio.pause();
    return;
  }
  
  if (state.currentAudio && state.currentAudio.currentTime > 0) {
    state.currentAudio.play();
    return;
  }

  const audioContent = await synthesizeSpeech();
  if (!audioContent) return;

  stopAndResetPlayer();

  const audioSrc = `data:audio/mp3;base64,${audioContent}`;
  state.currentAudio = new Audio(audioSrc);

  state.currentAudio.addEventListener('loadedmetadata', () => {
    UI.timeline.max = state.currentAudio.duration;
    UI.timeDisplay.textContent = `0:00 / ${formatTime(state.currentAudio.duration)}`;
    UI.timeline.disabled = false;
  });

  state.currentAudio.addEventListener('timeupdate', () => {
    UI.timeline.value = state.currentAudio.currentTime;
    UI.timeDisplay.textContent = `${formatTime(state.currentAudio.currentTime)} / ${formatTime(state.currentAudio.duration)}`;
  });

  state.currentAudio.addEventListener('play', () => { UI.playPauseBtn.textContent = '⏸️ 일시정지'; });
  state.currentAudio.addEventListener('pause', () => { UI.playPauseBtn.textContent = '▶️ 재생'; });
  state.currentAudio.addEventListener('ended', () => { stopAndResetPlayer(); });
  
  state.currentAudio.play();
}

// [수정] 다운로드 함수에 파일명 인자 추가
function downloadAudio(base64Audio, filename) {
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
    a.download = filename; // 전달받은 파일명 사용
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
            <!-- [추가] 바이트 카운트 표시 영역 -->
            <div id="tts-byte-count" class="byte-count">0 / 5,000 bytes</div>
        </div>
        <div class="tts-grid">
            <div class="tts-main">
                <textarea id="tts-textarea" placeholder="이곳에 음성으로 변환할 텍스트를 입력하세요... (1회 ${API_BYTE_LIMIT.toLocaleString()} bytes 제한)"></textarea>
            </div>
            <div class="tts-controls">
                <div class="control-group">
                    <label for="tts-voice-select">목소리 선택</label>
                    <select id="tts-voice-select" class="btn-outline"></select>
                </div>

                <!-- [추가] 음성 옵션 컨트롤 -->
                <div class="control-group options-group">
                    <label>음성 옵션</label>
                    <div class="option-slider">
                        <span>속도</span>
                        <input type="range" id="tts-rate-slider" min="0.25" max="4.0" step="0.05" value="1.0">
                        <span id="tts-rate-value">1.00x</span>
                    </div>
                    <div class="option-slider">
                        <span>음높이</span>
                        <input type="range" id="tts-pitch-slider" min="-20.0" max="20.0" step="0.5" value="0.0">
                        <span id="tts-pitch-value">0.0</span>
                    </div>
                    <div class="option-slider">
                        <span>볼륨</span>
                        <input type="range" id="tts-volume-slider" min="-16.0" max="16.0" step="0.5" value="0.0">
                        <span id="tts-volume-value">0.0 dB</span>
                    </div>
                </div>

                <div class="control-group">
                    <div id="tts-char-count" class="char-count">현재 글자 수: 0 자</div>
                    <div id="tts-usage-premium" class="usage-display"></div>
                </div>

                <div class="control-group">
                    <label>미리듣기</label>
                    <div id="tts-player-controls" class="tts-player">
                        <button id="tts-play-pause-btn" class="btn btn-sm">▶️ 재생</button>
                        <button id="tts-stop-btn" class="btn btn-sm">⏹️ 정지</button>
                        <div class="timeline-container">
                            <input type="range" id="tts-timeline" value="0" step="0.1" disabled>
                            <span id="tts-time-display">0:00 / 0:00</span>
                        </div>
                    </div>
                </div>
                <div class="control-group action-buttons">
                    <button id="tts-download-btn" class="btn btn-primary">MP3 다운로드</button>
                </div>
            </div>
        </div>
    </div>
  `;

  // UI 요소 할당
  UI.root = root;
  UI.textarea = root.querySelector('#tts-textarea');
  UI.voiceSelect = root.querySelector('#tts-voice-select');
  UI.downloadBtn = root.querySelector('#tts-download-btn');
  UI.usageDisplayPremium = root.querySelector('#tts-usage-premium');
  UI.charCount = root.querySelector('#tts-char-count');
  UI.byteCount = root.querySelector('#tts-byte-count'); // [추가]
  UI.playPauseBtn = root.querySelector('#tts-play-pause-btn');
  UI.stopBtn = root.querySelector('#tts-stop-btn');
  UI.timeline = root.querySelector('#tts-timeline');
  UI.timeDisplay = root.querySelector('#tts-time-display');
  // [추가] 음성 옵션 UI 요소 할당
  UI.rateSlider = root.querySelector('#tts-rate-slider');
  UI.rateValue = root.querySelector('#tts-rate-value');
  UI.pitchSlider = root.querySelector('#tts-pitch-slider');
  UI.pitchValue = root.querySelector('#tts-pitch-value');
  UI.volumeSlider = root.querySelector('#tts-volume-slider');
  UI.volumeValue = root.querySelector('#tts-volume-value');
  
  // 목소리 목록 채우기
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
  
  // 이벤트 핸들러 연결
  UI.playPauseBtn.onclick = handlePlayPreview;
  UI.stopBtn.onclick = stopAndResetPlayer;
  UI.timeline.oninput = () => {
    if (state.currentAudio) {
      state.currentAudio.currentTime = UI.timeline.value;
    }
  };

  const onSettingsChange = () => {
    state.lastGeneratedAudio = null; // 설정 변경 시 캐시 무효화
    stopAndResetPlayer();
    updateUsageUI();
  };

  UI.textarea.oninput = onSettingsChange;

  UI.voiceSelect.onchange = () => {
    kvSet('tts:lastVoice', UI.voiceSelect.value); // 마지막 선택 목소리 저장
    onSettingsChange();
  };

  // [추가] 음성 옵션 슬라이더 이벤트 핸들러
  UI.rateSlider.oninput = () => {
    state.speakingRate = parseFloat(UI.rateSlider.value);
    UI.rateValue.textContent = `${state.speakingRate.toFixed(2)}x`;
    onSettingsChange();
  };
  UI.pitchSlider.oninput = () => {
    state.pitch = parseFloat(UI.pitchSlider.value);
    UI.pitchValue.textContent = state.pitch.toFixed(1);
    onSettingsChange();
  };
  UI.volumeSlider.oninput = () => {
    state.volumeGainDb = parseFloat(UI.volumeSlider.value);
    UI.volumeValue.textContent = `${state.volumeGainDb.toFixed(1)} dB`;
    onSettingsChange();
  };

  // [수정] 다운로드 버튼 클릭 핸들러
  UI.downloadBtn.onclick = async () => {
      const audioContent = await synthesizeSpeech();
      if (audioContent) {
        state.downloadCounter++; // 다운로드 카운터 증가
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const voiceName = UI.voiceSelect.value;
        const number = String(state.downloadCounter).padStart(2, '0');
        const filename = `${date}_${voiceName}_${number}.mp3`;
        
        downloadAudio(audioContent, filename);
      }
  };
  
  // 초기화
  state.apiKey = await kvGet('ttsApiKey');
  await loadUsage();

  const lastVoice = await kvGet('tts:lastVoice');
  if (lastVoice && UI.voiceSelect.querySelector(`option[value="${lastVoice}"]`)) {
    UI.voiceSelect.value = lastVoice;
  }

  if (!state.apiKey) {
    window.toast("'음성합성' 탭을 사용하려면 인증 정보 설정에서 Text-to-Speech API 키를 입력해주세요.", 'warning', 3500);
  }
}