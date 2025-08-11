// 영상 관련 함수들
async function refreshMutant() {
  const channels = await getAllChannels(); 
  let list = []; 
  let minDate = null;
  
  if (state.currentMutantPeriod !== 'all') { 
    const n = state.currentMutantPeriod === '1m' ? 1 : 
              state.currentMutantPeriod === '3m' ? 3 : 6; 
    minDate = moment().subtract(n, 'months'); 
  }
  
  for (const ch of channels) {
    await ensureUploadsAndLatest(ch); 
    if (!ch.uploadsPlaylistId) continue;
    
    let ids = [], next = null, stop = false;
    while (!stop) {
      const pl = await yt('playlistItems', {
        part: 'snippet,contentDetails',
        playlistId: ch.uploadsPlaylistId,
        maxResults: 50,
        pageToken: next || ''
      });
      
      const items = pl.items || []; 
      const filtered = minDate ? 
        items.filter(i => moment(i.snippet.publishedAt).isAfter(minDate)) : 
        items;
      
      ids.push(...filtered.map(i => i.contentDetails.videoId)); 
      next = pl.nextPageToken; 
      
      if (!next || (minDate && filtered.length < items.length)) stop = true;
    }
    
    for (let i = 0; i < ids.length; i += 50) {
      const d = await yt('videos', {
        part: 'snippet,
