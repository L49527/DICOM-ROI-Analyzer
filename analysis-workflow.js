/* UI orchestration. Measurement data stays in memory and is never persisted. */
const ROIWorkflow = (() => {
    'use strict';
    const byId = id => document.getElementById(id);
    let ready = false, revision = 0, sequence = 0, run = null, preview = null;
    const ties = new Map(), lockedControls = new Map();
    let drag = null, suppressClick = false, pendingRefresh = null, focusNextTie = false;
    const colors = ['#ff5050', '#36ca78', '#559cff', '#ff9900', '#db63e5', '#20cbd1', '#c8ae28', '#aa80ff'];
    const running = () => run?.status === 'running';
    const canExport = () => Boolean(run && ['complete', 'partial'].includes(run.status) && run.revision === revision && run.results.length);
    function config() {
        return AnalysisCore.settings({ mode: byId('sliceSelectionMode').value,
            target: byId('sliceLocationFilter').value, maxDistance: byId('maxSliceDistance').value });
    }
    function source() {
        return { centers: state.roiCenters.map(center => ({ ...center })), radius: state.roiRadius,
            targetArea: state.roiTargetAreaMm2, mode: state.crossSeriesRoiMode,
            geometry: AnalysisCore.geometry(state.currentDS),
            anchors: state.roiCenters.map((center, i) => state.roiPatientAnchors[i] || AnalysisCore.anchor(center, state.currentDS)) };
    }
    function seriesForScope(scope) {
        if (scope === 'all') return Array.from(state.seriesMap.values());
        const series = state.seriesMap.get(state.activeSeriesKey);
        return series ? [series] : [];
    }
    function buildPreview({ line = false } = {}) {
        const scope = line ? 'current' : byId('analysisScope').value;
        const output = { tasks: [], series: [], skipped: [], errors: [], filtered: 0, unresolved: 0, scope, config: null };
        try { output.config = config(); } catch (error) { output.errors.push(error.message); return output; }
        if (!line && !state.roiCenters.length) output.errors.push('請先在影像上放置 ROI');
        if (!line && scope === 'all' && !state.crossSeriesRoiEnabled) output.errors.push('請先啟用跨 Series ROI');
        if (!line && (!Number.isInteger(state.roiRadius) || state.roiRadius < 5 || state.roiRadius > 200)) output.errors.push('ROI 半徑必須是 5–200 px 的整數');
        const origin = source();
        const list = seriesForScope(scope);
        if (!list.length) output.errors.push('請先載入並選取 Series');
        list.forEach(series => {
            const files = scope === 'single' ? [state.files[Number(elements.singleImageSelect.value)]].filter(Boolean) : series.files;
            const selection = AnalysisCore.selectFiles(files, output.config, ties.get(series.key), scope === 'single');
            const name = `${series.seriesNumber ? `#${series.seriesNumber} · ` : ''}${getSeriesDisplayName(series)}`;
            const item = { key: series.key, name, count: selection.files.length,
                locations: [], candidates: selection.candidates, reasons: [], skipped: 0 };
            if (selection.reason) item.reasons.push(selection.reason);
            if (selection.candidates.length) output.unresolved++;
            output.filtered += selection.filtered;
            if (selection.filtered && !selection.files.length) output.skipped.push({ series: item.name, file: '', reason: selection.reason, count: selection.filtered });
            selection.files.forEach(fileObject => {
                const location = AnalysisCore.sliceLocation(fileObject.dataSet);
                if (!item.locations.some(value => value === location)) item.locations.push(location);
                const mapped = line ? {} : AnalysisCore.mapRois(origin, fileObject.dataSet,
                    scope === 'all' && (series.key !== state.activeSeriesKey || state.crossSeriesRoiMode === 'patient'));
                if (mapped.error) {
                    item.skipped++;
                    if (!item.reasons.includes(mapped.error)) item.reasons.push(mapped.error);
                    const record = { series: item.name, file: fileObject.file.name, reason: mapped.error, count: 1 };
                    if (mapped.invalid?.length) output.errors.push(`${item.name}／${fileObject.file.name}：${mapped.error}`);
                    else output.skipped.push(record);
                    return;
                }
                output.tasks.push({ fileObject, seriesName: item.name,
                    centers: mapped.centers, radius: mapped.radius, fileName: fileObject.file.name,
                    metadata: { ...AnalysisCore.selectionMetadata(fileObject.dataSet, output.config),
                        ROI_TransferMode: mapped.transferMode || 'fixed-pixel-coordinate' } });
            });
            output.series.push(item);
        });
        return output;
    }
    const format = value => value === null ? '位置缺漏' : `${Number(value.toFixed(6))} mm`;
    function renderPreview() {
        const root = byId('analysisPreview');
        root.replaceChildren();
        const groups = [true, false].map(problems => {
            const group = document.createElement('details');
            group.className = 'analysis-preview-group'; group.dataset.problems = String(problems); group.open = problems;
            const heading = document.createElement('summary'); group.append(heading); root.append(group);
            return group;
        });
        let problemCount = 0;
        preview.series.forEach(item => {
            const hasProblem = Boolean(item.candidates.length || item.reasons.length);
            if (hasProblem) problemCount++;
            const details = document.createElement('details');
            details.className = 'analysis-series-preview';
            details.open = Boolean(item.candidates.length || item.reasons.length);
            const summary = document.createElement('summary');
            summary.textContent = `${item.name} · ${item.candidates.length ? '等距待確認' : `${item.count - item.skipped} 張`}${item.skipped ? `（${item.skipped} 張未納入）` : ''}`;
            details.append(summary);
            if (item.locations.length) {
                const text = document.createElement('p');
                const locationText = item.locations.map(location => {
                    const offset = preview.config.target === null || location === null ? '' : `，偏差 ${format(location - preview.config.target)}`;
                    return `${format(location)}${offset}`;
                }).join('；');
                text.textContent = `實際位置：${locationText}`;
                details.append(text);
            }
            item.reasons.forEach(reason => {
                const text = document.createElement('p'); text.textContent = reason; details.append(text);
            });
            if (item.candidates.length) {
                const label = document.createElement('label');
                label.textContent = '選擇等距切片';
                const select = document.createElement('select');
                select.setAttribute('aria-label', `${item.name}：選擇等距切片`);
                select.add(new Option('請選擇位置', ''));
                item.candidates.forEach(value => select.add(new Option(format(value), String(value))));
                select.addEventListener('change', () => {
                    if (running()) return;
                    const candidates = item.candidates.slice();
                    const choice = select.value;
                    ties.set(item.key, choice);
                    if (byId('applyTieToSimilar').checked && choice !== '') {
                        preview.series.filter(other => JSON.stringify(other.candidates) === JSON.stringify(candidates))
                            .forEach(other => ties.set(other.key, choice));
                    }
                    focusNextTie = true;
                    invalidate('等距切片選擇已變更');
                });
                label.append(select); details.append(label);
            }
            groups[hasProblem ? 0 : 1].append(details);
        });
        groups[0].firstElementChild.textContent = `待確認或未納入 · ${problemCount} Series`;
        groups[1].firstElementChild.textContent = `正常 Series · ${preview.series.length - problemCount}`;
        groups[0].hidden = !problemCount;
        groups[1].hidden = preview.series.length === problemCount;
        byId('tieOptions').hidden = !preview.unresolved;
        byId('previewCounts').textContent = `${preview.series.length} 個 Series · ${preview.tasks.length} 張待分析 · ${preview.filtered} 張被切片規則排除${preview.unresolved ? ` · 另有 ${preview.unresolved} Series 等距待確認` : ''}`;
        const problems = [...new Set(preview.errors)];
        if (preview.unresolved) problems.unshift(`${preview.unresolved} 個 Series 有等距切片，請先選擇位置`);
        if (!preview.tasks.length && !problems.length) problems.push('沒有符合條件的影像，請調整切片規則');
        byId('analysisValidation').textContent = problems.slice(0, 5).join('\n') + (problems.length > 5 ? `\n另有 ${problems.length - 5} 項，請檢查各 Series 詳情` : '');
        byId('analysisValidation').hidden = !problems.length;
        if (focusNextTie) {
            focusNextTie = false;
            (root.querySelector('select') || byId('workDetailsSummary'))?.focus();
        }
    }
    function refresh() {
        if (!ready || running()) return;
        clearTimeout(pendingRefresh);
        const mode = byId('sliceSelectionMode').value;
        byId('sliceLocationFields').hidden = mode === 'all';
        byId('maxDistanceGroup').hidden = mode !== 'nearest';
        byId('singleImageGroup').hidden = byId('analysisScope').value !== 'single';
        preview = buildPreview();
        renderPreview();
        elements.analyzeBtn.disabled = !preview.tasks.length || preview.errors.length > 0 || preview.unresolved > 0;
        elements.exportBtn.disabled = !canExport();
        byId('cancelAnalysisBtn').disabled = true;
        updateRoiControls();
        WorkstationUI.updatePreview(preview);
    }
    function invalidate(reason = '分析設定已變更') {
        if (!ready) return;
        if (running()) cancel();
        revision++;
        if (run && run.status !== 'cancelled') {
            run.status = 'stale'; run.results = [];
            setStatus(`${reason}；舊結果已失效，請重新分析`, 'warning');
        }
        state.results = [];
        state.availableTags = new Set();
        byId('analysisResultTable').replaceChildren();
        byId('analysisRunDetails').replaceChildren();
        byId('analysisDetails').hidden = true;
        elements.exportBtn.disabled = true;
        hideModal('tagModal');
        clearTimeout(pendingRefresh);
        pendingRefresh = setTimeout(refresh, 0);
    }
    function setStatus(message, tone = 'info') {
        const node = byId('analysisStatus'); node.textContent = message; node.dataset.tone = tone;
        if (preview) WorkstationUI.updatePreview(preview);
    }
    function setLocked(lock) {
        const selectors = ['#roiSettingsSection input', '#roiSettingsSection select', '#roiSettingsSection button',
            '#workRoiHeader input',
            '#alignmentSettings input', '#alignmentSettings select', '#alignmentSettings button', '#tieOptions input',
            '#lineSettingsSection input', '#lineSettingsSection select', '#lineSettingsSection button',
            '#analysisSettings input', '#analysisSettings select', '#analysisPreview select',
            '#folderInput', '#filesInput', '#selectFolderBtn', '#selectFilesBtn', '#sidebarSelectFolderBtn', '#sidebarSelectFilesBtn',
            '#appendModeToggle', '#sidebarAppendModeToggle', '#openSeriesManagerBtn', '#seriesNavList button', '#seriesList button',
            '#prevBtn', '#nextBtn', '#imageSlider', 'input[name="toolMode"]'];
        if (lock) {
            document.querySelectorAll(selectors.join(',')).forEach(control => {
                lockedControls.set(control, control.disabled); control.disabled = true;
            });
        } else {
            lockedControls.forEach((disabled, control) => { control.disabled = disabled; });
            lockedControls.clear();
        }
        elements.analyzeBtn.disabled = lock;
        byId('cancelAnalysisBtn').disabled = !lock;
        elements.exportBtn.disabled = lock || !canExport();
        elements.analysisProgress.classList.toggle('hidden', !lock);
        byId('analysisStatus').setAttribute('aria-busy', String(lock));
    }
    function createWorker() {
        if (state.worker || !window.Worker) return;
        try {
            state.worker = new Worker('analysis-worker.js');
            state.worker.onmessage = event => onMessage(event.data);
            state.worker.onerror = onWorkerError;
        } catch (_) { state.worker = null; updateSystemStatus('compatibility'); }
    }
    function disposeWorker() {
        if (state.worker) { state.worker.onmessage = null; state.worker.onerror = null; state.worker.terminate(); state.worker = null; }
    }
    function start() {
        if (running()) return;
        refresh();
        if (!preview || preview.errors.length || preview.unresolved || !preview.tasks.length) {
            showToast('請先修正分析預覽中的提示', 'warning'); return;
        }
        // Dataset references are read-only. Copy and freeze all mutable measurement settings.
        const tasks = preview.tasks.map(task => Object.freeze({ ...task,
            centers: Object.freeze(task.centers.map(center => Object.freeze({ ...center }))),
            metadata: Object.freeze({ ...task.metadata }) }));
        run = { id: ++sequence, revision, status: 'running', index: 0, successes: 0, results: [], failures: [], waiting: false,
            tasks: Object.freeze(tasks), filtered: preview.filtered,
            skipped: preview.skipped.map(item => ({ ...item })), scope: preview.scope };
        state.results = [];
        byId('analysisRunDetails').replaceChildren();
        byId('analysisResultTable').replaceChildren();
        hideModal('tagModal');
        setLocked(true);
        setStatus('分析中；ROI、來源與切片規則已鎖定，可調整影像顯示或取消');
        updateSystemStatus('processing');
        createWorker();
        dispatch();
    }
    function taskPayload(task) {
        return { centers: task.centers, radius: task.radius, metadata: task.metadata, fileName: task.fileName };
    }
    function progress() {
        const percent = Math.round(run.index / run.tasks.length * 100);
        elements.progressFill.style.width = `${percent}%`;
        elements.progressText.textContent = `${percent}%（${run.index}/${run.tasks.length} 張；失敗 ${run.failures.length} 張）`;
        WorkstationUI.updatePreview(preview);
    }
    function dispatch() {
        if (!running()) return;
        progress();
        if (run.index >= run.tasks.length) { finish(); return; }
        const task = run.tasks[run.index], id = run.id, index = run.index;
        if (state.worker) {
            run.waiting = true;
            try {
                // Copy the bytes: transferring the original would detach the viewer's data.
                const bytes = task.fileObject.byteArray.slice();
                state.worker.postMessage({ type: 'analyze_task', runId: id, taskIndex: index,
                    bytes, task: taskPayload(task), tags: COMMON_TAGS }, [bytes.buffer]);
            } catch (_) { onWorkerError(); }
        } else {
            run.waiting = false;
            setTimeout(() => {
                if (!running() || run.id !== id || run.index !== index) return;
                try { accept(AnalysisCore.analyze(task.fileObject.dataSet, taskPayload(task), COMMON_TAGS)); }
                catch (error) { accept([], error.message); }
            }, 0);
        }
    }
    function onMessage(message) {
        if (message.type !== 'task_complete' || !running() || !run.waiting ||
            message.runId !== run.id || message.taskIndex !== run.index) return;
        run.waiting = false;
        accept(message.results || [], message.error);
    }
    function onWorkerError() {
        disposeWorker();
        updateSystemStatus('compatibility');
        if (running()) {
            run.waiting = false;
            setStatus('背景模組無法使用，改以相容模式繼續；已完成資料不會重複計算', 'warning');
            dispatch();
        }
    }
    function accept(results, error) {
        if (!running()) return;
        const task = run.tasks[run.index];
        if (error || !results.length) run.failures.push({ series: task.seriesName, file: task.fileName, reason: error || '沒有產生 ROI 結果', count: 1 });
        else { run.results.push(...results); run.successes++; }
        run.index++;
        setTimeout(dispatch, 0);
    }
    function renderRunDetails() {
        const root = byId('analysisRunDetails'); root.replaceChildren();
        [...run.skipped, ...run.failures].forEach(record => {
            const li = document.createElement('li');
            li.textContent = `${record.series}${record.file ? `／${record.file}` : ''}：${record.reason}${record.count > 1 ? `（${record.count} 張）` : ''}`;
            root.append(li);
        });
        byId('analysisDetails').hidden = !root.childElementCount;
    }
    function resultTable() {
        const root = byId('analysisResultTable'); root.replaceChildren();
        if (!run.results.length) return;
        const table = document.createElement('table'); table.className = 'help-table';
        const head = table.createTHead().insertRow();
        ['檔案', 'ROI', '平均值', 'SD'].forEach(value => { const th = document.createElement('th'); th.textContent = value; head.append(th); });
        const body = table.createTBody();
        run.results.slice(0, 20).forEach(result => {
            const tr = body.insertRow();
            [result.FileName, result.ROI_ID, result.ROI_Mean, result.ROI_Noise_SD].forEach(value => { tr.insertCell().textContent = value; });
        });
        root.append(table);
        if (run.results.length > 20) { const note = document.createElement('p'); note.textContent = '預覽前 20 列；CSV 包含本次所有成功結果。'; root.append(note); }
    }
    function finish() {
        run.status = run.failures.length ? 'partial' : 'complete';
        state.results = run.results;
        state.availableTags = new Set(Object.keys(run.results[0] || {}));
        setLocked(false);
        renderRunDetails(); resultTable();
        const geometrySkipped = run.skipped.filter(record => record.file).length;
        const label = run.failures.length ? (run.successes ? '部分完成' : '分析失敗') : '分析完成';
        setStatus(`${label}：成功 ${run.successes} 張／切片篩除 ${run.filtered} 張／對位略過 ${geometrySkipped} 張／失敗 ${run.failures.length} 張；${run.results.length} 列 ROI 結果。${run.failures.length && run.successes ? '可手動匯出成功結果，請先檢查失敗清單。' : ''}`,
            run.failures.length || geometrySkipped ? 'warning' : 'success');
        updateSystemStatus(state.worker ? 'ready' : 'compatibility');
        refresh();
    }
    function cancel() {
        if (!running()) return;
        const completed = run.index;
        run.status = 'cancelled'; run.waiting = false; run.results = [];
        state.results = [];
        disposeWorker(); setLocked(false);
        renderRunDetails(); byId('analysisResultTable').replaceChildren();
        setStatus(`已取消（已處理 ${completed}/${run.tasks.length} 張）；本次結果不提供匯出`, 'warning');
        updateSystemStatus('ready'); refresh();
    }
    function renderRoiList() {
        const container = elements.roiListContainer;
        const focusName = container.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
        container.replaceChildren();
        if (!state.roiCenters.length) { container.textContent = '尚未放置 ROI'; return; }
        const table = document.createElement('table'); table.className = 'roi-coordinate-table';
        table.setAttribute('aria-label', 'ROI 座標');
        const header = table.createTHead().insertRow();
        ['ROI', 'X（像素）', 'Y（像素）'].forEach(text => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; header.append(th); });
        const body = table.createTBody(); container.append(table);
        state.roiCenters.forEach((center, index) => {
            const item = body.insertRow();
            item.className = 'roi-editor-row';
            const invalid = !AnalysisCore.circleFits(center, state.roiRadius, state.imageCols, state.imageRows);
            item.classList.toggle('selected', state.selectedRoiIndex === index);
            item.classList.toggle('invalid', invalid);
            const select = document.createElement('button'); select.className = 'roi-select';
            select.type = 'button'; select.textContent = `ROI ${index + 1}`;
            select.style.borderLeftColor = colors[index % colors.length];
            select.setAttribute('aria-pressed', String(state.selectedRoiIndex === index));
            select.disabled = running();
            select.setAttribute('aria-label', `選取 ROI ${index + 1}`);
            select.addEventListener('click', () => selectRoi(index)); item.insertCell().append(select);
            ['x', 'y'].forEach(axis => {
                const input = document.createElement('input'); input.type = 'number'; input.step = '1'; input.value = center[axis];
                input.disabled = running(); input.setAttribute('aria-label', `ROI ${index + 1} ${axis.toUpperCase()}`);
                input.setAttribute('aria-invalid', String(invalid));
                input.addEventListener('change', () => {
                    if (running()) return;
                    const value = Number(input.value);
                    if (input.value.trim() === '' || !Number.isInteger(value)) {
                        showToast('ROI 座標必須是整數', 'warning'); input.value = center[axis]; return;
                    }
                    state.selectedRoiIndex = index;
                    state.roiCenters[index][axis] = value;
                    state.roiPatientAnchors[index] = AnalysisCore.anchor(state.roiCenters[index], state.currentDS);
                    // Invalidate immediately, but let Tab finish moving focus before
                    // refresh rebuilds the table and restores that destination.
                    invalidate('ROI 座標已變更'); renderImage(); updateOverlayInfo();
                });
                item.insertCell().append(input);
            });
            if (invalid) { const message = body.insertRow().insertCell(); message.colSpan = 3; message.className = 'roi-boundary-note'; message.textContent = `ROI ${index + 1} 圓周超出影像，請移動或縮小`; }
        });
        if (focusName) Array.from(container.querySelectorAll('[aria-label]')).find(node => node.getAttribute('aria-label') === focusName)?.focus({ preventScroll: true });
    }
    function selectRoi(index) {
        if (running()) return;
        state.selectedRoiIndex = index;
        updateRoiControls(); renderImage();
    }
    function changed(message) {
        invalidate(message); updateRoiControls(); renderImage(); updateOverlayInfo();
    }
    function deleteSelected() {
        if (running() || !state.roiCenters.length) return;
        const index = state.selectedRoiIndex >= 0 ? state.selectedRoiIndex : state.roiCenters.length - 1;
        state.roiCenters.splice(index, 1); state.roiPatientAnchors.splice(index, 1);
        state.selectedRoiIndex = Math.min(index, state.roiCenters.length - 1);
        changed('ROI 已刪除');
    }
    function hit(coords) {
        const selected = state.selectedRoiIndex;
        const inside = i => Math.hypot(coords.x - state.roiCenters[i].x, coords.y - state.roiCenters[i].y) <= state.roiRadius;
        if (selected >= 0 && state.roiCenters[selected] && inside(selected)) return selected;
        for (let i = state.roiCenters.length - 1; i >= 0; i--) if (inside(i)) return i;
        return -1;
    }
    function mouseDown(event) {
        if (running() || state.toolMode !== 'roi' || event.button !== 0 || state.isSpaceHeld || !state.currentDS) return false;
        suppressClick = false;
        const coords = getCanvasCoordinates(event), index = hit(coords);
        if (index < 0) return false;
        selectRoi(index);
        drag = { index, start: coords, center: { ...state.roiCenters[index] }, moved: false };
        event.preventDefault(); return true;
    }
    function mouseMove(event) {
        if (!drag || running()) return false;
        const coords = getCanvasCoordinates(event);
        const dx = coords.x - drag.start.x, dy = coords.y - drag.start.y;
        if (!drag.moved && Math.hypot(dx, dy) < 2) return true;
        drag.moved = true;
        state.roiCenters[drag.index] = { x: drag.center.x + dx, y: drag.center.y + dy };
        renderImage(); return true;
    }
    function mouseUp() {
        if (!drag) return false;
        suppressClick = true;
        if (drag.moved) {
            state.roiPatientAnchors[drag.index] = AnalysisCore.anchor(state.roiCenters[drag.index], state.currentDS);
            changed('ROI 已移動');
        }
        drag = null; return true;
    }
    function click(event) {
        if (running()) return true;
        if (suppressClick) { suppressClick = false; return true; }
        if (!state.currentDS) return true;
        const coords = getCanvasCoordinates(event), index = hit(coords);
        if (index >= 0) { selectRoi(index); return true; }
        if (coords.x < 0 || coords.y < 0 || coords.x >= state.imageCols || coords.y >= state.imageRows) return true;
        return false;
    }
    function selectLineFiles() {
        const selection = buildPreview({ line: true });
        if (selection.errors.length || selection.unresolved || !selection.tasks.length) {
            showToast(selection.errors[0] || (selection.unresolved ? '目前 Series 有等距切片；請將分析範圍改為目前 Series，再於預覽選擇位置' : '沒有符合切片規則的影像'), 'warning', 6000);
            return null;
        }
        return selection;
    }
    function init() {
        ready = true; state.selectedRoiIndex = -1;
        ['analysisScope', 'sliceSelectionMode', 'sliceLocationFilter', 'maxSliceDistance'].forEach(id => {
            byId(id).addEventListener(id === 'sliceLocationFilter' || id === 'maxSliceDistance' ? 'input' : 'change', () => {
                if (running()) return;
                ties.clear(); invalidate('分析條件已變更');
            });
        });
        byId('cancelAnalysisBtn').addEventListener('click', cancel);
        byId('deleteSelectedRoiBtn').addEventListener('click', deleteSelected);
        refresh();
    }
    return { init, refresh, invalidate, running, canExport, start, cancel, onMessage, onWorkerError,
        renderRoiList, deleteSelected, mouseDown, mouseMove, mouseUp, click, selectLineFiles, config,
        buildPreview, getRun: () => run };
})();
