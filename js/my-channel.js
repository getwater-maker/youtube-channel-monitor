// js/my-channel.js
import { kvGet } from './indexedStore.js';

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest';
// [수정] 동영상 수정을 위해 더 높은 권한(youtube.force-ssl)을 포함한 SCOPES로 변경합니다.
const SCOPES = 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl';

let tokenClient;
let gapiInited = false;
let gisInited = false;

const UI = {
  authBtn: null,
  signoutBtn: null,
  authStatus: null,
  content: null,
  myVideosSection: null, // [추가] 내 영상 목록을 표시할 영역
};

function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
  maybeEnableButtons();
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
  if (gapiInited && gisInited) {
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
      throw (resp);
    }
    UI.signoutBtn.style.visibility = 'visible';
    UI.authBtn.innerText = '권한 갱신';
    UI.myVideosSection.style.display = 'block'; // [추가] 로그인 성공 시 내 영상 섹션 표시
    UI.authStatus.textContent = '인증되었습니다. 데이터를 불러옵니다...';
    await listChannelAnalytics();
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({prompt: 'consent'});
  } else {
    tokenClient.requestAccessToken({prompt: ''});
  }
}

function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
    UI.content.innerHTML = '<div class="empty-state">로그아웃되었습니다.</div>';
    UI.authStatus.textContent = '';
    UI.authBtn.innerText = 'Google 계정으로 로그인';
    UI.signoutBtn.style.visibility = 'hidden';
    UI.myVideosSection.style.display = 'none'; // [추가] 로그아웃 시 내 영상 섹션 숨김
    UI.myVideosSection.querySelector('#my-videos-list').innerHTML = ''; // [추가] 목록 초기화
  }
}

// [추가] 내 채널의 모든 동영상 목록을 가져오는 함수
async function listMyVideos() {
  const listContainer = UI.myVideosSection.querySelector('#my-videos-list');
  listContainer.innerHTML = '<div class="loading-state">내 영상 목록을 불러오는 중...</div>';
  
  try {
    let videos = [];
    let nextPageToken = null;

    // 페이지를 넘기며 모든 영상을 가져옵니다.
    do {
      const response = await gapi.client.youtube.search.list({
        part: 'snippet',
        forMine: true,
        type: 'video',
        maxResults: 50,
        pageToken: nextPageToken,
      });

      const videoIds = response.result.items.map(item => item.id.videoId).join(',');
      
      if (videoIds) {
        const detailsResponse = await gapi.client.youtube.videos.list({
          part: 'snippet,statistics',
          id: videoIds,
        });
        videos.push(...detailsResponse.result.items);
      }
      
      nextPageToken = response.result.nextPageToken;
    } while (nextPageToken);

    renderMyVideos(videos);
  } catch (err) {
    console.error('내 영상 목록 로딩 실패:', err);
    listContainer.innerHTML = `<div class="empty-state error">내 영상 목록을 불러오는 데 실패했습니다: ${err.result.error.message}</div>`;
  }
}

// [추가] 가져온 내 영상 목록을 화면에 그리는 함수
function renderMyVideos(videos) {
  const listContainer = UI.myVideosSection.querySelector('#my-videos-list');
  listContainer.innerHTML = '';

  if (!videos || videos.length === 0) {
    listContainer.innerHTML = '<div class="empty-state">업로드된 영상이 없습니다.</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'video-grid';

  videos.forEach(video => {
    const v = {
      id: video.id,
      title: video.snippet.title,
      thumb: video.snippet.thumbnails.medium.url,
      views: Number(video.statistics.viewCount || 0).toLocaleString(),
      publishedAt: new Date(video.snippet.publishedAt).toLocaleDateString(),
    };

    const card = document.createElement('div');
    card.className = 'video-card'; // 기존 카드 스타일 재활용
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
        <button class="btn btn-sm btn-primary btn-edit-video" data-id="${v.id}" disabled>수정 (준비중)</button>
      </div>
    `;
    grid.appendChild(card);
  });
  listContainer.appendChild(grid);
}


async function listChannelAnalytics() {
  try {
    const channelResponse = await gapi.client.youtube.channels.list({
        'part': 'snippet,contentDetails,statistics',
        'mine': true
    });
    
    if (!channelResponse.result.items || channelResponse.result.items.length === 0) {
        UI.content.innerHTML = `<div class="empty-state error">연결된 계정에서 YouTube 채널을 찾을 수 없습니다.</div>`;
        return;
    }
    const channel = channelResponse.result.items[0];
    const channelId = channel.id;

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
        'dimensions': 'day',
        'sort': 'day'
    });
    
    UI.authStatus.textContent = `'${channel.snippet.title}' 채널의 최근 30일 데이터`;
    renderAnalytics(analyticsResponse.result);

  } catch (err) {
    console.error(err);
    UI.content.innerHTML = `<div class="empty-state error">데이터를 불러오는 데 실패했습니다: ${err.result.error.message}</div>`;
  }
}

function renderAnalytics(data) {
    // ... (이 부분은 기존 analytics.js와 동일합니다) ...
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
        <p id="auth-status" class="muted" style="margin-top: -8px; margin-bottom: 16px;"></p>
        <div id="analytics-content">
            <div class="empty-state">
                내 채널의 분석 데이터를 보거나 영상을 관리하려면 Google 계정으로 로그인하여 권한을 부여해야 합니다.
            </div>
        </div>
    </div>

    <!-- [추가] 내 영상 목록 섹션 -->
    <div id="my-videos-section" class="section" style="margin-top: 18px; display: none;">
      <div class="section-header">
        <div class="section-title">내 영상 목록</div>
        <div class="section-actions">
          <button id="btn-load-my-videos" class="btn btn-primary">목록 새로고침</button>
        </div>
      </div>
      <div id="my-videos-list"></div>
    </div>
  `;

  UI.authBtn = root.querySelector('#authorize_button');
  UI.signoutBtn = root.querySelector('#signout_button');
  UI.authStatus = root.querySelector('#auth-status');
  UI.content = root.querySelector('#analytics-content');
  UI.myVideosSection = root.querySelector('#my-videos-section');
  
  UI.authBtn.onclick = handleAuthClick;
  UI.signoutBtn.onclick = handleSignoutClick;
  
  // [추가] 내 영상 목록 불러오기 버튼 이벤트
  root.querySelector('#btn-load-my-videos').onclick = listMyVideos;

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