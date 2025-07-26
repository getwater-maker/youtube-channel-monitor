// script.js

// ========== 탭 전환 ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ========== API 키 모달 열기 ==========
document.getElementById('api-settings-btn').addEventListener('click', () => {
  document.getElementById('api-modal').style.display = 'block';
});

// API 모달 닫기
document.getElementById('cancel-api-btn').addEventListener('click', () => {
  document.getElementById('api-modal').style.display = 'none';
});

// API 키 저장 (테스트용 - 콘솔 출력)
document.getElementById('save-api-btn').addEventListener('click', () => {
  const keys = [];
  for (let i = 1; i <= 5; i++) {
    const key = document.getElementById(`api-key-${i}`)?.value.trim();
    if (key) keys.push(key);
  }
  console.log("저장된 API 키 목록:", keys);
  document.getElementById('api-status-text').textContent = keys.length > 0 ? `${keys.length}개 키 사용 중` : 'API 키 설정 필요';
  document.getElementById('api-modal').style.display = 'none';
});

// ========== 채널 추가 모달 제어 ==========
document.getElementById('add-monitoring-channel-btn')?.addEventListener('click', () => {
  document.getElementById('channel-modal').style.display = 'block';
});

document.getElementById('cancel-channel-btn')?.addEventListener('click', () => {
  document.getElementById('channel-modal').style.display = 'none';
});

// 채널 추가 (UI에만 표시, 테스트용)
document.getElementById('add-channel-confirm-btn')?.addEventListener('click', () => {
  const input = document.getElementById('channel-input').value.trim();
  if (!input) return alert("채널 입력이 비어 있습니다.");
  const container = document.getElementById('monitoring-channel-grid');

  const el = document.createElement('div');
  el.className = 'channel-item';
  el.innerHTML = `
    <div class="channel-item-header">
      <div class="channel-info-with-logo">
        <div class="channel-logo-placeholder">?</div>
        <div class="channel-text-info">
          <div class="channel-name">${input}</div>
          <div class="channel-subscribers">구독자 수: -</div>
        </div>
      </div>
      <div class="channel-actions">
        <button class="btn-icon delete" title="삭제">🗑️</button>
      </div>
    </div>
    <div class="channel-id">${input}</div>
  `;
  container.appendChild(el);

  // 채널 수 업데이트
  document.getElementById('monitoring-channel-count').textContent =
    container.querySelectorAll('.channel-item').length;

  // 삭제 이벤트 연결
  el.querySelector('.btn-icon.delete').addEventListener('click', () => {
    el.remove();
    document.getElementById('monitoring-channel-count').textContent =
      container.querySelectorAll('.channel-item').length;
  });

  document.getElementById('channel-modal').style.display = 'none';
  document.getElementById('channel-input').value = '';
});
