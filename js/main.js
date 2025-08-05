// js/main.js
// 탭 전환, API 키 모달 등 공통 기능만 담당

import { saveApiKeys, downloadApiKeys, loadApiKeys } from './api_keys.js';
import { renderChannelList, loadChannelsFromStorage, openAddChannelModal, closeAddChannelModal, addChannel } from './channel-monitor.js';
import { renderMyChannels } from './my_channel_manager.js';

// DOM 요소 캐싱
const apiKeyModal = document.getElementById('api-key-modal');
const openApiKeyPopupButton = document.getElementById('open-api-key-popup');
const closeApiKeyModalButton = document.querySelector('#api-key-modal .close-button');
const saveApiKeysButton = document.getElementById('save-api-keys');
const apiKeyInputs = document.querySelectorAll('.api-key-input');
const downloadApiKeysButton = document.getElementById('download-api-keys');

const addChannelModal = document.getElementById('add-channel-modal');
const openAddChannelModalBtn = document.getElementById('open-add-channel-modal-btn');
const closeAddChannelModalBtn = document.getElementById('close-add-channel-modal');
const addChannelSaveBtn = document.getElementById('add-channel-save-btn');
const addChannelInput = document.getElementById('add-channel-input');

const tabs = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// 초기 로드
document.addEventListener('DOMContentLoaded', () => {
    // API 키 모달 초기화
    const keys = loadApiKeys();
    apiKeyInputs.forEach((input, index) => {
        if (keys[index]) {
            input.value = keys[index];
        }
    });

    // 탭 전환 이벤트 리스너
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTabId = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(targetTabId).classList.add('active');
            
            // 각 탭에 맞는 기능 로드 (필요에 따라)
            if (targetTabId === 'channel-monitor') {
                renderChannelList(loadChannelsFromStorage());
            } else if (targetTabId === 'my-channel-manager') {
                renderMyChannels();
            }
        });
    });

    // 초기에 활성화된 탭의 내용 렌더링
    const activeTab = document.querySelector('.tab-button.active');
    if (activeTab) {
        if (activeTab.dataset.tab === 'channel-monitor') {
            renderChannelList(loadChannelsFromStorage());
        } else if (activeTab.dataset.tab === 'my-channel-manager') {
            renderMyChannels();
        }
    }
});

// API 키 모달 이벤트
openApiKeyPopupButton.onclick = () => apiKeyModal.style.display = 'block';
closeApiKeyModalButton.onclick = () => apiKeyModal.style.display = 'none';
saveApiKeysButton.onclick = () => {
    const keys = Array.from(apiKeyInputs).map(input => input.value);
    if (saveApiKeys(keys)) {
        alert('API 키가 성공적으로 저장되었습니다.');
        apiKeyModal.style.display = 'none';
    }
};
downloadApiKeysButton.onclick = downloadApiKeys;
window.onclick = (event) => {
    if (event.target === apiKeyModal) {
        apiKeyModal.style.display = 'none';
    }
};

// 채널 추가 모달 이벤트
openAddChannelModalBtn.onclick = openAddChannelModal;
closeAddChannelModalBtn.onclick = closeAddChannelModal;
addChannelSaveBtn.onclick = () => {
    const channelId = addChannelInput.value.trim();
    if (channelId) {
        addChannel(channelId);
    } else {
        alert('채널 ID를 입력해주세요.');
    }
};
