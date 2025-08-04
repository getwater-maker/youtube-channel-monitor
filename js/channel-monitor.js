// js/channel-monitor.js

import { getApiKey } from './api-settings.js';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3/';
const CHANNELS_STORAGE_KEY = 'youtube_channels';

// 1. localStorage에서 저장된 채널 목록을 불러오는 함수
export function loadChannelsFromStorage() {
    const channelsJson = localStorage.getItem(CHANNELS_STORAGE_KEY);
    return channelsJson ? JSON.parse(channelsJson) : [];
}

// 2. 채널 목록을 localStorage에 저장하는 함수
export function saveChannelsToStorage(channels) {
    localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(channels));
}

// 3. 채널 추가 모달을 여는 함수
export function openAddChannelModal() {
    const modal = document.getElementById('add-channel-modal');
    if (modal) {
        modal.style.display = 'flex';
        const channelIdInput = document.getElementById('add-channel-input');
        if (channelIdInput) {
            channelIdInput.value = ''; // 모달 열 때 입력 필드 초기화
        }
    }
}

// 4. 채널 추가 모달을 닫는 함수
export function closeAddChannelModal() {
    const modal = document.getElementById('add-channel-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 5. 채널을 추가하고 localStorage에 저장하는 함수
export async function addChannel(channelId) {
    const apiKey = getApiKey();
    if (!apiKey) {
        alert('API 키가 설정되지 않았습니다. 설정 먼저 해주세요.');
        return;
    }

    try {
        const channelInfo = await fetchChannelInfo(channelId, apiKey);
        if (!channelInfo) {
            alert('채널 정보를 가져올 수 없습니다. 채널 ID를 다시 확인해주세요.');
            return;
        }

        const channels = loadChannelsFromStorage();
        if (channels.some(channel => channel.id === channelInfo.id)) {
            alert('이미 추가된 채널입니다.');
            return;
        }
        
        const videos = await fetchChannelVideos(channelId, apiKey);
        channelInfo.videos = videos;

        channels.push(channelInfo);
        saveChannelsToStorage(channels);
        renderChannelList(channels);
        alert(`${channelInfo.title} 채널이 성공적으로 추가되었습니다.`);
    } catch (error) {
        console.error('채널 추가 중 오류 발생:', error);
        alert('채널을 추가하는 중 오류가 발생했습니다. API 키가 유효한지 확인하거나 잠시 후 다시 시도해주세요.');
    }
}

// 6. 유튜브 API를 호출하여 채널 정보를 가져오는 함수
async function fetchChannelInfo(channelId, apiKey) {
    const response = await fetch(`${YOUTUBE_API_BASE_URL}channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`);
    const data = await response.json();
    if (response.ok && data.items.length > 0) {
        const item = data.items[0];
        return {
            id: item.id,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.default.url,
            subscriberCount: item.statistics.subscriberCount,
            videoCount: item.statistics.videoCount,
        };
    } else {
        return null;
    }
}

// 7. 특정 채널의 최신 영상 목록을 가져오는 함수
async function fetchChannelVideos(channelId, apiKey) {
    const playlistResponse = await fetch(`${YOUTUBE_API_BASE_URL}channels?part=contentDetails&id=${channelId}&key=${apiKey}`);
    const playlistData = await playlistResponse.json();
    if (!playlistData.items || playlistData.items.length === 0) {
        return [];
    }
    const uploadsPlaylistId = playlistData.items[0].contentDetails.relatedPlaylists.uploads;

    const videosResponse = await fetch(`${YOUTUBE_API_BASE_URL}playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=20&key=${apiKey}`);
    const videosData = await videosResponse.json();

    if (!videosData.items) {
        return [];
    }

    const videoIds = videosData.items.map(item => item.snippet.resourceId.videoId);
    const videoStats = await fetchVideoStatistics(videoIds, apiKey);

    return videosData.items.map(item => {
        const stats = videoStats[item.snippet.resourceId.videoId] || {};
        return {
            id: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.default.url,
            publishedAt: item.snippet.publishedAt,
            views: stats.viewCount || 0,
            likes: stats.likeCount || 0,
            comments: stats.commentCount || 0,
        };
    });
}

// 8. 여러 영상 ID의 통계 데이터를 가져오는 함수
async function fetchVideoStatistics(videoIds, apiKey) {
    if (videoIds.length === 0) {
        return {};
    }
    const videoStatsResponse = await fetch(`${YOUTUBE_API_BASE_URL}videos?part=statistics&id=${videoIds.join(',')}&key=${apiKey}`);
    const videoStatsData = await videoStatsResponse.json();
    
    const statsMap = {};
    if (videoStatsData.items) {
        videoStatsData.items.forEach(item => {
            statsMap[item.id] = {
                viewCount: item.statistics.viewCount,
                likeCount: item.statistics.likeCount,
                commentCount: item.statistics.commentCount,
            };
        });
    }
    return statsMap;
}

// 9. 채널 목록을 화면에 렌더링하는 함수
export function renderChannelList(channels) {
    const channelListContainer = document.getElementById('channel-list');
    if (!channelListContainer) return;

    channelListContainer.innerHTML = '';
    
    if (channels.length === 0) {
        channelListContainer.innerHTML = '<p class="no-data">등록된 채널이 없습니다.</p>';
        return;
    }

    channels.forEach(channel => {
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        channelItem.innerHTML = `
            <img src="${channel.thumbnail}" alt="${channel.title} 썸네일" class="channel-thumbnail">
            <div class="channel-info">
                <h3>${channel.title}</h3>
                <p>구독자: ${parseInt(channel.subscriberCount).toLocaleString()}명</p>
                <p>영상 수: ${parseInt(channel.videoCount).toLocaleString()}개</p>
            </div>
            <div class="channel-actions">
                <button class="view-videos-btn" data-channel-id="${channel.id}">최신 영상 보기</button>
                <button class="remove-btn" data-channel-id="${channel.id}">삭제</button>
            </div>
        `;
        channelListContainer.appendChild(channelItem);
    });

    // 버튼 이벤트 리스너 추가
    document.querySelectorAll('.view-videos-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const channelId = event.target.dataset.channelId;
            const channels = loadChannelsFromStorage();
            const channel = channels.find(c => c.id === channelId);
            if (channel) {
                renderVideoList(channel);
            }
        });
    });

    document.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const channelId = event.target.dataset.channelId;
            removeChannel(channelId);
        });
    });
}

// 10. 채널을 삭제하는 함수
export function removeChannel(channelId) {
    const channels = loadChannelsFromStorage();
    const updatedChannels = channels.filter(channel => channel.id !== channelId);
    saveChannelsToStorage(updatedChannels);
    renderChannelList(updatedChannels);
}

// 11. 특정 채널의 영상 목록을 화면에 렌더링하고 '돌연변이 지수'를 계산하여 표시하는 함수
export function renderVideoList(channel) {
    const videoListContainer = document.getElementById('video-list-container');
    if (!videoListContainer) return;

    videoListContainer.innerHTML = `
        <div class="video-list-header">
            <h3>${channel.title} 채널 영상 목록</h3>
            <button id="back-to-channels-btn">채널 목록으로 돌아가기</button>
        </div>
        <div class="video-list-body">
            ${channel.videos.map(video => {
                const mutantIndex = channel.subscriberCount > 0 ? (video.views / channel.subscriberCount) : 0;
                const isMutant = mutantIndex >= 1.5;

                return `
                    <div class="video-item ${isMutant ? 'mutant-video' : ''}">
                        <img src="${video.thumbnail}" alt="${video.title} 썸네일" class="video-thumbnail">
                        <div class="video-info">
                            <h4>${video.title}</h4>
                            <p>조회수: ${parseInt(video.views).toLocaleString()}회</p>
                            <p>돌연변이 지수: ${mutantIndex.toFixed(2)}</p>
                            ${isMutant ? '<span class="mutant-badge">돌연변이!</span>' : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    document.getElementById('back-to-channels-btn').addEventListener('click', () => {
        const channelMonitorTab = document.getElementById('channel-monitor');
        videoListContainer.innerHTML = '';
        renderChannelList(loadChannelsFromStorage());
    });
}
