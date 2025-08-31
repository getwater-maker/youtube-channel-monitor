// js/study.js
import { kvGet } from './indexedStore.js';
import { studyHistoryGetAll, studyHistoryAdd } from './indexedStore.js';

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const num = (n) => Number(n || 0);

const state = {
    allVideos: [],
    studyMode: null, // 'mutant' | 'views'
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
    thumbA: null,
    thumbB: null,
    progressText: null,
    resultMessage: null,
};

async function loadAllVideos() {
    const videos = await kvGet('videos:cache');
    if (!videos || videos.length < 2) {
        UI.root.innerHTML = `<div class="empty-state">학습에 필요한 영상 데이터가 부족합니다.<br>먼저 '영상분석' 탭에서 [다시불러오기]를 실행하여 데이터를 준비해주세요.</div>`;
        return false;
    }
    state.allVideos = videos.filter(v => v.secs > 0); // 라이브 영상 등 제외
    return true;
}

function generateQuestions() {
    state.questions = [];
    const videoCount = state.allVideos.length;
    for (let i = 0; i < 10; i++) {
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
    if (state.currentQuestionIndex >= 10) return;
    const q = state.questions[state.currentQuestionIndex];
    UI.thumbA.src = `https://i.ytimg.com/vi/${q.videoA.id}/mqdefault.jpg`;
    UI.thumbB.src = `https://i.ytimg.com/vi/${q.videoB.id}/mqdefault.jpg`;
    UI.progressText.textContent = `${state.currentQuestionIndex + 1} / 10`;
    UI.resultMessage.textContent = '더 높은 쪽을 선택하세요';
    UI.resultMessage.className = 'result-message';
    UI.thumbA.parentElement.classList.remove('correct', 'incorrect');
    UI.thumbB.parentElement.classList.remove('correct', 'incorrect');
}

async function handleGuess(selectedIndex) {
    const q = state.questions[state.currentQuestionIndex];
    const { videoA, videoB } = q;

    let isCorrect;
    let valueA, valueB;

    if (state.studyMode === 'mutant') {
        valueA = videoA.mutant;
        valueB = videoB.mutant;
        isCorrect = (selectedIndex === 0 && valueA > valueB) || (selectedIndex === 1 && valueB > valueA);
    } else { // 'views'
        valueA = videoA.views;
        valueB = videoB.views;
        isCorrect = (selectedIndex === 0 && valueA > valueB) || (selectedIndex === 1 && valueB > valueA);
    }

    if (isCorrect) {
        state.correctAnswers++;
        UI.resultMessage.textContent = '정답입니다!';
        UI.resultMessage.className = 'result-message correct';
        (selectedIndex === 0 ? UI.thumbA : UI.thumbB).parentElement.classList.add('correct');
    } else {
        UI.resultMessage.textContent = `오답! (A: ${num(valueA).toFixed(1)} vs B: ${num(valueB).toFixed(1)})`;
        UI.resultMessage.className = 'result-message incorrect';
        (selectedIndex === 0 ? UI.thumbA : UI.thumbB).parentElement.classList.add('incorrect');
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    state.currentQuestionIndex++;
    if (state.currentQuestionIndex < 10) {
        renderQuestion();
    } else {
        await endGame();
    }
}

async function endGame() {
    state.isGameActive = false;
    const accuracy = (state.correctAnswers / 10) * 100;
    
    window.toast(`학습 종료! 정답률: ${accuracy}%`, 'success', 2000);

    const newHistory = {
        date: new Date().toISOString().slice(0, 10),
        mode: state.studyMode === 'mutant' ? '돌연변이' : '시청수',
        total: 10,
        correct: state.correctAnswers,
        accuracy: accuracy,
    };

    await studyHistoryAdd(newHistory);
    await renderHistoryAndChart();
    renderUI();
}

function startGame(mode) {
    state.studyMode = mode;
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
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-state" style="padding: 24px;">학습 기록이 없습니다.</td></tr>`;
    } else {
        state.history.slice().reverse().forEach(h => {
            const row = el(`
                <tr>
                    <td>${h.date}</td>
                    <td>${h.mode}</td>
                    <td>${h.total}</td>
                    <td>${h.correct}</td>
                    <td>${h.accuracy.toFixed(0)}%</td>
                </tr>
            `);
            tableBody.appendChild(row);
        });
    }

    // Chart.js
    const canvas = UI.historyScreen.querySelector('#study-chart');
    const ctx = canvas.getContext('2d');

    const labels = state.history.map(h => h.date);
    const mutantData = state.history.filter(h => h.mode === '돌연변이').map(h => ({ x: h.date, y: h.accuracy }));
    const viewsData = state.history.filter(h => h.mode === '시청수').map(h => ({ x: h.date, y: h.accuracy }));

    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...new Set(labels)].sort(),
            datasets: [
                {
                    label: '돌연변이 정답률 (%)',
                    data: mutantData,
                    borderColor: 'var(--brand)',
                    backgroundColor: 'rgba(20, 184, 166, 0.1)',
                    fill: true,
                    tension: 0.1
                },
                {
                    label: '시청수 정답률 (%)',
                    data: viewsData,
                    borderColor: 'var(--brand-2)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

export async function initStudy({ mount }) {
    UI.root = document.querySelector(mount);
    UI.root.innerHTML = `
        <div class="study-container">
            <div id="study-start-screen" class="section">
                <div class="section-title">무엇을 공부할까요?</div>
                <p class="muted">두 개의 썸네일 중 더 높은 수치를 가진 쪽을 맞춰보세요.</p>
                <div class="start-buttons">
                    <button id="btn-start-mutant" class="btn btn-primary">돌연변이 지수 공부</button>
                    <button id="btn-start-views" class="btn btn-primary">시청수 공부</button>
                </div>
            </div>

            <div id="study-game-screen" style="display: none;">
                <div class="progress-bar"><span id="progress-text">1 / 10</span></div>
                <div class="thumbnail-pair">
                    <div class="thumbnail-option" data-index="0"><img id="thumb-a" src=""></div>
                    <div class="thumbnail-option" data-index="1"><img id="thumb-b" src=""></div>
                </div>
                <div id="result-message" class="result-message">더 높은 쪽을 선택하세요</div>
            </div>
            
            <div id="study-history-screen" class="section">
                <div class="section-title">학습 발전 과정</div>
                <div class="chart-container">
                    <canvas id="study-chart"></canvas>
                </div>
                <table class="styled-table">
                    <thead>
                        <tr>
                            <th>날짜</th>
                            <th>시도 영역</th>
                            <th>시도 횟수</th>
                            <th>정답 개수</th>
                            <th>정답률</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `;

    UI.startScreen = UI.root.querySelector('#study-start-screen');
    UI.gameScreen = UI.root.querySelector('#study-game-screen');
    UI.historyScreen = UI.root.querySelector('#study-history-screen');
    UI.thumbA = UI.root.querySelector('#thumb-a');
    UI.thumbB = UI.root.querySelector('#thumb-b');
    UI.progressText = UI.root.querySelector('#progress-text');
    UI.resultMessage = UI.root.querySelector('#result-message');
    
    const hasData = await loadAllVideos();
    if (hasData) {
        UI.root.querySelector('#btn-start-mutant').onclick = () => startGame('mutant');
        UI.root.querySelector('#btn-start-views').onclick = () => startGame('views');
        UI.root.querySelectorAll('.thumbnail-option').forEach(el => {
            el.onclick = () => handleGuess(parseInt(el.dataset.index, 10));
        });
        await renderHistoryAndChart();
    }
}