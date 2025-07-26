// script.js

// ========== [1] 유튜브 채널 정보 가져오기 ==========
async function fetchChannelData(channelInput, apiKey) {
  const query = encodeURIComponent(channelInput);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${query}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.items && data.items.length > 0) {
    const item = data.items[0];
    return {
      id: item.snippet.channelId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.default.url
    };
  }

  return null;
}

// ========== [2] 탭 전환 ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ========== [3] API 키 모달 열기 / 닫기 ==========
document.getElementById('api-settings-btn').addEventListener('click', () => {
  document.getElementById('api-modal').style.display = 'block';
});

document.getElementById('cancel-api-btn').addEventListener('click', () => {
  document.getElementById('api-modal').style.display = 'none';
});

// ========== [4] API 키 저장 처리 ==========
document.getElementById('save-api-btn').addEventListener('click', () => {
  const keys = [];
  for (let i = 1; i <= 5; i++) {
    const key = document.getElementById(`api-key-${i}`)?.value.trim();
    if (key) keys.push(key);
  }
  console.log("저장된 API 키 목록:", keys);
  document.getElementById('api-status-text').textContent =
    keys.length > 0 ? `${keys.length}개 키 사용 중` : 'API 키 설정 필요';
  document.getElementById('api-modal').style.display = 'none';
});

// ========== [5] 채널 추가 모달 열기 / 닫기 ==========
document.getElementById('add-monitoring-channel-btn')?.addEventListener('click', () => {
  document.getElementById('channel-modal').style.display = 'block';
});

document.getElementById('cancel-channel-btn')?.addEventListener('click', () => {
  document.getElementById('channel-modal').style.display = 'none';
});

// ========== [6] 채널 추가 버튼 클릭 시 YouTube API 호출 후 UI에 추가 ==========
document.getElementById('add-channel-confirm-btn')?.addEventListener('click', async () => {
  const input = document.getElementById('channel-input').value.trim();
  if (!input) return alert("채널 입력이 비어 있습니다.");

  const apiKey = document.getElementById('api-key-1')?.value.trim();
  if (!apiKey) return alert("API 키가 입력되어야 합니다.");

  const channelData = await fetchChannelData(input, apiKey);
  if (!channelData) {
    alert("채널 정보를 찾을 수 없습니다.");
    return;
  }

  const container = document.getElementById('monitoring-channel-grid');

  const el = document.createElement('div');
  el.className = 'channel-item';
  el.innerHTML = `
    <div class="channel-item-header">
      <div class="channel-info-with-logo">
        <img src="${channelData.thumbnail}" class="channel-logo" alt="logo" />
        <div class="channel-text-info">
          <div class="channel-name">${channelData.title}</div>
          <div class="channel-subscribers">조회 대기중...</div>
        </div>
      </div>
      <div class="channel-actions">
        <button class="btn-icon delete" title="삭제">🗑️</button>
      </div>
    </div>
    <div class="channel-id">${channelData.id}</div>
  `;
  container.appendChild(el);

  // 채널 수 업데이트
  document.getElementById('monitoring-channel-count').textContent =
    container.querySelectorAll('.channel-item').length;

  // 삭제 기능
  el.querySelector('.btn-icon.delete').addEventListener('click', () => {
    el.remove();
    document.getElementById('monitoring-channel-count').textContent =
      container.querySelectorAll('.channel-item').length;
  });

  document.getElementById('channel-modal').style.display = 'none';
  document.getElementById('channel-input').value = '';
});

// ========== [7] 채널 리스트 접기 / 펼치기 ==========
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
