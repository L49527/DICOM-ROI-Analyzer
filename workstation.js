/* Layout and display state only. DICOM, ROI geometry, and results remain in memory. */
const WorkstationUI = (() => {
    'use strict';
    const byId = id => document.getElementById(id);
    let isMounted = false, fit = true, dockHeight = 278, scheduled = 0;
    // The layout is static in index.html. mount() only wires the native <dialog> close behaviour.
    function mount() {
        if (isMounted) return;
        document.querySelectorAll('dialog.work-dialog').forEach(node => {
            node.querySelector('[data-close-dialog]').addEventListener('click', () => node.close());
            node.addEventListener('click', event => {
                if (event.target !== node) return;
                const box = node.getBoundingClientRect();
                if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) node.close();
            });
        });
        isMounted = true;
    }
    function openDialog(id) {
        const node = byId(id);
        if (!node.open) node.showModal();
    }
    function showPanel(name, shouldFocus) {
        if (name === 'view') openDialog('workViewDialog');
        else if (shouldFocus) byId(name === 'analysis' ? 'analysisScope' : 'roiRadius').focus();
    }
    function updatePreview(preview) {
        const run = ROIWorkflow.getRun();
        const status = run?.status;
        byId('workSummary').textContent = status === 'running' ? `分析中 · ${run.index} / ${run.tasks.length} 張` :
            ['complete', 'partial'].includes(status) ? `成功 ${run.successes} 張 · 失敗 ${run.failures.length} 張 · ${run.results.length} 列 ROI 結果` :
            `${preview.series.length} Series · ${preview.tasks.length} 張 · ${state.roiCenters.length} ROI · 預計 ${preview.tasks.length * state.roiCenters.length} 列`;
        byId('workDetailsSummary').textContent = byId('previewCounts').textContent;
        const hasSeries = state.seriesMap.size > 0;
        const issues = hasSeries ? preview.unresolved + preview.errors.length : 0;
        const previewBtn = byId('workPreviewBtn');
        previewBtn.textContent = issues ? `處理待確認項目（${issues}）` : `逐 Series 明細（${preview.series.length}）`;
        previewBtn.classList.toggle('has-issues', Boolean(issues));
        previewBtn.disabled = !hasSeries;
        byId('workReviewBtn').disabled = !hasSeries;
        // Idle guidance only; run messages (running / complete / stale / cancelled) keep their own text.
        if (!run) {
            const status = byId('analysisStatus');
            status.textContent = !hasSeries ? '先載入 Series，再放置 ROI。' :
                !state.roiCenters.length ? '在影像空白處點擊以放置 ROI。' :
                issues ? `有 ${issues} 項待確認，按「處理待確認項目」檢查。` : '條件已就緒，可開始分析。';
            status.dataset.tone = hasSeries && state.roiCenters.length && !issues ? 'success' : 'info';
        }
        byId('cancelAnalysisBtn').hidden = status !== 'running';
        byId('workMeasureTitle').textContent = state.toolMode === 'line' ? '線段剖面' : 'ROI 清單';
    }
    function syncZoomLabel() {
        const label = `${Number(state.zoom.toFixed(1))}%`;
        elements.zoomSlider.value = state.zoom; elements.zoomValue.textContent = label;
        elements.zoomResetBtn.textContent = label;
        byId('workFitBtn').setAttribute('aria-pressed', String(fit));
    }
    function prepareFrame() {
        if (!isMounted) return;
        if (fit && state.imageRows && state.imageCols) {
            const rotated = state.rotation === 90 || state.rotation === 270;
            const width = rotated ? state.imageRows : state.imageCols, height = rotated ? state.imageCols : state.imageRows;
            const bounds = elements.imageContainer;
            if (bounds.clientWidth > 24 && bounds.clientHeight > 24) state.zoom = Math.min(400, 100 * Math.min((bounds.clientWidth - 16) / width, (bounds.clientHeight - 16) / height));
            state.panX = 0; state.panY = 0; updatePanTransform();
        }
        syncZoomLabel();
    }
    function queueFit() {
        cancelAnimationFrame(scheduled);
        scheduled = requestAnimationFrame(() => { if (fit && state.pixelData) renderImage(); });
    }
    function setDockHeight(value) {
        const total = byId('viewerPanel').clientHeight;
        dockHeight = Math.max(230, Math.min(Math.max(230, total - 240), value));
        byId('viewerPanel').style.setProperty('--dock-height', `${dockHeight}px`);
        byId('workResizeHandle').setAttribute('aria-valuenow', String(Math.round(100 * dockHeight / Math.max(1, total))));
        queueFit();
    }
    function init() {
        byId('workViewBtn').addEventListener('click', () => openDialog('workViewDialog'));
        ['workReviewBtn', 'workPreviewBtn'].forEach(id => byId(id).addEventListener('click', () => openDialog('workDetailsDialog')));
        byId('workFitBtn').addEventListener('click', () => { fit = true; renderImage(); });
        byId('workFullscreenBtn').addEventListener('click', () => byId('fullscreenBtn').click());
        document.addEventListener('fullscreenchange', queueFit);
        document.addEventListener('webkitfullscreenchange', queueFit);
        byId('workResetLayout').addEventListener('click', () => setDockHeight(278));
        document.querySelectorAll('[data-grid-spacing]').forEach(node => node.addEventListener('click', () => {
            const input = byId('gridSpacing'); input.value = node.dataset.gridSpacing;
            input.dispatchEvent(new Event('input'));
        }));
        const handle = byId('workResizeHandle');
        handle.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            const start = event.clientY, initial = dockHeight;
            handle.setPointerCapture(event.pointerId); event.preventDefault();
            const resize = moveEvent => setDockHeight(initial + start - moveEvent.clientY);
            const end = () => { handle.removeEventListener('pointermove', resize); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end); };
            handle.addEventListener('pointermove', resize); handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
        });
        handle.addEventListener('keydown', event => {
            if (!['ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            setDockHeight(event.key === 'Home' ? 278 : dockHeight + (event.key === 'ArrowUp' ? 20 : -20));
        });
        new ResizeObserver(queueFit).observe(elements.imageContainer);
        window.addEventListener('resize', () => setDockHeight(dockHeight));
        document.addEventListener('keydown', event => {
            if (document.querySelector('dialog[open]')) return;
            const modal = Array.from(document.querySelectorAll('.modal:not(.hidden)')).pop();
            if (!modal) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hideModal(modal.id); return; }
            if (event.key !== 'Tab') return;
            const items = Array.from(modal.querySelectorAll('button, input, select, a[href], [tabindex="0"]')).filter(node => !node.disabled && node.getClientRects().length);
            if (!items.length) return;
            const index = items.indexOf(document.activeElement);
            if (index < 0 || (!event.shiftKey && index === items.length - 1) || (event.shiftKey && index === 0)) {
                event.preventDefault(); (event.shiftKey ? items[items.length - 1] : items[0]).focus();
            }
        }, true);
        setDockHeight(278); syncZoomLabel();
    }
    return { mount, init, mounted: () => isMounted, showPanel, updatePreview, prepareFrame,
        resetFit: () => { fit = true; }, useManualZoom: () => { fit = false; byId('workFitBtn')?.setAttribute('aria-pressed', 'false'); } };
})();
