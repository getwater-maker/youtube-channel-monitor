// ========== [1] 유튜브 채널 정보 + 최신 영상 조회 ==========

async function fetchChannelInfoAndVideos(channelInput, apiKey) {
  const query = encodeURIComponent(channelInput);
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${query}&key=${apiKey}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();

  if (!searchData.items || searchData.items.length === 0) return null;

  const item = searchData.items[0];
  const channelId = item.snippet.channelId;
  const title = item.snippet.title;
  const thumbnail = item.snippet.thumbnails.default.url;

  // 채널 구독자 수
  const statsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
  const statsRes = await fetch(statsUrl);
  const statsData = await statsRes.json();
  const subscriberCount = Number(statsData.items?.[0]?.statistics?.subscriberCount || 0);

  // 업로드된 영상 (playlistId 생성)
  const uploadsPlaylistId = `UU${channelId.substring(2)}`;
  const videosUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${uploadsPlaylistId}&key=${apiKey}`;
  const videosRes = await fetch(videosUrl);
  const videosData = await videosRes.json();

  const videos = [];

  for (const v of videosData.items || []) {
    const videoId = v.snippet.resourceId.videoId;
    const title = v.snippet.title;
    const thumbnail = v.snippet.thumbnails?.default?.url || '';
    videos.push({ videoId, title, thumbnail });
  }

  // 영상들의 조회수 가져오기
  const videoIds = videos.map(v => v.videoId).join(',');
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`;
  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();

  detailsData.items?.forEach((item, idx) => {
    videos[idx].viewCount = Number(item.statistics.viewCount || 0);
    videos[idx].highlight = videos[idx].viewCount >= subscriberCount * 2;
  });

  return {
    id: channelId,
    title,
    thumbnail,
    subscriberCount,
    videos
  };
}

// ========== [2] 채널 추가 버튼 ==========
document.getElementById('add-channel-confirm-btn')?.addEventListener('click', async () => {
  const input = document.getElementById('channel-input').value.trim();
  if (!input) return alert("채널 입력이 비어 있습니다.");

  const apiKey = document.getElementById('api-key-1')?.value.trim();
  if (!apiKey) return alert("API 키가 입력되어야 합니다.");

  const channelData = await fetchChannelInfoAndVideos(input, apiKey);
  if (!channelData) return alert("채널 정보를 가져오지 못했습니다.");

  const container = document.getElementById('monitoring-channel-grid');

  const el = document.createElement('div');
  el.className = 'channel-item';
  el.innerHTML = `
    <div class="channel-item-header">
      <div class="channel-info-with-logo">
        <img src="${channelData.thumbnail}" class="channel-logo" />
        <div class="channel-text-info">
          <div class="channel-name">${channelData.title}</div>
          <div class="channel-subscribers">구독자: ${channelData.subscriberCount.toLocaleString()}</div>
        </div>
      </div>
      <div class="channel-actions">
        <button class="btn-icon delete" title="삭제">🗑️</button>
      </div>
    </div>
    <div class="video-list">
      ${channelData.videos.map(v => `
        <div class="video-item ${v.highlight ? 'highlight' : ''}">
          <img src="${v.thumbnail}" />
          <span>${v.title} (${v.viewCount.toLocaleString()} 조회)</span>
        </div>
      `).join('')}
    </div>
  `;
  container.appendChild(el);

  document.getElementById('monitoring-channel-count').textContent =
    container.querySelectorAll('.channel-item').length;

  el.querySelector('.btn-icon.delete').addEventListener('click', () => {
    el.remove();
    document.getElementById('monitoring-channel-count').textContent =
      container.querySelectorAll('.channel-item').length;
  });

  document.getElementById('channel-modal').style.display = 'none';
  document.getElementById('channel-input').value = '';
});

// ========== [3] 기타 UI 기능 ==========

// 탭 전환
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// API 설정 모달
document.getElementById('api-settings-btn').addEventListener('click', () => {
  document.getElementById('api-modal').style.display = 'block';
});
document.getElementById('cancel-api-btn').addEventListener('click', () => {
  document.getElementById('api-modal').style.display = 'none';
});
document.getElementById('save-api-btn').addEventListener('click', () => {
  const keys = [];
  for (let i = 1; i <= 5; i++) {
    const key = document.getElementById(`api-key-${i}`)?.value.trim();
    if (key) keys.push(key);
  }
  console.log("저장된 API 키:", keys);
  document.getElementById('api-status-text').textContent =
    keys.length ? `${keys.length}개 키 사용 중` : 'API 키 설정 필요';
  document.getElementById('api-modal').style.display = 'none';
});

// 채널 모달 열기/닫기
document.getElementById('add-monitoring-channel-btn')?.addEventListener('click', () => {
  document.getElementById('channel-modal').style.display = 'block';
});
document.getElementById('cancel-channel-btn')?.addEventListener('click', () => {
  document.getElementById('channel-modal').style.display = 'none';
});

// 접기/펼치기
function toggleChannelManagementSection(section) {
  const grid = document.getElementById(`${section}-channel-grid`);
  const collapseBtn = document.getElementById(`${section}-collapse-btn`);
  if (!grid || !collapseBtn) return;
  if (grid.style.display === 'none') {
    grid.style.display = '';
    collapseBtn.textContent = '▼';
  } else {
    grid.style.display = 'none';
    collapseBtn.textContent = '▲';
  }
}
