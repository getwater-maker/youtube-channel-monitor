// 완전한 채널 분석 시스템
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
      startCompleteAnalysis(ch.id);
      closeModal('modal-analyze');
    };
    
    el.querySelector('button').onclick = (e) => {
      e.stopPropagation();
      startCompleteAnalysis(ch.id);
      closeModal('modal-analyze');
    };
    
    wrap.appendChild(el);
  });
}

async function startCompleteAnalysis(channelId) {
  const container = document.body.querySelector('.container');
  const mainContent = qs('main-content');
  if (mainContent) mainContent.style.display = 'none';
  
  // 기존 분석 섹션 제거
  const existingAnalysis = qs('analysis-section');
  if (existingAnalysis) existingAnalysis.remove();
  
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'analysis-section';
  loadingDiv.className = 'analysis-page';
  loadingDiv.innerHTML = `
    <div class="loading-text">
      <div class="loading"></div>
      <span>채널 데이터를 심층 분석 중입니다. 잠시만 기다려주세요...</span>
    </div>`;
  container.appendChild(loadingDiv);
  
  state.currentView = 'analysis';
  
  try {
    const ch = await idbGet('my_channels', channelId);
    if (!ch) throw new Error('채널을 찾을 수 없습니다.');
    
    // 완전한 채널 분석 수행
    const analysisData = await performCompleteAnalysis(ch);
    
    // 분석 결과 UI 렌더링
    renderCompleteAnalysisResult(ch, analysisData);
    
  } catch (e) {
    qs('analysis-section').innerHTML = `
      <button id="btn-back-home" class="nav-btn" onclick="showHome()">← 메인으로 돌아가기</button>
      <div class="error-message" style="text-align: center; margin-top: 40px;">
        채널 분석 중 오류가 발생했습니다: ${e.message}
      </div>`;
    console.error(e);
  }
}

async function performCompleteAnalysis(channel) {
  const subscriberCount = parseInt(channel.subscriberCount || '1');
  
  // 1. 최근 영상 데이터 수집 (최대 200개)
  const videos = await getLongformVideos(channel.uploadsPlaylistId, 200);
  
  // 2. 기본 통계 계산
  const totalViews = videos.reduce((sum, v) => sum + parseInt(v.statistics.viewCount || 0), 0);
  const avgViews = totalViews / videos.length || 0;
  const avgDuration = videos.reduce((sum, v) => sum + (moment.duration(v.contentDetails.duration).asSeconds() || 0), 0) / videos.length || 0;
  const totalLikes = videos.reduce((sum, v) => sum + parseInt(v.statistics.likeCount || 0), 0);
  const totalComments = videos.reduce((sum, v) => sum + parseInt(v.statistics.commentCount || 0), 0);
  
  // 3. 참여도 분석
  const engagementRate = totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100) : 0;
  const avgLikeRate = videos.length > 0 ? (totalLikes / videos.length) : 0;
  const avgCommentRate = videos.length > 0 ? (totalComments / videos.length) : 0;
  
  // 4. 상위 성과 영상
  const topVideos = [...videos]
    .sort((a, b) => parseInt(b.statistics.viewCount) - parseInt(a.statistics.viewCount))
    .slice(0, 10);
  
  // 5. 돌연변이 영상 (구독자 대비 높은 조회수)
  const mutantVideos = videos.filter(v => {
    const views = parseInt(v.statistics.viewCount || 0);
    return views >= (subscriberCount * CONFIG.MUTANT_THRESHOLD);
  }).sort((a, b) => parseInt(b.statistics.viewCount) - parseInt(a.statistics.viewCount));
  
  // 6. 업로드 패턴 분석
  const weeklyUploads = new Array(7).fill(0);
  const hourlyUploads = new Array(24).fill(0);
  const monthlyUploads = new Array(12).fill(0);
  
  videos.forEach(v => {
    const publishedMoment = moment(v.snippet.publishedAt);
    weeklyUploads[publishedMoment.day()]++;
    hourlyUploads[publishedMoment.hour()]++;
    monthlyUploads[publishedMoment.month()]++;
  });
  
  // 7. 업로드 빈도 계산
  const oldestVideo = videos[videos.length - 1];
  const newestVideo = videos[0];
  const daysBetween = oldestVideo && newestVideo ? 
    moment(newestVideo.snippet.publishedAt).diff(moment(oldestVideo.snippet.publishedAt), 'days') : 0;
  const uploadFrequency = daysBetween > 0 ? (videos.length / daysBetween * 7).toFixed(1) : 0; // 주당 업로드 수
  
  // 8. 카테고리 분석
  const categories = {};
  videos.forEach(v => {
    const cat = getCategoryName(v.snippet.categoryId);
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  // 9. 키워드 분석 (더 많이)
  const allTitles = videos.map(v => v.snippet.title).join(' ');
  const keywords = extractKeywords(allTitles).slice(0, 30); // 30개로 증가
  
  // 10. 성장 트렌드 분석
  const recentVideos = videos.slice(0, 20);
  const olderVideos = videos.slice(-20);
  const recentAvgViews = recentVideos.reduce((sum, v) => sum + parseInt(v.statistics.viewCount || 0), 0) / recentVideos.length || 0;
  const olderAvgViews = olderVideos.reduce((sum, v) => sum + parseInt(v.statistics.viewCount || 0), 0) / olderVideos.length || 0;
  const viewsGrowthRate = olderAvgViews > 0 ? ((recentAvgViews - olderAvgViews) / olderAvgViews * 100) : 0;
  
  // 11. 최적 업로드 시간 분석
  const bestDay = weeklyUploads.indexOf(Math.max(...weeklyUploads));
  const bestHour = hourlyUploads.indexOf(Math.max(...hourlyUploads));
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  
  // 12. 길이별 성과 분석
  const shortVideos = videos.filter(v => moment.duration(v.contentDetails.duration).asSeconds() < 600);
  const longVideos = videos.filter(v => moment.duration(v.contentDetails.duration).asSeconds() >= 600);
  const avgShortViews = shortVideos.length > 0 ? 
    shortVideos.reduce((sum, v) => sum + parseInt(v.statistics.viewCount || 0), 0) / shortVideos.length : 0;
  const avgLongViews = longVideos.length > 0 ? 
    longVideos.reduce((sum, v) => sum + parseInt(v.statistics.viewCount || 0), 0) / longVideos.length : 0;
  
  // 13. 일관성 지표
  const nonZeroUploads = weeklyUploads.filter(x => x > 0);
  const uploadConsistency = nonZeroUploads.length > 0 ? 
    (Math.max(...weeklyUploads) / Math.min(...nonZeroUploads)).toFixed(1) : '1.0';
  
  return {
    // 기본 통계
    totalViews,
    avgViews,
    avgDuration,
    totalVideos: videos.length,
    engagementRate,
    viewsGrowthRate,
    avgLikeRate,
    avgCommentRate,
    uploadFrequency,
    
    // 영상 데이터
    topVideos,
    mutantVideos,
    recentVideos: videos.slice(0, 10),
    shortVideos,
    longVideos,
    avgShortViews,
    avgLongViews,
    
    // 패턴 분석
    weeklyUploads,
    hourlyUploads,
    monthlyUploads,
    bestUploadTime: `${dayNames[bestDay]} ${bestHour}시`,
    
    // 콘텐츠 분석
    keywords,
    categories,
    
    // 성과 분석
    topPerformingDay: dayNames[bestDay],
    uploadConsistency
  };
}

async function renderCompleteAnalysisResult(channel, data) {
  // 전일 구독자 수 비교 (실제 데이터베이스에서)
  const yesterdaySubCount = await getYesterdaySubCount(channel);
  const todaySubCount = parseInt(channel.subscriberCount || '0');
  const subDiff = yesterdaySubCount ? todaySubCount - yesterdaySubCount : null;
  
  const subDiffDisplay = subDiff === null ? '(전일 정보 없음)' :
    subDiff > 0 ? `+${fmt(subDiff)}` :
    subDiff < 0 ? `${fmt(subDiff)}` : '0';
  
  const subDiffClass = subDiff === null ? 'neutral' :
    subDiff > 0 ? 'positive' :
    subDiff < 0 ? 'negative' : 'neutral';
  
  const analysisSection = qs('analysis-section');
  
  analysisSection.innerHTML = `
    <div class="analysis-header">
      <button id="btn-back-home" class="nav-btn">← 메인으로 돌아가기</button>
      <img class="thumb" src="${channel.thumbnail}" alt="${channel.title}">
      <div class="info">
        <h2>${channel.title}</h2>
        <p>구독자: ${fmt(channel.subscriberCount)}명</p>
        <div class="analysis-stats">
          <div class="stat-item">
            <div class="stat-value ${subDiffClass}">${subDiffDisplay}</div>
            <div class="stat-label">전일대비</div>
          </div>
          <div class="stat-item">
            <div class="stat-value neutral">${fmt(Math.round(data.avgViews))}</div>
            <div class="stat-label">평균조회수</div>
          </div>
          <div class="stat-item">
            <div class="stat-value ${data.viewsGrowthRate >= 0 ? 'positive' : 'negative'}">${data.viewsGrowthRate >= 0 ? '+' : ''}${data.viewsGrowthRate.toFixed(1)}%</div>
            <div class="stat-label">조회수 성장률</div>
          </div>
          <div class="stat-item">
            <div class="stat-value neutral">${data.engagementRate.toFixed(2)}%</div>
            <div class="stat-label">참여도</div>
          </div>
          <div class="stat-item">
            <div class="stat-value neutral">${data.uploadFrequency}</div>
            <div class="stat-label">주당 업로드</div>
          </div>
          <div class="stat-item">
            <div class="stat-value neutral">${Math.round(data.avgDuration / 60)}분</div>
            <div class="stat-label">평균 길이</div>
          </div>
          <div class="stat-item">
            <div class="stat-value neutral">${data.shortVideos.length}:${data.longVideos.length}</div>
            <div class="stat-label">짧은:긴 영상</div>
          </div>
          <div class="stat-item">
            <div class="stat-value neutral">${data.topPerformingDay}</div>
            <div class="stat-label">최다 업로드 요일</div>
          </div>
          <div class="stat-item">
            <div class="stat-value neutral">${Object.keys(data.categories)[0] || '미분류'}</div>
            <div class="stat-label">주요 카테고리</div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="analysis-content">
      <!-- 주요 키워드 섹션을 크게 -->
      <div class="analysis-card analysis-keywords-large">
        <h3>🏷️ 주요 키워드 (상위 30개)</h3>
        <div class="tag-cloud-large">
          ${data.keywords.map(([word, count]) => `
            <span class="tag-large" style="font-size: ${Math.min(2, 0.9 + count * 0.1)}rem; opacity: ${Math.min(1, 0.5 + count * 0.1)}">${word} <small>(${count})</small></span>
          `).join('')}
        </div>
      </div>
      
      <!-- 핵심 성과 지표 -->
      <div class="analysis-card">
        <h3>📊 핵심 성과 지표</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value positive">${data.mutantVideos.length}</div>
            <div class="metric-label">돌연변이 영상</div>
            <div class="metric-change">전체의 ${((data.mutantVideos.length / data.totalVideos) * 100).toFixed(1)}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-value neutral">${fmt(data.totalViews)}</div>
            <div class="metric-label">총 조회수</div>
            <div class="metric-change">분석 영상 기준</div>
          </div>
          <div class="metric-card">
            <div class="metric-value neutral">${data.totalVideos}</div>
            <div class="metric-label">분석 영상수</div>
            <div class="metric-change">롱폼만 대상</div>
          </div>
          <div class="metric-card">
            <div class="metric-value neutral">${data.uploadConsistency}x</div>
            <div class="metric-label">업로드 일관성</div>
            <div class="metric-change">요일별 편차</div>
          </div>
        </div>
      </div>
      
      <!-- 상위 성과 영상 -->
      <div class="analysis-card">
        <h3>🔥 상위 성과 영상 (TOP 10)</h3>
        <div class="analysis-videos">
          <div class="video-list">
            ${data.topVideos.map((v, index) => `
              <div class="analysis-video-card">
                <span class="rank-badge">${index + 1}</span>
                <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank">
                  <img src="${v.snippet.thumbnails.medium.url}" alt="${v.snippet.title}">
                </a>
                <div class="analysis-video-meta">
                  <h4>${truncateText(v.snippet.title, 60)}</h4>
                  <p>조회수: ${fmt(v.statistics.viewCount)} · 좋아요: ${fmt(v.statistics.likeCount || 0)} · 댓글: ${fmt(v.statistics.commentCount || 0)}</p>
                  <p>${moment(v.snippet.publishedAt).fromNow()} · 길이: ${Math.round(moment.duration(v.contentDetails.duration).asMinutes())}분</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      
      <!-- 돌연변이 영상 -->
      <div class="analysis-card">
        <h3>🚀 돌연변이 영상 (${data.mutantVideos.length}개)</h3>
        <div class="analysis-videos">
          <div class="video-list">
            ${data.mutantVideos.slice(0, 8).map(v => {
              const mutantIndex = (parseInt(v.statistics.viewCount) / subscriberCount).toFixed(2);
              return `
                <div class="analysis-video-card">
                  <span class="mutant-rank">${mutantIndex}x</span>
                  <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank">
                    <img src="${v.snippet.thumbnails.medium.url}" alt="${v.snippet.title}">
                  </a>
                  <div class="analysis-video-meta">
                    <h4>${truncateText(v.snippet.title, 60)}</h4>
                    <p>조회수: ${fmt(v.statistics.viewCount)} · 돌연변이지수: ${mutantIndex}</p>
                    <p>${moment(v.snippet.publishedAt).fromNow()}</p>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      
      <!-- 업로드 패턴 분석 -->
      <div class="analysis-card">
        <h3>📅 업로드 패턴 분석</h3>
        <div class="chart-container">
          <canvas id="weekly-upload-chart"></canvas>
        </div>
        <div class="chart-label">요일별 업로드 패턴</div>
        <div class="pattern-insights">
          <p><strong>최적 업로드 시간:</strong> ${data.bestUploadTime}</p>
          <p><strong>업로드 빈도:</strong> 주당 ${data.uploadFrequency}개</p>
          <p><strong>업로드 일관성:</strong> ${data.uploadConsistency}배 (낮을수록 일관적)</p>
        </div>
      </div>
      
      <!-- 시간대별 업로드 -->
      <div class="analysis-card">
        <h3>⏰ 시간대별 업로드 분포</h3>
        <div class="chart-container">
          <canvas id="hourly-upload-chart"></canvas>
        </div>
        <div class="chart-label">24시간 업로드 분포</div>
      </div>
      
      <!-- 참여도 및 성과 분석 -->
      <div class="analysis-card">
        <h3>💬 참여도 분석</h3>
        <div class="engagement-metrics">
          <div class="engagement-item">
            <div class="engagement-value">${data.engagementRate.toFixed(3)}%</div>
            <div class="engagement-label">전체 참여도</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(100, data.engagementRate * 50)}%"></div>
            </div>
          </div>
          <div class="engagement-item">
            <div class="engagement-value">${fmt(Math.round(data.avgLikeRate))}</div>
            <div class="engagement-label">평균 좋아요</div>
          </div>
          <div class="engagement-item">
            <div class="engagement-value">${fmt(Math.round(data.avgCommentRate))}</div>
            <div class="engagement-label">평균 댓글</div>
          </div>
        </div>
      </div>
      
      <!-- 콘텐츠 길이 분석 -->
      <div class="analysis-card">
        <h3>📏 콘텐츠 길이 분석</h3>
        <div class="length-analysis">
          <div class="length-comparison">
            <div class="length-item">
              <div class="length-type">짧은 영상 (10분 미만)</div>
              <div class="length-count">${data.shortVideos.length}개</div>
              <div class="length-avg">평균 조회수: ${fmt(Math.round(data.avgShortViews))}</div>
            </div>
            <div class="length-item">
              <div class="length-type">긴 영상 (10분 이상)</div>
              <div class="length-count">${data.longVideos.length}개</div>
              <div class="length-avg">평균 조회수: ${fmt(Math.round(data.avgLongViews))}</div>
            </div>
          </div>
          <div class="length-recommendation">
            <strong>추천:</strong> ${data.avgLongViews > data.avgShortViews ? 
              '긴 영상이 더 높은 조회수를 기록하고 있습니다' : 
              '짧은 영상이 더 높은 조회수를 기록하고 있습니다'}
          </div>
        </div>
      </div>
    </div>`;
  
  // 뒤로가기 버튼 이벤트 연결
  qs('btn-back-home').onclick = () => showHome();
  
  // 차트 렌더링
  setTimeout(() => {
    renderAnalysisCharts(data);
  }, 100);
}

function renderAnalysisCharts(data) {
  const isDark = document.body.classList.contains('dark');
  const colors = {
    grid: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    text: isDark ? '#e4e6ea' : '#333',
    primary: '#c4302b',
    gradient: ['#ff4757', '#ffa502', '#2ed573', '#5352ed', '#ff6b6b', '#3742fa', '#2f3542']
  };

  // 요일별 업로드 차트
  const weeklyCtx = qs('weekly-upload-chart');
  if (weeklyCtx) {
    new Chart(weeklyCtx, {
      type: 'bar',
      data: {
        labels: ['일', '월', '화', '수', '목', '금', '토'],
        datasets: [{
          label: '업로드 수',
          data: data.weeklyUploads,
          backgroundColor: colors.gradient,
          borderColor: colors.primary,
          borderWidth: 2,
          borderRadius: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { 
            beginAtZero: true, 
            grid: { color: colors.grid }, 
            ticks: { color: colors.text }
          },
          x: { 
            grid: { color: colors.grid }, 
            ticks: { color: colors.text }
          }
        },
        plugins: { 
          legend: { 
            labels: { color: colors.text }
          }
        }
      }
    });
  }

  // 시간대별 업로드 차트
  const hourlyCtx = qs('hourly-upload-chart');
  if (hourlyCtx) {
    new Chart(hourlyCtx, {
      type: 'line',
      data: {
        labels: Array.from({length: 24}, (_, i) => `${i}시`),
        datasets: [{
          label: '업로드 수',
          data: data.hourlyUploads,
          borderColor: colors.primary,
          backgroundColor: colors.primary + '20',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: colors.primary,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { 
            beginAtZero: true, 
            grid: { color: colors.grid }, 
            ticks: { color: colors.text }
          },
          x: { 
            grid: { color: colors.grid }, 
            ticks: { color: colors.text }
          }
        },
        plugins: { 
          legend: { 
            labels: { color: colors.text }
          }
        }
      }
    });
  }
}

async function getLongformVideos(uploadsPlaylistId, videoCount = 200) {
  let videoIds = [];
  let videos = [];
  let nextPageToken = '';
  
  // 재생목록에서 비디오 ID 수집
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
  
  // 비디오 세부 정보 가져오기 (50개씩 배치 처리)
  for (let i = 0; i < videoIds.length; i += 50) {
    const idsChunk = videoIds.slice(i, i + 50);
    const videosRes = await yt('videos', {
      part: 'snippet,statistics,contentDetails',
      id: idsChunk.join(',')
    });
    
    const videoItems = videosRes.items || [];
    for (const item of videoItems) {
      // 롱폼만 필터링 (3분 이상)
      if (moment.duration(item.contentDetails.duration).asSeconds() > 180) {
        videos.push(item);
      }
    }
  }
  
  return videos;
}

function getCategoryName(categoryId) {
  const categories = {
    '1': '영화/애니메이션', '2': '자동차/교통', '10': '음악', '15': '애완동물/동물',
    '17': '스포츠', '19': '여행/이벤트', '20': '게임', '22': '사람/블로그',
    '23': '코미디', '24': '엔터테인먼트', '25': '뉴스/정치', '26': '하우투/스타일',
    '27': '교육', '28': '과학/기술', '29': '비영리/행동주의'
  };
  return categories[categoryId] || '기타';
}
