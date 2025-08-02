// =====================================================================================================
// thumbnail-test.js: '썸네일 테스트' 탭의 모든 로직을 담당하는 모듈
// =====================================================================================================
import {
    showLoading,
    hideLoading,
    fetchYouTubeApi,
} from './main.js';

// 이 모듈에서만 사용되는 DOM 요소들
const testIntroSection = document.getElementById('test-intro');
const testGameSection = document.getElementById('test-game');
const testResultSection = document.getElementById('test-result');
const testRecordsSection = document.getElementById('test-records');

const startTestBtn = document.getElementById('start-test-btn');
const restartTestBtn = document.getElementById('restart-test-btn');
const newTestBtn = document.getElementById('new-test-btn');
const viewRecordsBtn = document.getElementById('view-records-btn');
const closeRecordsBtn = document.getElementById('close-records-btn');

const questionCounterSpan = document.getElementById('question-counter');
const scoreCounterSpan = document.getElementById('score-counter');
const finalScoreTextSpan = document.getElementById('final-score-text');
const finalPercentageSpan = document.getElementById('final-percentage');

const thumbnailOptionA = document.getElementById('option-a');
const thumbnailOptionB = document.getElementById('option-b');
const thumbnailImgA = document.getElementById('thumbnail-a');
const thumbnailImgB = document.getElementById('thumbnail-b');
const videoTitleA = document.getElementById('title-a');
const videoTitleB = document.getElementById('title-b');
const channelNameA = document.getElementById('channel-a');
const channelNameB = document.getElementById('channel-b');

const testKeywordInput = document.getElementById('test-keyword');
const subscriberRangeSelect = document.getElementById('subscriber-range');
const questionCountSelect = document.getElementById('question-count');
const customSubscriberRangeDiv = document.getElementById('custom-subscriber-range');
const minSubscribersInput = document.getElementById('min-subscribers');
const maxSubscribersInput = document.getElementById('max-subscribers');
const recordsList = document.getElementById('records-list');

// 게임 상태 변수
let currentQuestionIndex = 0;
let score = 0;
let questions = [];
let testRecords = JSON.parse(localStorage.getItem('testRecords')) || [];

// =====================================================================================================
// 이벤트 리스너 설정
// =====================================================================================================
function setupEventListeners() {
    startTestBtn.addEventListener('click', () => {
        startTest();
    });
    restartTestBtn.addEventListener('click', () => {
        startTest();
    });
    newTestBtn.addEventListener('click', () => {
        showSection(testIntroSection);
    });
    viewRecordsBtn.addEventListener('click', () => {
        showSection(testRecordsSection);
        renderTestRecords();
    });
    closeRecordsBtn.addEventListener('click', () => {
        showSection(testIntroSection);
    });

    thumbnailOptionA.addEventListener('click', () => handleAnswer('a'));
    thumbnailOptionB.addEventListener('click', () => handleAnswer('b'));
    subscriberRangeSelect.addEventListener('change', toggleCustomSubRange);
}

// =====================================================================================================
// 게임 진행 로직
// =====================================================================================================
async function startTest() {
    showLoading('테스트 영상을 준비 중...');
    currentQuestionIndex = 0;
    score = 0;
    questions = [];

    const keyword = testKeywordInput.value.trim();
    const questionCount = parseInt(questionCountSelect.value);

    // API 호출을 통해 테스트에 사용할 영상 목록을 가져오는 로직 (가정)
    // 실제로는 검색 API와 video API를 조합하여 조건을 만족하는 영상들을 찾아야 합니다.
    const searchParams = {
        q: keyword,
        part: 'snippet',
        maxResults: 50,
        type: 'video',
        publishedAfter: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        publishedBefore: new Date(Date.now() - 45 * 60 * 60 * 1000).toISOString()
    };

    const searchData = await fetchYouTubeApi('search', searchParams);
    
    if (!searchData || searchData.items.length < 2) {
        hideLoading();
        alert('테스트에 필요한 영상을 찾을 수 없습니다. 조건을 변경하거나 나중에 다시 시도해주세요.');
        showSection(testIntroSection);
        return;
    }

    const videoIds = searchData.items.map(item => item.id.videoId);
    const videoData = await fetchYouTubeApi('videos', {
        id: videoIds.join(','),
        part: 'snippet,statistics'
    });
    
    if (!videoData) {
        hideLoading();
        alert('영상 통계 정보를 가져오는 데 실패했습니다.');
        showSection(testIntroSection);
        return;
    }

    // 통계 데이터를 포함한 영상 목록
    const availableVideos = videoData.items.filter(video => {
        // 영상 길이, 구독자 수 등 필터링 로직 추가
        const viewCount = parseInt(video.statistics.viewCount);
        const subCount = parseInt(video.statistics.subscriberCount);
        return viewCount > 1000 && subCount > 1000;
    });

    if (availableVideos.length < questionCount * 2) {
        hideLoading();
        alert(`테스트에 필요한 영상 ${questionCount * 2}개를 찾을 수 없습니다. 조건을 변경하거나 나중에 다시 시도해주세요.`);
        showSection(testIntroSection);
        return;
    }

    // 문제 생성
    for (let i = 0; i < questionCount; i++) {
        const randomIndexA = Math.floor(Math.random() * availableVideos.length);
        let randomIndexB = Math.floor(Math.random() * availableVideos.length);
        while (randomIndexA === randomIndexB) {
            randomIndexB = Math.floor(Math.random() * availableVideos.length);
        }
        
        const videoA = availableVideos[randomIndexA];
        const videoB = availableVideos[randomIndexB];
        
        questions.push({
            videoA,
            videoB,
            correctAnswer: parseInt(videoA.statistics.viewCount) > parseInt(videoB.statistics.viewCount) ? 'a' : 'b'
        });
    }

    hideLoading();
    showSection(testGameSection);
    loadQuestion();
}

function loadQuestion() {
    if (currentQuestionIndex >= questions.length) {
        endTest();
        return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    
    // UI 업데이트
    questionCounterSpan.textContent = `${currentQuestionIndex + 1} / ${questions.length}`;
    scoreCounterSpan.textContent = `정답: ${score}개`;

    // 썸네일과 정보 업데이트
    thumbnailImgA.src = currentQuestion.videoA.snippet.thumbnails.high.url;
    thumbnailImgB.src = currentQuestion.videoB.snippet.thumbnails.high.url;
    videoTitleA.textContent = currentQuestion.videoA.snippet.title;
    videoTitleB.textContent = currentQuestion.videoB.snippet.title;
    channelNameA.textContent = currentQuestion.videoA.snippet.channelTitle;
    channelNameB.textContent = currentQuestion.videoB.snippet.channelTitle;

    // 선택 효과 초기화
    thumbnailOptionA.classList.remove('selected', 'correct', 'incorrect');
    thumbnailOptionB.classList.remove('selected', 'correct', 'incorrect');
}

async function handleAnswer(selectedOption) {
    const currentQuestion = questions[currentQuestionIndex];
    const correctAnswer = currentQuestion.correctAnswer;
    const isCorrect = selectedOption === correctAnswer;

    if (isCorrect) {
        score++;
        scoreCounterSpan.textContent = `정답: ${score}개`;
        document.getElementById(`option-${selectedOption}`).classList.add('correct');
    } else {
        document.getElementById(`option-${selectedOption}`).classList.add('incorrect');
        document.getElementById(`option-${correctAnswer}`).classList.add('correct');
    }
    
    // 다음 문제로 넘어가기 전 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    currentQuestionIndex++;
    loadQuestion();
}

function endTest() {
    const totalQuestions = questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    finalScoreTextSpan.textContent = `${totalQuestions}문제 중 ${score}문제 정답`;
    finalPercentageSpan.textContent = `(${percentage}%)`;

    // 기록 저장
    const newRecord = {
        date: new Date().toLocaleDateString(),
        keyword: testKeywordInput.value.trim() || '없음',
        totalQuestions: totalQuestions,
        score: score,
        percentage: percentage,
    };
    testRecords.push(newRecord);
    localStorage.setItem('testRecords', JSON.stringify(testRecords));

    showSection(testResultSection);
}

// =====================================================================================================
// UI 렌더링 및 유틸리티 함수
// =====================================================================================================
function showSection(section) {
    testIntroSection.style.display = 'none';
    testGameSection.style.display = 'none';
    testResultSection.style.display = 'none';
    testRecordsSection.style.display = 'none';
    section.style.display = 'block';
}

function toggleCustomSubRange() {
    if (subscriberRangeSelect.value === 'custom') {
        customSubscriberRangeDiv.style.display = 'flex';
    } else {
        customSubscriberRangeDiv.style.display = 'none';
    }
}

function renderTestRecords() {
    recordsList.innerHTML = '';
    if (testRecords.length === 0) {
        recordsList.innerHTML = '<div class="empty-state"><p>아직 기록된 테스트가 없습니다.</p></div>';
        return;
    }

    testRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    testRecords.forEach(record => {
        const recordCard = document.createElement('div');
        recordCard.className = 'record-card';
        recordCard.innerHTML = `
            <div>
                <span class="record-date">${record.date}</span>
                <span class="record-keyword">${record.keyword}</span>
            </div>
            <div class="record-score">
                <span>${record.score} / ${record.totalQuestions} (${record.percentage}%)</span>
            </div>
        `;
        recordsList.appendChild(recordCard);
    });
}

// =====================================================================================================
// 초기화
// =====================================================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    toggleCustomSubRange(); // 초기 상태 설정
});
