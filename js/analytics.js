// js/analytics.js
import { kvGet } from './indexedStore.js'; // [추가] IndexedDB에서 값을 가져오기 위한 함수 임포트

// [삭제] 하드코딩된 CLIENT_ID 상수
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

const UI = {
  authBtn: null,
  signoutBtn: null,
  authStatus: null,
  content: null,
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

// [수정] gisLoaded 함수가 저장된 Client ID를 비동기로 불러오도록 변경
async function gisLoaded() {
  const clientId = await kvGet('oauthClientId');
  if (!clientId) {
    UI.authBtn.style.visibility = 'visible';
    UI.authBtn.disabled = true;
    UI.authStatus.textContent = "OAuth 클라이언트 ID가 설정되지 않았습니다. 상단의 '인증 정보 설정' 버튼을 눌러 ID를 입력해주세요.";
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId, // 저장된 값 사용
    scope: SCOPES,
    callback: '', // A blank callback avoids a redirect.
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    UI.authBtn.style.visibility = 'visible';
    UI.authBtn.disabled = false; // [수정] ID가 있을 경우 버튼 활성화
  }
}

function handleAuthClick() {
  // [수정] tokenClient가 초기화되지 않았을 경우를 대비
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
  }
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
    if (!data.rows || data.rows.length === 0) {
        UI.content.innerHTML = `<div class="empty-state">선택한 기간에 대한 분석 데이터가 없습니다.</div>`;
        return;
    }

    const labels = data.rows.map(row => row[0]); // 날짜
    const viewsData = data.rows.map(row => row[1]);
    const watchTimeData = data.rows.map(row => row[2]);

    const totalViews = viewsData.reduce((a, b) => a + b, 0);
    const totalWatchTime = watchTimeData.reduce((a, b) => a + b, 0);
    const totalSubscribersGained = data.rows.reduce((a, b) => a + b[4], 0);
    const totalSubscribersLost = data.rows.reduce((a, b) => a + b[5], 0);
    
    UI.content.innerHTML = `
        <div class="analytics-summary">
            <div class="summary-card"><strong>총 조회수</strong><span>${totalViews.toLocaleString()} 회</span></div>
            <div class="summary-card"><strong>총 시청 시간</strong><span>${(totalWatchTime / 60).toFixed(0).toLocaleString()} 시간</span></div>
            <div class="summary-card"><strong>구독자 증감</strong><span>+${totalSubscribersGained.toLocaleString()} / -${totalSubscribersLost.toLocaleString()}</span></div>
        </div>
        <div class="chart-container" style="margin-top: 24px;">
            <canvas id="analytics-chart"></canvas>
        </div>
    `;

    const ctx = document.getElementById('analytics-chart').getContext('d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '일일 조회수',
                    data: viewsData,
                    borderColor: 'var(--brand)',
                    yAxisID: 'y'
                },
                {
                    label: '일일 시청 시간 (분)',
                    data: watchTimeData,
                    borderColor: 'var(--brand-2)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { type: 'linear', display: true, position: 'left' },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    });
}

export function initAnalytics({ mount }) {
  const root = document.querySelector(mount);
  root.innerHTML = `
    <div class="section">
        <div class="section-header">
            <div class="section-title">채널 분석</div>
            <div class="section-actions">
                <button id="authorize_button" class="btn btn-primary" style="visibility: hidden;">Google 계정으로 로그인</button>
                <button id="signout_button" class="btn btn-outline" style="visibility: hidden;">로그아웃</button>
            </div>
        </div>
        <p id="auth-status" class="muted" style="margin-top: -8px; margin-bottom: 16px;"></p>
        <div id="analytics-content">
            <div class="empty-state">
                분석 데이터를 보려면 Google 계정으로 로그인하여 YouTube 채널에 대한 접근 권한을 부여해야 합니다.
            </div>
        </div>
    </div>
  `;

  UI.authBtn = root.querySelector('#authorize_button');
  UI.signoutBtn = root.querySelector('#signout_button');
  UI.authStatus = root.querySelector('#auth-status');
  UI.content = root.querySelector('#analytics-content');
  
  UI.authBtn.onclick = handleAuthClick;
  UI.signoutBtn.onclick = handleSignoutClick;
  
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