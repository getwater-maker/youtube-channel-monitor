// js/study.js
import { kvGet } from './indexedStore.js';
import { studyHistoryGetAll, studyHistoryAdd } from './indexedStore.js';

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const num = (n) => Number(n || 0);

const state = {
    allVideos: [],
    studyType: null,
    studyMode: null,
    sessionLength: 10,
    questions: [],
    currentQuestionIndex: 0,
    correctAnswers: 0,
    isGameActive: false,
    history: [],
    chartInstance: null,
};

const UI = {
    root: null,
    startScreen: null,
    gameScreen: null,
    historyScreen: null,
    optionA: null,
    optionB: null,
    progressText: null,
    resultMessage: null,
};

async function loadAllVideos() {
    const videos = await kvGet('videos:cache');
    if (!videos || videos.length < 2) {
        UI.root.innerHTML = `<div class="empty-state">학습에 필요한 영상 데이터가 부족합니다.<br>먼저 '영상분석' 탭에서 [다시불러오기]를 실행하여 데이터를 준비해주세요.</div>`;
        return false;
    }
    state.allVideos = videos.filter(v => v.secs > 0);
    return true;
}

function generateQuestions() {
    state.questions = [];
    const videoCount = state.allVideos.length;
    for (let i = 0; i < state.sessionLength; i++) {
        let indexA, indexB;
        do {
            indexA = Math.floor(Math.random() * videoCount);
            indexB = Math.floor(Math.random() * videoCount);
        } while (indexA === indexB);
        state.questions.push({
            videoA: state.allVideos[indexA],
            videoB: state.allVideos[indexB],
        });
    }
}

function renderQuestion() {
    if (state.currentQuestionIndex >= state.sessionLength) return;
    const q = state.questions[state.currentQuestionIndex];
    
    if (state.studyType === 'thumbnail') {
        UI.optionA.innerHTML = `<img src="https://i.ytimg.com/vi/${q.videoA.id}/mqdefault.jpg">`;
        UI.optionB.innerHTML = `<img src="https://i.ytimg.com/vi/${q.videoB.id}/mqdefault.jpg">`;
    } else {
        UI.optionA.innerHTML = `<div class="title-study-box">${q.videoA.title}</div>`;
        UI.optionB.innerHTML = `<div class="title-study-box">${q.videoB.title}</div>`;
    }

    UI.progressText.textContent = `${state.currentQuestionIndex + 1} / ${state.sessionLength}`;
    UI.resultMessage.textContent = '더 높은 쪽을 선택하세요';
    UI.resultMessage.className = 'result-message';
    UI.optionA.classList.remove('correct', 'incorrect');
    UI.optionB.classList.remove('correct', 'incorrect');
}

async function handleGuess(selectedIndex) {
    const q = state.questions[state.currentQuestionIndex];
    const { videoA, videoB } = q;

    let isCorrect;
    let valueA, valueB;

    if (state.studyMode === 'mutant') {
        valueA = videoA.mutant;
        valueB = videoB.mutant;
    } else {
        valueA = videoA.views;
        valueB = videoB.views;
    }
    isCorrect = (selectedIndex === 0 && valueA >= valueB) || (selectedIndex === 1 && valueB >= valueA);

    if (isCorrect) {
        state.correctAnswers++;
        UI.resultMessage.textContent = '정답입니다!';
        UI.resultMessage.className = 'result-message correct';
        (selectedIndex === 0 ? UI.optionA : UI.optionB).classList.add('correct');
    } else {
        const displayValueA = state.studyMode === 'mutant' ? valueA.toFixed(1) : num(valueA).toLocaleString();
        const displayValueB = state.studyMode === 'mutant' ? valueB.toFixed(1) : num(valueB).toLocaleString();
        UI.resultMessage.textContent = `오답! (A: ${displayValueA} vs B: ${displayValueB})`;
        UI.resultMessage.className = 'result-message incorrect';
        (selectedIndex === 0 ? UI.optionA : UI.optionB).classList.add('incorrect');
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    state.currentQuestionIndex++;
    if (state.currentQuestionIndex < state.sessionLength) {
        renderQuestion();
    } else {
        await endGame();
    }
}

async function endGame() {
    state.isGameActive = false;
    const accuracy = (state.correctAnswers / state.sessionLength) * 100;
    
    window.toast(`학습 종료! 정답률: ${accuracy.toFixed(0)}%`, 'success', 2000);

    const newHistory = {
        date: new Date().toISOString().slice(0, 10),
        type: state.studyType === 'thumbnail' ? '썸네일' : '제목',
        mode: state.studyMode === 'mutant' ? '돌연변이' : '시청수',
        total: state.sessionLength,
        correct: state.correctAnswers,
        accuracy: accuracy,
    };

    await studyHistoryAdd(newHistory);
    await renderHistoryAndChart();
    renderUI();
}

function startGame(type, mode, length) {
    state.studyType = type;
    state.studyMode = mode;
    state.sessionLength = length;
    state.isGameActive = true;
    state.currentQuestionIndex = 0;
    state.correctAnswers = 0;
    generateQuestions();
    renderUI();
    renderQuestion();
}

function renderUI() {
    UI.startScreen.style.display = state.isGameActive ? 'none' : 'block';
    UI.gameScreen.style.display = state.isGameActive ? 'block' : 'none';
}

async function renderHistoryAndChart() {
    state.history = await studyHistoryGetAll();
    const tableBody = UI.historyScreen.querySelector('tbody');
    tableBody.innerHTML = '';
    
    if (state.history.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-state" style="padding: 24px;">학습 기록이 없습니다.</td></tr>`;
    } else {
        state.history.slice().reverse().forEach(h => {
            const row = el(`
                <tr>
                    <td>${h.date}</td>
                    <td>${h.type}</td>
                    <td>${h.mode}</td>
                    <td>${h.total}</td>
                    <td>${h.correct}</td>
                    <td>${h.accuracy.toFixed(0)}%</td>
                </tr>
            `);
            tableBody.appendChild(row);
        });
    }

    const canvas = UI.historyScreen.querySelector('#study-chart');
    const ctx = canvas.getContext('2d');

    const labels = [...new Set(state.history.map(h => h.date))].sort();
    
    const datasets = [
        { type: '썸네일', mode: '돌연변이', label: '썸네일-돌연변이(%)', color: 'var(--brand)' },
        { type: '썸네일', mode: '시청수', label: '썸네일-시청수(%)', color: 'rgba(20, 184, 166, 0.5)' },
        { type: '제목', mode: '돌연변이', label: '제목-돌연변이(%)', color: 'var(--brand-2)' },
        { type: '제목', mode: '시청수', label: '제목-시청수(%)', color: 'rgba(37, 99, 235, 0.5)' }
    ].map(config => ({
        label: config.label,
        data: state.history.filter(h => h.type === config.type && h.mode === config.mode).map(h => ({ x: h.date, y: h.accuracy })),
        borderColor: config.color,
        backgroundColor: `${config.color.replace(')', ', 0.1)')}`,
        fill: true,
        tension: 0.1
    }));

    if (state.chartInstance) state.chartInstance.destroy();

    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

export async function initStudy({ mount }) {
    UI.root = document.querySelector(mount);
    UI.root.innerHTML = `
        <div class="study-container">
            <div id="study-start-screen" class="section">
                <div class="section-title">학습 시작하기</div>
                <p class="muted">두 개의 썸네일 또는 제목 중 더 높은 수치를 가진 쪽을 맞춰보세요.</p>
                <div class="study-mode-wrapper">
                    <!-- 썸네일 공부 -->
                    <div class="study-mode-group">
                        <div class="mode-title">🖼️ 썸네일 공부</div>
                        <p class="muted" style="font-size:14px; margin-top:-8px; margin-bottom:12px;">두 썸네일 중 더 성과가 좋은 쪽을 선택하세요.</p>
                        
                        <!-- [수정된 레이아웃] 돌연변이 지수와 시청수를 한 줄에 배치 -->
                        <div class="start-buttons study-button-line">
                            <div class="study-button-sub-group">
                                <strong>돌연변이 지수</strong>
                                <button class="btn" data-type="thumbnail" data-mode="mutant" data-length="10">10개 (지수)</button>
                                <button class="btn" data-type="thumbnail" data-mode="mutant" data-length="20">20개 (지수)</button>
                                <button class="btn" data-type="thumbnail" data-mode="mutant" data-length="30">30개 (지수)</button>
                            </div>
                            <div class="study-button-sub-group">
                                <strong>시청수</strong>
                                <button class="btn" data-type="thumbnail" data-mode="views" data-length="10">10개 (시청)</button>
                                <button class="btn" data-type="thumbnail" data-mode="views" data-length="20">20개 (시청)</button>
                                <button class="btn" data-type="thumbnail" data-mode="views" data-length="30">30개 (시청)</button>
                            </div>
                        </div>
                    </div>

                    <!-- 제목 공부 -->
                    <div class="study-mode-group">
                        <div class="mode-title">✍️ 제목 공부</div>
                        <p class="muted" style="font-size:14px; margin-top:-8px; margin-bottom:12px;">두 제목 중 더 성과가 좋은 쪽을 선택하세요.</p>
                        
                        <!-- [수정된 레이아웃] 돌연변이 지수와 시청수를 한 줄에 배치 -->
                        <div class="start-buttons study-button-line">
                            <div class="study-button-sub-group">
                                <strong>돌연변이 지수</strong>
                                <button class="btn" data-type="title" data-mode="mutant" data-length="10">10개 (지수)</button>
                                <button class="btn" data-type="title" data-mode="mutant" data-length="20">20개 (지수)</button>
                                <button class="btn" data-type="title" data-mode="mutant" data-length="30">30개 (지수)</button>
                            </div>
                            <div class="study-button-sub-group">
                                <strong>시청수</strong>
                                <button class="btn" data-type="title" data-mode="views" data-length="10">10개 (시청)</button>
                                <button class="btn" data-type="title" data-mode="views" data-length="20">20개 (시청)</button>
                                <button class="btn" data-type="title" data-mode="views" data-length="30">30개 (시청)</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="study-game-screen" style="display: none;">
                <div class="progress-bar"><span id="progress-text">1 / 10</span></div>
                <div class="thumbnail-pair">
                    <div class="thumbnail-option" data-index="0"></div>
                    <div class="thumbnail-option" data-index="1"></div>
                </div>
                <div id="result-message" class="result-message">더 높은 쪽을 선택하세요</div>
            </div>
            
            <div id="study-history-screen" class="section">
                <div class="section-title">학습 발전 과정</div>
                <div class="chart-container"><canvas id="study-chart"></canvas></div>
                <table class="styled-table">
                    <thead>
                        <tr>
                            <th>날짜</th>
                            <th>학습</th>
                            <th>영역</th>
                            <th>횟수</th>
                            <th>정답</th>
                            <th>정답률</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
        <style>
          /* 가로 2분할 레이아웃 */
          .study-mode-wrapper { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
          
          /* 새로운 버튼 그룹 스타일 */
          .study-button-line { 
            display: grid; 
            grid-template-columns: 1fr 1fr; /* 돌연변이 그룹과 시청수 그룹을 가로로 분할 */
            gap: 10px; 
            align-items: start;
          }
          .study-button-sub-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .study-button-sub-group strong {
            font-size: 14px;
            margin-bottom: 4px;
            color: var(--brand-2); /* 구분을 위해 색상 강조 */
          }
          .study-button-sub-group .btn {
            width: 100%; /* 버튼이 서브 그룹 내에서 너비 꽉 채우도록 */
          }

          /* 제목 공부 상자 스타일 */
          .title-study-box { aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; text-align: center; padding: 16px; background-color: var(--card); font-size: 1.2rem; font-weight: bold; line-height: 1.4; border-radius: 10px; }
          
          /* 반응형 설정 */
          @media (max-width: 768px) { 
              .study-mode-wrapper { grid-template-columns: 1fr; } 
              .study-button-line { grid-template-columns: 1fr; } /* 모바일에서는 다시 수직으로 쌓기 */
          }
        </style>
    `;

    UI.startScreen = UI.root.querySelector('#study-start-screen');
    UI.gameScreen = UI.root.querySelector('#study-game-screen');
    UI.historyScreen = UI.root.querySelector('#study-history-screen');
    UI.optionA = UI.root.querySelectorAll('.thumbnail-option')[0];
    UI.optionB = UI.root.querySelectorAll('.thumbnail-option')[1];
    UI.progressText = UI.root.querySelector('#progress-text');
    UI.resultMessage = UI.root.querySelector('#result-message');
    
    const hasData = await loadAllVideos();
    if (hasData) {
        UI.root.querySelectorAll('.start-buttons button').forEach(btn => {
            btn.onclick = async () => {
                const confirmed = await window.showConfirmModal('준비되었나요?\n학습을 시작하겠습니다.');
                if (confirmed) {
                    const type = btn.dataset.type;
                    const mode = btn.dataset.mode;
                    const length = parseInt(btn.dataset.length, 10);
                    startGame(type, mode, length);
                }
            };
        });

        UI.root.querySelectorAll('.thumbnail-option').forEach(el => {
            el.onclick = () => handleGuess(parseInt(el.dataset.index, 10));
        });
        await renderHistoryAndChart();
    }
}