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

// 3. 채널을 추가하고 localStorage에 저장하는 함수
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

        channels.push(channelInfo);
        saveChannelsToStorage(channels);
        renderChannelList(channels);
        alert(`${channelInfo.title} 채널이 성공적으로 추가되었습니다.`);
    } catch (error) {
        console.error('채널 추가 중 오류 발생:', error);
        alert('채널을 추가하는 중 오류가 발생했습니다.');
    }
}

// 4. 유튜브 API를 호출하여 채널 정보를 가져오는 함수
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
            videoCount: item.statistics.videoCount
        };
    } else {
        return null;
    }
}

// 5. 채널 목록을 화면에 렌더링하는 함수
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
            <button class="remove-btn" data-channel-id="${channel.id}">삭제</button>
        `;
        channelListContainer.appendChild(channelItem);
    });

    // 삭제 버튼 이벤트 리스너 추가
    document.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const channelId = event.target.dataset.channelId;
            removeChannel(channelId);
        });
    });
}

// 6. 채널을 삭제하는 함수
export function removeChannel(channelId) {
    const channels = loadChannelsFromStorage();
    const updatedChannels = channels.filter(channel => channel.id !== channelId);
    saveChannelsToStorage(updatedChannels);
    renderChannelList(updatedChannels);
}
