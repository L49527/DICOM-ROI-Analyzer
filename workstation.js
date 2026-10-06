/* Layout and display state only. DICOM, ROI geometry, and results remain in memory. */
const WorkstationUI = (() => {
    'use strict';
    const byId = id => document.getElementById(id);
    let isMounted = false, fit = true, dockHeight = 278, scheduled = 0;
    const move = (node, parent) => { if (node && parent) parent.append(node); };
    function button(id, text, icon) {
        const node = document.createElement('button');
        node.id = id; node.type = 'button'; node.className = 'btn btn-secondary btn-sm';
        if (icon) { const glyph = document.createElement('i'); glyph.className = `fa-solid ${icon}`; glyph.setAttribute('aria-hidden', 'true'); node.append(glyph); }
        node.append(document.createTextNode(` ${text}`)); return node;
    }
    function disclosure(title, id) {
        const node = document.createElement('details'); node.className = 'work-disclosure';
        if (id) node.id = id;
        const summary = document.createElement('summary'); summary.textContent = title; node.append(summary);
        return node;
    }
    function dialog(id, title) {
        const node = document.createElement('dialog'); node.id = id; node.className = 'work-dialog';
        node.setAttribute('aria-labelledby', `${id}Title`);
        node.innerHTML = `<header class="work-dialog-heading"><h2 id="${id}Title">${title}</h2><button type="button" class="btn btn-ghost" data-close-dialog aria-label="關閉${title}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header><div class="work-dialog-body"></div>`;
        document.querySelector('.app-container').append(node);
        node.querySelector('[data-close-dialog]').addEventListener('click', () => node.close());
        node.addEventListener('click', event => { if (event.target === node && (event.clientX < node.getBoundingClientRect().left || event.clientX > node.getBoundingClientRect().right || event.clientY < node.getBoundingClientRect().top || event.clientY > node.getBoundingClientRect().bottom)) node.close(); });
        return node;
    }
    function openDialog(id) {
        const node = byId(id);
        if (!node.open) node.showModal();
    }
    function mount() {
        if (isMounted) return;
        document.body.classList.add('precision-workstation');
        const root = byId('viewerPanel'), canvasSection = root.querySelector('.image-section');
        const measure = byId('inspector-panel-measure'), analysis = byId('inspector-panel-analysis'), view = byId('inspector-panel-view');
        const settings = dialog('workViewDialog', '影像設定');
        move(view, settings.querySelector('.work-dialog-body')); view.hidden = false;
        view.removeAttribute('role'); view.removeAttribute('aria-labelledby');
        const presets = root.querySelector('.toolbar-presets-group');
        settings.querySelector('.work-dialog-body').prepend(presets);
        const inspection = dialog('workDetailsDialog', '分析預覽與結果');
        const body = inspection.querySelector('.work-dialog-body');
        move(byId('analysisPreview'), body); move(analysis.querySelector('.analysis-help'), body);
        move(byId('analysisDetails'), body); move(analysis.querySelector('.analysis-result-preview'), body);
        const detailsHeading = document.createElement('p'); detailsHeading.id = 'workDetailsSummary'; detailsHeading.tabIndex = -1; detailsHeading.setAttribute('role', 'status'); body.prepend(detailsHeading);
        detailsHeading.after(byId('tieOptions'));

        const dock = document.createElement('section'); dock.id = 'workDock'; dock.className = 'work-dock'; dock.setAttribute('aria-label', 'ROI 與分析工作區');
        [measure, analysis].forEach(panel => { panel.hidden = false; panel.removeAttribute('role'); panel.removeAttribute('aria-labelledby'); move(panel, dock); });
        root.querySelector('.inspector-panel').remove();
        const splitter = document.createElement('div'); splitter.id = 'workSplitter'; splitter.className = 'work-splitter';
        splitter.innerHTML = '<div id="workResizeHandle" tabindex="0" role="separator" aria-label="調整影像與工具高度" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100"><i class="fa-solid fa-grip" aria-hidden="true"></i></div>';
        const reset = button('workResetLayout', '重設布局', 'fa-arrow-rotate-left'); splitter.append(reset);
        root.append(splitter, dock);

        const footer = document.createElement('footer'); footer.id = 'workActionBar';
        footer.innerHTML = '<div class="work-run-summary"><strong id="workSummary" aria-live="polite">載入影像以開始</strong></div><div class="work-run-actions"></div>';
        document.querySelector('.app-container').append(footer);
        move(byId('analysisStatus'), footer.querySelector('.work-run-summary'));
        move(byId('analysisProgress'), footer.querySelector('.work-run-summary'));
        const actions = footer.querySelector('.work-run-actions');
        const review = button('workReviewBtn', '明細', 'fa-list-check'); move(review, actions);
        move(byId('cancelAnalysisBtn'), actions); move(byId('exportBtn'), actions); move(byId('analyzeBtn'), actions);
        byId('exportBtn').className = 'btn btn-secondary'; byId('exportBtn').innerHTML = '<i class="fa-solid fa-file-export" aria-hidden="true"></i> 匯出 CSV';
        byId('exportBtn').title = '選擇欄位並匯出 CSV';
        byId('analyzeBtn').innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i> 開始分析';
        analysis.querySelector('.analysis-actions').remove();
        byId('analysisStatus').textContent = '先載入 Series，再放置 ROI。';

        const measureHeading = measure.querySelector('h3'); measureHeading.innerHTML = '<i class="fa-solid fa-crosshairs" aria-hidden="true"></i><span id="workMeasureTitle">ROI 清單</span>';
        measure.querySelector('.tool-mode-summary').hidden = true;
        const roiSection = byId('roiSettingsSection'), sizes = document.createElement('div'); sizes.className = 'work-roi-sizes';
        [byId('roiRadius'), byId('roiArea')].forEach(input => move(input.closest('.control-group'), sizes));
        roiSection.prepend(sizes);
        const roiHeader = document.createElement('div'); roiHeader.id = 'workRoiHeader'; roiHeader.className = 'work-roi-heading';
        measure.querySelector('.control-card').prepend(roiHeader); roiHeader.append(measureHeading, sizes);
        byId('roiRadius').closest('.control-group').querySelector('label').textContent = '半徑';
        byId('roiArea').closest('.control-group').querySelector('label').textContent = '面積';
        const advanced = disclosure('進階與對位', 'alignmentSettings');
        ['crossSeriesRoiToggle', 'crossSeriesRoiMode'].forEach(id => move(byId(id).closest('.control-group'), advanced));
        move(byId('crossSeriesRoiStatus'), advanced); move(byId('roiPhysicalInfo'), advanced);
        const areaHint = byId('roiArea').closest('.control-group').querySelector('.hint'); move(areaHint, advanced);
        const roiActions = disclosure('ROI 操作與說明', 'workRoiActions');
        move(byId('deleteSelectedRoiBtn'), roiActions); move(byId('deleteLastRoiBtn').closest('.roi-buttons'), roiActions);
        Array.from(roiSection.querySelectorAll(':scope > .hint')).forEach(node => move(node, roiActions));
        const countGroup = byId('roiCount').closest('.control-group'); countGroup.hidden = true;
        roiSection.append(roiActions);
        analysis.querySelector('h3').innerHTML = '<i class="fa-solid fa-sliders" aria-hidden="true"></i> 分析條件';
        analysis.querySelector('.subsection-label').hidden = true;
        byId('previewCounts').classList.add('work-preview-counts');
        analysis.querySelector('.control-card').append(advanced);
        const reviewInline = button('workPreviewBtn', '逐 Series 明細', 'fa-list-check');
        analysis.querySelector('.control-card').append(reviewInline);
        analysis.querySelector('.control-card > .hint').hidden = true;

        const viewerBar = document.createElement('div'); viewerBar.className = 'work-viewer-bar';
        move(root.querySelector('.canvas-slice-nav'), viewerBar);
        const location = document.createElement('span'); location.id = 'workSliceLocation'; location.className = 'work-viewer-info'; location.textContent = 'Loc: --'; viewerBar.append(location);
        byId('viewerWwlStatus').classList.add('work-viewer-info'); move(byId('viewerWwlStatus'), viewerBar);
        move(root.querySelector('.canvas-toolbar'), viewerBar);
        const tools = viewerBar.querySelector('.canvas-toolbar');
        const viewButton = button('workViewBtn', '影像設定', 'fa-sliders');
        const fitButton = button('workFitBtn', '符合畫布', 'fa-expand');
        tools.insertBefore(viewButton, tools.querySelector('.toolbar-zoom-group'));
        tools.insertBefore(fitButton, tools.querySelector('.toolbar-zoom-group'));
        const full = button('workFullscreenBtn', '', 'fa-expand'); full.setAttribute('aria-label', '全螢幕'); full.title = '全螢幕 (F)'; tools.append(full);
        byId('fullscreenBtn').setAttribute('aria-label', '離開全螢幕');
        canvasSection.append(viewerBar);
        canvasSection.querySelector('.viewer-statusbar').classList.add('work-aux-status');

        const header = document.querySelector('.header'), context = document.createElement('div'); context.className = 'work-context';
        const seriesButton = byId('openSeriesManagerBtn'); seriesButton.innerHTML = '<i class="fa-solid fa-list" aria-hidden="true"></i> Series'; seriesButton.setAttribute('aria-haspopup', 'dialog');
        context.append(seriesButton); move(byId('activeSeriesCard'), context);
        header.insertBefore(context, header.querySelector('.header-controls'));
        const local = document.createElement('span'); local.className = 'work-local'; local.textContent = '本機處理'; header.querySelector('.header-controls').prepend(local);
        const seriesModal = byId('seriesManagerModal'); seriesModal.classList.add('work-series-drawer'); seriesModal.setAttribute('role', 'dialog'); seriesModal.setAttribute('aria-modal', 'true'); seriesModal.setAttribute('aria-label', 'Series 管理器');
        seriesModal.querySelector('.modal-body').prepend(root.querySelector('.sidebar-load-section'));
        root.querySelector('.series-sidebar').remove();
        byId('zoomSlider').min = '1'; byId('zoomSlider').step = '1';
        isMounted = true;
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
        byId('workPreviewBtn').textContent = preview.unresolved || preview.errors.length ? `處理待確認項目（${preview.unresolved + preview.errors.length}）` : `逐 Series 明細（${preview.series.length}）`;
        byId('workPreviewBtn').classList.toggle('has-issues', Boolean(preview.unresolved || preview.errors.length));
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
