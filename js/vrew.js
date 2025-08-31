// js/vrew.js

const UI = {
    root: null,
    srtInput: null, srtDisplay: null,
    imgInput: null, imgDisplay: null,
    vrewInput: null, vrewDisplay: null,
    deleteMarkersCheck: null,
    startBtn: null,
    statusDisplay: null,
};

const state = {
    srtFile: null,
    imgFiles: [],
    vrewFile: null,
    isBusy: false,
};

// --- 파일 파싱 및 데이터 처리 로직 (Python 코드 이식) ---

function parseSrt(srtContent) {
    const cues = [];
    const lines = srtContent.replace(/\r\n/g, '\n').split('\n');
    const timeRe = /^\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*$/;

    let i = 0, n = lines.length, clip_idx = 0;
    while (i < n) {
        if (lines[i].trim().match(/^\d+$/)) i++; // Index line
        if (i >= n) break;
        
        const timeLine = lines[i];
        if (!timeRe.test(timeLine)) { i++; continue; }
        i++;
        
        let text_lines = [];
        while (i < n && lines[i].trim() !== "") {
            text_lines.push(lines[i]);
            i++;
        }
        while (i < n && lines[i].trim() === "") i++;
        
        clip_idx++;
        const txt = text_lines.map(t => t.trim()).join(" ").trim();
        cues.push({ "clip": clip_idx, "text": txt });
    }
    return cues;
}

function buildMapping(srtCues, imgFiles) {
    const sceneRe = /\[장면\s*(\d+)\]/;
    const markers = [];
    for (const cue of srtCues) {
        const match = sceneRe.exec(cue.text);
        if (match) {
            markers.push({ clip: cue.clip, n: parseInt(match[1], 10) });
        }
    }
    if (markers.length === 0) throw new Error("SRT에서 '[장면 n]' 형태의 마커를 찾지 못했습니다.");
    
    const segments = [];
    for (let i = 0; i < markers.length; i++) {
        const startClip = markers[i].clip + 1;
        const endClip = (i + 1 < markers.length) ? markers[i+1].clip - 1 : srtCues[srtCues.length - 1].clip;
        if (startClip > endClip) continue;
        segments.push({ scene_n: markers[i].n, start: startClip, end: endClip });
    }

    const imgMap = new Map(imgFiles.map(f => [f.name, f]));
    const rows = [];
    const effectCycle = ["left", "down", "right", "up"];
    let effectIdx = 0;

    for (const seg of segments) {
        const sceneNum = seg.scene_n;
        const imgName = `${String(sceneNum).padStart(3, '0')}.jpg`;
        const imgFile = imgMap.get(imgName);

        if (imgFile) {
            const effect = `fade-in-${effectCycle[effectIdx % effectCycle.length]}`;
            effectIdx++;

            rows.push({
                start_clip: seg.start,
                end_clip: seg.start,
                image_file: imgFile,
                effect_type: effect,
                scene: 1 
            });

            if (seg.start < seg.end) {
                rows.push({
                    start_clip: seg.start + 1,
                    end_clip: seg.end,
                    image_file: imgFile,
                    effect_type: 'none',
                    scene: 1
                });
            }
        }
    }
    return rows;
}

// --- Vrew(.zip) 파일 처리 로직 ---

async function processVrewFile() {
    if (state.isBusy) return;
    if (!state.srtFile || state.imgFiles.length === 0 || !state.vrewFile) {
        window.toast("SRT, 이미지 폴더, Vrew 파일을 모두 선택해주세요.", "warning");
        return;
    }

    state.isBusy = true;
    updateUI();

    try {
        setStatus("1/5: SRT 파일 분석 중...");
        const srtContent = await state.srtFile.text();
        const srtCues = parseSrt(srtContent);

        setStatus("2/5: 이미지 매핑 데이터 생성 중...");
        const mappingData = buildMapping(srtCues, state.imgFiles);
        if (mappingData.length === 0) throw new Error("매칭되는 이미지가 없습니다. 파일명을 확인하세요 (예: 001.jpg).");

        setStatus("3/5: Vrew 프로젝트 파일(.zip) 로드 중...");
        const zip = await JSZip.loadAsync(state.vrewFile);
        const projectJsonFile = zip.file("project.json");
        if (!projectJsonFile) throw new Error("Vrew 파일에 project.json이 없습니다.");
        const project = JSON.parse(await projectJsonFile.async("string"));
        
        const scenes = project.transcript?.scenes;
        if (!scenes || scenes.length === 0) throw new Error("프로젝트에 장면(scene)이 없습니다.");

        setStatus("4/5: 이미지 삽입 및 프로젝트 수정 중...");
        
        const assets = project.props.assets || {};
        project.props.assets = assets;

        for (const row of mappingData) {
            const { start_clip, end_clip, image_file, effect_type } = row;

            const mediaId = crypto.randomUUID();
            const mediaFilename = `${mediaId}.jpg`;
            zip.file(`media/${mediaFilename}`, image_file);

            project.files.push({
                version: 2, type: "IMAGE", path: "", mediaId: mediaId,
                fileLocation: "IN_MEMORY", sourceOrigin: "USER", isTransparent: false, fileSize: 0
            });

            const assetId = crypto.randomUUID();
            assets[assetId] = {
                mediaId: mediaId, xPos: 0, yPos: 0, height: 1, width: 1,
                rotation: 0, zIndex: 99, type: "image",
                importType: "scripted",
                assetEffectInfo: { type: effect_type, duration: effect_type === 'none' ? 0 : 2000 },
            };

            const scene = scenes[row.scene - 1];
            for (let i = start_clip - 1; i < end_clip; i++) {
                if (scene.clips[i]) {
                    scene.clips[i].assetIds = scene.clips[i].assetIds || [];
                    scene.clips[i].assetIds.push(assetId);
                }
            }
        }

        if (UI.deleteMarkersCheck.checked) {
            const sceneRe = /\[장면\s*(\d+)\]/;
            for (const scene of scenes) {
                scene.clips = scene.clips.filter(clip => !sceneRe.test(clip.words.map(w => w.text).join('')));
            }
        }
        
        zip.file("project.json", JSON.stringify(project, null, 2));

        setStatus("5/5: 새로운 Vrew 파일 생성 및 다운로드...");
        const newVrewBlob = await zip.generateAsync({ type: "blob" });
        
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(newVrewBlob);
        const originalName = state.vrewFile.name.replace(/\.vrew$/, '');
        downloadLink.download = `${originalName}_automated.vrew`;
        downloadLink.click();
        URL.revokeObjectURL(downloadLink.href);

        window.toast("Vrew 자동화 작업 완료!", "success");
        setStatus("준비됨.");

    } catch (error) {
        console.error("Vrew 자동화 실패:", error);
        window.toast(`오류: ${error.message}`, "error", 4000);
        setStatus(`오류 발생: ${error.message}`);
    } finally {
        state.isBusy = false;
        updateUI();
    }
}

// --- UI 업데이트 및 이벤트 핸들러 ---

function updateUI() {
    UI.startBtn.disabled = state.isBusy;
    UI.startBtn.textContent = state.isBusy ? "처리 중..." : "자동화 시작";
}

function setStatus(message) {
    UI.statusDisplay.textContent = message;
}

export function initVrew({ mount }) {
    const root = document.querySelector(mount);
    root.innerHTML = `
        <div class="section">
            <div class="section-header">
                <div class="section-title">Vrew 자동화</div>
            </div>
            <p class="muted">SRT 자막의 '[장면 n]' 마커를 기준으로, 이미지 폴더의 'nnn.jpg' 파일을 찾아 Vrew 프로젝트에 자동으로 삽입합니다.</p>
            <div class="vrew-form-grid">
                <label for="vrew-srt-input">1. SRT 자막 파일</label>
                <div>
                    <button class="btn btn-sm btn-outline" onclick="document.getElementById('vrew-srt-input').click()">파일 선택</button>
                    <span id="vrew-srt-display" class="file-display">선택된 파일 없음</span>
                    <input type="file" id="vrew-srt-input" accept=".srt" style="display:none;">
                </div>

                <label for="vrew-img-input">2. 이미지 폴더</label>
                <div>
                    <button class="btn btn-sm btn-outline" onclick="document.getElementById('vrew-img-input').click()">폴더 선택</button>
                    <span id="vrew-img-display" class="file-display">선택된 폴더 없음</span>
                    <input type="file" id="vrew-img-input" webkitdirectory directory multiple style="display:none;">
                </div>

                <label for="vrew-vrew-input">3. 원본 Vrew 파일</label>
                <div>
                    <button class="btn btn-sm btn-outline" onclick="document.getElementById('vrew-vrew-input').click()">파일 선택</button>
                    <span id="vrew-vrew-display" class="file-display">선택된 파일 없음</span>
                    <input type="file" id="vrew-vrew-input" accept=".vrew" style="display:none;">
                </div>
            </div>

            <div class="vrew-options">
                <input type="checkbox" id="vrew-delete-markers-check" checked>
                <label for="vrew-delete-markers-check">작업 후 '[장면]' 텍스트 클립 삭제</label>
            </div>

            <div class="vrew-actions">
                <button id="vrew-start-btn" class="btn btn-primary">자동화 시작</button>
                <div id="vrew-status" class="vrew-status-display">준비됨.</div>
            </div>
        </div>
    `;

    UI.root = root;
    UI.srtInput = root.querySelector('#vrew-srt-input');
    UI.srtDisplay = root.querySelector('#vrew-srt-display');
    UI.imgInput = root.querySelector('#vrew-img-input');
    UI.imgDisplay = root.querySelector('#vrew-img-display');
    UI.vrewInput = root.querySelector('#vrew-vrew-input');
    UI.vrewDisplay = root.querySelector('#vrew-vrew-display');
    UI.deleteMarkersCheck = root.querySelector('#vrew-delete-markers-check');
    UI.startBtn = root.querySelector('#vrew-start-btn');
    UI.statusDisplay = root.querySelector('#vrew-status');

    UI.srtInput.onchange = (e) => {
        state.srtFile = e.target.files[0];
        UI.srtDisplay.textContent = state.srtFile ? state.srtFile.name : "선택된 파일 없음";
    };
    UI.imgInput.onchange = (e) => {
        state.imgFiles = Array.from(e.target.files);
        UI.imgDisplay.textContent = state.imgFiles.length > 0 ? `${state.imgFiles.length}개 이미지 선택됨` : "선택된 폴더 없음";
    };
    UI.vrewInput.onchange = (e) => {
        state.vrewFile = e.target.files[0];
        UI.vrewDisplay.textContent = state.vrewFile ? state.vrewFile.name : "선택된 파일 없음";
    };

    UI.startBtn.onclick = processVrewFile;
}