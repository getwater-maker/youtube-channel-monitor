// YouTube 채널 모니터 - 비디오 관리
console.log('videos.js 로딩 시작');

// 돌연변이 영상 새로고침
async function refreshMutant() {
  console.log('돌연변이 영상 새로고침 시작');
  
  const listEl = qs('#mutant-list');
  if (!listEl) {
    console.error('mutant-list 요소를 찾을 수 없음');
    return;
  }
  
  // 로딩 상태 표시
  listEl.innerHTML = `
    <div class="loading-state" style="text-align: center; padding: 40px 20px;">
      <div class="loading-spinner"></div>
      <div style="margin-top: 16px; color: var(--muted);">돌연변이 영상을 분석하는 중...</div>
    </div>
  `;
  
  try {
    const channels = await getAllChannels();
    console.log('채널 수:', channels.length);
    
    if (!channels.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🚀</div>
          <p class="muted">채널을 추가하여 영상을 분석해주세요</p>
        </div>
      `;
      return;
    }

    let videos = [];
    let minDate = null;
    
    // 기간 필터
    if (window.state && window.state.currentMutantPeriod !== 'all') {
      const months = window.state.currentMutantPeriod === '1m' ? 1 : 
                    window.state.currentMutantPeriod === '3m' ? 3 : 6;
      minDate = moment().subtract(months, 'months');
      console.log('기간 필터:', minDate.format('YYYY-MM-DD'));
    }
    
    // 각 채널의 돌연변이 영상 수집
    for (const channel of channels) {
      console.log('채널 분석 시작:', channel.title);
      
      // uploadsPlaylistId 확인 및 가져오기
      let uploadsPlaylistId = channel.uploadsPlaylistId;
      
      if (!uploadsPlaylistId) {
        console.log(`${channel.title}: uploadsPlaylistId 없음, 채널 정보 업데이트 시도`);
        
        try {
          const channelInfo = await window.yt('channels', {
            part: 'contentDetails',
            id: channel.id
          });
          
          uploadsPlaylistId = channelInfo.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
          if (uploadsPlaylistId) {
            channel.uploadsPlaylistId = uploadsPlaylistId;
            await idbPut('my_channels', channel);
            console.log(`${channel.title}: uploadsPlaylistId 업데이트됨`);
          } else {
            console.log(`${channel.title}: uploadsPlaylistId를 찾을 수 없음`);
            continue;
          }
        } catch (e) {
          console.error(`${channel.title}: 채널 정보 업데이트 실패`, e);
          continue;
        }
      }
      
      try {
        let videoIds = [];
        let nextPageToken = null;
        let shouldStop = false;
        let fetchCount = 0;
        
        // 재생목록에서 비디오 ID 수집 (최대 50개)
        while (!shouldStop && videoIds.length < 50 && fetchCount < 2) {
          const playlistResponse = await window.yt('playlistItems', {
            part: 'snippet,contentDetails',
            playlistId: uploadsPlaylistId,
            maxResults: 25,
            pageToken: nextPageToken || ''
          });
          
          fetchCount++;
          const items = playlistResponse.items || [];
          if (!items.length) break;
          
          // 기간 필터 적용
          const filteredItems = minDate ? 
            items.filter(item => moment(item.snippet.publishedAt).isAfter(minDate)) : 
            items;
          
          videoIds.push(...filteredItems.map(item => item.contentDetails.videoId));
          nextPageToken = playlistResponse.nextPageToken;
          
          // 더 이상 가져올 필요 없으면 중단
          if (!nextPageToken || (minDate && filteredItems.length < items.length)) {
            shouldStop = true;
          }
        }
        
        console.log(`${channel.title}: ${videoIds.length}개 영상 ID 수집`);
        
        // 비디오 세부 정보 가져오기 (25개씩)
        for (let i = 0; i < videoIds.length; i += 25) {
          const batchIds = videoIds.slice(i, i + 25);
          
          const videosResponse = await window.yt('videos', {
            part: 'snippet,statistics,contentDetails',
            id: batchIds.join(',')
          });
          
          (videosResponse.items || []).forEach(video => {
            const duration = window.seconds(video.contentDetails.duration);
            if (duration <= 180) return; // 숏폼 제외 (3분 이하)
            
            const views = parseInt(video.statistics.viewCount || '0', 10);
            const subscribers = parseInt(channel.subscriberCount || '1', 10);
            const mutantIndex = subscribers > 0 ? (views / subscribers) : 0;
            
            if (mutantIndex >= window.CONFIG.MUTANT_THRESHOLD) {
              videos.push({
                id: video.id,
                title: video.snippet.title,
                thumbnail: video.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
                viewCount: views,
                publishedAt: video.snippet.publishedAt,
                mutantIndex: mutantIndex.toFixed(2),
                __ch: {
                  subscriberCount: subscribers,
                  title: channel.title,
                  channelId: channel.id
                }
              });
            }
          });
        }
        
      } catch (e) {
        console.error(`채널 ${channel.title} 분석 실패:`, e);
      }
    }
    
    console.log('총 돌연변이 영상 수:', videos.length);
    
    // 정렬
    const sortSelect = qs('#sort-mutant');
    const sortMode = sortSelect?.value || 'mutantIndex';
    sortVideoCards(videos, sortMode);
    
    // 렌더링
    renderVideoList(videos, 'mutant-list', 'mutant-keywords', 'mutant-pagination');
    
  } catch (error) {
    console.error('돌연변이 영상 새로고침 실패:', error);
    
    // 오류 발생시 빈 상태 표시
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p class="muted">영상 분석 중 오류가 발생했습니다: ${error.message}</p>
        <button class="btn btn-secondary" onclick="window.refreshMutant()">다시 시도</button>
      </div>
    `;
  }
}

// 최신 영상 새로고침
async function refreshLatest() {
  console.log('최신 영상 새로고침 시작');
  
  const listEl = qs('#latest-list');
  if (!listEl) {
    console.error('latest-list 요소를 찾을 수 없음');
    return;
  }
  
  // 로딩 상태 표시
  listEl.innerHTML = `
    <div class="loading-state" style="text-align: center; padding: 40px 20px;">
      <div class="loading-spinner"></div>
      <div style="margin-top: 16px; color: var(--muted);">최신 영상을 조회하는 중...</div>
    </div>
  `;
  
  try {
    const channels = await getAllChannels();
    
    if (!channels.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📱</div>
          <p class="muted">채널을 추가하여 영상을 분석해주세요</p>
        </div>
      `;
      return;
    }

    const videos = [];
    
    // 각 채널의 최신 롱폼 영상 1개씩 가져오기
    for (const channel of channels) {
      console.log('최신 영상 조회:', channel.title);
      
      // uploadsPlaylistId 확인
      let uploadsPlaylistId = channel.uploadsPlaylistId;
      
      if (!uploadsPlaylistId) {
        try {
          const channelInfo = await window.yt('channels', {
            part: 'contentDetails',
            id: channel.id
          });
          
          uploadsPlaylistId = channelInfo.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
          if (uploadsPlaylistId) {
            channel.uploadsPlaylistId = uploadsPlaylistId;
            await idbPut('my_channels', channel);
          } else {
            console.log(`${channel.title}: uploadsPlaylistId를 찾을 수 없음`);
            continue;
          }
        } catch (e) {
          console.error(`${channel.title}: 채널 정보 업데이트 실패`, e);
          continue;
        }
      }
      
      try {
        let nextPageToken = null;
        let found = false;
        let searchCount = 0;
        
        while (!found && searchCount < 2) {
          const playlistResponse = await window.yt('playlistItems', {
            part: 'snippet,contentDetails',
            playlistId: uploadsPlaylistId,
            maxResults: 10,
            pageToken: nextPageToken || ''
          });
          
          searchCount++;
          const videoIds = (playlistResponse.items || []).map(item => item.contentDetails.videoId);
          if (!videoIds.length) break;
          
          const videosResponse = await window.yt('videos', {
            part: 'snippet,statistics,contentDetails',
            id: videoIds.join(',')
          });
          
          for (const video of (videosResponse.items || [])) {
            const duration = window.seconds(video.contentDetails.duration);
            if (duration > 180) { // 롱폼만 (3분 초과)
              const views = parseInt(video.statistics.viewCount || '0', 10);
              const subscribers = parseInt(channel.subscriberCount || '1', 10);
              const mutantIndex = subscribers > 0 ? (views / subscribers) : 0;
              
              videos.push({
                id: video.id,
                title: video.snippet.title,
                thumbnail: video.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
                viewCount: views,
                publishedAt: video.snippet.publishedAt,
                mutantIndex: mutantIndex.toFixed(2),
                __ch: {
                  subscriberCount: subscribers,
                  title: channel.title,
                  channelId: channel.id
                }
              });
              
              found = true;
              break;
            }
          }
          
          nextPageToken = playlistResponse.nextPageToken;
          if (!nextPageToken) break;
        }
        
      } catch (e) {
        console.error(`채널 ${channel.title} 최신 영상 조회 실패:`, e);
      }
    }
    
    console.log('최신 영상 수:', videos.length);
    
    // 정렬
    const sortSelect = qs('#sort-latest');
    const sortMode = sortSelect?.value || 'views';
    sortVideoCards(videos, sortMode);
    
    // 렌더링
    renderVideoList(videos, 'latest-list', 'latest-keywords', 'latest-pagination');
    
  } catch (error) {
    console.error('최신 영상 새로고침 실패:', error);
    
    // 오류 발생시 빈 상태 표시
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p class="muted">최신 영상 조회 중 오류가 발생했습니다: ${error.message}</p>
        <button class="btn btn-secondary" onclick="window.refreshLatest()">다시 시도</button>
      </div>
    `;
  }
}

// 비디오 정렬
function sortVideoCards(list, mode) {
  console.log('비디오 정렬:', mode);
  
  if (mode === 'views') {
    list.sort((a, b) => b.viewCount - a.viewCount);
  } else if (mode === 'subscribers') {
    list.sort((a, b) => b.__ch.subscriberCount - a.__ch.subscriberCount);
  } else if (mode === 'latest') {
    list.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  } else {
    list.sort((a, b) => parseFloat(b.mutantIndex || 0) - parseFloat(a.mutantIndex || 0));
  }
}

// 비디오 리스트 렌더링
function renderVideoList(videos, listId, keywordsId, paginationId) {
  console.log('비디오 리스트 렌더링:', listId, videos.length + '개');
  
  const itemsPerPage = window.CONFIG.PAGINATION.VIDEOS;
  const sectionName = listId.replace('-list', '');
  const currentPage = window.state.currentPage[sectionName] || 1;
  const totalItems = videos.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedVideos = videos.slice(startIndex, endIndex);
  
  const listEl = qs('#' + listId);
  if (!listEl) {
    console.error('비디오 리스트 요소를 찾을 수 없음:', listId);
    return;
  }
  
  if (!videos.length) { 
    listEl.innerHTML = '<p class="muted" style="text-align: center; padding: 40px 20px;">표시할 영상이 없습니다.</p>'; 
    
    if (keywordsId) {
      const keywordsEl = qs('#' + keywordsId);
      if (keywordsEl) keywordsEl.innerHTML = '';
    }
    
    if (paginationId) {
      const paginationEl = qs('#' + paginationId);
      if (paginationEl) paginationEl.innerHTML = '';
    }
    
    return; 
  }
  
  listEl.innerHTML = '';
  
  paginatedVideos.forEach(video => {
    const videoCard = document.createElement('div'); 
    videoCard.className = 'video-card';
    
    const channelName = video.__ch?.title || '알 수 없음';
    const subscriberCount = parseInt(video.__ch?.subscriberCount || 0);
    const viewCount = parseInt(video.viewCount || 0);
    const uploadDate = moment(video.publishedAt).format('MM-DD');
    const mutantIndex = parseFloat(video.mutantIndex || '0.00');
    
    // 구독자 수 포맷팅
    const formatSubscribers = (count) => {
      if (count >= 10000) {
        return `구독자 ${Math.floor(count / 10000)}만명`;
      } else if (count >= 1000) {
        return `구독자 ${Math.floor(count / 1000)}천명`;
      } else {
        return `구독자 ${count}명`;
      }
    };
    
    // 조회수 포맷팅
    const formatViews = (count) => {
      if (count >= 100000000) {
        return `조회수 ${Math.floor(count / 100000000)}억`;
      } else if (count >= 10000) {
        return `조회수 ${Math.floor(count / 10000)}만`;
      } else if (count >= 1000) {
        return `조회수 ${Math.floor(count / 1000)}천`;
      } else {
        return `조회수 ${count}`;
      }
    };
    
    // 돌연변이 배지 표시 여부
    const showMutantBadge = mutantIndex >= window.CONFIG.MUTANT_THRESHOLD;
    
    videoCard.innerHTML = `
      <a class="video-link" target="_blank" href="https://www.youtube.com/watch?v=${video.id}">
        <div class="thumb-wrap">
          <img class="thumb" src="${video.thumbnail}" alt="" loading="lazy">
        </div>
        <div class="v-title">${video.title}</div>
        <div class="v-meta">
          <div class="v-meta-top">
            <span title="${channelName}">${window.truncateText(channelName, 12)}</span>
            <span>${formatSubscribers(subscriberCount)}</span>
            <span>${formatViews(viewCount)}</span>
          </div>
          <div class="v-meta-bottom">
            ${showMutantBadge ? 
              `<div class="mutant-badge">🚀 ${mutantIndex.toFixed(2)}</div>` : 
              `<div class="mutant-indicator">${mutantIndex.toFixed(2)}</div>`
            }
            <div class="upload-date">${uploadDate}</div>
            <label class="video-done-checkbox">
              <input type="checkbox" data-done="${video.id}"/> 완료
            </label>
          </div>
        </div>
      </a>
    `;
    
    // 완료 상태 복원
    idbGet('doneVideos', [video.__ch?.channelId || '', video.id])
      .then(record => {
        if (record) {
          const checkbox = videoCard.querySelector(`[data-done='${video.id}']`);
          if (checkbox) checkbox.checked = true;
        }
      })
      .catch(e => console.error('완료 상태 조회 실패:', e));
    
    // 완료 상태 변경 이벤트
    videoCard.addEventListener('change', async (e) => {
      if (e.target && e.target.matches(`[data-done='${video.id}']`)) {
        const channelId = video.__ch?.channelId || '';
        try {
          if (e.target.checked) {
            await idbPut('doneVideos', {
              channelId: channelId,
              videoId: video.id,
              done: true,
              timestamp: Date.now()
            });
          } else {
            await idbDel('doneVideos', [channelId, video.id]);
          }
        } catch (e) {
          console.error('완료 상태 저장 실패:', e);
        }
      }
    });
    
    listEl.appendChild(videoCard);
  });
  
  // 키워드 렌더링
  if (keywordsId) {
    const keywords = window.extractKeywords(videos.map(v => v.title || '').join(' '));
    const topKeywords = keywords.slice(0, 12);
    const keywordsEl = qs('#' + keywordsId);
    if (keywordsEl) {
      keywordsEl.innerHTML = topKeywords.map(([word, count]) => 
        `<span class="kw">${word} ${count}회</span>`
      ).join('');
    }
  }
  
  // 페이지네이션 렌더링
  if (paginationId && totalItems > itemsPerPage) {
    window.renderPagination(paginationId, currentPage, totalItems, itemsPerPage, (page) => {
      window.state.currentPage[sectionName] = page;
      renderVideoList(videos, listId, keywordsId, paginationId);
    });
  } else if (paginationId) {
    const paginationEl = qs('#' + paginationId);
    if (paginationEl) paginationEl.innerHTML = '';
  }
}

// 전역으로 노출
window.refreshMutant = refreshMutant;
window.refreshLatest = refreshLatest;
window.sortVideoCards = sortVideoCards;
window.renderVideoList = renderVideoList;

console.log('videos.js 로딩 완료');