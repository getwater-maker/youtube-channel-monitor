// 채널 분석 관련 함수들
async function openAnalyzeModal() {
  if (!hasKeys()) { 
    toast('먼저 API 키를 설정해주세요.'); 
    return; 
  }
  
  openModal('modal-analyze');
  const list = await getAllChannels();
  const wrap = qs('analyze-channel-list');
  
  if (list.length === 0) { 
    wrap.innerHTML = '<p class="muted">등록된 채널이 없습니다.</p>'; 
    return; 
  }
  
  wrap.innerHTML = '';
  list.forEach(ch => {
    const el = document.createElement('div');
    el.className = 'result-row';
    el.innerHTML = `
      <img class="r-avatar" src="${ch.thumbnail}" alt="${ch.title}">
      <div>
        <div class="r-title">${ch.title}</div>
        <div class="r-sub">구독자: ${fmt(ch.subscriberCount)}</div>
      </div>
      <button class="btn" data-analyze-ch="${ch.id}">분석</button>`;
    
    el.onclick = () => {
      startAnalysis(ch.id);
      closeModal('modal-analyze');
    };
    
    el.querySelector('button').onclick = (e) => {
      e.stopPropagation();
      startAnalysis(ch.id);
      closeModal('modal-analyze');
    };
    
    wrap.appendChild(el);
  });
}

async function startAnalysis(channelId) {
  const container = document.body.querySelector('.container');
  const mainContent = qs('main-content');
  if (mainContent) { 
    mainContent.remove(); 
  }
  
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'analysis-section';
  loadingDiv.className = 'analysis-page';
  loadingDiv.innerHTML = '<p class="muted" style="text-align: center;">채널 데이터를 분석 중입니다. 잠시만 기다려주세요...</p>';
  container.appendChild(loadingDiv);
  state.currentView = 'analysis';
  
  try {
    const ch = await idbGet('my_channels', channelId);
    if (!ch) throw new Error('채널을 찾을 수 없습니다.');
    
    const videos = await getLongformVideos(ch.uploadsPlaylistId);
    const analysisResult = analyzeVideos(videos, ch);
    renderAnalysisResult(ch, analysisResult);
    
  } catch (e) {
    qs('analysis-section').innerHTML = `<p class="error-message" style="text-align: center;">채널 분석 중 오류가 발생했습니다: ${e.message}</p>`;
    console.error(e);
  }
}

async function getLongformVideos(uploadsPlaylistId, videoCount = 100) {
  let videoIds = [];
  let videos = [];
  let nextPageToken = '';
  
  while (videoIds.length < videoCount) {
    const playlistRes = await yt('playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: nextPageToken
    });
    
    const items = playlistRes.items || [];
    if (items.length === 0) break;
    
    const currentVideoIds = items.map(item => item.contentDetails.videoId);
    videoIds.push(...currentVideoIds);
    nextPageToken = playlistRes.nextPageToken;
    if (!nextPageToken) break;
  }
  
  for (let i = 0; i < videoIds.length; i += 50) {
    const idsChunk = videoIds.slice(i, i + 50);
    const videosRes = await yt('videos', {
      part: 'snippet,statistics,contentDetails',
      id: idsChunk.join(',')
    });
    
    const videoItems = videosRes.items || [];
    for (const item of videoItems) {
      if (seconds(item.contentDetails.duration) > 180) {
        videos.push(item);
      }
    }
  }
  
  return videos;
}

function analyzeVideos(videos, channel) {
  const subscriberCount = parseInt(channel.subscriberCount || '1');
  const topVideos = [...videos].sort((a, b) => parseInt(b.statistics.viewCount) - parseInt(a.statistics.viewCount)).slice(0, 10);
  
  const allTitles = videos.map(v => v.snippet.title).join(' ');
  const keywords = extractKeywords(allTitles).slice(0, 15);
  
  const totalViews = videos.reduce((sum, v) => sum + parseInt(v.statistics.viewCount), 0);
  const avgViewCount = totalViews / videos.length;
  
  const weeklyUploads = new Array(7).fill(0);
  const hourlyUploads = new Array(24).fill(0);
  
  videos.forEach(v => {
    const publishedMoment = moment(v.snippet.publishedAt);
    weeklyUploads[publishedMoment.day()]++;
    hourlyUploads[publishedMoment.hour()]++;
  });
  
  const mutantVideos = videos.filter(v => {
    const views = parseInt(v.statistics.viewCount);
    return views >= (subscriberCount * CONFIG.MUTANT_THRESHOLD);
  });
  
  return {
    topVideos,
    keywords,
    avgViewCount,
    weeklyUploads,
    hourlyUploads,
    mutantVideos
  };
}

function renderAnalysisResult(channel, result) {
  const container = document.body.querySelector('.container');
  const analysisPage = document.createElement('div');
  analysisPage.id = 'analysis-section';
  analysisPage.className = 'analysis-page';

  const subDiff = async () => {
    const y = await getYesterdaySubCount(channel);
    const today = parseInt(channel.subscriberCount || '0', 10);
    const diff = y == null ? null : today - y;
    const diffStr = y == null ? '<span class="v" style="color:#888">(전일 정보 없음)</span>'
        : diff > 0 ? `<span class="v" style="color:#1db954">+${fmt(diff)}</span>`
        : diff < 0 ? `<span class="v" style="color:#c4302b">${fmt(diff)}</span>`
        : `<span class="v" style="color:#888">0</span>`;
    return diffStr;
  };
  
  analysisPage.innerHTML = `
    <button id="btn-back-home" class="btn">메인 페이지로 돌아가기</button>
    <div class="analysis-header">
      <img class="thumb" src="${channel.thumbnail}" alt="${channel.title}">
      <div>
        <h2>${channel.title}</h2>
        <p>구독자: ${fmt(channel.subscriberCount)}</p>
      </div>
    </div>
    <div class="analysis-card analysis-insights">
        <h3>채널 인사이트 요약</h3>
        <div class="insights">
          <div><span class="k">전일대비</span> <span id="sub-diff-insight" class="v">...</span></div>
          <div><span class="k">평균조회수</span> <span class="v">${fmt(Math.round(result.avgViewCount))}회</span></div>
          <div><span class="k">업로드 영상</span> <span class="v">${fmt(channel.videoCount)}개</span></div>
        </div>
    </div>
    <div class="analysis-content">
      <div class="analysis-card analysis-videos">
        <h3>주요 히트 영상 (조회수 상위 10개)</h3>
        <div class="video-list" id="analysis-top-videos"></div>
      </div>
      
      <div class="analysis-card analysis-insights">
        <h3>주요 키워드</h3>
        <div class="keywords" id="analysis-keywords"></div>
      </div>

      <div class="analysis-card analysis-charts">
        <h3>업로드 패턴 분석</h3>
        <div class="chart-container">
          <canvas id="weekly-chart"></canvas>
          <p class="chart-label">요일별 업로드</p>
        </div>
        <div class="chart-container" style="margin-top:20px;">
          <canvas id="hourly-chart"></canvas>
          <p class="chart-label">시간대별 업로드</p>
        </div>
      </div>
      
      <div class="analysis-card analysis-mutant">
        <h3>돌연변이 영상 (${result.mutantVideos.length}개)</h3>
        <div class="video-list" id="analysis-mutant-videos"></div>
      </div>
    </div>
  `;
  
  container.appendChild(analysisPage);
  
  subDiff().then(diffStr => {
    qs('sub-diff-insight').innerHTML = diffStr;
  });

  const topVideosList = qs('analysis-top-videos');
  result.topVideos.forEach(v => {
    const card = document.createElement('div');
    card.className = 'analysis-video-card';
    card.innerHTML = `
      <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank">
        <img src="${v.snippet.thumbnails.medium.url}" alt="${v.snippet.title}">
      </a>
      <div class="analysis-video-meta">
        <h4>${v.snippet.title}</h4>
        <p>조회수: ${fmt(v.statistics.viewCount)} · 업로드: ${moment(v.snippet.publishedAt).fromNow()}</p>
      </div>
    `;
    topVideosList.appendChild(card);
  });
  
  const mutantVideosList = qs('analysis-mutant-videos');
  result.mutantVideos.forEach(v => {
    const card = document.createElement('div');
    card.className = 'analysis-video-card';
    card.innerHTML = `
      <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank">
        <img src="${v.snippet.thumbnails.medium.url}" alt="${v.snippet.title}">
      </a>
      <div class="analysis-video-meta">
        <h4>${v.snippet.title}</h4>
        <p>조회수: ${fmt(v.statistics.viewCount)} · 업로드: ${moment(v.snippet.publishedAt).fromNow()}</p>
      </div>
    `;
    mutantVideosList.appendChild(card);
  });

  qs('analysis-keywords').innerHTML = result.keywords.map(([w, c]) => `<span class="kw">${w} ${c}회</span>`).join('');
  
  renderCharts(result);

  qs('btn-back-home').onclick = () => showHome(true);
}

function renderCharts(result) {
  const colors = {
      light: {
          grid: 'rgba(0,0,0,0.1)',
          text: '#333',
          bar: 'rgba(196, 48, 43, 0.8)'
      },
      dark: {
          grid: 'rgba(255,255,255,0.1)',
          text: '#e0e0e0',
          bar: 'rgba(196, 48, 43, 0.8)'
      }
  };
  const theme = document.body.classList.contains('dark') ? colors.dark : colors.light;

  const weeklyData = {
    labels: ['일', '월', '화', '수', '목', '금', '토'],
    datasets: [{
      label: '업로드 영상 수',
      data: result.weeklyUploads,
      backgroundColor: theme.bar,
      borderColor: theme.bar,
      borderWidth: 1,
      borderRadius: 5,
    }]
  };
  const weeklyConfig = {
    type: 'bar',
    data: weeklyData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.text } },
        x: { grid: { color: theme.grid }, ticks: { color: theme.text } }
      },
      plugins: { legend: { display: false } }
    }
  };
  new Chart(qs('weekly-chart'), weeklyConfig);

  const hourlyData = {
    labels: Array.from({length: 24}, (_, i) => `${i}시`),
    datasets: [{
      label: '업로드 영상 수',
      data: result.hourlyUploads,
      backgroundColor: theme.bar,
      borderColor: theme.bar,
      borderWidth: 1,
      borderRadius: 5,
    }]
  };
  const hourlyConfig = {
    type: 'bar',
    data: hourlyData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.text } },
        x: { grid: { color: theme.grid }, ticks: { color: theme.text } }
      },
      plugins: { legend: { display: false } }
    }
  };
  new Chart(qs('hourly-chart'), hourlyConfig);
}
