// js/main.js

import { openApiSettingsModal, closeApiSettingsModal, saveApiKey, updateApiStatus } from './api-settings.js';
import { addChannel, renderChannelList, loadChannelsFromStorage } from './channel-monitor.js';

document.addEventListener('DOMContentLoaded', () => {
    // API 설정 버튼 (톱니바퀴 아이콘) 클릭 이벤트
    const apiSettingsBtn = document.getElementById('api-settings-btn');
    if (apiSettingsBtn) {
        apiSettingsBtn.addEventListener('click', openApiSettingsModal);
    }

    const addChannelBtn = document.getElementById('add-channel-btn');
    if (addChannelBtn) {
        addChannelBtn.addEventListener('click', () => {
            const channelIdInput = document.getElementById('add-channel-id-input');
            const channelId = channelIdInput ? channelIdInput.value.trim() : '';

            if (channelId) {
                addChannel(channelId);
                channelIdInput.value = ''; // 입력 필드 초기화
            } else {
                alert('채널 ID를 입력해주세요.');
            }
        });
    }
    
    // 모달 내 '저장' 버튼 클릭 이벤트
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', () => {
            const apiKeyInput = document.getElementById('api-key-input');
            const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

            if (apiKey) {
                saveApiKey(apiKey);
                updateApiStatus();
                closeApiSettingsModal();
                alert('API 키가 성공적으로 저장되었습니다.');
            } else {
                alert('유효한 API 키를 입력해주세요.');
            }
        });
    }

    // 모달 내 '취소' 버튼 클릭 이벤트
    const cancelApiKeyBtn = document.getElementById('cancel-api-key-btn');
    if (cancelApiKeyBtn) {
        cancelApiKeyBtn.addEventListener('click', closeApiSettingsModal);
    }

    // 탭 네비게이션 기능
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 모든 탭 버튼과 콘텐츠에서 'active' 클래스 제거
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 클릭된 버튼과 해당 콘텐츠에 'active' 클래스 추가
            button.classList.add('active');
            const tabName = button.dataset.tab;
            const targetContent = document.getElementById(tabName);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // 페이지 로드 시 API 키 상태를 업데이트하여 표시
    updateApiStatus();
});
