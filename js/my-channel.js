// js/my-channel.js
import { kvGet, kvSet } from './indexedStore.js';

const SCOPES = 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube';

let tokenClient;
let gapiInited = false;
let gisInited = false;

const state = {
  myVideos: [],
  filteredVideos: [],
  currentPage: 1,
  itemsPerPage: 9,
  filterPeriod: 'all',
  showShorts: false,
};

const UI = {
  authBtn: null,
  signoutBtn: null,
  authStatus: null,
  content: null,
  myVideosSection: null,
  myVideosList: null,
  paginationContainer: null,
};

function gapiLoaded() {
  gapi.load('client', async () => {
    await gapi.client.init({
      discoveryDocs: [
        "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest",
        "https://www.googleapis.com/discovery/v1/apis/youtubeAnalytics/v2/rest"
      ],
    });
    gapiInited = true;
    
    const token = await kvGet('gapiToken');
    if (token && token.expires_at > Date.now()) {
        gapi.client.setToken(token);
        
        UI.authBtn.style.visibility = 'hidden';
        UI.signoutBtn.style.visibility = 'visible';
        UI.authBtn.innerText = '권한 갱신';
        UI.myVideosSection.style.display = 'block';
        UI.authStatus.textContent = '인증되었습니다. 데이터를 불러옵니다...';
        
        await Promise.all([ listChannelAnalytics(), listMyVideos() ]);
    } else {
        UI.authBtn.style.visibility = 'visible';
    }
    
    maybeEnableButtons();
  });
}

async function gisLoaded() {
  const clientId = await kvGet('oauthClientId');
  if (!clientId) {
    UI.authBtn.style.visibility = 'visible';
    UI.authBtn.disabled = true;
    UI.authStatus.textContent = "OAuth 클라이언트 ID가 설정되지 않았습니다. 상단의 '인증 정보 설정' 버튼을 눌러 ID를 입력해주세요.";
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: '',
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited && !gapi.client.getToken()) {
    UI.authBtn.style.visibility = 'visible';
    UI.authBtn.disabled = false;
  }
}

function handleAuthClick() {
  if (!tokenClient) {
    window.toast('클라이언트 ID가 설정되지 않아 인증을 진행할 수 없습니다.', 'error');
    return;
  }
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      window.toast(`인증 오류: ${resp.error_description || resp.error || '알 수 없는 오류'}`, 'error');
      throw (resp);
    }
    
    const token = gapi.client.getToken();
    token.expires_at = Date.now() + (token.expires_in * 1000);
    await kvSet('gapiToken', token);
    
    UI.authBtn.style.visibility = 'hidden';
    UI.signoutBtn.style.visibility = 'visible';
    UI.authBtn.innerText = '권한 갱신';
    UI.myVideosSection.style.display = 'block';
    UI.authStatus.textContent = '인증되었습니다. 데이터를 불러옵니다...';
    
    await Promise.all([
      listChannelAnalytics(),
      listMyVideos()
    ]);
  };
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({prompt: 'consent'});
  } else {
    tokenClient.requestAccessToken({prompt: ''});
  }
}

async function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken(null);
    await kvSet('gapiToken', null);
    
    UI.content.innerHTML = '';
    UI.authStatus.textContent = '내 채널의 분석 데이터를 보거나 영상을 관리하려면 Google 계정으로 로그인하여 권한을 부여해야 합니다.';
    UI.authBtn.innerText = 'Google 계정으로 로그인';
    UI.authBtn.style.visibility = 'visible';
    UI.signoutBtn.style.visibility = 'hidden';
    UI.myVideosSection.style.display = 'none';
    UI.myVideosList.innerHTML = '';
    UI.paginationContainer.innerHTML = '';
  }
}

function secFromISO(iso){
  if (!iso || typeof iso !== 'string') return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const hours = parseInt(m[1] || 0, 10);
  const minutes = parseInt(m[2] || 0, 10);
  const seconds = parseInt(m[3] || 0, 10);
  return (hours * 3600) + (minutes * 60) + seconds;
}


function applyFiltersAndRenderMyVideos() {
  let videos = [...state.myVideos];

  if (state.filterPeriod !== 'all') {
    const now = new Date();
    const days = { '1w': 7, '1m': 30 }[state.filterPeriod];
    videos = videos.filter(v => {
      const publishedDate = new Date(v.snippet.publishedAt);
      return (now - publishedDate) / (1000 * 60 * 60 * 24) <= days;
    });
  }

  if (!state.showShorts) {
    videos = videos.filter(v => secFromISO(v.contentDetails.duration) > 60);
  }

  state.filteredVideos = videos;
  state.currentPage = 1;
  renderMyVideoGrid();
  renderPagination();
}

function renderMyVideoGrid() {
  UI.myVideosList.innerHTML = '';
  const videos = state.filteredVideos;

  if (videos.length === 0) {
    UI.myVideosList.innerHTML = '<div class="empty-state">표시할 영상이 없습니다. 필터를 조정해보세요.</div>';
    return;
  }

  const start = (state.currentPage - 1) * state.itemsPerPage;
  const end = start + state.itemsPerPage;
  const paginatedItems = videos.slice(start, end);

  const grid = document.createElement('div');
  grid.className = 'video-grid';

  paginatedItems.forEach(video => {
    const v = {
      id: video.id,
      title: video.snippet.title,
      thumb: video.snippet.thumbnails.medium.url,
      views: Number(video.statistics.viewCount || 0).toLocaleString(),
      publishedAt: new Date(video.snippet.publishedAt).toLocaleDateString(),
    };

    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
      <div class="thumb-wrap">
        <a href="https://youtu.be/${v.id}" target="_blank" rel="noopener">
          <img class="thumb" src="${v.thumb}" alt="${v.title}">
        </a>
      </div>
      <div class="video-body">
        <div class="title">${v.title}</div>
        <div class="v-meta" style="margin-top:12px;">
          <div class="v-meta-top">
            <span>조회수 ${v.views}회</span>
            <span class="muted">${v.publishedAt}</span>
          </div>
        </div>
      </div>
      <div class="video-actions">
        <a href="https://studio.youtube.com/video/${v.id}/edit" target="_blank" rel="noopener" class="btn btn-sm btn-outline">스튜디오에서 수정</a>
        <button class="btn btn-sm btn-primary btn-edit-video" data-id="${v.id}">수정</button>
      </div>
    `;
    card.querySelector('.btn-edit-video').onclick = () => showEditModal(video);
    grid.appendChild(card);
  });
  UI.myVideosList.appendChild(grid);
}

function renderPagination() {
  UI.paginationContainer.innerHTML = '';
  const totalPages = Math.ceil(state.filteredVideos.length / state.itemsPerPage);
  if (totalPages <= 1) return;

  const nav = document.createElement('nav');
  nav.className = 'pagination';
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = `btn btn-sm ${i === state.currentPage ? 'active' : ''}`;
    btn.textContent = i;
    btn.onclick = () => {
      state.currentPage = i;
      renderMyVideoGrid();
      renderPagination();
      UI.myVideosSection.scrollIntoView({ behavior: 'smooth' });
    };
    nav.appendChild(btn);
  }
  UI.paginationContainer.appendChild(nav);
}

async function listMyVideos() {
  UI.myVideosList.innerHTML = '<div class="loading-state">내 영상 목록을 불러오는 중...</div>';
  try {
    let allVideos = [];
    let nextPageToken = null;
    do {
      const response = await gapi.client.youtube.search.list({
        part: 'snippet', forMine: true, type: 'video', maxResults: 50, pageToken: nextPageToken,
      });
      const videoIds = response.result.items.map(item => item.id.videoId).join(',');
      if (videoIds) {
        const detailsResponse = await gapi.client.youtube.videos.list({
          part: 'snippet,statistics,contentDetails', id: videoIds,
        });
        allVideos.push(...detailsResponse.result.items);
      }
      nextPageToken = response.result.nextPageToken;
    } while (nextPageToken);

    state.myVideos = allVideos.sort((a,b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt));
    applyFiltersAndRenderMyVideos();
  } catch (err) {
    console.error('내 영상 목록 로딩 실패:', err);
    UI.myVideosList.innerHTML = `<div class="empty-state error">내 영상 목록을 불러오는 데 실패했습니다. API 할당량을 확인해주세요.</div>`;
  }
}

async function listChannelAnalytics() {
  try {
    const channelResponse = await gapi.client.youtube.channels.list({
        'part': 'snippet,statistics',
        'mine': true
    });
    
    if (!channelResponse.result.items || channelResponse.result.items.length === 0) {
        UI.content.innerHTML = `<div class="empty-state error">연결된 계정에서 YouTube 채널을 찾을 수 없습니다.</div>`;
        return;
    }
    const channel = channelResponse.result.items[0];
    const channelId = channel.id;
    UI.authStatus.textContent = `'${channel.snippet.title}' 채널의 분석 데이터를 불러옵니다...`;

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);

    const analyticsResponse = await gapi.client.youtubeAnalytics.reports.query({
        'ids': `channel==${channelId}`,
        'startDate': startDate,
        'endDate': endDate,
        'metrics': 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost',
    });
    
    renderAnalytics(analyticsResponse.result);

  } catch (err) {
    console.error('분석 데이터 로딩 실패:', err);
    UI.content.innerHTML = `<div class="empty-state error">분석 데이터를 불러오는 데 실패했습니다: ${err.result.error.message}</div>`;
  }
}

function renderAnalytics(data) {
    if (!data || !data.rows || data.rows.length === 0) {
        UI.content.innerHTML = `<div class="empty-state">분석 데이터가 없습니다.</div>`;
        return;
    }
    const totalViews = data.rows[0][0];
    const totalWatchTimeInMinutes = data.rows[0][1];
    const totalSubscribersGained = data.rows[0][3];
    const totalSubscribersLost = data.rows[0][4];

    const totalWatchTimeInHours = (totalWatchTimeInMinutes / 60).toFixed(1);
    
    UI.content.innerHTML = `
        <div class="analytics-summary">
            <div class="summary-card"><strong>최근 30일 조회수</strong><span>${totalViews.toLocaleString()} 회</span></div>
            <div class="summary-card"><strong>최근 30일 시청 시간(시간)</strong><span>${totalWatchTimeInHours}</span></div>
            <div class="summary-card"><strong>최근 30일 구독자 증감</strong><span>+${totalSubscribersGained.toLocaleString()} / -${totalSubscribersLost.toLocaleString()}</span></div>
        </div>
    `;
}

// [수정] 즉시 제목 변경을 위한 헬퍼 함수 추가
async function updateVideoTitle(videoId, newTitle, categoryId, buttonElement) {
    buttonElement.textContent = '변경 중...';
    buttonElement.disabled = true;
    try {
        await gapi.client.youtube.videos.update({
            part: 'snippet',
            resource: {
                id: videoId,
                snippet: {
                    title: newTitle,
                    categoryId: categoryId 
                }
            }
        });
        window.toast('제목이 성공적으로 변경되었습니다!', 'success');
        await listMyVideos(); // 변경사항을 반영하기 위해 목록 새로고침
    } catch (err) {
        console.error('제목 업데이트 실패:', err);
        window.toast(`제목 변경 실패: ${err.result.error.message}`, 'error', 4000);
    } finally {
        buttonElement.textContent = '변경';
        buttonElement.disabled = false;
    }
}


function showEditModal(video) {
  document.getElementById('edit-video-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'edit-video-modal';
  overlay.className = 'sp-modal-overlay';

  // [수정] 팝업창 HTML 구조 변경
  overlay.innerHTML = `
    <div class="sp-modal" style="max-width: 960px;">
      <div class="sp-modal-head">
        <div class="sp-modal-title">영상 정보 수정</div>
        <button class="sp-modal-close">&times;</button>
      </div>
      <div class="sp-modal-body">
        <div class="edit-modal-grid">
          <div class="edit-form">
            <label for="edit-title">현재 제목</label>
            <textarea id="edit-title" rows="3"></textarea>

            <div class="title-suggestion-group">
                <label>대체 제목 제안</label>
                <div class="title-suggestion-row">
                    <textarea id="edit-title-suggestion-1" rows="3" placeholder="대체 제목 1..."></textarea>
                    <button id="btn-apply-suggestion-1" class="btn btn-sm btn-outline">변경</button>
                </div>
                <div class="title-suggestion-row">
                    <textarea id="edit-title-suggestion-2" rows="3" placeholder="대체 제목 2..."></textarea>
                    <button id="btn-apply-suggestion-2" class="btn btn-sm btn-outline">변경</button>
                </div>
            </div>

            <label for="edit-desc">설명</label>
            <textarea id="edit-desc" rows="10"></textarea>
          </div>
          <div class="edit-thumb">
            <label>썸네일</label>
            <img id="thumb-preview" src="${video.snippet.thumbnails.high.url}" alt="썸네일 미리보기">
            <input type="file" id="thumb-upload" accept="image/jpeg,image/png" style="display:none;">
            <button id="btn-thumb-upload" class="btn btn-outline" style="width:100%; margin-top:10px;">새 썸네일 업로드</button>
          </div>
        </div>
      </div>
      <div class="sp-modal-footer">
        <button id="btn-edit-cancel" class="btn btn-outline">취소</button>
        <button id="btn-edit-save" class="btn btn-primary">전체 저장</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const titleInput = overlay.querySelector('#edit-title');
  const descInput = overlay.querySelector('#edit-desc');
  const suggestion1Input = overlay.querySelector('#edit-title-suggestion-1');
  const suggestion2Input = overlay.querySelector('#edit-title-suggestion-2');
  const applyBtn1 = overlay.querySelector('#btn-apply-suggestion-1');
  const applyBtn2 = overlay.querySelector('#btn-apply-suggestion-2');
  
  const thumbPreview = overlay.querySelector('#thumb-preview');
  const thumbUploadInput = overlay.querySelector('#thumb-upload');
  const saveBtn = overlay.querySelector('#btn-edit-save');
  
  titleInput.value = video.snippet.title;
  descInput.value = video.snippet.description;

  const closeModal = () => overlay.remove();
  overlay.querySelector('.sp-modal-close').onclick = closeModal;
  overlay.querySelector('#btn-edit-cancel').onclick = closeModal;
  overlay.querySelector('#btn-thumb-upload').onclick = () => thumbUploadInput.click();

  // '변경' 버튼 이벤트 리스너 추가
  applyBtn1.onclick = () => {
    const newTitle = suggestion1Input.value.trim();
    if (newTitle) {
      titleInput.value = newTitle; // 현재 제목 칸에도 반영
      updateVideoTitle(video.id, newTitle, video.snippet.categoryId, applyBtn1);
    } else {
      window.toast('제목을 입력해주세요.', 'warning');
    }
  };
  applyBtn2.onclick = () => {
    const newTitle = suggestion2Input.value.trim();
    if (newTitle) {
      titleInput.value = newTitle; // 현재 제목 칸에도 반영
      updateVideoTitle(video.id, newTitle, video.snippet.categoryId, applyBtn2);
    } else {
      window.toast('제목을 입력해주세요.', 'warning');
    }
  };

  thumbUploadInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
          window.toast('썸네일 파일은 2MB를 초과할 수 없습니다.', 'error');
          thumbUploadInput.value = ''; // 파일 선택 초기화
          return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        thumbPreview.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // '전체 저장' 버튼 로직
  saveBtn.onclick = async () => {
    saveBtn.textContent = '저장 중...';
    saveBtn.disabled = true;

    try {
      await gapi.client.youtube.videos.update({
        part: 'snippet',
        resource: {
          id: video.id,
          snippet: {
            title: titleInput.value,
            description: descInput.value,
            categoryId: video.snippet.categoryId
          }
        }
      });
      window.toast('제목/설명 저장 완료!', 'success');

      const file = thumbUploadInput.files[0];
      if (file) {
        await uploadThumbnail(video.id, file);
      }
      
      await listMyVideos();
      closeModal();

    } catch (err) {
      console.error('영상 업데이트 실패:', err);
      window.toast(`저장 실패: ${err.result.error.message}`, 'error', 4000);
    } finally {
      saveBtn.textContent = '전체 저장';
      saveBtn.disabled = false;
    }
  };
}

async function uploadThumbnail(videoId, file) {
    const token = gapi.client.getToken().access_token;
    const response = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': file.type,
        },
        body: file,
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || '썸네일 업로드 실패');
    }
    window.toast('썸네일 저장 완료!', 'success');
}

export function initMyChannel({ mount }) {
  const root = document.querySelector(mount);
  root.innerHTML = `
    <div class="section">
      <div class="section-header">
        <div class="section-title">내 채널 관리</div>
        <div class="section-actions">
          <button id="authorize_button" class="btn btn-primary" style="visibility: hidden;">Google 계정으로 로그인</button>
          <button id="signout_button" class="btn btn-outline" style="visibility: hidden;">로그아웃</button>
        </div>
      </div>
      <div id="auth-status" class="muted" style="margin-top: -8px; margin-bottom: 16px;">
          내 채널의 분석 데이터를 보거나 영상을 관리하려면 Google 계정으로 로그인하여 권한을 부여해야 합니다.
      </div>
      <div id="analytics-content"></div>
    </div>

    <div id="my-videos-section" class="section" style="margin-top: 18px; display: none;">
      <div class="section-header my-videos-toolbar">
        <div class="section-title">내 영상 목록</div>
        <div class="section-actions">
          <div class="group">
            <span class="chip" data-period="1w">최근 1주</span>
            <span class="chip" data-period="1m">최근 1개월</span>
            <span class="chip active" data-period="all">전체</span>
          </div>
          <div class="group">
             <span id="btn-toggle-shorts" class="chip">쇼츠 포함</span>
          </div>
          <button id="btn-load-my-videos" class="btn btn-primary btn-sm">목록 새로고침</button>
        </div>
      </div>
      <div id="my-videos-list"></div>
      <div id="my-videos-pagination"></div>
    </div>
  `;

  UI.authBtn = root.querySelector('#authorize_button');
  UI.signoutBtn = root.querySelector('#signout_button');
  UI.authStatus = root.querySelector('#auth-status');
  UI.content = root.querySelector('#analytics-content');
  UI.myVideosSection = root.querySelector('#my-videos-section');
  UI.myVideosList = root.querySelector('#my-videos-list');
  UI.paginationContainer = root.querySelector('#my-videos-pagination');
  
  UI.authBtn.onclick = handleAuthClick;
  UI.signoutBtn.onclick = handleSignoutClick;
  
  root.querySelector('#btn-load-my-videos').onclick = listMyVideos;

  root.querySelectorAll('[data-period]').forEach(btn => {
    btn.onclick = () => {
      root.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterPeriod = btn.dataset.period;
      applyFiltersAndRenderMyVideos();
    };
  });
  
  const shortsBtn = root.querySelector('#btn-toggle-shorts');
  shortsBtn.onclick = () => {
    state.showShorts = !state.showShorts;
    shortsBtn.classList.toggle('active', state.showShorts);
    applyFiltersAndRenderMyVideos();
  };

  const gapiScript = document.createElement('script');
  gapiScript.src = 'https://apis.google.com/js/api.js';
  gapiScript.async = true;
  gapiScript.defer = true;
  gapiScript.onload = gapiLoaded;
  document.body.appendChild(gapiScript);

  const gisScript = document.createElement('script');
  gisScript.src = 'https://accounts.google.com/gsi/client';
  gisScript.async = true;
  gisScript.defer = true;
  gisScript.onload = gisLoaded;
  document.body.appendChild(gisScript);
}