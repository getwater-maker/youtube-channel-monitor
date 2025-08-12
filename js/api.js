// YouTube 채널 모니터 - YouTube API 호출
console.log('api.js 로딩 시작');

// YouTube API 호출 함수
async function yt(endpoint, params, attempt = 0) {
  console.log(`YouTube API 호출: ${endpoint}`, params);
  
  if (!window.hasKeys()) {
    throw new Error('API 키가 설정되지 않았습니다. API 키를 먼저 입력해주세요.');
  }
  
  const ctrl = new AbortController();
  const timeout = setTimeout(() => {
    ctrl.abort();
    console.log('API 호출 타임아웃');
  }, window.CONFIG.TIMEOUT);
  
  const p = new URLSearchParams(params);
  p.set('key', window.apiKeys[window.keyIdx]);
  const url = window.CONFIG.API_BASE + endpoint + '?' + p.toString();
  
  console.log(`API URL (키 인덱스 ${window.keyIdx}):`, url.replace(/key=[^&]+/, 'key=***'));
  
  try {
    const response = await fetch(url, { signal: ctrl.signal });
    const data = await response.json();
    clearTimeout(timeout);
    
    console.log(`API 응답 상태: ${response.status}`);
    
    if (data.error) {
      console.error('API 오류:', data.error);
      
      if (data.error.code === 403 && /quota/i.test(data.error.message || '')) {
        throw new Error('API 할당량이 초과되었습니다.');
      }
      
      // 다른 키로 재시도
      if (attempt < window.apiKeys.length - 1) {
        console.log('다른 API 키로 재시도');
        window.nextKey();
        return yt(endpoint, params, attempt + 1);
      }
      
      throw new Error(data.error.message || 'API 오류');
    }
    
    console.log('API 호출 성공');
    return data;
    
  } catch (e) {
    clearTimeout(timeout);
    console.error('API 호출 실패:', e);
    
    // 네트워크 오류 등에서도 다른 키로 재시도
    if (attempt < window.apiKeys.length - 1 && !e.message.includes('할당량')) {
      console.log('네트워크 오류로 다른 API 키로 재시도');
      window.nextKey();
      return yt(endpoint, params, attempt + 1);
    }
    
    throw e;
  }
}

// 채널 ID 추출 함수 - 채널명 검색 우선
async function extractChannelId(input) {
  if (!input) return null;
  
  input = input.trim();
  console.log('채널 ID 추출 시도:', input);
  
  // 이미 채널 ID인 경우
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) {
    console.log('유효한 채널 ID 감지');
    return input;
  }
  
  // 채널 URL에서 ID 추출
  let match = input.match(/(?:youtube\.com|youtu\.be)\/channel\/([a-zA-Z0-9_-]+)/);
  if (match) {
    console.log('채널 URL에서 ID 추출:', match[1]);
    return match[1];
  }
  
  // @핸들 처리
  match = input.match(/@([a-zA-Z0-9_-]+)/);
  if (match) {
    console.log('핸들 감지, 검색 시도:', match[1]);
    try {
      const searchRes = await yt('search', {
        part: 'snippet',
        q: '@' + match[1],
        type: 'channel',
        maxResults: 5
      });
      
      const channels = searchRes.items || [];
      if (channels.length === 0) {
        throw new Error('해당 핸들의 채널을 찾을 수 없습니다.');
      }
      
      if (channels.length === 1) {
        return channels[0].snippet.channelId;
      }
      
      return await showChannelSelectionModal(channels, input);
    } catch (e) {
      console.error('핸들 검색 실패:', e);
      throw e;
    }
  }

  // 영상 URL에서 채널 ID 추출
  match = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (match) {
    console.log('영상 URL 감지, 채널 정보 조회:', match[1]);
    try {
      const videoRes = await yt('videos', {
        part: 'snippet',
        id: match[1]
      });
      const channelId = videoRes.items?.[0]?.snippet?.channelId;
      if (!channelId) {
        throw new Error('영상 정보를 찾을 수 없습니다.');
      }
      console.log('영상에서 채널 ID 추출:', channelId);
      return channelId;
    } catch (e) {
      console.error('영상 정보 조회 실패:', e);
      throw e;
    }
  }

  // 채널명으로 검색 (핵심 기능) - 다양한 검색어로 시도
  console.log('채널명으로 검색 시도:', input);
  try {
    // 첫 번째 시도: 정확한 채널명
    let searchRes = await yt('search', {
      part: 'snippet',
      q: `"${input}"`,
      type: 'channel',
      maxResults: 10
    });
    
    let channels = searchRes.items || [];
    
    // 정확한 검색 결과가 없으면 일반 검색
    if (channels.length === 0) {
      console.log('정확한 검색 결과 없음, 일반 검색 시도');
      searchRes = await yt('search', {
        part: 'snippet',
        q: input,
        type: 'channel',
        maxResults: 10
      });
      channels = searchRes.items || [];
    }
    
    // 여전히 결과 없으면 부분 검색
    if (channels.length === 0) {
      console.log('일반 검색 결과 없음, 부분 검색 시도');
      const keywords = input.split(' ').filter(word => word.length > 1);
      if (keywords.length > 0) {
        searchRes = await yt('search', {
          part: 'snippet',
          q: keywords.join(' OR '),
          type: 'channel',
          maxResults: 10
        });
        channels = searchRes.items || [];
      }
    }
    
    if (channels.length === 0) {
      throw new Error(`"${input}"와 관련된 채널을 찾을 수 없습니다. 다른 검색어를 시도해보세요.`);
    }
    
    // 정확한 일치 찾기
    const exactMatch = channels.find(ch => 
      ch.snippet.title.toLowerCase() === input.toLowerCase() ||
      ch.snippet.title.toLowerCase().includes(input.toLowerCase())
    );
    
    if (exactMatch && channels.length > 1) {
      // 정확한 일치가 있지만 여러 결과가 있을 때 확인 요청
      const confirmed = await showChannelConfirmModal(exactMatch, input);
      if (confirmed) {
        return exactMatch.snippet.channelId;
      }
      // 확인 거부시 선택 모달로 이동
    }
    
    if (channels.length === 1) {
      console.log('검색 결과 1개, 자동 선택');
      return channels[0].snippet.channelId;
    }
    
    // 여러 개 결과가 있으면 선택 UI 표시
    console.log('검색 결과 여러 개, 선택 UI 표시');
    return await showChannelSelectionModal(channels, input);
    
  } catch (e) {
    console.error('채널명 검색 실패:', e);
    throw e;
  }
}

// 채널 확인 모달 (정확한 일치 발견시)
async function showChannelConfirmModal(channel, searchQuery) {
  return new Promise((resolve) => {
    const modalHtml = `
      <div id="channel-confirm-modal" class="modal" style="display: flex;">
        <div class="modal-content">
          <h3>✅ 채널을 찾았습니다!</h3>
          <p class="modal-description">"${searchQuery}" 검색 결과:</p>
          <div class="channel-confirm-item" style="
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 20px;
            border: 2px solid var(--brand);
            border-radius: 12px;
            background: var(--glass-bg);
            margin: 16px 0;
          ">
            <img src="${channel.snippet.thumbnails?.default?.url || ''}" alt="${channel.snippet.title}" style="
              width: 60px;
              height: 60px;
              border-radius: 12px;
              object-fit: cover;
            ">
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 18px; margin-bottom: 8px;">${channel.snippet.title}</div>
              <div style="font-size: 14px; color: var(--muted); line-height: 1.4;">${channel.snippet.description ? window.truncateText(channel.snippet.description, 100) : '설명 없음'}</div>
            </div>
          </div>
          <div class="modal-actions">
            <button id="confirm-channel-yes" class="btn btn-primary">네, 이 채널입니다</button>
            <button id="confirm-channel-no" class="btn btn-secondary">아니요, 다른 채널 보기</button>
          </div>
        </div>
      </div>
    `;
    
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('channel-confirm-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // 새 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('channel-confirm-modal');
    
    // 이벤트 처리
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'confirm-channel-yes') {
        console.log('채널 확인됨:', channel.snippet.channelId);
        modal.remove();
        resolve(true);
      } else if (e.target.id === 'confirm-channel-no') {
        console.log('채널 확인 거부, 선택 모달로 이동');
        modal.remove();
        resolve(false);
      } else if (e.target === modal) {
        console.log('모달 외부 클릭으로 거부');
        modal.remove();
        resolve(false);
      }
    });
  });
}

// 채널 선택 모달 표시
async function showChannelSelectionModal(channels, searchQuery) {
  return new Promise((resolve) => {
    const modalHtml = `
      <div id="channel-selection-modal" class="modal" style="display: flex;">
        <div class="modal-content modal-large">
          <span class="close" onclick="this.closest('.modal').remove(); return false;">&times;</span>
          <h3>🔍 "${searchQuery}" 검색 결과</h3>
          <p class="modal-description">여러 채널이 검색되었습니다. 추가할 채널을 선택해주세요:</p>
          <div class="channel-selection-list" style="max-height: 400px; overflow-y: auto;">
            ${channels.map((ch, index) => `
              <div class="channel-selection-item" data-channel-id="${ch.snippet.channelId}" style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border: 2px solid var(--border);
                border-radius: 8px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
              ">
                <img src="${ch.snippet.thumbnails?.default?.url || ''}" alt="${ch.snippet.title}" style="
                  width: 48px;
                  height: 48px;
                  border-radius: 8px;
                  object-fit: cover;
                  border: 1px solid var(--border);
                ">
                <div style="flex: 1;">
                  <div style="font-weight: 700; margin-bottom: 4px; font-size: 14px;">${ch.snippet.title}</div>
                  <div style="font-size: 12px; color: var(--muted); line-height: 1.3;">
                    ${ch.snippet.description ? window.truncateText(ch.snippet.description, 80) : '설명 없음'}
                  </div>
                </div>
                <button class="btn btn-primary btn-select-channel" data-channel-id="${ch.snippet.channelId}">선택</button>
              </div>
            `).join('')}
          </div>
          <div class="modal-actions">
            <button id="cancel-channel-selection" class="btn btn-secondary">취소</button>
          </div>
        </div>
      </div>
    `;
    
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('channel-selection-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // 새 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('channel-selection-modal');
    
    // 선택 이벤트
    modal.addEventListener('click', (e) => {
      const selectBtn = e.target.closest('.btn-select-channel');
      if (selectBtn) {
        const channelId = selectBtn.dataset.channelId;
        console.log('채널 선택됨:', channelId);
        modal.remove();
        resolve(channelId);
        return;
      }
      
      // 채널 아이템 더블클릭으로 선택
      const channelItem = e.target.closest('.channel-selection-item');
      if (channelItem) {
        // 기존 선택 제거
        modal.querySelectorAll('.channel-selection-item').forEach(item => {
          item.style.background = '';
          item.style.borderColor = 'var(--border)';
        });
        
        // 현재 아이템 선택 표시
        channelItem.style.background = 'var(--glass-bg)';
        channelItem.style.borderColor = 'var(--brand)';
        
        // 더블클릭 처리
        if (channelItem.dataset.lastClick && Date.now() - channelItem.dataset.lastClick < 300) {
          const channelId = channelItem.dataset.channelId;
          console.log('채널 더블클릭으로 선택됨:', channelId);
          modal.remove();
          resolve(channelId);
          return;
        }
        channelItem.dataset.lastClick = Date.now();
      }
      
      // 취소 버튼
      if (e.target.id === 'cancel-channel-selection') {
        console.log('채널 선택 취소됨');
        modal.remove();
        resolve(null);
      }
      
      // 모달 외부 클릭
      if (e.target === modal) {
        console.log('모달 외부 클릭으로 취소');
        modal.remove();
        resolve(null);
      }
    });
    
    // 호버 효과
    modal.addEventListener('mouseover', (e) => {
      const channelItem = e.target.closest('.channel-selection-item');
      if (channelItem && !channelItem.style.borderColor.includes('var(--brand)')) {
        channelItem.style.background = 'var(--glass-bg)';
      }
    });
    
    modal.addEventListener('mouseout', (e) => {
      const channelItem = e.target.closest('.channel-selection-item');
      if (channelItem && !channelItem.style.borderColor.includes('var(--brand)')) {
        channelItem.style.background = '';
      }
    });
  });
}

// 전역으로 노출
window.yt = yt;
window.extractChannelId = extractChannelId;
window.showChannelSelectionModal = showChannelSelectionModal;
window.showChannelConfirmModal = showChannelConfirmModal;

console.log('api.js 로딩 완료');