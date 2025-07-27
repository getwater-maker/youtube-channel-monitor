// YouTube 채널 모니터 JavaScript
class YouTubeMonitor {
    constructor() {
        this.apiKeys = [];
        this.currentApiIndex = 0;
        this.monitoringChannels = [];
        this.trackingChannels = [];
        this.thumbnailTestData = {
            currentQuestion: 0,
            score: 0,
            questions: [],
            gameInProgress: false
        };
        
        this.init();
    }

    init() {
        this.loadLocalData();
        this.setupEventListeners();
        this.setupTabs();
        this.updateApiStatus();
        this.renderMonitoringChannels();
        this.renderTrackingChannels();
        this.updateTrackingChannelSelection();
        this.loadThumbnailTestRecords();
    }

    // 로컬 데이터 로드
    loadLocalData() {
        const apiKeys = localStorage.getItem('youtube_api_keys');
        if (apiKeys) {
            this.apiKeys = JSON.parse(apiKeys);
        }
        
        const monitoringChannels = localStorage.getItem('monitoring_channels');
        if (monitoringChannels) {
            this.monitoringChannels = JSON.parse(monitoringChannels);
        }
        
        const trackingChannels = localStorage.getItem('tracking_channels');
        if (trackingChannels) {
            this.trackingChannels = JSON.parse(trackingChannels);
        }
        
        this.currentApiIndex = parseInt(localStorage.getItem('current_api_index')) || 0;
    }

    // 로컬 데이터 저장
    saveLocalData() {
        localStorage.setItem('youtube_api_keys', JSON.stringify(this.apiKeys));
        localStorage.setItem('monitoring_channels', JSON.stringify(this.monitoringChannels));
        localStorage.setItem('tracking_channels', JSON.stringify(this.trackingChannels));
        localStorage.setItem('current_api_index', this.currentApiIndex.toString());
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // API 설정 모달
        document.getElementById('api-settings-btn').addEventListener('click', () => {
            this.showApiModal();
        });
        
        document.getElementById('save-api-btn').addEventListener('click', () => {
            this.saveApiKeys();
        });
        
        document.getElementById('cancel-api-btn').addEventListener('click', () => {
            this.hideApiModal();
        });

        // 채널 추가 모달 (모니터링)
        document.getElementById('add-monitoring-channel-btn').addEventListener('click', () => {
            this.currentChannelType = 'monitoring';
            this.showChannelModal();
        });

        // 채널 추가 모달 (구독자수 추적)
        document.getElementById('add-tracking-channel-btn').addEventListener('click', () => {
            this.currentChannelType = 'tracking';
            this.showChannelModal();
        });
        
        document.getElementById('add-channel-confirm-btn').addEventListener('click', () => {
            this.addChannel();
        });
        
        document.getElementById('cancel-channel-btn').addEventListener('click', () => {
            this.hideChannelModal();
        });

        // 채널 추적 시작
        document.getElementById('track-channels-btn').addEventListener('click', () => {
            this.trackChannels();
        });

        // 영상 검색
        document.getElementById('search-btn').addEventListener('click', () => {
            this.searchVideos();
        });

        // 날짜 범위 타입 변경
        document.getElementById('date-range-type').addEventListener('change', (e) => {
            const customDateRange = document.getElementById('custom-date-range');
            customDateRange.style.display = e.target.value === 'custom' ? 'flex' : 'none';
        });

        // 구독자 수 데이터 수집
        document.getElementById('collect-subscriber-data-btn').addEventListener('click', () => {
            this.collectSubscriberData();
        });

        // 썸네일 테스트
        document.getElementById('start-test-btn').addEventListener('click', () => {
            this.startThumbnailTest();
        });

        document.getElementById('view-records-btn').addEventListener('click', () => {
            this.showTestRecords();
        });

        document.getElementById('close-records-btn').addEventListener('click', () => {
            this.hideTestRecords();
        });

        document.getElementById('restart-test-btn').addEventListener('click', () => {
            this.restartThumbnailTest();
        });

        document.getElementById('new-test-btn').addEventListener('click', () => {
            this.newThumbnailTest();
        });

        // 구독자 범위 변경
        document.getElementById('subscriber-range').addEventListener('change', (e) => {
            const customRange = document.getElementById('custom-subscriber-range');
            customRange.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });

        // 전역 함수들
        window.selectAllTrackingChannels = () => this.selectAllTrackingChannels();
        window.deselectAllTrackingChannels = () => this.deselectAllTrackingChannels();
        window.selectThumbnail = (option) => this.selectThumbnail(option);
        window.toggleChannelManagementSection = (type) => this.toggleChannelManagementSection(type);
    }

    // 탭 설정
    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                
                // 모든 탭 버튼과 컨텐츠에서 active 클래스 제거
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // 선택된 탭 활성화
                btn.classList.add('active');
                document.getElementById(tabId).classList.add('active');
                
                // 채널 모니터링 탭이 활성화되면 최신 영상 로드
                if (tabId === 'channel-monitor') {
                    this.loadLatestVideos();
                }
            });
        });
    }

    // API 상태 업데이트
    updateApiStatus() {
        const statusText = document.getElementById('api-status-text');
        const currentApiIndexSpan = document.getElementById('current-api-index');
        
        if (this.apiKeys.length === 0) {
            statusText.textContent = 'API 키 설정 필요';
            statusText.style.color = '#f44336';
            if (currentApiIndexSpan) currentApiIndexSpan.textContent = '-';
        } else {
            statusText.textContent = `API 키 ${this.apiKeys.length}개 설정됨`;
            statusText.style.color = '#4caf50';
            if (currentApiIndexSpan) currentApiIndexSpan.textContent = `#${this.currentApiIndex + 1}`;
        }
    }

    // API 모달 표시
    showApiModal() {
        const modal = document.getElementById('api-modal');
        
        // 현재 API 키들을 입력 필드에 채우기
        for (let i = 0; i < 5; i++) {
            const input = document.getElementById(`api-key-${i + 1}`);
            if (input) {
                input.value = this.apiKeys[i] || '';
            }
        }
        
        modal.style.display = 'block';
    }

    // API 모달 숨기기
    hideApiModal() {
        document.getElementById('api-modal').style.display = 'none';
    }

    // API 키 저장
    saveApiKeys() {
        const newApiKeys = [];
        
        for (let i = 1; i <= 5; i++) {
            const input = document.getElementById(`api-key-${i}`);
            if (input && input.value.trim()) {
                newApiKeys.push(input.value.trim());
            }
        }
        
        if (newApiKeys.length === 0) {
            alert('최소 하나의 API 키를 입력해주세요.');
            return;
        }
        
        this.apiKeys = newApiKeys;
        this.currentApiIndex = 0;
        this.saveLocalData();
        this.updateApiStatus();
        this.hideApiModal();
        
        alert('API 키가 저장되었습니다.');
    }

    // YouTube API 호출
    async makeApiCall(endpoint, params = {}) {
        if (this.apiKeys.length === 0) {
            throw new Error('API 키가 설정되지 않았습니다.');
        }

        const baseUrl = 'https://www.googleapis.com/youtube/v3';
        const url = new URL(`${baseUrl}/${endpoint}`);
        
        // API 키 추가
        params.key = this.apiKeys[this.currentApiIndex];
        
        // 파라미터 추가
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });

        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                // API 키 할당량 초과 등의 오류 시 다음 키로 전환
                if (data.error.code === 403 || data.error.code === 429) {
                    console.warn(`API 키 #${this.currentApiIndex + 1} 오류:`, data.error.message);
                    
                    if (this.currentApiIndex < this.apiKeys.length - 1) {
                        this.currentApiIndex++;
                        this.saveLocalData();
                        this.updateApiStatus();
                        
                        // 다음 키로 재시도
                        return this.makeApiCall(endpoint, { ...params, key: undefined });
                    } else {
                        throw new Error('모든 API 키의 할당량이 초과되었습니다.');
                    }
                } else {
                    throw new Error(data.error.message);
                }
            }
            
            return data;
        } catch (error) {
            console.error('API 호출 오류:', error);
            throw error;
        }
    }

    // 채널 검색
    async searchChannels(query) {
        try {
            // 먼저 채널 ID로 직접 검색 시도
            if (query.startsWith('UC') && query.length === 24) {
                const data = await this.makeApiCall('channels', {
                    part: 'snippet,statistics',
                    id: query
                });
                
                if (data.items && data.items.length > 0) {
                    return data.items.map(item => ({
                        id: item.id,
                        title: item.snippet.title,
                        description: item.snippet.description,
                        thumbnail: item.snippet.thumbnails.default?.url,
                        subscriberCount: parseInt(item.statistics.subscriberCount),
                        customUrl: item.snippet.customUrl
                    }));
                }
            }

            // URL에서 채널명 추출
            let searchQuery = query;
            if (query.includes('youtube.com/')) {
                const urlMatch = query.match(/youtube\.com\/(@[\w-]+|c\/[\w-]+|channel\/(UC[\w-]+))/);
                if (urlMatch) {
                    if (urlMatch[3]) { // channel/UC... 형태
                        return this.searchChannels(urlMatch[3]);
                    } else if (urlMatch[1]) { // @channelname 또는 c/channelname 형태
                        searchQuery = urlMatch[1].replace(/^[@c\/]/, '');
                    }
                }
            }

            // 검색 API 사용
            const searchData = await this.makeApiCall('search', {
                part: 'snippet',
                q: searchQuery,
                type: 'channel',
                maxResults: 10
            });

            if (!searchData.items || searchData.items.length === 0) {
                return [];
            }

            // 채널 상세 정보 가져오기
            const channelIds = searchData.items.map(item => item.snippet.channelId).join(',');
            const channelData = await this.makeApiCall('channels', {
                part: 'snippet,statistics',
                id: channelIds
            });

            return channelData.items.map(item => ({
                id: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails.default?.url,
                subscriberCount: parseInt(item.statistics.subscriberCount),
                customUrl: item.snippet.customUrl
            }));

        } catch (error) {
            console.error('채널 검색 오류:', error);
            throw error;
        }
    }

    // 채널 모달 표시
    showChannelModal() {
        document.getElementById('channel-modal').style.display = 'block';
        document.getElementById('channel-input').value = '';
        document.getElementById('channel-input').focus();
    }

    // 채널 모달 숨기기
    hideChannelModal() {
        document.getElementById('channel-modal').style.display = 'none';
    }

    // 채널 추가
    async addChannel() {
        const input = document.getElementById('channel-input');
        const query = input.value.trim();
        
        if (!query) {
            alert('채널명, URL 또는 ID를 입력해주세요.');
            return;
        }

        try {
            this.showLoading();
            const channels = await this.searchChannels(query);
            
            if (channels.length === 0) {
                alert('채널을 찾을 수 없습니다.');
                this.hideLoading();
                return;
            }

            if (channels.length === 1) {
                // 채널이 하나만 찾아진 경우 바로 추가
                this.confirmAddChannel(channels[0]);
            } else {
                // 여러 채널이 찾아진 경우 선택 모달 표시
                this.showChannelSelectionModal(channels);
            }
            
        } catch (error) {
            alert('채널 검색 중 오류가 발생했습니다: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 채널 선택 모달 표시
    showChannelSelectionModal(channels) {
        const modal = document.getElementById('channel-selection-modal');
        const list = document.getElementById('channel-selection-list');
        
        list.innerHTML = '';
        
        channels.forEach(channel => {
            const item = document.createElement('div');
            item.className = 'channel-selection-item';
            item.onclick = () => this.selectChannelFromList(channel, item);
            
            item.innerHTML = `
                ${channel.thumbnail ? 
                    `<img src="${channel.thumbnail}" alt="${channel.title}" class="channel-selection-thumbnail">` :
                    `<div class="channel-selection-thumbnail-placeholder">📺</div>`
                }
                <div class="channel-selection-info">
                    <div class="channel-selection-name">${channel.title}</div>
                    <div class="channel-selection-meta">
                        <div class="channel-selection-subscribers">구독자 ${this.formatNumber(channel.subscriberCount)}명</div>
                        ${channel.description ? `<div class="channel-selection-description">${channel.description.substring(0, 100)}...</div>` : ''}
                        <div class="channel-selection-id">${channel.id}</div>
                    </div>
                </div>
            `;
            
            list.appendChild(item);
        });
        
        modal.style.display = 'block';
    }

    // 채널 선택
    selectChannelFromList(channel, element) {
        // 기존 선택 해제
        document.querySelectorAll('.channel-selection-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 새 선택 표시
        element.classList.add('selected');
        
        // 잠시 후 추가 확인
        setTimeout(() => {
            this.confirmAddChannel(channel);
            document.getElementById('channel-selection-modal').style.display = 'none';
        }, 500);
    }

    // 채널 추가 확인
    confirmAddChannel(channel) {
        const targetChannels = this.currentChannelType === 'monitoring' ? this.monitoringChannels : this.trackingChannels;
        
        // 중복 체크
        const existing = targetChannels.find(c => c.id === channel.id);
        if (existing) {
            alert('이미 등록된 채널입니다.');
            this.hideChannelModal();
            return;
        }
        
        // 채널 추가
        const newChannel = {
            ...channel,
            addedAt: new Date().toISOString(),
            mutationCount: 0,
            totalVideos: 0
        };
        
        targetChannels.push(newChannel);
        this.saveLocalData();
        
        if (this.currentChannelType === 'monitoring') {
            this.renderMonitoringChannels();
            this.loadLatestVideos();
        } else {
            this.renderTrackingChannels();
            this.updateTrackingChannelSelection();
        }
        
        this.hideChannelModal();
        alert(`${channel.title} 채널이 추가되었습니다.`);
    }

    // 채널 삭제
    deleteChannel(channelId, type) {
        if (!confirm('정말로 이 채널을 삭제하시겠습니까?')) {
            return;
        }
        
        const targetChannels = type === 'monitoring' ? this.monitoringChannels : this.trackingChannels;
        const index = targetChannels.findIndex(c => c.id === channelId);
        
        if (index !== -1) {
            targetChannels.splice(index, 1);
            this.saveLocalData();
            
            if (type === 'monitoring') {
                this.renderMonitoringChannels();
                this.loadLatestVideos();
            } else {
                this.renderTrackingChannels();
                this.updateTrackingChannelSelection();
            }
        }
    }

    // 모니터링 채널 렌더링
    renderMonitoringChannels() {
        const container = document.getElementById('monitoring-channel-grid');
        const countElement = document.getElementById('monitoring-channel-count');
        
        countElement.textContent = this.monitoringChannels.length;
        
        if (this.monitoringChannels.length === 0) {
            container.innerHTML = `
                <div class="channel-grid-empty">
                    <p>등록된 채널이 없습니다.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('add-monitoring-channel-btn').click()">
                        첫 번째 채널 추가하기
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        this.monitoringChannels.forEach(channel => {
            const channelElement = document.createElement('div');
            channelElement.className = 'channel-item';
            
            channelElement.innerHTML = `
                <div class="channel-item-header">
                    <div class="channel-info-with-logo">
                        ${channel.thumbnail ? 
                            `<img src="${channel.thumbnail}" alt="${channel.title}" class="channel-logo">` :
                            `<div class="channel-logo-placeholder">📺</div>`
                        }
                        <div class="channel-text-info">
                            <h4 class="channel-name" onclick="window.open('https://youtube.com/channel/${channel.id}')">${channel.title}</h4>
                            <div class="channel-subscribers">${this.formatNumber(channel.subscriberCount)}명</div>
                        </div>
                    </div>
                    <div class="channel-actions">
                        <button class="btn-icon delete" onclick="app.deleteChannel('${channel.id}', 'monitoring')" title="채널 삭제">🗑️</button>
                    </div>
                </div>
                <div class="channel-info">
                    <span class="channel-id">${channel.id}</span>
                </div>
                <div class="channel-status">
                    <div class="status-indicator"></div>
                    <span>돌연변이: ${channel.mutationCount || 0} / ${channel.totalVideos || 0}</span>
                </div>
            `;
            
            container.appendChild(channelElement);
        });
    }

    // 구독자수 추적 채널 렌더링
    renderTrackingChannels() {
        const container = document.getElementById('tracking-channel-grid');
        const countElement = document.getElementById('tracking-channel-count');
        
        countElement.textContent = this.trackingChannels.length;
        
        if (this.trackingChannels.length === 0) {
            container.innerHTML = `
                <div class="channel-grid-empty">
                    <p>등록된 채널이 없습니다.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('add-tracking-channel-btn').click()">
                        첫 번째 채널 추가하기
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        this.trackingChannels.forEach(channel => {
            const channelElement = document.createElement('div');
            channelElement.className = 'channel-item';
            
            channelElement.innerHTML = `
                <div class="channel-item-header">
                    <div class="channel-info-with-logo">
                        ${channel.thumbnail ? 
                            `<img src="${channel.thumbnail}" alt="${channel.title}" class="channel-logo">` :
                            `<div class="channel-logo-placeholder">📺</div>`
                        }
                        <div class="channel-text-info">
                            <h4 class="channel-name" onclick="window.open('https://youtube.com/channel/${channel.id}')">${channel.title}</h4>
                            <div class="channel-subscribers">${this.formatNumber(channel.subscriberCount)}명</div>
                        </div>
                    </div>
                    <div class="channel-actions">
                        <button class="btn-icon delete" onclick="app.deleteChannel('${channel.id}', 'tracking')" title="채널 삭제">🗑️</button>
                    </div>
                </div>
                <div class="channel-info">
                    <span class="channel-id">${channel.id}</span>
                </div>
                <div class="channel-status">
                    <div class="status-indicator"></div>
                    <span>추적 대상</span>
                </div>
            `;
            
            container.appendChild(channelElement);
        });
    }

    // 채널 추적
    async trackChannels() {
        if (this.monitoringChannels.length === 0) {
            alert('추적할 채널을 먼저 등록해주세요.');
            return;
        }

        try {
            this.showLoading();
            const trackingResults = [];
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            for (const channel of this.monitoringChannels) {
                try {
                    // 채널의 최신 영상들 가져오기
                    const videosData = await this.makeApiCall('search', {
                        part: 'snippet',
                        channelId: channel.id,
                        type: 'video',
                        order: 'date',
                        maxResults: 50,
                        publishedAfter: sixMonthsAgo.toISOString()
                    });

                    if (videosData.items && videosData.items.length > 0) {
                        // 영상 상세 정보 가져오기
                        const videoIds = videosData.items.map(item => item.id.videoId).join(',');
                        const videoDetails = await this.makeApiCall('videos', {
                            part: 'statistics,snippet,contentDetails',
                            id: videoIds
                        });

                        // 돌연변이 영상 찾기
                        const hotRatio = parseFloat(document.getElementById('hot-video-ratio').value) || 2;
                        let mutationVideo = null;
                        let highestRatio = 0;

                        videoDetails.items.forEach(video => {
                            const viewCount = parseInt(video.statistics.viewCount);
                            const ratio = viewCount / channel.subscriberCount;
                            
                            // 롱폼 영상인지 확인 (60초 이상)
                            const duration = this.parseDuration(video.contentDetails.duration);
                            if (duration >= 60 && ratio >= hotRatio && ratio > highestRatio) {
                                highestRatio = ratio;
                                mutationVideo = {
                                    id: video.id,
                                    title: video.snippet.title,
                                    thumbnail: video.snippet.thumbnails.medium?.url,
                                    viewCount: viewCount,
                                    publishedAt: video.snippet.publishedAt,
                                    ratio: ratio
                                };
                            }
                        });

                        // 채널 정보 업데이트
                        channel.mutationCount = mutationVideo ? 1 : 0;
                        channel.totalVideos = videoDetails.items.length;

                        if (mutationVideo) {
                            trackingResults.push({
                                channel: channel,
                                video: mutationVideo
                            });
                        }
                    }
                } catch (error) {
                    console.error(`채널 ${channel.title} 추적 오류:`, error);
                }
            }

            this.saveLocalData();
            this.renderMonitoringChannels();
            this.displayTrackingResults(trackingResults);
            
        } catch (error) {
            alert('채널 추적 중 오류가 발생했습니다: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 추적 결과 표시
    displayTrackingResults(results) {
        const container = document.getElementById('tracking-records');
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>돌연변이 영상이 발견되지 않았습니다.</p>
                </div>
            `;
            return;
        }

        // 정렬 옵션에 따라 정렬
        const sortOrder = document.getElementById('tracking-sort-order').value;
        this.sortTrackingResults(results, sortOrder);

        const timestamp = new Date().toLocaleString('ko-KR');
        
        container.innerHTML = `
            <div class="tracking-record">
                <div class="tracking-header">
                    <div class="tracking-timestamp">${timestamp}</div>
                    <div class="tracking-summary">${results.length}개의 돌연변이 영상 발견</div>
                </div>
                <div class="channel-tracking-list">
                    ${results.map(result => this.createTrackingVideoCard(result)).join('')}
                </div>
            </div>
        `;
    }

    // 추적 결과 정렬
    sortTrackingResults(results, sortOrder) {
        switch (sortOrder) {
            case 'ratio':
                results.sort((a, b) => b.video.ratio - a.video.ratio);
                break;
            case 'publishedAt':
                results.sort((a, b) => new Date(b.video.publishedAt) - new Date(a.video.publishedAt));
                break;
            case 'subscriberCount':
                results.sort((a, b) => b.channel.subscriberCount - a.channel.subscriberCount);
                break;
            case 'viewCount':
                results.sort((a, b) => b.video.viewCount - a.video.viewCount);
                break;
        }
    }

    // 추적 영상 카드 생성
    createTrackingVideoCard(result) {
        const { channel, video } = result;
        
        return `
            <div class="channel-tracking-item" onclick="window.open('https://youtube.com/watch?v=${video.id}')">
                ${video.thumbnail ? 
                    `<img src="${video.thumbnail}" alt="${video.title}" class="tracking-video-thumbnail">` :
                    `<div class="tracking-video-thumbnail-placeholder">🎬</div>`
                }
                <div class="tracking-video-details">
                    <div class="tracking-channel-header">
                        <div class="tracking-channel-name">${channel.title}</div>
                    </div>
                    <div class="tracking-channel-subscribers">${this.formatNumber(channel.subscriberCount)}명</div>
                    <div class="tracking-video-title">${video.title}</div>
                    <div class="tracking-video-stats">
                        <span>👁 ${this.formatNumber(video.viewCount)}</span>
                        <span class="tracking-hot-ratio">${video.ratio.toFixed(1)}배</span>
                    </div>
                </div>
            </div>
        `;
    }

    // 최신 영상 로드
    async loadLatestVideos() {
        if (this.monitoringChannels.length === 0) {
            document.getElementById('latest-videos-container').innerHTML = `
                <div class="empty-state">
                    <p>등록된 채널이 없습니다.</p>
                </div>
            `;
            return;
        }

        try {
            this.showLoading();
            const latestVideos = [];

            // 구독자 수로 채널 정렬 (내림차순)
            const sortedChannels = [...this.monitoringChannels].sort((a, b) => b.subscriberCount - a.subscriberCount);

            for (const channel of sortedChannels) {
                try {
                    // 각 채널의 최신 영상 1개씩 가져오기
                    const videosData = await this.makeApiCall('search', {
                        part: 'snippet',
                        channelId: channel.id,
                        type: 'video',
                        order: 'date',
                        maxResults: 1
                    });

                    if (videosData.items && videosData.items.length > 0) {
                        const video = videosData.items[0];
                        
                        // 영상 상세 정보 가져오기
                        const videoDetails = await this.makeApiCall('videos', {
                            part: 'statistics,snippet',
                            id: video.id.videoId
                        });

                        if (videoDetails.items && videoDetails.items.length > 0) {
                            const videoDetail = videoDetails.items[0];
                            const viewCount = parseInt(videoDetail.statistics.viewCount);
                            const ratio = viewCount / channel.subscriberCount;

                            latestVideos.push({
                                id: videoDetail.id,
                                title: videoDetail.snippet.title,
                                thumbnail: videoDetail.snippet.thumbnails.medium?.url,
                                channelTitle: channel.title,
                                channelSubscribers: channel.subscriberCount,
                                viewCount: viewCount,
                                publishedAt: videoDetail.snippet.publishedAt,
                                ratio: ratio
                            });
                        }
                    }
                } catch (error) {
                    console.error(`채널 ${channel.title} 최신 영상 로드 오류:`, error);
                }
            }

            this.displayLatestVideos(latestVideos);
            
        } catch (error) {
            console.error('최신 영상 로드 오류:', error);
        } finally {
            this.hideLoading();
        }
    }

    // 최신 영상 표시
    displayLatestVideos(videos) {
        const container = document.getElementById('latest-videos-container');
        
        if (videos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>최신 영상을 불러올 수 없습니다.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = videos.map(video => `
            <div class="video-card" onclick="window.open('https://youtube.com/watch?v=${video.id}')">
                ${video.thumbnail ? 
                    `<img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">` :
                    `<div class="video-thumbnail-placeholder-large">🎬</div>`
                }
                <div class="video-details">
                    <div class="video-title-inline">${video.title}</div>
                    <div class="video-channel">${video.channelTitle} (${this.formatNumber(video.channelSubscribers)}명)</div>
                    <div class="video-stats">
                        <span>👁 ${this.formatNumber(video.viewCount)}</span>
                        <span>🔥 ${video.ratio.toFixed(1)}배</span>
                        <span>📅 ${this.formatDate(video.publishedAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 영상 검색
    async searchVideos() {
        const keyword = document.getElementById('search-keyword').value.trim();
        if (!keyword) {
            alert('검색 키워드를 입력해주세요.');
            return;
        }

        try {
            this.showLoading();
            
            // 검색 매개변수 수집
            const subFilter = parseInt(document.getElementById('sub-filter').value);
            const viewFilter = parseInt(document.getElementById('view-filter').value);
            const sortOrder = document.getElementById('sort-order').value;
            const dateRange = this.getDateRange();

            // 영상 검색
            const searchData = await this.makeApiCall('search', {
                part: 'snippet',
                q: keyword,
                type: 'video',
                order: 'relevance',
                maxResults: 50,
                publishedAfter: dateRange.start,
                publishedBefore: dateRange.end
            });

            if (!searchData.items || searchData.items.length === 0) {
                this.displaySearchResults([]);
                return;
            }

            // 영상 상세 정보 가져오기
            const videoIds = searchData.items.map(item => item.id.videoId).join(',');
            const videoDetails = await this.makeApiCall('videos', {
                part: 'statistics,snippet,contentDetails',
                id: videoIds
            });

            // 채널 정보 가져오기
            const channelIds = [...new Set(videoDetails.items.map(item => item.snippet.channelId))];
            const channelData = await this.makeApiCall('channels', {
                part: 'statistics',
                id: channelIds.join(',')
            });

            // 채널 정보를 맵으로 변환
            const channelMap = {};
            channelData.items.forEach(channel => {
                channelMap[channel.id] = parseInt(channel.statistics.subscriberCount);
            });

            // 결과 필터링 및 처리
            const filteredVideos = [];
            
            videoDetails.items.forEach(video => {
                const viewCount = parseInt(video.statistics.viewCount);
                const subscriberCount = channelMap[video.snippet.channelId] || 0;
                const ratio = subscriberCount > 0 ? viewCount / subscriberCount : 0;
                
                // 롱폼 영상인지 확인 (60초 이상)
                const duration = this.parseDuration(video.contentDetails.duration);
                
                // 필터 적용
                if (duration >= 60 && 
                    subscriberCount >= subFilter && 
                    viewCount >= viewFilter) {
                    
                    filteredVideos.push({
                        id: video.id,
                        title: video.snippet.title,
                        thumbnail: video.snippet.thumbnails.medium?.url,
                        channelTitle: video.snippet.channelTitle,
                        channelSubscribers: subscriberCount,
                        viewCount: viewCount,
                        publishedAt: video.snippet.publishedAt,
                        ratio: ratio
                    });
                }
            });

            // 정렬
            this.sortSearchResults(filteredVideos, sortOrder);
            this.displaySearchResults(filteredVideos);
            
        } catch (error) {
            alert('검색 중 오류가 발생했습니다: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 검색 결과 정렬
    sortSearchResults(videos, sortOrder) {
        switch (sortOrder) {
            case 'ratio':
                videos.sort((a, b) => b.ratio - a.ratio);
                break;
            case 'viewCount':
                videos.sort((a, b) => b.viewCount - a.viewCount);
                break;
            case 'subscriberCount':
                videos.sort((a, b) => b.channelSubscribers - a.channelSubscribers);
                break;
            case 'publishedAt':
                videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
                break;
        }
    }

    // 검색 결과 표시
    displaySearchResults(videos) {
        const container = document.getElementById('search-results');
        
        if (videos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>검색 결과가 없습니다.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = videos.map(video => `
            <div class="video-card" onclick="window.open('https://youtube.com/watch?v=${video.id}')">
                ${video.thumbnail ? 
                    `<img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">` :
                    `<div class="video-thumbnail-placeholder-large">🎬</div>`
                }
                <div class="video-details">
                    <div class="video-title-inline">${video.title}</div>
                    <div class="video-channel">${video.channelTitle} (${this.formatNumber(video.channelSubscribers)}명)</div>
                    <div class="video-stats">
                        <span>👁 ${this.formatNumber(video.viewCount)}</span>
                        <span>🔥 ${video.ratio.toFixed(1)}배</span>
                        <span>📅 ${this.formatDate(video.publishedAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 날짜 범위 가져오기
    getDateRange() {
        const dateRangeType = document.getElementById('date-range-type').value;
        const now = new Date();
        let start, end = now.toISOString();

        if (dateRangeType === 'custom') {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            
            if (startDate) {
                start = new Date(startDate).toISOString();
            }
            if (endDate) {
                end = new Date(endDate + 'T23:59:59').toISOString();
            }
        } else {
            const dateRange = document.getElementById('date-range').value;
            const startDate = new Date(now);

            switch (dateRange) {
                case 'hour':
                    startDate.setHours(startDate.getHours() - 1);
                    break;
                case 'hour3':
                    startDate.setHours(startDate.getHours() - 3);
                    break;
                case 'hour12':
                    startDate.setHours(startDate.getHours() - 12);
                    break;
                case 'day':
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case 'day3':
                    startDate.setDate(startDate.getDate() - 3);
                    break;
                case 'week':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'week2':
                    startDate.setDate(startDate.getDate() - 14);
                    break;
                case 'month':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'month3':
                    startDate.setMonth(startDate.getMonth() - 3);
                    break;
                case 'month6':
                    startDate.setMonth(startDate.getMonth() - 6);
                    break;
                case 'year':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
            }

            start = startDate.toISOString();
        }

        return { start, end };
    }

    // 구독자수 추적 채널 선택 업데이트
    updateTrackingChannelSelection() {
        const container = document.getElementById('tracking-channels-selection');
        
        if (this.trackingChannels.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>추적할 채널을 먼저 등록해주세요.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.trackingChannels.map(channel => `
            <div class="tracking-channel-option" onclick="this.classList.toggle('selected')">
                <input type="checkbox" class="tracking-channel-checkbox" value="${channel.id}" checked 
                       onchange="event.stopPropagation()">
                <div class="tracking-channel-info">
                    ${channel.thumbnail ? 
                        `<img src="${channel.thumbnail}" alt="${channel.title}" class="tracking-channel-logo">` :
                        `<div class="tracking-channel-logo-placeholder">📺</div>`
                    }
                    <div class="tracking-channel-text">
                        <div class="tracking-channel-name">${channel.title}</div>
                        <div class="tracking-channel-subscribers">${this.formatNumber(channel.subscriberCount)}명</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 전체 채널 선택
    selectAllTrackingChannels() {
        const checkboxes = document.querySelectorAll('.tracking-channel-checkbox');
        const options = document.querySelectorAll('.tracking-channel-option');
        
        checkboxes.forEach((checkbox, index) => {
            checkbox.checked = true;
            options[index].classList.add('selected');
        });
    }

    // 전체 채널 선택 해제
    deselectAllTrackingChannels() {
        const checkboxes = document.querySelectorAll('.tracking-channel-checkbox');
        const options = document.querySelectorAll('.tracking-channel-option');
        
        checkboxes.forEach((checkbox, index) => {
            checkbox.checked = false;
            options[index].classList.remove('selected');
        });
    }

    // 구독자 수 데이터 수집
    async collectSubscriberData() {
        const selectedChannels = this.getSelectedTrackingChannels();
        
        if (selectedChannels.length === 0) {
            alert('추적할 채널을 선택해주세요.');
            return;
        }

        try {
            this.showLoading();
            const today = new Date().toISOString().split('T')[0];
            const subscriberData = [];

            for (const channelId of selectedChannels) {
                try {
                    const channelData = await this.makeApiCall('channels', {
                        part: 'statistics',
                        id: channelId
                    });

                    if (channelData.items && channelData.items.length > 0) {
                        const subscriberCount = parseInt(channelData.items[0].statistics.subscriberCount);
                        const channel = this.trackingChannels.find(c => c.id === channelId);
                        
                        subscriberData.push({
                            channelId: channelId,
                            channelTitle: channel ? channel.title : 'Unknown',
                            subscriberCount: subscriberCount,
                            date: today
                        });
                    }
                } catch (error) {
                    console.error(`채널 ${channelId} 구독자 수 수집 오류:`, error);
                }
            }

            // 로컬 스토리지에 저장 (실제로는 Firebase를 사용해야 함)
            this.saveSubscriberData(subscriberData);
            this.updateLastCollectionInfo();
            this.updateSubscriberChart();
            this.displaySubscriberDataList();
            
            alert('구독자 수 데이터가 수집되었습니다.');
            
        } catch (error) {
            alert('구독자 수 수집 중 오류가 발생했습니다: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 선택된 추적 채널 가져오기
    getSelectedTrackingChannels() {
        const checkboxes = document.querySelectorAll('.tracking-channel-checkbox:checked');
        return Array.from(checkboxes).map(checkbox => checkbox.value);
    }

    // 구독자 수 데이터 저장
    saveSubscriberData(newData) {
        const existingData = JSON.parse(localStorage.getItem('subscriber_data') || '[]');
        const today = new Date().toISOString().split('T')[0];
        
        // 오늘 날짜의 기존 데이터 제거
        const filteredData = existingData.filter(item => item.date !== today);
        
        // 새 데이터 추가
        const updatedData = [...filteredData, ...newData];
        
        localStorage.setItem('subscriber_data', JSON.stringify(updatedData));
    }

    // 마지막 수집 정보 업데이트
    updateLastCollectionInfo() {
        const lastCollectionInfo = document.getElementById('last-collection-info');
        const now = new Date().toLocaleString('ko-KR');
        lastCollectionInfo.textContent = `마지막 수집: ${now}`;
    }

    // 구독자 수 차트 업데이트
    updateSubscriberChart() {
        const data = JSON.parse(localStorage.getItem('subscriber_data') || '[]');
        const selectedChannels = this.getSelectedTrackingChannels();
        
        // 차트 업데이트 로직 (Chart.js 사용)
        // 여기서는 간단한 구현만 제공
        console.log('구독자 수 차트 업데이트:', data);
    }

    // 구독자 수 데이터 목록 표시
    displaySubscriberDataList() {
        const container = document.getElementById('subscriber-data-list');
        const data = JSON.parse(localStorage.getItem('subscriber_data') || '[]');
        
        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>아직 기록된 데이터가 없습니다.</p>
                </div>
            `;
            return;
        }

        // 날짜별로 그룹화
        const groupedData = {};
        data.forEach(item => {
            if (!groupedData[item.date]) {
                groupedData[item.date] = [];
            }
            groupedData[item.date].push(item);
        });

        // 날짜 내림차순으로 정렬
        const sortedDates = Object.keys(groupedData).sort((a, b) => new Date(b) - new Date(a));

        container.innerHTML = sortedDates.map(date => `
            <div class="data-item">
                <div class="data-date">${new Date(date).toLocaleDateString('ko-KR')}</div>
                <div class="data-details">
                    ${groupedData[date].map(item => `
                        <div>${item.channelTitle}: ${this.formatNumber(item.subscriberCount)}명</div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    // 썸네일 테스트 시작
    async startThumbnailTest() {
        const keyword = document.getElementById('test-keyword').value.trim();
        const subscriberRange = document.getElementById('subscriber-range').value;
        
        try {
            this.showLoading();
            
            // 테스트용 영상 데이터 수집
            const testVideos = await this.collectThumbnailTestVideos(keyword, subscriberRange);
            
            if (testVideos.length < 100) { // 50문제 * 2개 = 100개 필요
                alert('충분한 영상을 찾을 수 없습니다. 다른 조건으로 시도해보세요.');
                this.hideLoading();
                return;
            }

            // 테스트 데이터 초기화
            this.thumbnailTestData = {
                currentQuestion: 0,
                score: 0,
                questions: this.generateThumbnailQuestions(testVideos),
                gameInProgress: true,
                keyword: keyword || '전체'
            };

            this.showThumbnailGame();
            this.displayCurrentQuestion();
            
        } catch (error) {
            alert('테스트 준비 중 오류가 발생했습니다: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 썸네일 테스트용 영상 수집
    async collectThumbnailTestVideos(keyword, subscriberRange) {
        const videos = [];
        const now = new Date();
        const start48Hours = new Date(now.getTime() - (48 * 60 * 60 * 1000));
        const start50Hours = new Date(now.getTime() - (50 * 60 * 60 * 1000));

        // 구독자 수 범위 설정
        const { minSubs, maxSubs } = this.getSubscriberRange(subscriberRange);

        // 검색 쿼리 설정
        const searchQuery = keyword || 'music OR gaming OR tech OR food OR travel OR beauty OR fitness';

        // 영상 검색
        const searchData = await this.makeApiCall('search', {
            part: 'snippet',
            q: searchQuery,
            type: 'video',
            order: 'relevance',
            maxResults: 50,
            publishedAfter: start50Hours.toISOString(),
            publishedBefore: start48Hours.toISOString()
        });

        if (!searchData.items || searchData.items.length === 0) {
            return [];
        }

        // 영상 상세 정보 가져오기
        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const videoDetails = await this.makeApiCall('videos', {
            part: 'statistics,snippet,contentDetails',
            id: videoIds
        });

        // 채널 정보 가져오기
        const channelIds = [...new Set(videoDetails.items.map(item => item.snippet.channelId))];
        const channelData = await this.makeApiCall('channels', {
            part: 'statistics',
            id: channelIds.join(',')
        });

        const channelMap = {};
        channelData.items.forEach(channel => {
            channelMap[channel.id] = parseInt(channel.statistics.subscriberCount);
        });

        // 조건에 맞는 영상 필터링
        videoDetails.items.forEach(video => {
            const subscriberCount = channelMap[video.snippet.channelId] || 0;
            const duration = this.parseDuration(video.contentDetails.duration);
            
            // 롱폼이고 구독자 수 조건에 맞는 영상만
            if (duration >= 60 && subscriberCount >= minSubs && subscriberCount <= maxSubs) {
                videos.push({
                    id: video.id,
                    title: video.snippet.title,
                    thumbnail: video.snippet.thumbnails.medium?.url,
                    channelTitle: video.snippet.channelTitle,
                    viewCount: parseInt(video.statistics.viewCount),
                    subscriberCount: subscriberCount
                });
            }
        });

        return videos;
    }

    // 구독자 수 범위 가져오기
    getSubscriberRange(range) {
        switch (range) {
            case 'micro':
                return { minSubs: 1000, maxSubs: 10000 };
            case 'small':
                return { minSubs: 10000, maxSubs: 100000 };
            case 'medium':
                return { minSubs: 100000, maxSubs: 1000000 };
            case 'large':
                return { minSubs: 1000000, maxSubs: 10000000 };
            case 'mega':
                return { minSubs: 10000000, maxSubs: Number.MAX_SAFE_INTEGER };
            case 'custom':
                const min = parseInt(document.getElementById('min-subscribers').value) || 0;
                const max = parseInt(document.getElementById('max-subscribers').value) || Number.MAX_SAFE_INTEGER;
                return { minSubs: min, maxSubs: max };
            default:
                return { minSubs: 0, maxSubs: Number.MAX_SAFE_INTEGER };
        }
    }

    // 썸네일 테스트 문제 생성
    generateThumbnailQuestions(videos) {
        const questions = [];
        const shuffled = [...videos].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < Math.min(25, Math.floor(shuffled.length / 2)); i++) {
            const videoA = shuffled[i * 2];
            const videoB = shuffled[i * 2 + 1];
            
            questions.push({
                videoA: videoA,
                videoB: videoB,
                correctAnswer: videoA.viewCount > videoB.viewCount ? 'a' : 'b'
            });
        }
        
        return questions;
    }

    // 썸네일 게임 화면 표시
    showThumbnailGame() {
        document.getElementById('test-intro').style.display = 'none';
        document.getElementById('test-game').style.display = 'block';
        document.getElementById('test-result').style.display = 'none';
    }

    // 현재 문제 표시
    displayCurrentQuestion() {
        const data = this.thumbnailTestData;
        const question = data.questions[data.currentQuestion];
        
        if (!question) {
            this.endThumbnailTest();
            return;
        }

        // 진행상황 업데이트
        document.getElementById('question-counter').textContent = `${data.currentQuestion + 1} / ${data.questions.length}`;
        document.getElementById('score-counter').textContent = `정답: ${data.score}개`;

        // 썸네일 표시
        document.getElementById('thumbnail-a').src = question.videoA.thumbnail || '';
        document.getElementById('thumbnail-b').src = question.videoB.thumbnail || '';
        
        document.getElementById('title-a').textContent = question.videoA.title;
        document.getElementById('title-b').textContent = question.videoB.title;
        
        document.getElementById('channel-a').textContent = question.videoA.channelTitle;
        document.getElementById('channel-b').textContent = question.videoB.channelTitle;

        // 옵션 리셋
        document.getElementById('option-a').classList.remove('selected', 'correct', 'incorrect');
        document.getElementById('option-b').classList.remove('selected', 'correct', 'incorrect');
    }

    // 썸네일 선택
    selectThumbnail(option) {
        const data = this.thumbnailTestData;
        const question = data.questions[data.currentQuestion];
        
        // 선택 표시
        document.getElementById('option-a').classList.remove('selected');
        document.getElementById('option-b').classList.remove('selected');
        document.getElementById(`option-${option}`).classList.add('selected');

        // 정답 체크
        const isCorrect = option === question.correctAnswer;
        if (isCorrect) {
            data.score++;
            document.getElementById(`option-${option}`).classList.add('correct');
        } else {
            document.getElementById(`option-${option}`).classList.add('incorrect');
            document.getElementById(`option-${question.correctAnswer}`).classList.add('correct');
        }

        // 잠시 후 다음 문제로
        setTimeout(() => {
            data.currentQuestion++;
            this.displayCurrentQuestion();
        }, 2000);
    }

    // 썸네일 테스트 종료
    endThumbnailTest() {
        const data = this.thumbnailTestData;
        const percentage = Math.round((data.score / data.questions.length) * 100);
        
        // 결과 저장
        this.saveThumbnailTestRecord({
            date: new Date().toISOString(),
            keyword: data.keyword,
            score: data.score,
            total: data.questions.length,
            percentage: percentage
        });

        // 결과 화면 표시
        document.getElementById('final-score-text').textContent = `${data.questions.length}문제 중 ${data.score}문제 정답`;
        document.getElementById('final-percentage').textContent = `(${percentage}%)`;

        document.getElementById('test-game').style.display = 'none';
        document.getElementById('test-result').style.display = 'block';

        data.gameInProgress = false;
    }

    // 썸네일 테스트 기록 저장
    saveThumbnailTestRecord(record) {
        const records = JSON.parse(localStorage.getItem('thumbnail_test_records') || '[]');
        records.unshift(record);
        
        // 최근 20개만 유지
        if (records.length > 20) {
            records.splice(20);
        }
        
        localStorage.setItem('thumbnail_test_records', JSON.stringify(records));
    }

    // 썸네일 테스트 기록 로드
    loadThumbnailTestRecords() {
        const records = JSON.parse(localStorage.getItem('thumbnail_test_records') || '[]');
        this.displayThumbnailTestRecords(records);
    }

    // 썸네일 테스트 기록 표시
    displayThumbnailTestRecords(records) {
        const container = document.getElementById('records-list');
        
        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>아직 테스트 기록이 없습니다.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = records.map(record => `
            <div class="record-item">
                <div class="record-info">
                    <div class="record-date">${new Date(record.date).toLocaleDateString('ko-KR')}</div>
                    <div class="record-keyword">키워드: ${record.keyword}</div>
                </div>
                <div class="record-score">
                    <div class="record-score-number">${record.score}/${record.total}</div>
                    <div class="record-percentage">${record.percentage}%</div>
                </div>
            </div>
        `).join('');
    }

    // 테스트 기록 보기
    showTestRecords() {
        document.getElementById('test-intro').style.display = 'none';
        document.getElementById('test-records').style.display = 'block';
        this.loadThumbnailTestRecords();
    }

    // 테스트 기록 숨기기
    hideTestRecords() {
        document.getElementById('test-records').style.display = 'none';
        document.getElementById('test-intro').style.display = 'block';
    }

    // 테스트 재시작
    restartThumbnailTest() {
        this.thumbnailTestData.currentQuestion = 0;
        this.thumbnailTestData.score = 0;
        this.thumbnailTestData.gameInProgress = true;
        
        this.showThumbnailGame();
        this.displayCurrentQuestion();
    }

    // 새 테스트 시작
    newThumbnailTest() {
        document.getElementById('test-result').style.display = 'none';
        document.getElementById('test-intro').style.display = 'block';
        
        // 입력 필드 초기화
        document.getElementById('test-keyword').value = '';
        document.getElementById('subscriber-range').value = 'all';
        document.getElementById('custom-subscriber-range').style.display = 'none';
    }

    // 채널 관리 섹션 토글
    toggleChannelManagementSection(type) {
        const grid = document.getElementById(`${type}-channel-grid`);
        const btn = document.getElementById(`${type}-collapse-btn`);
        
        if (grid.style.display === 'none') {
            grid.style.display = 'grid';
            btn.textContent = '▼';
        } else {
            grid.style.display = 'none';
            btn.textContent = '▶';
        }
    }

    // 유틸리티 함수들
    
    // 숫자 포맷팅
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // 날짜 포맷팅
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return '1일 전';
        } else if (diffDays < 7) {
            return `${diffDays}일 전`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks}주 전`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `${months}개월 전`;
        } else {
            const years = Math.floor(diffDays / 365);
            return `${years}년 전`;
        }
    }

    // YouTube 길이 파싱 (PT15M33S 형태를 초로 변환)
    parseDuration(duration) {
        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        const hours = (match[1] ? parseInt(match[1]) : 0);
        const minutes = (match[2] ? parseInt(match[2]) : 0);
        const seconds = (match[3] ? parseInt(match[3]) : 0);
        return hours * 3600 + minutes * 60 + seconds;
    }

    // 로딩 오버레이 표시
    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    // 로딩 오버레이 숨기기
    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// 앱 초기화
const app = new YouTubeMonitor();

// 전역 함수들 (HTML에서 호출되는 함수들)
window.app = app;
