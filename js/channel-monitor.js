// js/channel-monitor.js

import { fetchYoutubeApi } from './api_keys.js';

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
    try {
        const url = `${YOUTUBE_API_BASE_URL}channels?part=snippet,statistics&id=${channelId}`;
        const data = await fetchYoutubeApi(url);

        if (data.items.length > 0) {
            const channelData = data.items[0];
            const newChannel = {
                id: channelData.id,
                title: channelData.snippet.title,
                thumbnail: channelData.snippet.thumbnails.default.url,
                subscriberCount: parseInt(channelData.statistics.subscriberCount),
                videoCount: parseInt(channelData.statistics.videoCount)
            };

            const channels = loadChannelsFromStorage();
            if (!channels.find(c => c.id === newChannel.id)) {
                channels.push(newChannel);
                saveChannelsToStorage(channels);
                renderChannelList(channels);
                closeAddChannelModal();
            } else {
                alert('이미 추가된 채널입니다.');
            }
        } else {
            alert('채널을 찾을 수 없습니다. 올바른 채널 ID를 입력해주세요.');
        }
    } catch (error) {
        console.error('Error fetching channel data:', error);
        alert('채널 데이터를 불러오는 중 오류가 발생했습니다. API 키를 확인해주세요.');
    }
}


// 6. 채널 목록을 화면에 렌더링하는 함수
export function renderChannelList(channels) {
    const container = document.getElementById('channel-list-container');
    if (!container) return;

    if (channels.length === 0) {
        container.innerHTML = '<p style="text-align:center;">아직 추가된 채널이 없습니다.</p>';
        return;
    }

    container.innerHTML = `
        <div class="channel-list">
            ${channels.map(channel => `
                <div class="channel-item">
                    <img src="${channel.thumbnail}" alt="${channel.title} 썸네일">
                    <div class="channel-info-wrapper">
                        <span class="channel-name">${channel.title}</span>
                        <div class="channel-actions">
                            <button class="view-videos-btn" data-channel-id="${channel.id}">영상 보기</button>
                            <button class="remove-btn" data-channel-id="${channel.id}">삭제</button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const channelIdToRemove = e.target.dataset.channelId;
            const updatedChannels = channels.filter(c => c.id !== channelIdToRemove);
            saveChannelsToStorage(updatedChannels);
            renderChannelList(updatedChannels);
        });
    });

    container.querySelectorAll('.view-videos-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const channelId = e.target.dataset.channelId;
            const channel = channels.find(c => c.id === channelId);
            if (channel) {
                await fetchAndRenderVideos(channel);
            }
        });
    });
}

// 7. 특정 채널의 영상을 불러와 렌더링하는 함수 (비동기)
async function fetchAndRenderVideos(channel) {
    try {
        const url = `${YOUTUBE_API_BASE_URL}search?part=snippet&channelId=${channel.id}&maxResults=20&order=date&type=video`;
        const data = await fetchYoutubeApi(url);

        if (data.items.length > 0) {
            const videoIds = data.items.map(item => item.id.videoId).join(',');
            const videoStatsUrl = `${YOUTUBE_API_BASE_URL}videos?part=statistics&id=${videoIds}`;
            const statsData = await fetchYoutubeApi(videoStatsUrl);

            const videos = data.items.map(item => {
                const stats = statsData.items.find(s => s.id === item.id.videoId);
                const viewCount = stats ? parseInt(stats.statistics.viewCount) : 0;
                
                // 돌연변이 지수 계산
                const mutantIndex = channel.subscriberCount > 0 ? (viewCount / channel.subscriberCount) : 0;
                const isMutant = mutantIndex >= 1.5;

                return {
                    id: item.id.videoId,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.high.url,
                    views: viewCount,
                    mutantIndex: mutantIndex,
                    isMutant: isMutant
                };
            });

            renderVideoList(channel, videos);
        } else {
            alert('해당 채널의 영상을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('Error fetching videos:', error);
        alert('영상 데이터를 불러오는 중 오류가 발생했습니다. API 키를 확인해주세요.');
    }
}

// 8. 영상 목록을 화면에 렌더링하는 함수
function renderVideoList(channel, videos) {
    const videoListContainer = document.getElementById('video-list-container');
    if (!videoListContainer) return;

    videoListContainer.innerHTML = `
        <div class="video-list-header">
            <h3>${channel.title} 채널 영상 목록</h3>
            <button id="back-to-channels-btn">채널 목록으로 돌아가기</button>
        </div>
        <div class="video-list">
            ${videos.map(video => {
                const mutantIndex = video.mutantIndex;
                const isMutant = mutantIndex >= 1.5;

                return `
                    <div class="thumbnail-card ${isMutant ? 'mutant-video' : ''}">
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
