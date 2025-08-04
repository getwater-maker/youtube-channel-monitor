// js/utils.js

/**
 * ISO 8601 형식의 재생시간을 초 단위로 변환하여 롱폼 영상인지 판별합니다.
 * 180초(3분)를 초과하면 true를 반환합니다.
 * @param {string} durationString - 유튜브 API에서 반환되는 재생시간 문자열 (예: 'PT3M15S')
 * @returns {boolean} - 롱폼 영상 여부
 */
export function isLongform(durationString) {
    if (!durationString) {
        return false;
    }
    const durationInSeconds = moment.duration(durationString).asSeconds();
    return durationInSeconds > 180;
}

/**
 * 영상의 돌연변이 지수를 계산합니다.
 * 지수는 (조회수 / 구독자수)입니다.
 * @param {number} viewCount - 영상의 조회수
 * @param {number} subscriberCount - 채널의 구독자수
 * @returns {string} - 소수점 둘째 자리까지 반올림된 돌연변이 지수 문자열
 */
export function calculateMutantIndex(viewCount, subscriberCount) {
    if (subscriberCount === 0 || subscriberCount === '0') {
        return (viewCount > 0) ? 'Infinity' : '0.00';
    }
    const index = (parseInt(viewCount) / parseInt(subscriberCount));
    return index.toFixed(2);
}

/**
 * UNIX 타임스탬프 또는 날짜 문자열을 받아서 최근 N개월 이내인지 판별합니다.
 * @param {string} dateString - ISO 8601 형식의 날짜 문자열 (예: '2025-07-28T10:00:00Z')
 * @param {number} months - 최근 N개월
 * @returns {boolean} - 최근 N개월 이내 여부
 */
export function isWithinLastMonths(dateString, months) {
    const videoDate = moment(dateString);
    const sixMonthsAgo = moment().subtract(months, 'months');
    return videoDate.isAfter(sixMonthsAgo);
}
