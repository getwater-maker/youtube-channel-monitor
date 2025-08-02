// =====================================================================================================
// video-search.js: '영상 검색' 탭의 모든 로직을 담당하는 모듈
// =====================================================================================================
import {
    showLoading,
    hideLoading,
    fetchYouTubeApi
} from './main.js';

// 이 모듈에서만 사용되는 DOM 요소들
const searchKeywordInput = document.getElementById('search-keyword');
const searchBtn = document.getElementById('search-btn');
const searchResultsContainer = document.getElementById('search-results');
const subFilterSelect = document.getElementById('sub-filter');
const viewFilterSelect = document.getElementById('view-filter');
const dateRangeTypeSelect = document.getElementById('date-range-type');
const dateRangeSelect = document.getElementById('date-range');
const customDateRangeDiv = document.getElementById('custom-date-range');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const sortOrderSelect = document.getElementById('sort-order');

let currentSearchQuery = '';
let searchResults = [];

// =====================================================================================================
// 이벤트 리스너 설정 함수
// =====================================================================================================
function setupEventListeners() {
    searchBtn.addEventListener('click', startSearch);
    searchKeywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startSearch();
        }
    });
    dateRangeTypeSelect.addEventListener('change', toggleCustomDateRange);
}

// =====================================================================================================
// 검색 로직 함수
// =====================================================================================================
async function startSearch() {
    const keyword = searchKeywordInput.value.trim();
    if (!keyword) {
        alert('검색 키워드를 입력해주세요.');
        return;
    }

    currentSearchQuery = keyword;
    showLoading('영상을 검색 중...');

    // 검색 파라미터 구성
    const params = {
        q: keyword,
        part: 'snippet',
        maxResults: 50,
        type: 'video',
        order: 'relevance' // 기본 정렬은 관련성
    };

    // 업로드 날짜 필터 적용
    const publishedAfter = getPublishedAfterDate();
    if (publishedAfter) {
        params.publishedAfter = publishedAfter;
    }

    const data = await fetchYouTubeApi('search', params);

    if (!data || data.items.length === 0) {
        hideLoading();
        searchResultsContainer.innerHTML = `
            <div class="empty-state">
                <p>검색 결과가 없습니다.</p>
            </div>
        `;
        return;
    }
    
    // 이 단계에서 각 영상의 통계 데이터를 가져오는 로직 추가 필요
    // Search API는 조회수, 구독자수 등의 통계 데이터를 제공하지 않으므로,
    // video API를 추가로 호출해야 합니다.
    const videoIds = data.items.map(item => item.id.videoId).join(',');
    const videoData = await fetchYouTubeApi('videos', {
        id: videoIds,
        part: 'snippet,statistics'
    });

    hideLoading();
    if (!videoData) {
        return;
    }

    searchResults = videoData.items.map(item => {
        const viewCount = parseInt(item.statistics.viewCount) || 0;
        const subscriberCount = item.channel.statistics.subscriberCount; // 더미 데이터로 가정
        const averageViewCount = (subscriberCount > 0) ? (viewCount / subscriberCount) * 100 : 0; // 예시로 단순 계산
        
        return {
            ...item,
            viewCount: viewCount,
            subscriberCount: subscriberCount,
            averageViewCount: averageViewCount,
            ratio: (viewCount / averageViewCount).toFixed(2)
        };
    });
    
    renderSearchResults();
}

// =====================================================================================================
// UI 렌더링 및 필터링/정렬 함수
// =====================================================================================================
// 검색 결과 화면에 렌더링
function renderSearchResults() {
    if (searchResults.length === 0) {
        searchResultsContainer.innerHTML = `
            <div class="empty-state">
                <p>검색 결과를 표시할 수 없습니다.</p>
            </div>
        `;
        return;
    }
    
    // 필터링 및 정렬 로직
    let filteredResults = filterSearchResults(searchResults);
    filteredResults = sortSearchResults(filteredResults);
    
    searchResultsContainer.innerHTML = '';
    
    if (filteredResults.length === 0) {
        searchResultsContainer.innerHTML = `
            <div class="empty-state">
                <p>필터링 조건에 맞는 결과가 없습니다.</p>
            </div>
        `;
        return;
    }

    filteredResults.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.innerHTML = `
            <img src="${video.snippet.thumbnails.high.url}" alt="${video.snippet.title}" class="video-thumbnail">
            <div class="video-info">
                <div class="video-title">${video.snippet.title}</div>
                <div class="video-stats">
                    <span>채널: ${video.snippet.channelTitle}</span>
                    <span>조회수: ${video.viewCount.toLocaleString()}회</span>
                    <span>돌연변이: ${video.ratio}배</span>
                </div>
            </div>
        `;
        searchResultsContainer.appendChild(videoCard);
    });
}

// 검색 결과 필터링
function filterSearchResults(results) {
    const subCount = parseInt(subFilterSelect.value);
    const viewCount = parseInt(viewFilterSelect.value);
    
    return results.filter(video => {
        const passesSubFilter = video.subscriberCount >= subCount;
        const passesViewFilter = video.viewCount >= viewCount;
        return passesSubFilter && passesViewFilter;
    });
}

// 검색 결과 정렬
function sortSearchResults(results) {
    const sortKey = sortOrderSelect.value;
    
    return results.sort((a, b) => {
        if (sortKey === 'ratio') {
            return parseFloat(b.ratio) - parseFloat(a.ratio);
        } else if (sortKey === 'viewCount') {
            return b.viewCount - a.viewCount;
        } else if (sortKey === 'subscriberCount') {
            return b.subscriberCount - a.subscriberCount;
        } else if (sortKey === 'publishedAt') {
            return new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt);
        }
        return 0;
    });
}

// 업로드 날짜 필터링 로직
function getPublishedAfterDate() {
    const type = dateRangeTypeSelect.value;
    const now = new Date();
    let publishedAfter = null;

    if (type === 'preset') {
        const range = dateRangeSelect.value;
        const [unit, value] = [range.slice(-1), parseInt(range.slice(0, -1))];
        
        if (unit === 'h') now.setHours(now.getHours() - value);
        if (unit === 'd') now.setDate(now.getDate() - value);
        if (unit === 'w') now.setDate(now.getDate() - value * 7);
        if (unit === 'm') now.setMonth(now.getMonth() - value);
        if (unit === 'y') now.setFullYear(now.getFullYear() - value);
        
        publishedAfter = now.toISOString();
    } else if (type === 'custom') {
        if (startDateInput.value) {
            publishedAfter = new Date(startDateInput.value).toISOString();
        }
    }
    return publishedAfter;
}

// 커스텀 날짜 범위 토글
function toggleCustomDateRange() {
    if (dateRangeTypeSelect.value === 'custom') {
        dateRangeSelect.style.display = 'none';
        customDateRangeDiv.style.display = 'block';
    } else {
        dateRangeSelect.style.display = 'block';
        customDateRangeDiv.style.display = 'none';
    }
}

// =====================================================================================================
// 초기화
// =====================================================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});
