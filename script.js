// 테스트 문제 생성 (롱폼만)
class YouTubeMonitor {

        async generateTestQuestions(keyword, subscriberRange, questionCount = 50) {
        const apiKey = this.getCurrentApiKey();
        if (!apiKey) {
            throw new Error('API 키가 설정되지 않았습니다.');
        }

        // 48-50시간 전 날짜 범위 계산
        const endTime = new Date();
        endTime.setHours(endTime.getHours() - 48);
        const startTime = new Date();
        startTime.setHours(startTime.getHours() - 50);

        const publishedAfter = startTime.toISOString();
        const publishedBefore = endTime.toISOString();

        let searchQuery = keyword || '';
        if (!keyword) {
            // 키워드가 없으면 다양한 주제로 검색
            const topics = ['음악', '게임', '요리', '여행', '스포츠', '기술', '영화', '드라마', '뉴스', '교육'];
            searchQuery = topics[Math.floor(Math.random() * topics.length)];
        }

        // 영상 검색 (롱폼만)
        const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(searchQuery)}&maxResults=50&publishedAfter=${publishedAfter}&publishedBefore=${publishedBefore}&videoDuration=medium&key=${apiKey}`
        );

        if (!searchResponse.ok) {
            throw new Error(`검색 API 오류: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();
        if (!searchData.items || searchData.items.length < 10) {
            throw new Error('충분한 영상을 찾을 수 없습니다.');
        }

        // 영상 상세 정보 가져오기 (contentDetails 포함)
        const videoIds = searchData.items.map(item => item.id.videoId);
        const videosResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
        );

        if (!videosResponse.ok) {
            throw new Error(`영상 정보 API 오류: ${videosResponse.status}`);
        }

        const videosData = await videosResponse.json();

        // 채널 정보 가져오기
        const channelIds = [...new Set(videosData.items.map(item => item.snippet.channelId))];
        const channelsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds.join(',')}&key=${apiKey}`
        );

        let channelsData = { items: [] };
        if (channelsResponse.ok) {
            channelsData = await channelsResponse.json();
        }

        // 롱폼 영상만 필터링 및 구독자 수 필터링 (3분 1초 이상)
        const videos = videosData.items
            .filter(video => {
                // 롱폼 필터링 (3분 1초 이상)
                return this.isLongForm(video.contentDetails?.duration || 'PT0S');
            })
            .map(video => {
                const channel = channelsData.items.find(c => c.id === video.snippet.channelId) || {};
                const subscriberCount = parseInt(channel.statistics?.subscriberCount || 0);
                
                return {
                    id: video.id,
                    title: video.snippet.title,
                    channelTitle: video.snippet.channelTitle,
                    channelId: video.snippet.channelId,
                    thumbnail: video.snippet.thumbnails?.medium?.url || '',
                    viewCount: parseInt(video.statistics?.viewCount || 0),
                    subscriberCount: subscriberCount,
                    duration: this.parseDuration(video.contentDetails?.duration || 'PT0S')
                };
            })
            .filter(video => {
                // 구독자 수 필터링
                if (subscriberRange === 'all') return true;
                
                const sub = video.subscriberCount;
                switch (subscriberRange) {
                    case 'micro': return sub >= 1000 && sub <= 10000;
                    case 'small': return sub >= 10000 && sub <= 100000;
                    case 'medium': return sub >= 100000 && sub <= 1000000;
                    case 'large': return sub >= 1000000 && sub <= 10000000;
                    case 'mega': return sub >= 10000000;
                    case 'custom':
                        const min = parseInt(document.getElementById('min-subscribers').value) || 0;
                        const max = parseInt(document.getElementById('max-subscribers').value) || Infinity;
                        return sub >= min && sub <= max;
                    default: return true;
                }
            });

        if (videos.length < 10) {
            throw new Error('필터 조건에 맞는 충분한 롱폼 영상을 찾을 수 없습니다.');
        }

        // 문제 생성
        const questions = [];
        const usedVideos = new Set();

        while (questions.length < questionCount && usedVideos.size < videos.length - 1) {
            // 랜덤하게 두 영상 선택
            const availableVideos = videos.filter(v => !usedVideos.has(v.id));
            if (availableVideos.length < 2) break;

            const video1 = availableVideos[Math.floor(Math.random() * availableVideos.length)];
            let video2;
            do {
                video2 = availableVideos[Math.floor(Math.random() * availableVideos.length)];
            } while (video2.id === video1.id);

            // 정답 결정 (조회수가 더 높은 것)
            const correctAnswer = video1.viewCount > video2.viewCount ? 'a' : 'b';

            questions.push({
                videoA: video1,
                videoB: video2,
                correctAnswer: correctAnswer
            });

            usedVideos.add(video1.id);
            usedVideos.add(video2.id);
        }

        return questions;
    }

// YouTube 채널 모니터링 애플리케이션

    constructor() {
        this.apiKeys = [];
        this.currentApiIndex = 0;
        this.monitoringChannels = [];
        this.trackingChannels = [];
        this.subscriberData = {};
        this.currentTest = null;
        this.testQuestions = [];
        this.currentQuestionIndex = 0;
        this.testRecords = [];
        
        this.init();
    }

    init() {
        this.loadStoredData();
        this.setupEventListeners();
        this.updateApiStatus();
        this.updateChannelManagement();
        this.updateTrackingChannelManagement();
        this.updateSubscriberChart();
        this.updateLastCollectionInfo();
        this.showLatestVideos();
    }

    // 저장된 데이터 로드
    loadStoredData() {
        // API 키들 로드
        for (let i = 1; i <= 5; i++) {
            const key = localStorage.getItem(`youtube_api_key_${i}`);
            if (key) this.apiKeys.push(key);
        }
        
        // 추가 API 키들 로드
        const additionalKeys = JSON.parse(localStorage.getItem('youtube_additional_api_keys') || '[]');
        this.apiKeys.push(...additionalKeys);
        
        this.currentApiIndex = parseInt(localStorage.getItem('youtube_current_api_index') || '0');
        
        // 채널 데이터 로드
        this.monitoringChannels = JSON.parse(localStorage.getItem('youtube_monitoring_channels') || '[]');
        this.trackingChannels = JSON.parse(localStorage.getItem('youtube_tracking_channels') || '[]');
        this.subscriberData = JSON.parse(localStorage.getItem('youtube_subscriber_data') || '{}');
        this.testRecords = JSON.parse(localStorage.getItem('youtube_test_records') || '[]');
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 탭 전환
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // API 설정
        document.getElementById('api-settings-btn')?.addEventListener('click', () => this.showApiModal());
        document.getElementById('save-api-btn')?.addEventListener('click', () => this.saveApiKeys());
        document.getElementById('cancel-api-btn')?.addEventListener('click', () => this.hideApiModal());
        document.getElementById('reset-api-rotation')?.addEventListener('click', () => this.resetApiRotation());
        document.getElementById('test-all-api-keys-btn')?.addEventListener('click', () => this.testAllApiKeys());
        document.getElementById('import-api-keys-btn')?.addEventListener('click', () => this.importApiKeys());
        document.getElementById('export-api-keys-btn')?.addEventListener('click', () => this.exportApiKeys());

        // 채널 추가 (모니터링용)
        document.getElementById('add-monitoring-channel-btn')?.addEventListener('click', () => this.showChannelModal('monitoring'));
        document.getElementById('add-channel-confirm-btn')?.addEventListener('click', () => this.addChannel());
        document.getElementById('cancel-channel-btn')?.addEventListener('click', () => this.hideChannelModal());
        document.getElementById('cancel-channel-selection-btn')?.addEventListener('click', () => this.hideChannelSelectionModal());

        // 채널 추가 (추적용)
        document.getElementById('add-tracking-channel-btn')?.addEventListener('click', () => this.showChannelModal('tracking'));

        // 검색
        document.getElementById('search-btn')?.addEventListener('click', () => this.searchVideos());
        document.getElementById('search-keyword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchVideos();
        });

        // 날짜 범위 타입 변경
        document.getElementById('date-range-type')?.addEventListener('change', (e) => {
            const customRange = document.getElementById('custom-date-range');
            const presetRange = document.getElementById('date-range');
            if (e.target.value === 'custom') {
                customRange.style.display = 'flex';
                presetRange.style.display = 'none';
            } else {
                customRange.style.display = 'none';
                presetRange.style.display = 'block';
            }
        });

        // 채널 추적
        document.getElementById('track-channels-btn')?.addEventListener('click', () => this.trackChannels());
        document.getElementById('tracking-sort-order')?.addEventListener('change', () => this.sortTrackingRecords());
        document.getElementById('show-all-channels')?.addEventListener('change', () => this.sortTrackingRecords());

        // 구독자 수 추적
        document.getElementById('collect-subscriber-data-btn')?.addEventListener('click', () => this.collectSubscriberData());
        document.getElementById('chart-channel-select')?.addEventListener('change', () => this.updateSubscriberChart());

        // 데이터 백업/복원
        document.getElementById('backup-tracking-data-btn')?.addEventListener('click', () => this.backupTrackingData());
        document.getElementById('restore-tracking-data-btn')?.addEventListener('click', () => {
            document.getElementById('restore-tracking-data-input')?.click();
        });
        document.getElementById('restore-tracking-data-input')?.addEventListener('change', (e) => this.restoreTrackingData(e));

        // 썸네일 테스트
        document.getElementById('start-test-btn')?.addEventListener('click', () => this.startThumbnailTest());
        document.getElementById('view-records-btn')?.addEventListener('click', () => this.showTestRecords());
        document.getElementById('restart-test-btn')?.addEventListener('click', () => this.restartTest());
        document.getElementById('new-test-btn')?.addEventListener('click', () => this.newTest());
        document.getElementById('close-records-btn')?.addEventListener('click', () => this.closeTestRecords());
        document.getElementById('subscriber-range')?.addEventListener('change', (e) => {
            const customRange = document.getElementById('custom-subscriber-range');
            if (e.target.value === 'custom') {
                customRange.style.display = 'block';
            } else {
                customRange.style.display = 'none';
            }
        });

        // 모달 배경 클릭 시 닫기
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    // 탭 전환
    switchTab(tabId) {
        // 모든 탭 버튼과 콘텐츠 비활성화
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // 선택된 탭 활성화
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');

        // 구독자 추적 탭이 활성화될 때 추적 채널 선택 목록 업데이트
        if (tabId === 'subscriber-tracking') {
            this.updateTrackingChannelsSelection();
        }
    }

    // API 상태 업데이트
    updateApiStatus() {
        const statusText = document.getElementById('api-status-text');
        const currentApiInfo = document.getElementById('current-api-index');
        
        if (this.apiKeys.length === 0) {
            statusText.textContent = 'API 키 설정 필요';
            statusText.style.color = '#f44336';
            if (currentApiInfo) currentApiInfo.textContent = '-';
        } else {
            statusText.textContent = `API 키 ${this.apiKeys.length}개 설정됨`;
            statusText.style.color = '#4caf50';
            if (currentApiInfo) currentApiInfo.textContent = `#${this.currentApiIndex + 1}`;
        }
    }

    // API 모달 표시
    showApiModal() {
        // 현재 키들을 입력 필드에 표시
        for (let i = 1; i <= 5; i++) {
            const input = document.getElementById(`api-key-${i}`);
            if (input) {
                input.value = this.apiKeys[i - 1] || '';
            }
        }
        
        // 추가 키들을 위한 입력 필드 생성
        this.updateApiInputs();
        
        document.getElementById('api-modal').style.display = 'block';
        this.updateApiStatus();
    }

    // API 입력 필드 업데이트
    updateApiInputs() {
        const container = document.querySelector('.api-inputs');
        
        // 5개 초과 키들을 위한 추가 입력 필드 생성
        if (this.apiKeys.length > 5) {
            for (let i = 6; i <= this.apiKeys.length; i++) {
                if (!document.getElementById(`api-key-${i}`)) {
                    const group = document.createElement('div');
                    group.className = 'api-input-group';
                    group.innerHTML = `
                        <label>API 키 #${i}</label>
                        <input type="password" id="api-key-${i}" placeholder="${i}번째 API 키" value="${this.apiKeys[i - 1] || ''}">
                    `;
                    container.appendChild(group);
                }
            }
        }
    }

    // API 모달 숨기기
    hideApiModal() {
        document.getElementById('api-modal').style.display = 'none';
    }

    // API 키 저장
    saveApiKeys() {
        this.apiKeys = [];
        
        // 기본 5개 키 수집
        for (let i = 1; i <= 5; i++) {
            const input = document.getElementById(`api-key-${i}`);
            if (input && input.value.trim()) {
                this.apiKeys.push(input.value.trim());
                localStorage.setItem(`youtube_api_key_${i}`, input.value.trim());
            } else {
                localStorage.removeItem(`youtube_api_key_${i}`);
            }
        }
        
        // 추가 키들 수집
        const additionalKeys = [];
        let i = 6;
        while (document.getElementById(`api-key-${i}`)) {
            const input = document.getElementById(`api-key-${i}`);
            if (input && input.value.trim()) {
                additionalKeys.push(input.value.trim());
                this.apiKeys.push(input.value.trim());
            }
            i++;
        }
        
        localStorage.setItem('youtube_additional_api_keys', JSON.stringify(additionalKeys));
        localStorage.setItem('youtube_current_api_index', '0');
        this.currentApiIndex = 0;
        
        this.updateApiStatus();
        this.hideApiModal();
        this.showMessage('API 키가 저장되었습니다.');
    }

    // API 순환 초기화
    resetApiRotation() {
        this.currentApiIndex = 0;
        localStorage.setItem('youtube_current_api_index', '0');
        this.updateApiStatus();
        this.showMessage('API 순환이 초기화되었습니다.');
    }

    // 모든 API 키 테스트
    async testAllApiKeys() {
        if (this.apiKeys.length === 0) {
            this.showMessage('테스트할 API 키가 없습니다.', 'error');
            return;
        }

        this.showLoading('API 키 테스트 중...');
        const results = [];

        for (let i = 0; i < this.apiKeys.length; i++) {
            try {
                // 간단한 채널 검색으로 API 키 테스트 (mine=true 대신)
                const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=test&maxResults=1&key=${this.apiKeys[i]}`);
                if (response.ok) {
                    results.push(`키 #${i + 1}: 정상`);
                } else {
                    results.push(`키 #${i + 1}: 오류 (${response.status})`);
                }
            } catch (error) {
                results.push(`키 #${i + 1}: 네트워크 오류`);
            }
        }

        this.hideLoading();
        this.showMessage(`테스트 결과:\n${results.join('\n')}`);
    }

    // API 키 가져오기
    importApiKeys() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.json,.csv';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    let keys = [];

                    if (file.name.endsWith('.json')) {
                        const data = JSON.parse(content);
                        keys = Array.isArray(data) ? data : [data];
                    } else {
                        // txt, csv 파일 처리
                        keys = content.split(/[,\n\r]+/)
                            .map(key => key.trim())
                            .filter(key => key.length > 0);
                    }

                    if (keys.length > 0) {
                        this.apiKeys = keys;
                        // 입력 필드 업데이트
                        for (let i = 1; i <= Math.min(5, keys.length); i++) {
                            const input = document.getElementById(`api-key-${i}`);
                            if (input) input.value = keys[i - 1] || '';
                        }
                        
                        this.updateApiInputs();
                        this.showMessage(`${keys.length}개의 API 키를 가져왔습니다.`);
                    } else {
                        this.showMessage('유효한 API 키를 찾을 수 없습니다.', 'error');
                    }
                } catch (error) {
                    this.showMessage('파일을 읽는 중 오류가 발생했습니다.', 'error');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    // API 키 내보내기
    exportApiKeys() {
        if (this.apiKeys.length === 0) {
            this.showMessage('내보낼 API 키가 없습니다.', 'error');
            return;
        }

        const data = this.apiKeys.join('\n');
        const blob = new Blob([data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube_api_keys_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showMessage('API 키가 내보내기되었습니다.');
    }

    // 채널 모달 표시
    showChannelModal(type) {
        this.channelModalType = type;
        document.getElementById('channel-modal').style.display = 'block';
        document.getElementById('channel-input').value = '';
        document.getElementById('channel-input').focus();
    }

    // 채널 모달 숨기기
    hideChannelModal() {
        document.getElementById('channel-modal').style.display = 'none';
    }

    // 채널 선택 모달 숨기기
    hideChannelSelectionModal() {
        document.getElementById('channel-selection-modal').style.display = 'none';
    }

    // 채널 추가
    async addChannel() {
        const input = document.getElementById('channel-input').value.trim();
        if (!input) {
            this.showMessage('채널 정보를 입력해주세요.', 'error');
            return;
        }

        this.showLoading('채널을 검색하는 중...');
        
        try {
            const channels = await this.searchChannels(input);
            
            if (channels.length === 0) {
                this.hideLoading();
                this.showMessage('채널을 찾을 수 없습니다.', 'error');
                return;
            }

            if (channels.length === 1) {
                // 단일 채널인 경우 바로 추가
                await this.confirmAddChannel(channels[0]);
            } else {
                // 여러 채널인 경우 선택 모달 표시
                this.showChannelSelectionModal(channels);
            }
            
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            this.showMessage('채널 검색 중 오류가 발생했습니다.', 'error');
        }
    }

    // 채널 검색
    async searchChannels(query) {
        const apiKey = this.getCurrentApiKey();
        if (!apiKey) {
            throw new Error('API 키가 설정되지 않았습니다.');
        }

        let channelId = null;
        let searchQuery = query;

        // 채널 ID 형식 체크 (UC로 시작하는 24자리)
        if (/^UC[a-zA-Z0-9_-]{22}$/.test(query)) {
            channelId = query;
        } 
        // URL에서 채널 ID 추출
        else if (query.includes('youtube.com/channel/')) {
            const match = query.match(/\/channel\/([a-zA-Z0-9_-]+)/);
            if (match) channelId = match[1];
        }
        // @핸들 형식 처리
        else if (query.includes('@') || query.includes('youtube.com/@')) {
            const handle = query.includes('@') ? query.split('@').pop() : query.split('/@').pop();
            searchQuery = handle;
        }

        const channels = [];

        // 채널 ID가 있는 경우 직접 조회
        if (channelId) {
            try {
                const response = await fetch(
                    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
                );
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.items && data.items.length > 0) {
                        channels.push(...data.items);
                    }
                }
            } catch (error) {
                console.error('채널 ID 조회 오류:', error);
            }
        }

        // 채널 ID로 찾지 못했거나 검색어인 경우 검색 API 사용
        if (channels.length === 0) {
            try {
                const response = await fetch(
                    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(searchQuery)}&maxResults=10&key=${apiKey}`
                );
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.items && data.items.length > 0) {
                        // 검색 결과에서 채널 ID들 추출
                        const channelIds = data.items.map(item => item.snippet.channelId);
                        
                        // 채널 상세 정보 조회
                        const detailResponse = await fetch(
                            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds.join(',')}&key=${apiKey}`
                        );
                        
                        if (detailResponse.ok) {
                            const detailData = await detailResponse.json();
                            if (detailData.items) {
                                channels.push(...detailData.items);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('채널 검색 오류:', error);
            }
        }

        // 중복 제거 (같은 채널 ID)
        const uniqueChannels = [];
        const seenIds = new Set();
        
        for (const channel of channels) {
            if (!seenIds.has(channel.id)) {
                seenIds.add(channel.id);
                uniqueChannels.push(channel);
            }
        }

        return uniqueChannels;
    }

    // 채널 선택 모달 표시
    showChannelSelectionModal(channels) {
        const modal = document.getElementById('channel-selection-modal');
        const list = document.getElementById('channel-selection-list');
        
        list.innerHTML = '';
        
        channels.forEach((channel, index) => {
            const item = document.createElement('div');
            item.className = 'channel-selection-item';
            item.onclick = () => this.selectChannelFromModal(channel);
            
            const subscriberCount = this.formatNumber(channel.statistics?.subscriberCount || 0);
            const thumbnail = channel.snippet.thumbnails?.medium?.url || '';
            
            item.innerHTML = `
                ${thumbnail ? 
                    `<img src="${thumbnail}" alt="${channel.snippet.title}" class="channel-selection-thumbnail">` :
                    `<div class="channel-selection-thumbnail-placeholder">📺</div>`
                }
                <div class="channel-selection-info">
                    <div class="channel-selection-name">${channel.snippet.title}</div>
                    <div class="channel-selection-meta">
                        <div class="channel-selection-subscribers">구독자 ${subscriberCount}명</div>
                        ${channel.snippet.description ? 
                            `<div class="channel-selection-description">${channel.snippet.description}</div>` : ''
                        }
                        <div class="channel-selection-id">${channel.id}</div>
                    </div>
                </div>
            `;
            
            list.appendChild(item);
        });
        
        modal.style.display = 'block';
    }

    // 모달에서 채널 선택
    async selectChannelFromModal(channel) {
        this.hideChannelSelectionModal();
        await this.confirmAddChannel(channel);
    }

    // 채널 추가 확인
    async confirmAddChannel(channel) {
        const targetChannels = this.channelModalType === 'monitoring' ? this.monitoringChannels : this.trackingChannels;
        const storageKey = this.channelModalType === 'monitoring' ? 'youtube_monitoring_channels' : 'youtube_tracking_channels';
        
        // 이미 추가된 채널인지 확인
        if (targetChannels.some(c => c.id === channel.id)) {
            this.showMessage('이미 추가된 채널입니다.', 'error');
            return;
        }

        const channelData = {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description || '',
            thumbnail: channel.snippet.thumbnails?.medium?.url || '',
            subscriberCount: parseInt(channel.statistics?.subscriberCount || 0),
            videoCount: parseInt(channel.statistics?.videoCount || 0),
            addedAt: new Date().toISOString()
        };

        targetChannels.push(channelData);
        localStorage.setItem(storageKey, JSON.stringify(targetChannels));
        
        this.hideChannelModal();
        
        if (this.channelModalType === 'monitoring') {
            this.updateChannelManagement();
            // 채널 추가 후 최신 영상 자동 로드
            setTimeout(() => this.showLatestVideos(), 1000);
        } else {
            this.updateTrackingChannelManagement();
            this.updateTrackingChannelsSelection();
        }
        
        this.showMessage(`채널 "${channel.snippet.title}"이 추가되었습니다.`);
    }

    // 채널 관리 UI 업데이트 (모니터링용)
    async updateChannelManagement() {
        const grid = document.getElementById('monitoring-channel-grid');
        const count = document.getElementById('monitoring-channel-count');
        
        count.textContent = this.monitoringChannels.length;
        
        if (this.monitoringChannels.length === 0) {
            grid.innerHTML = `
                <div class="channel-grid-empty">
                    <p>등록된 채널이 없습니다.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('add-monitoring-channel-btn').click()">
                        첫 번째 채널 추가하기
                    </button>
                </div>
            `;
            return;
        }

        // 각 채널의 분석 데이터 수집
        grid.innerHTML = '<div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">채널 데이터 분석 중...</div>';
        
        const channelAnalytics = await this.analyzeChannels();

        grid.innerHTML = this.monitoringChannels.map(channel => {
            const analytics = channelAnalytics[channel.id] || { longFormCount: 0, hotVideoCount: 0, error: true };
            
            return `
                <div class="channel-item">
                    <div class="channel-item-header">
                        <div class="channel-info-with-logo">
                            ${channel.thumbnail ? 
                                `<img src="${channel.thumbnail}" alt="${channel.title}" class="channel-logo">` :
                                `<div class="channel-logo-placeholder">📺</div>`
                            }
                            <div class="channel-text-info">
                                <h4 class="channel-name" onclick="window.open('https://youtube.com/channel/${channel.id}', '_blank')">${channel.title}</h4>
                            </div>
                        </div>
                        <div class="channel-actions">
                            <button class="btn-icon delete" onclick="youtubeMonitor.removeChannel('monitoring', '${channel.id}')" title="채널 삭제">🗑️</button>
                        </div>
                    </div>
                    <div class="channel-info">
                        <span class="channel-subscribers">구독자 ${this.formatNumber(channel.subscriberCount)}명</span>
                        <span class="channel-id">${channel.id}</span>
                    </div>
                    ${analytics.error ? 
                        `<div class="channel-analytics error">
                            <div class="analytics-item">❌ 데이터 로드 실패</div>
                        </div>` :
                        `<div class="channel-analytics">
                            <div class="analytics-item">📹 롱폼: ${analytics.hotVideoCount} / ${analytics.longFormCount}개 (최근 6개월)</div>
                            <div class="analytics-item ${analytics.hotVideoCount > 0 ? 'hot' : ''}">🔥 돌연변이: ${analytics.hotVideoCount}개</div>
                        </div>`
                    }
                    <div class="channel-status">
                        <div class="status-indicator ${analytics.error ? 'error' : ''}"></div>
                        <span>${analytics.error ? '오류' : '정상'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

// YouTubeMonitor 클래스 내부에 "fetchChannelVideos" 함수 단 하나만 남기세요!

/**
 * 모니터링 채널별 최신 롱폼 영상/조회수/ratio 분석 (롱폼: 3분 1초 이상)
 * ratio: 조회수/구독자수
 */
async fetchChannelVideos() {
    const apiKey = this.getCurrentApiKey();
    if (!apiKey) {
        throw new Error('API 키가 설정되지 않았습니다.');
    }

    const hotVideoRatio = parseInt(document.getElementById('hot-video-ratio')?.value) || 5;
    const results = [];

    for (const channel of this.monitoringChannels) {
        try {
            // 1. 채널 최신 영상 20개 불러오기
            const searchResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel.id}&type=video&order=date&maxResults=20&key=${apiKey}`
            );

            if (!searchResponse.ok) {
                results.push({
                    channel: channel,
                    error: `API 오류: ${searchResponse.status}`,
                    videos: []
                });
                continue;
            }

            const searchData = await searchResponse.json();
            if (!searchData.items || searchData.items.length === 0) {
                results.push({
                    channel: channel,
                    videos: []
                });
                continue;
            }

            // 2. 영상 상세정보 fetch
            const videoIds = searchData.items.map(item => item.id.videoId);
            const videosResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
            );

            if (!videosResponse.ok) {
                results.push({
                    channel: channel,
                    error: `영상 정보 API 오류: ${videosResponse.status}`,
                    videos: []
                });
                continue;
            }

            const videosData = await videosResponse.json();

            // 3. 롱폼 필터 (3분 1초 이상, 180초 초과)
            const videos = videosData.items
                .filter(video => {
                    const duration = this.parseDuration(video.contentDetails?.duration || 'PT0S');
                    return duration > 180;
                })
                .map(video => {
                    const viewCount = parseInt(video.statistics?.viewCount || 0);
                    const subscriberCount = parseInt(channel.subscriberCount || 0);
                    const ratio = subscriberCount > 0 ? (viewCount / subscriberCount) : 0;

                    return {
                        id: video.id,
                        title: video.snippet.title,
                        publishedAt: video.snippet.publishedAt,
                        thumbnail: video.snippet.thumbnails?.medium?.url || '',
                        viewCount: viewCount,
                        likeCount: parseInt(video.statistics?.likeCount || 0),
                        commentCount: parseInt(video.statistics?.commentCount || 0),
                        ratio: ratio,
                        isHot: ratio >= hotVideoRatio,
                        subscriberCount: subscriberCount, // 이 채널 구독자수
                        duration: this.parseDuration(video.contentDetails?.duration || 'PT0S')
                    };
                });

            results.push({
                channel: channel,
                videos: videos
            });

        } catch (error) {
            results.push({
                channel: channel,
                error: error.message,
                videos: []
            });
        }
    }

    return results;
}

    // YouTube 동영상 길이 파싱 (ISO 8601 duration) - 3분 1초 이상만 롱폼
parseDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    return hours * 3600 + minutes * 60 + seconds;
}


    // 롱폼 여부 확인 (3분 1초 이상)
    isLongForm(duration) {
        return this.parseDuration(duration) > 180; // 3분 = 180초
    }
    updateTrackingChannelManagement() {
        const grid = document.getElementById('tracking-channel-grid');
        const count = document.getElementById('tracking-channel-count');
        
        count.textContent = this.trackingChannels.length;
        
        if (this.trackingChannels.length === 0) {
            grid.innerHTML = `
                <div class="channel-grid-empty">
                    <p>등록된 채널이 없습니다.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('add-tracking-channel-btn').click()">
                        첫 번째 채널 추가하기
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.trackingChannels.map(channel => `
            <div class="channel-item">
                <div class="channel-item-header">
                    <div class="channel-info-with-logo">
                        ${channel.thumbnail ? 
                            `<img src="${channel.thumbnail}" alt="${channel.title}" class="channel-logo">` :
                            `<div class="channel-logo-placeholder">📺</div>`
                        }
                        <div class="channel-text-info">
                            <h4 class="channel-name" onclick="window.open('https://youtube.com/channel/${channel.id}', '_blank')">${channel.title}</h4>
                        </div>
                    </div>
                    <div class="channel-actions">
                        <button class="btn-icon delete" onclick="youtubeMonitor.removeChannel('tracking', '${channel.id}')" title="채널 삭제">🗑️</button>
                    </div>
                </div>
                <div class="channel-info">
                    <span class="channel-subscribers">구독자 ${this.formatNumber(channel.subscriberCount)}명</span>
                    <span class="channel-id">${channel.id}</span>
                </div>
                <div class="channel-status">
                    <div class="status-indicator"></div>
                    <span>정상</span>
                </div>
            </div>
        `).join('');
    }

    // 채널 삭제
    removeChannel(type, channelId) {
        if (!confirm('이 채널을 삭제하시겠습니까?')) return;

        if (type === 'monitoring') {
            this.monitoringChannels = this.monitoringChannels.filter(c => c.id !== channelId);
            localStorage.setItem('youtube_monitoring_channels', JSON.stringify(this.monitoringChannels));
            this.updateChannelManagement();
            this.showLatestVideos();
        } else {
            this.trackingChannels = this.trackingChannels.filter(c => c.id !== channelId);
            localStorage.setItem('youtube_tracking_channels', JSON.stringify(this.trackingChannels));
            this.updateTrackingChannelManagement();
            this.updateTrackingChannelsSelection();
        }
        
        this.showMessage('채널이 삭제되었습니다.');
    }

    // 영상 검색
    async searchVideos() {
        const keyword = document.getElementById('search-keyword').value.trim();
        if (!keyword) {
            this.showMessage('검색 키워드를 입력해주세요.', 'error');
            return;
        }

        this.showLoading('영상을 검색하는 중...');

        try {
            const videos = await this.fetchVideos(keyword);
            this.displaySearchResults(videos);
        } catch (error) {
            this.showMessage('검색 중 오류가 발생했습니다.', 'error');
        }

        this.hideLoading();
    }

    // 영상 데이터 가져오기 (돌연변이 영상만)
    async fetchVideos(keyword) {
        const apiKey = this.getCurrentApiKey();
        if (!apiKey) {
            throw new Error('API 키가 설정되지 않았습니다.');
        }

        // 검색 조건 수집
        const publishedAfter = this.getPublishedAfter();
        const maxResults = 50;

        // 검색 API 호출 (롱폼만 - videoDuration=medium,long)
        const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(keyword)}&maxResults=${maxResults}&publishedAfter=${publishedAfter}&videoDuration=medium&key=${apiKey}`
        );

        if (!searchResponse.ok) {
            if (searchResponse.status === 403) {
                // API 할당량 초과 시 다음 키로 시도
                await this.rotateApiKey();
                throw new Error('API 할당량이 초과되었습니다. 다음 키로 재시도해주세요.');
            }
            throw new Error(`검색 API 오류: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();
        if (!searchData.items || searchData.items.length === 0) {
            return [];
        }

        // 영상 ID들 추출
        const videoIds = searchData.items.map(item => item.id.videoId);

        // 영상 상세 정보 및 통계 가져오기 (contentDetails 추가로 길이 확인)
        const videosResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
        );

        if (!videosResponse.ok) {
            throw new Error(`영상 정보 API 오류: ${videosResponse.status}`);
        }

        const videosData = await videosResponse.json();
        
        // 채널 정보 가져오기
        const channelIds = [...new Set(videosData.items.map(item => item.snippet.channelId))];
        const channelsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds.join(',')}&key=${apiKey}`
        );

        let channelsData = { items: [] };
        if (channelsResponse.ok) {
            channelsData = await channelsResponse.json();
        }

        // 데이터 결합 및 필터링 (롱폼 + 돌연변이만)
        const videos = videosData.items
            .filter(video => {
                // 영상 길이 필터링 (3분 1초 이상만 롱폼으로 간주)
                return this.isLongForm(video.contentDetails?.duration || 'PT0S');
            })
            .map(video => {
                const channel = channelsData.items.find(c => c.id === video.snippet.channelId) || {};
                const subscriberCount = parseInt(channel.statistics?.subscriberCount || 0);
                const viewCount = parseInt(video.statistics?.viewCount || 0);
                const ratio = subscriberCount > 0 ? (viewCount / subscriberCount) : 0;
                
                return {
                    id: video.id,
                    title: video.snippet.title,
                    channelTitle: video.snippet.channelTitle,
                    channelId: video.snippet.channelId,
                    publishedAt: video.snippet.publishedAt,
                    thumbnail: video.snippet.thumbnails?.medium?.url || '',
                    viewCount: viewCount,
                    subscriberCount: subscriberCount,
                    likeCount: parseInt(video.statistics?.likeCount || 0),
                    commentCount: parseInt(video.statistics?.commentCount || 0),
                    ratio: ratio,
                    duration: this.parseDuration(video.contentDetails?.duration || 'PT0S')
                };
            })
            .filter(video => {
                // 돌연변이 영상만 필터링 (구독자 수 대비 조회수가 1배 이상)
                return video.ratio >= 1;
            });

        return this.applyFilters(videos);
    }

    // 필터 적용
    applyFilters(videos) {
        const subFilter = parseInt(document.getElementById('sub-filter').value);
        const viewFilter = parseInt(document.getElementById('view-filter').value);
        const sortOrder = document.getElementById('sort-order').value;

        let filtered = videos.filter(video => {
            if (subFilter > 0 && video.subscriberCount < subFilter) return false;
            if (viewFilter > 0 && video.viewCount < viewFilter) return false;
            return true;
        });

        // 정렬
        filtered.sort((a, b) => {
            switch (sortOrder) {
                case 'ratio':
                    return b.ratio - a.ratio;
                case 'viewCount':
                    return b.viewCount - a.viewCount;
                case 'subscriberCount':
                    return b.subscriberCount - a.subscriberCount;
                case 'publishedAt':
                    return new Date(b.publishedAt) - new Date(a.publishedAt);
                default:
                    return 0;
            }
        });

        return filtered;
    }

    // 검색 결과 표시
    displaySearchResults(videos) {
        const container = document.getElementById('search-results');
        
        if (videos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>검색 결과가 없습니다.</p>
                    <p>다른 키워드나 필터 조건을 시도해보세요.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = videos.map(video => `
            <div class="video-card" onclick="window.open('https://youtube.com/watch?v=${video.id}', '_blank')">
                ${video.thumbnail ? 
                    `<img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">` :
                    `<div class="video-thumbnail-placeholder-large">📹</div>`
                }
                <div class="video-details">
                    <div class="video-title-inline">${video.title}</div>
                    <div class="video-channel">${video.channelTitle}</div>
                    <div class="video-stats">
                        <span>👥 ${this.formatNumber(video.subscriberCount)}</span>
                        <span>👁️ ${this.formatNumber(video.viewCount)}</span>
                        <span>🔥 ${video.ratio.toFixed(1)}배</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 발행일 필터 계산
    getPublishedAfter() {
        const dateRangeType = document.getElementById('date-range-type').value;
        
        if (dateRangeType === 'custom') {
            const startDate = document.getElementById('start-date').value;
            return startDate ? new Date(startDate).toISOString() : this.getDateBefore('week');
        }

        const dateRange = document.getElementById('date-range').value;
        return this.getDateBefore(dateRange);
    }

    // 날짜 계산
    getDateBefore(range) {
        const now = new Date();
        const hours = {
            'hour': 1,
            'hour3': 3,
            'hour12': 12,
            'day': 24,
            'day3': 72,
            'week': 168,
            'week2': 336,
            'month': 720,
            'month3': 2160,
            'month6': 4320,
            'year': 8760
        };
        
        now.setHours(now.getHours() - (hours[range] || 168));
        return now.toISOString();
    }

    // 채널 추적
    async trackChannels() {
        if (this.monitoringChannels.length === 0) {
            this.showMessage('추적할 채널을 먼저 추가해주세요.', 'error');
            return;
        }

        this.showLoading('채널을 추적하는 중...');

        try {
            const results = await this.fetchChannelVideos();
            this.displayTrackingResults(results);
            this.showLatestVideos();
        } catch (error) {
            this.showMessage('채널 추적 중 오류가 발생했습니다.', 'error');
        }

        this.hideLoading();
    }

    // YouTubeMonitor 클래스 내부에 붙여넣으세요
async fetchChannelVideos() {
    const apiKey = this.getCurrentApiKey();
    if (!apiKey) {
        throw new Error('API 키가 설정되지 않았습니다.');
    }

    const hotVideoRatio = parseInt(document.getElementById('hot-video-ratio')?.value) || 5;
    const results = [];

    for (const channel of this.monitoringChannels) {
        try {
            // 1. 채널 영상 검색
            const searchResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel.id}&type=video&order=date&maxResults=10&key=${apiKey}`
            );

            if (!searchResponse.ok) {
                results.push({
                    channel: channel,
                    error: `API 오류: ${searchResponse.status}`,
                    videos: []
                });
                continue;
            }

            const searchData = await searchResponse.json();
            if (!searchData.items || searchData.items.length === 0) {
                results.push({
                    channel: channel,
                    videos: []
                });
                continue;
            }

            // 2. 영상 상세정보 조회
            const videoIds = searchData.items.map(item => item.id.videoId);
            const videosResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
            );

            if (!videosResponse.ok) {
                results.push({
                    channel: channel,
                    error: `영상 정보 API 오류: ${videosResponse.status}`,
                    videos: []
                });
                continue;
            }

            // ⭐⭐ 반드시 함수 안에만 위치!
            const videosData = await videosResponse.json();

            // 영상 리스트 가공
            const videos = videosData.items
                .filter(video => {
                    // 롱폼 영상만 (예: 60초 이상)
                    const duration = this.parseDuration(video.contentDetails?.duration || 'PT0S');
                    return duration >= 60;
                })
                .map(video => {
                    const viewCount = parseInt(video.statistics?.viewCount || 0);
                    const ratio = channel.subscriberCount > 0 ? (viewCount / channel.subscriberCount) : 0;

                    return {
                        id: video.id,
                        title: video.snippet.title,
                        publishedAt: video.snippet.publishedAt,
                        thumbnail: video.snippet.thumbnails?.medium?.url || '',
                        viewCount: viewCount,
                        likeCount: parseInt(video.statistics?.likeCount || 0),
                        commentCount: parseInt(video.statistics?.commentCount || 0),
                        ratio: ratio,
                        isHot: ratio >= hotVideoRatio,
                        duration: this.parseDuration(video.contentDetails?.duration || 'PT0S')
                    };
                });

            results.push({
                channel: channel,
                videos: videos
            });

        } catch (error) {
            results.push({
                channel: channel,
                error: error.message,
                videos: []
            });
        }
    }

    return results;
}

   const videosData = await videosResponse.json();
// channelList: 채널 정보 배열 (id, statistics.subscriberCount 등이 들어있는 배열이어야 함)

const videos = videosData.items.map(video => {
    // 해당 영상의 채널 정보 찾기
    const videoChannelId = video.snippet.channelId;
    const channel = channelList.find(c => c.id === videoChannelId);
    const subscriberCount = parseInt(channel?.statistics?.subscriberCount || 0);
    const viewCount = parseInt(video.statistics?.viewCount || 0);
    const ratio = subscriberCount > 0 ? (viewCount / subscriberCount) : 0;

    return {
        id: video.id,
        title: video.snippet.title,
        publishedAt: video.snippet.publishedAt,
        thumbnail: video.snippet.thumbnails?.medium?.url || '',
        viewCount: viewCount,
        likeCount: parseInt(video.statistics?.likeCount || 0),
        commentCount: parseInt(video.statistics?.commentCount || 0),
        ratio: ratio,
        isHot: ratio >= hotVideoRatio,
        subscriberCount: subscriberCount   // 구독자수 표시용
    };
});




                results.push({
                    channel: channel,
                    videos: videos
                });

            } catch (error) {
                results.push({
                    channel: channel,
                    error: error.message,
                    videos: []
                });
            }
        }

        return results;
    }

    // 추적 결과 표시
    displayTrackingResults(results) {
        const container = document.getElementById('tracking-records');
        const timestamp = new Date().toLocaleString('ko-KR');
        
        // 기존 결과에 새 결과 추가
        const record = document.createElement('div');
        record.className = 'tracking-record';
        
        const hotVideosCount = results.reduce((count, result) => 
            count + (result.videos?.filter(v => v.isHot).length || 0), 0);
        
        record.innerHTML = `
            <div class="tracking-header">
                <div class="tracking-timestamp">${timestamp}</div>
                <div class="tracking-summary">
                    총 ${this.monitoringChannels.length}개 채널 • 돌연변이 영상 ${hotVideosCount}개 발견
                </div>
            </div>
            <div class="channel-tracking-list">
                ${results.map(result => this.renderChannelTrackingItem(result)).join('')}
            </div>
        `;
        
        // 빈 상태 메시지 제거
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        container.insertBefore(record, container.firstChild);
        
        // 추적 결과 정렬
        this.sortTrackingRecords();
    }

    // 채널 추적 아이템 렌더링
    renderChannelTrackingItem(result) {
        if (result.error) {
            return `
                <div class="channel-tracking-item error">
                    <div class="tracking-video-details">
                        <div class="tracking-channel-header">
                            <h4 class="tracking-channel-name">${result.channel.title}</h4>
                        </div>
                        <div class="tracking-channel-error">${result.error}</div>
                    </div>
                </div>
            `;
        }

        if (!result.videos || result.videos.length === 0) {
            return `
                <div class="channel-tracking-item">
                    <div class="tracking-video-details">
                        <div class="tracking-channel-header">
                            <h4 class="tracking-channel-name">${result.channel.title}</h4>
                        </div>
                        <div class="tracking-no-video">최근 영상이 없습니다</div>
                    </div>
                </div>
            `;
        }

        const latestVideo = result.videos[0];
        return `
            <div class="channel-tracking-item" onclick="window.open('https://youtube.com/watch?v=${latestVideo.id}', '_blank')">
                ${latestVideo.thumbnail ? 
                    `<img src="${latestVideo.thumbnail}" alt="${latestVideo.title}" class="tracking-video-thumbnail">` :
                    `<div class="tracking-video-thumbnail-placeholder">📹</div>`
                }
                <div class="tracking-video-details">
                    <div class="tracking-channel-header">
                        <h4 class="tracking-channel-name">${result.channel.title}</h4>
                    </div>
                    <div class="tracking-channel-subscribers">구독자 ${this.formatNumber(result.channel.subscriberCount)}명</div>
                    <div class="tracking-video-title">${latestVideo.title}</div>
                    <div class="tracking-video-stats">
                        <span>👁️ ${this.formatNumber(latestVideo.viewCount)}</span>
                        <span>📅 ${this.formatDate(latestVideo.publishedAt)}</span>
                        ${latestVideo.isHot ? 
                            `<span class="tracking-hot-ratio">🔥 ${latestVideo.ratio.toFixed(1)}배</span>` :
                            `<span>🔥 ${latestVideo.ratio.toFixed(1)}배</span>`
                        }
                    </div>
                </div>
            </div>
        `;
    }

    // 추적 결과 정렬
    sortTrackingRecords() {
        const sortOrder = document.getElementById('tracking-sort-order').value;
        const showAll = document.getElementById('show-all-channels').checked;
        
        document.querySelectorAll('.channel-tracking-list').forEach(list => {
            const items = Array.from(list.children);
            
            // 필터링
            let filteredItems = items;
            if (!showAll) {
                filteredItems = items.filter(item => {
                    const hotRatio = item.querySelector('.tracking-hot-ratio');
                    return hotRatio !== null;
                });
            }
            
            // 정렬
            filteredItems.sort((a, b) => {
                const getVideoData = (item) => {
                    const channelName = item.querySelector('.tracking-channel-name')?.textContent || '';
                    const subscribersText = item.querySelector('.tracking-channel-subscribers')?.textContent || '0';
                    const viewText = item.querySelector('.tracking-video-stats span')?.textContent || '0';
                    const ratioText = item.querySelector('.tracking-hot-ratio, .tracking-video-stats span:last-child')?.textContent || '0';
                    const dateText = item.querySelector('.tracking-video-stats span:nth-child(2)')?.textContent || '';
                    
                    return {
                        channelName,
                        subscriberCount: this.parseNumber(subscribersText),
                        viewCount: this.parseNumber(viewText),
                        ratio: parseFloat(ratioText.replace(/[^0-9.]/g, '')) || 0,
                        publishedAt: dateText
                    };
                };

                const dataA = getVideoData(a);
                const dataB = getVideoData(b);

                switch (sortOrder) {
                    case 'ratio':
                        return dataB.ratio - dataA.ratio;
                    case 'viewCount':
                        return dataB.viewCount - dataA.viewCount;
                    case 'subscriberCount':
                        return dataB.subscriberCount - dataA.subscriberCount;
                    case 'publishedAt':
                        return dataB.publishedAt.localeCompare(dataA.publishedAt);
                    default:
                        return 0;
                }
            });
            
            // DOM 재정렬
            list.innerHTML = '';
            filteredItems.forEach(item => list.appendChild(item));
            
            // 숨겨진 아이템들도 다시 추가 (보이지 않게)
            if (!showAll) {
                const hiddenItems = items.filter(item => !filteredItems.includes(item));
                hiddenItems.forEach(item => {
                    item.style.display = 'none';
                    list.appendChild(item);
                });
            } else {
                items.forEach(item => {
                    item.style.display = '';
                });
            }
        });
    }

    // 최신 영상 표시 (롱폼만)
    async showLatestVideos() {
        const container = document.getElementById('latest-videos-container');
        
        if (this.monitoringChannels.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>등록된 채널이 없습니다.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="empty-state">
                <p>최신 영상을 불러오는 중...</p>
            </div>
        `;

        try {
            const apiKey = this.getCurrentApiKey();
            if (!apiKey) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>API 키를 먼저 설정해주세요.</p>
                    </div>
                `;
                return;
            }

            const allVideos = [];
            
            // 각 채널별로 최신 롱폼 영상 1개씩 가져오기
            for (const channel of this.monitoringChannels) {
                try {
                    // 채널의 최신 영상 검색 (더 많이 가져와서 롱폼 필터링)
                    const searchResponse = await fetch(
                        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel.id}&type=video&order=date&maxResults=20&key=${apiKey}`
                    );

                    if (searchResponse.ok) {
                        const searchData = await searchResponse.json();
                        if (searchData.items && searchData.items.length > 0) {
                            // 영상 상세 정보 가져오기
                            const videoIds = searchData.items.map(item => item.id.videoId);
                            const videoResponse = await fetch(
                                `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
                            );

                            if (videoResponse.ok) {
                                const videoData = await videoResponse.json();
                                
                                // 롱폼 영상만 필터링하고 가장 최신 것 1개 선택
                                const longFormVideos = videoData.items.filter(video => {
                                    const duration = this.parseDuration(video.contentDetails?.duration || 'PT0S');
                                    return duration >= 60; // 1분 이상만 롱폼으로 간주
                                });

                                if (longFormVideos.length > 0) {
                                    const video = longFormVideos[0]; // 가장 최신 롱폼 영상
                                    allVideos.push({
                                        id: video.id,
                                        title: video.snippet.title,
                                        channelTitle: channel.title,
                                        channelId: channel.id,
                                        publishedAt: video.snippet.publishedAt,
                                        thumbnail: video.snippet.thumbnails?.medium?.url || '',
                                        viewCount: parseInt(video.statistics?.viewCount || 0),
                                        subscriberCount: channel.subscriberCount,
                                        duration: this.parseDuration(video.contentDetails?.duration || 'PT0S')
                                    });
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`채널 ${channel.title} 영상 로드 오류:`, error);
                }
            }

            if (allVideos.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>최근 롱폼 영상이 없거나 불러올 수 없습니다.</p>
                    </div>
                `;
                return;
            }

            // 발행일순으로 정렬
            allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

            container.innerHTML = allVideos.map(video => `
                <div class="video-card" onclick="window.open('https://youtube.com/watch?v=${video.id}', '_blank')">
                    ${video.thumbnail ? 
                        `<img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">` :
                        `<div class="video-thumbnail-placeholder-large">📹</div>`
                    }
                    <div class="video-details">
                        <div class="video-title-inline">${video.title}</div>
                        <div class="video-channel">${video.channelTitle}</div>
                        <div class="video-stats">
                            <span>👥 ${this.formatNumber(video.subscriberCount)}</span>
                            <span>👁️ ${this.formatNumber(video.viewCount)}</span>
                            <span>⏱️ ${this.formatDuration(video.duration)}</span>
                            <span>📅 ${this.formatDate(video.publishedAt)}</span>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('최신 영상 로드 오류:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <p>영상을 불러오는 중 오류가 발생했습니다.</p>
                    <p>API 키를 확인해주세요.</p>
                </div>
            `;
        }
    }

    // 영상 길이 포맷팅
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // 구독자 수 추적 채널 선택 업데이트
    updateTrackingChannelsSelection() {
        const container = document.getElementById('tracking-channels-selection');
        
        if (this.trackingChannels.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <p>추적용 채널을 먼저 추가해주세요.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.trackingChannels.map(channel => `
            <div class="tracking-channel-option selected" onclick="this.classList.toggle('selected'); youtubeMonitor.updateTrackingSelection()">
                <input type="checkbox" class="tracking-channel-checkbox" data-channel-id="${channel.id}" checked>
                <div class="tracking-channel-info">
                    ${channel.thumbnail ? 
                        `<img src="${channel.thumbnail}" alt="${channel.title}" class="tracking-channel-logo">` :
                        `<div class="tracking-channel-logo-placeholder">📺</div>`
                    }
                    <div class="tracking-channel-text">
                        <div class="tracking-channel-name">${channel.title}</div>
                        <div class="tracking-channel-subscribers">구독자 ${this.formatNumber(channel.subscriberCount)}명</div>
                    </div>
                </div>
            </div>
        `).join('');
        
        this.updateChartChannelSelect();
    }

    // 추적 선택 업데이트
    updateTrackingSelection() {
        const checkboxes = document.querySelectorAll('.tracking-channel-checkbox');
        checkboxes.forEach(checkbox => {
            const option = checkbox.closest('.tracking-channel-option');
            checkbox.checked = option.classList.contains('selected');
        });
        
        this.updateChartChannelSelect();
        this.updateSubscriberChart();
    }

    // 차트 채널 선택 업데이트
    updateChartChannelSelect() {
        const select = document.getElementById('chart-channel-select');
        const selectedChannels = this.getSelectedTrackingChannels();
        
        select.innerHTML = '<option value="all">전체 채널 비교</option>';
        
        selectedChannels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = channel.title;
            select.appendChild(option);
        });
    }

    // 선택된 추적 채널 가져오기
    getSelectedTrackingChannels() {
        const checkboxes = document.querySelectorAll('.tracking-channel-checkbox:checked');
        return Array.from(checkboxes).map(checkbox => {
            const channelId = checkbox.dataset.channelId;
            return this.trackingChannels.find(c => c.id === channelId);
        }).filter(Boolean);
    }

    // 구독자 수 데이터 수집
    async collectSubscriberData() {
        const selectedChannels = this.getSelectedTrackingChannels();
        
        if (selectedChannels.length === 0) {
            this.showMessage('추적할 채널을 선택해주세요.', 'error');
            return;
        }

        this.showLoading('구독자 수 데이터를 수집하는 중...');

        try {
            const apiKey = this.getCurrentApiKey();
            if (!apiKey) {
                throw new Error('API 키가 설정되지 않았습니다.');
            }

            const today = new Date().toISOString().split('T')[0];
            const channelIds = selectedChannels.map(c => c.id);
            
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(',')}&key=${apiKey}`
            );

            if (!response.ok) {
                throw new Error(`API 오류: ${response.status}`);
            }

            const data = await response.json();
            
            if (!this.subscriberData[today]) {
                this.subscriberData[today] = {};
            }

            data.items.forEach(channel => {
                const subscriberCount = parseInt(channel.statistics.subscriberCount || 0);
                this.subscriberData[today][channel.id] = subscriberCount;
            });

            localStorage.setItem('youtube_subscriber_data', JSON.stringify(this.subscriberData));
            
            this.updateSubscriberChart();
            this.updateSubscriberDataList();
            this.updateLastCollectionInfo();
            
            this.showMessage(`${selectedChannels.length}개 채널의 구독자 수 데이터가 수집되었습니다.`);

        } catch (error) {
            this.showMessage('데이터 수집 중 오류가 발생했습니다.', 'error');
        }

        this.hideLoading();
    }

    // 구독자 수 차트 업데이트
    updateSubscriberChart() {
        const canvas = document.getElementById('subscriber-chart');
        const ctx = canvas.getContext('2d');
        
        // 기존 차트 삭제
        if (window.subscriberChart) {
            window.subscriberChart.destroy();
        }

        const selectedChannel = document.getElementById('chart-channel-select').value;
        const selectedChannels = this.getSelectedTrackingChannels();
        
        if (selectedChannels.length === 0) {
            // 빈 차트 표시
            window.subscriberChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: '추적할 채널을 선택해주세요'
                        }
                    }
                }
            });
            return;
        }

        const dates = Object.keys(this.subscriberData).sort();
        const colors = ['#764ba2', '#f093fb', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#fd79a8'];

        let datasets = [];

        if (selectedChannel === 'all') {
            // 전체 채널 비교
            datasets = selectedChannels.map((channel, index) => ({
                label: channel.title,
                data: dates.map(date => this.subscriberData[date]?.[channel.id] || null),
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                tension: 0.4,
                fill: false
            }));
        } else {
            // 단일 채널
            const channel = selectedChannels.find(c => c.id === selectedChannel);
            if (channel) {
                datasets = [{
                    label: channel.title,
                    data: dates.map(date => this.subscriberData[date]?.[channel.id] || null),
                    borderColor: colors[0],
                    backgroundColor: colors[0] + '20',
                    tension: 0.4,
                    fill: true
                }];
            }
        }

        window.subscriberChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates.map(date => new Date(date).toLocaleDateString('ko-KR', { 
                    month: 'short', 
                    day: 'numeric' 
                })),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${youtubeMonitor.formatNumber(context.parsed.y)}명`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return youtubeMonitor.formatNumber(value) + '명';
                            }
                        }
                    }
                }
            }
        });
    }

    // 구독자 데이터 목록 업데이트
    updateSubscriberDataList() {
        const container = document.getElementById('subscriber-data-list');
        const dates = Object.keys(this.subscriberData).sort().reverse();
        
        if (dates.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="color: #666;">
                    <p>아직 기록된 데이터가 없습니다.</p>
                    <p>상단의 "오늘 구독자 수 수집" 버튼을 눌러 시작해보세요.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = dates.map((date, index) => {
            const prevDate = dates[index + 1];
            const dayData = this.subscriberData[date];
            const prevDayData = prevDate ? this.subscriberData[prevDate] : {};
            
            return `
                <div class="data-item">
                    <div class="data-date">${new Date(date).toLocaleDateString('ko-KR')}</div>
                    <div class="data-details">
                        ${Object.keys(dayData).map(channelId => {
                            const channel = this.trackingChannels.find(c => c.id === channelId);
                            const current = dayData[channelId];
                            const previous = prevDayData[channelId];
                            const growth = previous ? current - previous : 0;
                            const growthClass = growth > 0 ? 'growth-positive' : growth < 0 ? 'growth-negative' : 'growth-neutral';
                            const growthText = growth > 0 ? `+${this.formatNumber(growth)}` : this.formatNumber(growth);
                            
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <span>${channel ? channel.title : channelId}</span>
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <span class="data-subscribers">${this.formatNumber(current)}명</span>
                                        ${growth !== 0 ? `<span class="data-growth ${growthClass}">${growthText}</span>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    // 마지막 수집 정보 업데이트
    updateLastCollectionInfo() {
        const info = document.getElementById('last-collection-info');
        const dates = Object.keys(this.subscriberData).sort();
        
        if (dates.length > 0) {
            const lastDate = dates[dates.length - 1];
            info.textContent = `마지막 수집: ${new Date(lastDate).toLocaleDateString('ko-KR')}`;
        } else {
            info.textContent = '마지막 수집: -';
        }
    }

    // 전체 선택/해제 함수들 (전역에서 호출)
    selectAllTrackingChannels() {
        document.querySelectorAll('.tracking-channel-option').forEach(option => {
            option.classList.add('selected');
        });
        this.updateTrackingSelection();
    }

    deselectAllTrackingChannels() {
        document.querySelectorAll('.tracking-channel-option').forEach(option => {
            option.classList.remove('selected');
        });
        this.updateTrackingSelection();
    }

    // 데이터 백업
    backupTrackingData() {
        const data = {
            monitoringChannels: this.monitoringChannels,
            trackingChannels: this.trackingChannels,
            subscriberData: this.subscriberData,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube_monitor_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showMessage('데이터가 백업되었습니다.');
    }

    // 데이터 복원
    restoreTrackingData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.monitoringChannels) {
                    this.monitoringChannels = data.monitoringChannels;
                    localStorage.setItem('youtube_monitoring_channels', JSON.stringify(this.monitoringChannels));
                }
                
                if (data.trackingChannels) {
                    this.trackingChannels = data.trackingChannels;
                    localStorage.setItem('youtube_tracking_channels', JSON.stringify(this.trackingChannels));
                }
                
                if (data.subscriberData) {
                    this.subscriberData = data.subscriberData;
                    localStorage.setItem('youtube_subscriber_data', JSON.stringify(this.subscriberData));
                }
                
                // UI 업데이트
                this.updateChannelManagement();
                this.updateTrackingChannelManagement();
                this.updateTrackingChannelsSelection();
                this.updateSubscriberChart();
                this.updateSubscriberDataList();
                this.updateLastCollectionInfo();
                this.showLatestVideos();
                
                this.showMessage('데이터가 복원되었습니다.');
                
            } catch (error) {
                this.showMessage('파일을 읽는 중 오류가 발생했습니다.', 'error');
            }
        };
        
        reader.readAsText(file);
        event.target.value = ''; // 파일 입력 초기화
    }

    // 썸네일 테스트 시작
    async startThumbnailTest() {
        const keyword = document.getElementById('test-keyword').value.trim();
        const subscriberRange = document.getElementById('subscriber-range').value;
        const questionCount = parseInt(document.getElementById('question-count')?.value) || 50;
        
        this.showLoading('테스트 문제를 준비하는 중...');
        
        try {
            this.testQuestions = await this.generateTestQuestions(keyword, subscriberRange, questionCount);
            
            if (this.testQuestions.length < questionCount) {
                this.hideLoading();
                this.showMessage(`충분한 문제를 생성할 수 없습니다. (${this.testQuestions.length}/${questionCount})`, 'error');
                return;
            }
            
            this.currentTest = {
                keyword: keyword || '전체',
                subscriberRange: subscriberRange,
                questionCount: questionCount,
                startedAt: new Date().toISOString(),
                score: 0,
                totalQuestions: questionCount
            };
            
            this.currentQuestionIndex = 0;
            this.hideLoading();
            this.showTestGame();
            this.displayCurrentQuestion();
            
        } catch (error) {
            this.hideLoading();
            this.showMessage('테스트 준비 중 오류가 발생했습니다.', 'error');
        }
    }

    // 테스트 문제 생성 (롱폼만)
    async generateTestQuestions(keyword, subscriberRange) {
        const apiKey = this.getCurrentApiKey();
        if (!apiKey) {
            throw new Error('API 키가 설정되지 않았습니다.');
        }

        // 48-50시간 전 날짜 범위 계산
        const endTime = new Date();
        endTime.setHours(endTime.getHours() - 48);
        const startTime = new Date();
        startTime.setHours(startTime.getHours() - 50);

        const publishedAfter = startTime.toISOString();
        const publishedBefore = endTime.toISOString();

        let searchQuery = keyword || '';
        if (!keyword) {
            // 키워드가 없으면 다양한 주제로 검색
            const topics = ['음악', '게임', '요리', '여행', '스포츠', '기술', '영화', '드라마', '뉴스', '교육'];
            searchQuery = topics[Math.floor(Math.random() * topics.length)];
        }

        // 영상 검색 (롱폼만)
        const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(searchQuery)}&maxResults=50&publishedAfter=${publishedAfter}&publishedBefore=${publishedBefore}&videoDuration=medium&key=${apiKey}`
        );

        if (!searchResponse.ok) {
            throw new Error(`검색 API 오류: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();
        if (!searchData.items || searchData.items.length < 10) {
            throw new Error('충분한 영상을 찾을 수 없습니다.');
        }

        // 영상 상세 정보 가져오기 (contentDetails 포함)
        const videoIds = searchData.items.map(item => item.id.videoId);
        const videosResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
        );

        if (!videosResponse.ok) {
            throw new Error(`영상 정보 API 오류: ${videosResponse.status}`);
        }

        const videosData = await videosResponse.json();

        // 채널 정보 가져오기
        const channelIds = [...new Set(videosData.items.map(item => item.snippet.channelId))];
        const channelsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds.join(',')}&key=${apiKey}`
        );

        let channelsData = { items: [] };
        if (channelsResponse.ok) {
            channelsData = await channelsResponse.json();
        }

        // 롱폼 영상만 필터링 및 구독자 수 필터링
        const videos = videosData.items
            .filter(video => {
                // 롱폼 필터링 (1분 이상)
                const duration = this.parseDuration(video.contentDetails?.duration || 'PT0S');
                return duration >= 60;
            })
            .map(video => {
                const channel = channelsData.items.find(c => c.id === video.snippet.channelId) || {};
                const subscriberCount = parseInt(channel.statistics?.subscriberCount || 0);
                
                return {
                    id: video.id,
                    title: video.snippet.title,
                    channelTitle: video.snippet.channelTitle,
                    channelId: video.snippet.channelId,
                    thumbnail: video.snippet.thumbnails?.medium?.url || '',
                    viewCount: parseInt(video.statistics?.viewCount || 0),
                    subscriberCount: subscriberCount,
                    duration: this.parseDuration(video.contentDetails?.duration || 'PT0S')
                };
            })
            .filter(video => {
                // 구독자 수 필터링
                if (subscriberRange === 'all') return true;
                
                const sub = video.subscriberCount;
                switch (subscriberRange) {
                    case 'micro': return sub >= 1000 && sub <= 10000;
                    case 'small': return sub >= 10000 && sub <= 100000;
                    case 'medium': return sub >= 100000 && sub <= 1000000;
                    case 'large': return sub >= 1000000 && sub <= 10000000;
                    case 'mega': return sub >= 10000000;
                    case 'custom':
                        const min = parseInt(document.getElementById('min-subscribers').value) || 0;
                        const max = parseInt(document.getElementById('max-subscribers').value) || Infinity;
                        return sub >= min && sub <= max;
                    default: return true;
                }
            });

        if (videos.length < 10) {
            throw new Error('필터 조건에 맞는 충분한 롱폼 영상을 찾을 수 없습니다.');
        }

        // 문제 생성 (50문제)
        const questions = [];
        const usedVideos = new Set();

        while (questions.length < 50 && usedVideos.size < videos.length - 1) {
            // 랜덤하게 두 영상 선택
            const availableVideos = videos.filter(v => !usedVideos.has(v.id));
            if (availableVideos.length < 2) break;

            const video1 = availableVideos[Math.floor(Math.random() * availableVideos.length)];
            let video2;
            do {
                video2 = availableVideos[Math.floor(Math.random() * availableVideos.length)];
            } while (video2.id === video1.id);

            // 정답 결정 (조회수가 더 높은 것)
            const correctAnswer = video1.viewCount > video2.viewCount ? 'a' : 'b';

            questions.push({
                videoA: video1,
                videoB: video2,
                correctAnswer: correctAnswer
            });

            usedVideos.add(video1.id);
            usedVideos.add(video2.id);
        }

        return questions;
    }

    // 테스트 게임 화면 표시
    showTestGame() {
        document.getElementById('test-intro').style.display = 'none';
        document.getElementById('test-game').style.display = 'block';
        document.getElementById('test-result').style.display = 'none';
    }

    // 현재 문제 표시
    displayCurrentQuestion() {
        const question = this.testQuestions[this.currentQuestionIndex];
        
        document.getElementById('question-counter').textContent = `${this.currentQuestionIndex + 1} / ${this.currentTest.totalQuestions}`;
        document.getElementById('score-counter').textContent = `정답: ${this.currentTest.score}개`;
        
        // 썸네일과 정보 표시
        document.getElementById('thumbnail-a').src = question.videoA.thumbnail;
        document.getElementById('thumbnail-b').src = question.videoB.thumbnail;
        document.getElementById('title-a').textContent = question.videoA.title;
        document.getElementById('title-b').textContent = question.videoB.title;
        document.getElementById('channel-a').textContent = question.videoA.channelTitle;
        document.getElementById('channel-b').textContent = question.videoB.channelTitle;
        
        // 선택 상태 초기화
        document.getElementById('option-a').classList.remove('selected', 'correct', 'incorrect');
        document.getElementById('option-b').classList.remove('selected', 'correct', 'incorrect');
    }

    // 썸네일 선택
    selectThumbnail(option) {
        const question = this.testQuestions[this.currentQuestionIndex];
        const isCorrect = option === question.correctAnswer;
        
        // 선택 표시
        document.getElementById(`option-${option}`).classList.add('selected');
        
        // 정답 표시
        setTimeout(() => {
            document.getElementById(`option-${question.correctAnswer}`).classList.add('correct');
            if (!isCorrect) {
                document.getElementById(`option-${option}`).classList.add('incorrect');
            } else {
                this.currentTest.score++;
            }
            
            // 2초 후 다음 문제
            setTimeout(() => {
                this.currentQuestionIndex++;
                
                if (this.currentQuestionIndex >= this.currentTest.totalQuestions) {
                    this.finishTest();
                } else {
                    this.displayCurrentQuestion();
                }
            }, 2000);
        }, 500);
    }

    // 테스트 완료
    finishTest() {
        this.currentTest.completedAt = new Date().toISOString();
        this.currentTest.percentage = Math.round((this.currentTest.score / this.currentTest.totalQuestions) * 100);
        
        // 기록 저장
        this.testRecords.push({
            ...this.currentTest,
            id: Date.now()
        });
        localStorage.setItem('youtube_test_records', JSON.stringify(this.testRecords));
        
        // 결과 화면 표시
        document.getElementById('test-game').style.display = 'none';
        document.getElementById('test-result').style.display = 'block';
        
        document.getElementById('final-score-text').textContent = `${this.currentTest.totalQuestions}문제 중 ${this.currentTest.score}문제 정답`;
        document.getElementById('final-percentage').textContent = `(${this.currentTest.percentage}%)`;
    }

    // 테스트 재시작
    restartTest() {
        this.currentQuestionIndex = 0;
        this.currentTest.score = 0;
        this.showTestGame();
        this.displayCurrentQuestion();
    }

    // 새 테스트
    newTest() {
        document.getElementById('test-result').style.display = 'none';
        document.getElementById('test-intro').style.display = 'block';
        this.currentTest = null;
        this.testQuestions = [];
    }

    // 테스트 기록 보기
    showTestRecords() {
        const container = document.getElementById('records-list');
        
        if (this.testRecords.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>아직 테스트 기록이 없습니다.</p>
                </div>
            `;
        } else {
            container.innerHTML = this.testRecords.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).map(record => `
                <div class="record-item">
                    <div class="record-info">
                        <div class="record-date">${new Date(record.completedAt).toLocaleDateString('ko-KR')}</div>
                        <div class="record-keyword">키워드: ${record.keyword} | 구독자: ${this.getSubscriberRangeText(record.subscriberRange)}</div>
                    </div>
                    <div class="record-score">
                        <div class="record-score-number">${record.score}/${record.totalQuestions}</div>
                        <div class="record-percentage">${record.percentage}%</div>
                    </div>
                </div>
            `).join('');
        }
        
        document.getElementById('test-records').style.display = 'block';
        document.getElementById('test-intro').style.display = 'none';
    }

    // 테스트 기록 닫기
    closeTestRecords() {
        document.getElementById('test-records').style.display = 'none';
        document.getElementById('test-intro').style.display = 'block';
    }

    // 구독자 범위 텍스트 가져오기
    getSubscriberRangeText(range) {
        const ranges = {
            'all': '전체',
            'micro': '1천-1만명',
            'small': '1만-10만명',
            'medium': '10만-100만명',
            'large': '100만-1000만명',
            'mega': '1000만명 이상',
            'custom': '사용자 정의'
        };
        return ranges[range] || '전체';
    }

    // 현재 API 키 가져오기
    getCurrentApiKey() {
        if (this.apiKeys.length === 0) return null;
        if (this.currentApiIndex >= this.apiKeys.length) this.currentApiIndex = 0;
        return this.apiKeys[this.currentApiIndex];
    }

    // API 키 순환
    async rotateApiKey() {
        this.currentApiIndex = (this.currentApiIndex + 1) % this.apiKeys.length;
        localStorage.setItem('youtube_current_api_index', this.currentApiIndex.toString());
        this.updateApiStatus();
    }

    // 숫자 포맷팅
    formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // 숫자 파싱
    parseNumber(text) {
        const match = text.match(/[\d,.]+/);
        if (!match) return 0;
        return parseInt(match[0].replace(/[,.]/g, ''));
    }

    // 날짜 포맷팅
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffHours < 1) {
            return '방금 전';
        } else if (diffHours < 24) {
            return `${diffHours}시간 전`;
        } else if (diffDays < 7) {
            return `${diffDays}일 전`;
        } else {
            return date.toLocaleDateString('ko-KR', { 
                month: 'short', 
                day: 'numeric' 
            });
        }
    }

    // 메시지 표시
    showMessage(message, type = 'info') {
        // 더 나은 알림 시스템 구현
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        
        if (type === 'error') {
            alertDiv.style.backgroundColor = '#f44336';
        } else {
            alertDiv.style.backgroundColor = '#4caf50';
        }
        
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            alertDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(alertDiv)) {
                    document.body.removeChild(alertDiv);
                }
            }, 300);
        }, 3000);
        
        // CSS 애니메이션 추가 (한 번만)
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // 로딩 표시
    showLoading(message = '로딩 중...') {
        const overlay = document.getElementById('loading-overlay');
        overlay.querySelector('p').textContent = message;
        overlay.style.display = 'flex';
    }

    // 로딩 숨기기
    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// 전역 함수들 (HTML에서 직접 호출)
window.selectAllTrackingChannels = function() {
    if (window.youtubeMonitor) {
        window.youtubeMonitor.selectAllTrackingChannels();
    }
}

window.deselectAllTrackingChannels = function() {
    if (window.youtubeMonitor) {
        window.youtubeMonitor.deselectAllTrackingChannels();
    }
}

window.selectThumbnail = function(option) {
    if (window.youtubeMonitor) {
        window.youtubeMonitor.selectThumbnail(option);
    }
}

window.toggleChannelManagementSection = function(type) {
    const gridId = type === 'monitoring' ? 'monitoring-channel-grid' : 'tracking-channel-grid';
    const btnId = type === 'monitoring' ? 'monitoring-collapse-btn' : 'tracking-collapse-btn';
    
    const grid = document.getElementById(gridId);
    const btn = document.getElementById(btnId);
    
    if (grid.style.display === 'none') {
        grid.style.display = 'grid';
        btn.textContent = '▼';
        btn.style.transform = 'rotate(0deg)';
    } else {
        grid.style.display = 'none';
        btn.textContent = '▶';
        btn.style.transform = 'rotate(-90deg)';
    }
}

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.youtubeMonitor = new YouTubeMonitor();
});
