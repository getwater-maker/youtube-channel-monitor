// js/my-channel-manager.js
import { fetchYoutubeApi } from './api_keys.js';
import { isLongform, calculateMutantIndex } from './utils.js';

// 내채널관리 관련 변수 및 초기화
let myChannels = [];
const MY_CHANNELS_KEY = 'myChannels'; // localStorage key

// DOM 캐싱
const myChannelCountText = document.getElementById('my-channel-count-text');
const myChannelListContainer = document.getElementById('my-channel-list-container');
const addMyChannelButton = document.getElementById('add-my-channel-button');
const myChannelStatsContainer = document.getElementById('my-channel-stats-container');
const myChannelMutantVideosContainer = document.getElementById('my-channel-mutant-videos-container');

// 탭 진입시만 새로고침
document.querySelector('button[data-tab="my-channel-manager"]').addEventListener('click', () => {
    loadMyChannels();
    updateMyChannelManagerUI();
});

// ---------- 1. 로컬스토리지에서 내채널 목록 불러오기 ----------
function loadMyChannels() {
    const stored = localStorage.getItem(MY_CHANNELS_KEY);
    if (stored) {
        myChannels = JSON.parse(stored);
    } else {
        myChannels = [];
    }
}

// ---------- 2. 로컬스토리지에 저장하기 ----------
function saveMyChannels() {
    localStorage.setItem(MY_CHANNELS_KEY, JSON.stringify(myChannels));
}

// ---------- 3. 내 채널 UI 업데이트 ----------
async function updateMyChannelManagerUI() {
    // 3-1. 상단 카운트
    myChannelCountText.textContent = `현재 ${myChannels.length}개의 채널이 등록되었습니다.`;

    // 3-2. 채널 리스트 출력
    myChannelListContainer.innerHTML = '';
    if (myChannels.length === 0) {
        myChannelListContainer.innerHTML = '<p>등록된 채널이 없습니다.</p>';
        myChannelStatsContainer.innerHTML = '';
        myChannelMutantVideosContainer.innerHTML = '';
        return;
    }
    myChannels.forEach(channel => {
        const div = document.createElement('div');
        div.classList.add('channel-item');
        div.innerHTML = `
            <div class="channel-info-wrapper">
                <a href="https://www.youtube.com/channel/${channel.id}" target="_blank">
                    <img src="${channel.logo}" alt="${channel.name} 로고" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;">
                </a>
                <div>
                    <h3><a href="https://www.youtube.com/channel/${channel.id}" target="_blank">${channel.name}</a></h3>
                    <p>구독자: <span>${parseInt(channel.subscriberCount).toLocaleString()}</span>명</p>
                    <p>총조회수: <span>${parseInt(channel.viewCount).toLocaleString()}</span></p>
                    <p>공개영상 유효시청시간: <span>${channel.watchTime || '알 수 없음'}</span> 시간</p>
                </div>
            </div>
            <button class="delete-my-channel-button" data-channel-id="${channel.id}">삭제</button>
        `;
        myChannelListContainer.appendChild(div);
    });

    // 3-3. 변화량, mutant 영상 업데이트
    await updateMyChannelStatsAndMutants();
}

// ---------- 4. 채널 변화량 & 돌연변이 TOP3 ----------
async function updateMyChannelStatsAndMutants() {
    myChannelStatsContainer.innerHTML = '';
    myChannelMutantVideosContainer.innerHTML = '';

    // 표 헤더
    let statsTable = `
        <table class="stats-table">
        <thead>
            <tr>
                <th>채널명</th>
                <th>구독자수 증감</th>
                <th>총조회수 증감</th>
                <th>공개영상 유효시청시간 증감</th>
                <th>마지막 기록일</th>
            </tr>
        </thead>
        <tbody>
    `;

    for (const channel of myChannels) {
        // 1. 이전 저장 데이터 불러오기
        const prevKey = `myChannelHistory_${channel.id}`;
        let prevData = localStorage.getItem(prevKey);
        prevData = prevData ? JSON.parse(prevData) : null;

        // 2. 현재 데이터 최신화
        const latest = await fetchMyChannelStats(channel.id);
        if (!latest) continue; // fetch 실패

        // 3. 변화량 계산
        const subDiff = prevData ? latest.subscriberCount - prevData.subscriberCount : 0;
        const viewDiff = prevData ? latest.viewCount - prevData.viewCount : 0;
        const watchDiff = prevData ? (latest.watchTime - prevData.watchTime) : 0;

        // 4. 표에 추가
        statsTable += `
            <tr>
                <td>${channel.name}</td>
                <td>${subDiff > 0 ? '+' : ''}${subDiff.toLocaleString()}</td>
                <td>${viewDiff > 0 ? '+' : ''}${viewDiff.toLocaleString()}</td>
                <td>${watchDiff > 0 ? '+' : ''}${watchDiff.toLocaleString()}</td>
                <td>${prevData ? prevData.savedDate : '-'}</td>
            </tr>
        `;

        // 5. 오늘 정보로 기록 갱신
        const todayData = {
            subscriberCount: latest.subscriberCount,
            viewCount: latest.viewCount,
            watchTime: latest.watchTime,
            savedDate: new Date().toLocaleDateString('ko-KR')
        };
        localStorage.setItem(prevKey, JSON.stringify(todayData));

        // 6. 돌연변이 TOP3
        const mutantList = await fetchMutantVideos(channel, latest.subscriberCount);
        // mutantList: [{id, title, mutantIndex, thumbnail, viewCount, publishedAt}]
        if (mutantList && mutantList.length) {
            let html = `<div class="my-mutant-videos"><b>${channel.name} TOP3</b>`;
            mutantList.forEach(video => {
                html += `
                <div class="video-item" style="display:flex;align-items:center;">
                    <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">
                        <img src="${video.thumbnail}" style="width:90px; height:55px; border-radius:6px; margin-right:12px;">
                    </a>
                    <div style="flex:1">
                        <div style="font-size:14px; font-weight:bold; margin-bottom:2px;">
                            <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">${video.title}</a>
                        </div>
                        <span style="color:#c4302b; font-weight:bold; border:2px solid #c4302b; border-radius:6px; padding:2px 6px; margin-left:8px; float:right;">${video.mutantIndex}</span>
                    </div>
                </div>
                `;
            });
            html += `</div>`;
            myChannelMutantVideosContainer.innerHTML += html;
        }
    }
    statsTable += '</tbody></table>';
    myChannelStatsContainer.innerHTML = statsTable;
}

// ---------- 5. 내 채널 직접 추가 ----------
addMyChannelButton.addEventListener('click', async () => {
    const input = prompt('추가할 채널명을 입력하세요:');
    if (!input) return;
    // 유튜브 API로 채널 검색
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(input)}&type=channel&maxResults=1`;
    try {
        const data = await fetchYoutubeApi(url);
        if (!data.items || !data.items.length) {
            alert('채널을 찾을 수 없습니다.');
            return;
        }
        const channelId = data.items[0].id.channelId;
        if (myChannels.some(c => c.id === channelId)) {
            alert('이미 등록된 채널입니다.');
            return;
        }
        // 상세정보
        const info = await getMyChannelInfo(channelId);
        myChannels.push(info);
        saveMyChannels();
        updateMyChannelManagerUI();
    } catch (e) {
        alert('채널 정보 조회에 실패했습니다.');
    }
});

// ---------- 6. 내 채널 삭제 ----------
myChannelListContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-my-channel-button')) {
        const id = e.target.dataset.channelId;
        if (confirm('이 채널을 삭제하시겠습니까?')) {
            myChannels = myChannels.filter(c => c.id !== id);
            saveMyChannels();
            updateMyChannelManagerUI();
        }
    }
});

// ---------- 7. 유튜브 API - 채널 상세, 통계 ----------
async function getMyChannelInfo(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const item = data.items[0];
    return {
        id: channelId,
        name: item.snippet.title,
        logo: item.snippet.thumbnails.default.url,
        subscriberCount: Number(item.statistics.subscriberCount || 0),
        viewCount: Number(item.statistics.viewCount || 0),
        watchTime: 0, // 최초는 0, 추후 업데이트 시 갱신
        uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads
    };
}

// ---------- 8. 내채널 통계 정보 수집 ----------
async function fetchMyChannelStats(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const stat = data.items[0]?.statistics || {};
    // 유효시청시간은 실제로는 별도 API 필요(여기선 임의값)
    return {
        subscriberCount: Number(stat.subscriberCount || 0),
        viewCount: Number(stat.viewCount || 0),
        watchTime: Math.floor(Math.random() * 10000) // 데모용 랜덤(실제 구현시 유효 API 필요)
    };
}

// ---------- 9. 돌연변이 영상 TOP3 ----------
async function fetchMutantVideos(channel, subscriberCount) {
    let allVideos = [];
    let nextPageToken = null;
    // 최근 30개만 조회
    while (allVideos.length < 30) {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${channel.uploadsPlaylistId}&maxResults=10${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const data = await fetchYoutubeApi(url);
        if (!data.items) break;
        allVideos = allVideos.concat(data.items);
        if (!data.nextPageToken) break;
        nextPageToken = data.nextPageToken;
    }
    const videoIds = allVideos.map(item => item.contentDetails.videoId);
    // 영상 상세정보
    if (!videoIds.length) return [];
    const details = await getMyVideoDetails(videoIds);
    const mutants = details
        .map(v => ({
            ...v,
            mutantIndex: calculateMutantIndex(v.viewCount, subscriberCount)
        }))
        .filter(v => parseFloat(v.mutantIndex) >= 2.0 && isLongform(v.duration))
        .sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex))
        .slice(0, 3);
    return mutants;
}

async function getMyVideoDetails(videoIds) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}`;
    const data = await fetchYoutubeApi(url);
    return data.items.map(item => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
        viewCount: Number(item.statistics.viewCount || 0),
        publishedAt: item.snippet.publishedAt,
        duration: item.contentDetails.duration
    }));
}
