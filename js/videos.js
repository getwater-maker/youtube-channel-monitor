// YouTube 채널 모니터 - 비디오 섹션 통합 관리
console.log('videos.js (통합) 로딩 시작');

// 비디오 섹션 공통 설정
window.VIDEO_COMMON = {
  // 공통 설정값들
  LONGFORM_MIN_DURATION: 180,  // 롱폼 최소 길이 (초)
  SHORTFORM_MAX_DURATION: 60,  // 숏폼 최대 길이 (초)
  
  // 공통 포맷팅 함수들
  formatSubscribers: function(count) {
    if (count >= 10000) return `구독자 ${Math.floor(count / 10000)}만명`;
    if (count >= 1000) return `구독자 ${Math.floor(count / 1000)}천명`;
    return `구독자 ${count}명`;
  },
  
  formatViews: function(count) {
    if (count >= 100000000) return `조회수 ${Math.floor(count / 100000000)}억`;
    if (count >= 10000) return `조회수 ${Math.floor(count / 10000)}만`;
    if (count >= 1000) return `조회수 ${Math.floor(count / 1000)}천`;
    return `조회수 ${count}`;
  },
  
  formatDuration: function(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
};

// 비디오 섹션 관리자
window.VideoSectionManager = {
  // 모든 섹션 새로고침
  refreshAll: async function() {
    console.log('모든 비디오 섹션 새로고침 시작');
    
    try {
      // 병렬로 실행하지 않고 순차적으로 실행 (API 호출 최적화)
      if (typeof window.refreshMutant === 'function') {
        await window.refreshMutant();
      }
      
      // 잠시 대기 후 다음 섹션 처리
      setTimeout(async () => {
        if (typeof window.refreshLatest === 'function') {
          await window.refreshLatest();
        }
      }, 1000);
      
    } catch (error) {
      console.error('비디오 섹션 새로고침 실패:', error);
      window.toast('비디오 섹션 새로고침 중 오류가 발생했습니다.', 'error');
    }
  },
  
  // 특정 섹션만 새로고침
  refreshSection: function(sectionName) {
    console.log('섹션 새로고침:', sectionName);
    
    switch (sectionName) {
      case 'mutant':
        if (typeof window.refreshMutant === 'function') {
          window.refreshMutant();
        }
        break;
      case 'latest':
        if (typeof window.refreshLatest === 'function') {
          window.refreshLatest();
        }
        break;
      default:
        console.warn('알 수 없는 섹션:', sectionName);
    }
  },
  
  // 섹션 상태 확인
  getSectionStatus: function() {
    return {
      mutant: {
        available: typeof window.refreshMutant === 'function',
        config: window.MUTANT_CONFIG || null
      },
      latest: {
        available: typeof window.refreshLatest === 'function',
        config: window.LATEST_CONFIG || null
      }
    };
  },
  
  // 전체 통계 조회
  getAllVideoStats: async function() {
    try {
      const channels = await getAllChannels();
      const totalChannels = channels.length;
      const totalSubscribers = channels.reduce((sum, ch) => sum + parseInt(ch.subscriberCount || 0), 0);
      const avgSubscribers = totalChannels > 0 ? Math.round(totalSubscribers / totalChannels) : 0;
      
      return {
        totalChannels,
        totalSubscribers,
        avgSubscribers,
        sections: this.getSectionStatus()
      };
    } catch (error) {
      console.error('비디오 통계 조회 실패:', error);
      return null;
    }
  }
};

// 레거시 호환성을 위한 함수들 (기존 코드와의 호환성 유지)
window.refreshMutant = window.refreshMutant || function() {
  console.warn('refreshMutant 함수가 로드되지 않았습니다. mutant-videos.js를 확인하세요.');
};

window.refreshLatest = window.refreshLatest || function() {
  console.warn('refreshLatest 함수가 로드되지 않았습니다. latest-videos.js를 확인하세요.');
};

// 공통 비디오 정렬 함수 (레거시 호환성)
function sortVideoCards(list, mode) {
  console.log('비디오 정렬 (레거시):', mode);
  
  if (mode === 'views') {
    list.sort((a, b) => b.viewCount - a.viewCount);
  } else if (mode === 'subscribers') {
    list.sort((a, b) => (b.__ch?.subscriberCount || 0) - (a.__ch?.subscriberCount || 0));
  } else if (mode === 'latest') {
    list.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  } else {
    list.sort((a, b) => parseFloat(b.mutantIndex || 0) - parseFloat(a.mutantIndex || 0));
  }
}

// 공통 비디오 리스트 렌더링 함수 (레거시 호환성)
function renderVideoList(videos, listId, keywordsId, paginationId) {
  console.log('비디오 리스트 렌더링 (레거시):', listId, videos.length + '개');
  
  // 실제 섹션별 렌더링 함수가 있으면 그것을 우선 사용
  if (listId === 'mutant-list' && typeof window.renderMutantVideos === 'function') {
    return window.renderMutantVideos(videos);
  }
  
  if (listId === 'latest-list' && typeof window.renderLatestVideos === 'function') {
    return window.renderLatestVideos(videos);
  }
  
  // 레거시 렌더링 로직
  const listEl = qs('#' + listId);
  if (!listEl) {
    console.error('비디오 리스트 요소를 찾을 수 없음:', listId);
    return;
  }
  
  if (!videos.length) {
    listEl.innerHTML = '<p class="muted" style="text-align: center; padding: 40px 20px;">표시할 영상이 없습니다.</p>';
    return;
  }
  
  // 간단한 기본 렌더링
  listEl.innerHTML = videos.slice(0, 10).map(video => `
    <div class="video-card">
      <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" style="display: block; padding: 12px; text-decoration: none; color: inherit;">
        <img src="${video.thumbnail}" alt="" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;">
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px;">${video.title}</div>
        <div style="font-size: 12px; color: var(--muted);">
          ${video.__ch?.title || '알 수 없음'} • ${window.fmt(video.viewCount)} 조회수
        </div>
      </a>
    </div>
  `).join('');
}

// 전역으로 노출 (레거시 호환성)
window.sortVideoCards = sortVideoCards;
window.renderVideoList = renderVideoList;

// 초기화 함수
function initializeVideoSections() {
  console.log('비디오 섹션 초기화');
  
  // 섹션 상태 확인 및 로그
  const status = window.VideoSectionManager.getSectionStatus();
  console.log('비디오 섹션 상태:', status);
  
  // 필요한 이벤트 리스너 추가
  document.addEventListener('DOMContentLoaded', () => {
    // 정렬 변경 이벤트 (이미 main.js에서 처리되지만 백업)
    const sortMutant = qs('#sort-mutant');
    if (sortMutant && !sortMutant.hasAttribute('data-initialized')) {
      sortMutant.addEventListener('change', () => {
        window.VideoSectionManager.refreshSection('mutant');
      });
      sortMutant.setAttribute('data-initialized', 'true');
    }
    
    const sortLatest = qs('#sort-latest');
    if (sortLatest && !sortLatest.hasAttribute('data-initialized')) {
      sortLatest.addEventListener('change', () => {
        window.VideoSectionManager.refreshSection('latest');
      });
      sortLatest.setAttribute('data-initialized', 'true');
    }
  });
}

// 즉시 초기화
initializeVideoSections();

console.log('videos.js (통합) 로딩 완료');

// 디버깅용 정보
console.log('비디오 섹션 관리 정보:', {
  VideoSectionManager: typeof window.VideoSectionManager,
  VIDEO_COMMON: typeof window.VIDEO_COMMON,
  refreshMutant: typeof window.refreshMutant,
  refreshLatest: typeof window.refreshLatest
});
