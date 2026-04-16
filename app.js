/**
 * ================================================================================
 * DICOM ROI Analyzer - Web Application
 * ================================================================================
 * 
 * 功能特色:
 * - 拖曳資料夾上傳 DICOM 檔案
 * - 影像檢視與導航
 * - ROI 圓形選取
 * - Window Width / Window Level 調整 (右鍵拖曳)
 * - 全螢幕模式
 * - 批次分析
 * - CSV 匯出 (可選擇標籤)
 * 
 * ================================================================================
 */

// ============================================
// Global State
// ============================================
const state = {
    files: [],              // All loaded DICOM files
    currentIndex: 0,        // Current image index
    pixelData: null,        // Current image pixel data
    currentDS: null,        // Current DICOM dataset

    // ROI - Multi-ROI Support
    roiCenters: [],         // Array of {x, y} objects
    roiRadius: 25,

    // Zoom
    zoom: 100,              // Zoom percentage (25-400)

    // Window/Level
    windowWidth: 400,
    windowLevel: 200,
    defaultWW: 400,
    defaultWL: 200,

    // Per-image WW/WL storage (for apply to all)
    imageWWWL: [],          // Array of {ww, wl} for each image

    // Rotation
    rotation: 0,            // Current rotation angle (0, 90, 180, 270)
    imageRotations: [],     // Array of rotation angles for each image

    // Mouse state for WW/WL adjustment
    isRightDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartWW: 0,
    dragStartWL: 0,

    // Pan state (Space + left-drag or middle-button drag)
    isPanning: false,
    isSpaceHeld: false,
    panStartX: 0,
    panStartY: 0,
    panX: 0,
    panY: 0,
    startPanX: 0,
    startPanY: 0,

    // Tools
    toolMode: 'roi',

    // Analysis results
    results: [],
    availableTags: new Set(),
    selectedTags: new Set(),

    // Display tags on image overlay
    displayTags: new Set(),
    tempDisplayTags: new Set(), // Temporary selection in modal

    // Grid Settings
    showGrid: false,
    gridMode: 'fixed', // 預設固定在畫面上 (Default to fixed on screen)
    gridSpacing: 50,

    // Web Worker for background analysis
    worker: null,
    lockCenter: false,       // Lock image to geometric center
    lastAnalysisMode: 'batch', // 'batch' or 'single'
    exportMode: 'batch'      // 'batch' or 'single' - For tag selection modal
};

// CT Presets
const CT_PRESETS = {
    lung: { ww: 1500, wl: -600 },
    brain: { ww: 80, wl: 40 },
    bone: { ww: 2000, wl: 300 },
    abdomen: { ww: 400, wl: 50 },
    mediastinum: { ww: 350, wl: 50 }
};

// Common DICOM Tags for analysis (共用標籤列表，避免重複定義)
const COMMON_TAGS = [
    { tag: 'x00100010', name: 'PatientName' },
    { tag: 'x00100020', name: 'PatientID' },
    { tag: 'x00080020', name: 'StudyDate' },
    { tag: 'x00080060', name: 'Modality' },
    { tag: 'x00080070', name: 'Manufacturer' },
    { tag: 'x00181411', name: 'ExposureIndex' },
    { tag: 'x00181412', name: 'TargetExposureIndex' },
    { tag: 'x00181413', name: 'DeviationIndex' },
    { tag: 'x00181150', name: 'ExposureTime' },
    { tag: 'x00181152', name: 'Exposure' },
    { tag: 'x00181151', name: 'XRayTubeCurrent' },
    { tag: 'x00180060', name: 'KVP' },
    { tag: 'x00280010', name: 'Rows' },
    { tag: 'x00280011', name: 'Columns' },
    { tag: 'x00201041', name: 'SliceLocation' },
    { tag: 'x0008103e', name: 'SeriesDescription' }
];

// DICOM Tag 中文翻譯對照表
const TAG_TRANSLATIONS = {
    // 分析結果標籤
    'FileName': '檔案名稱',
    'ROI_Mean': 'ROI 平均值',
    'ROI_Noise_SD': 'ROI 雜訊 (標準差)',
    'FullImage_Mean': '全影像平均值',
    'FullImage_SD': '全影像標準差',
    'ROI_ID': 'ROI 編號',
    'ROI_X': 'ROI 圓心 X',
    'ROI_Y': 'ROI 圓心 Y',
    'ROI_R': 'ROI 半徑',

    // 病患資訊
    'PatientName': '病患姓名',
    'PatientID': '病患 ID',
    'PatientBirthDate': '病患生日',
    'PatientSex': '病患性別',
    'PatientAge': '病患年齡',

    // 檢查資訊
    'StudyDate': '檢查日期',
    'StudyTime': '檢查時間',
    'StudyDescription': '檢查描述',
    'StudyID': '檢查 ID',
    'AccessionNumber': '醫療單號',

    // 系列資訊
    'SeriesDate': '系列日期',
    'SeriesTime': '系列時間',
    'SeriesDescription': '系列描述',
    'SeriesNumber': '系列編號',

    // 設備資訊
    'Modality': '影像類型',
    'Manufacturer': '設備製造商',
    'InstitutionName': '醫療機構名稱',
    'StationName': '工作站名稱',
    'ManufacturerModelName': '設備型號',

    // 曝光參數
    'ExposureIndex': '曝光指數 (EI)',
    'TargetExposureIndex': '目標曝光指數',
    'DeviationIndex': '偏差指數 (DI)',
    'ExposureTime': '曝光時間 (ms)',
    'Exposure': '曝光量 (mAs)',
    'XRayTubeCurrent': '管電流 (mA)',
    'KVP': '管電壓 (kVp)',
    'DistanceSourceToDetector': '射源至偵測器距離 (SID)',
    'DistanceSourceToPatient': '射源至病患距離',
    'ExposureControlMode': '曝光控制模式',
    'FilterType': '濾片類型',
    'FocalSpots': '焦點大小',
    'AnodeTargetMaterial': '陽極靶材',

    // 影像參數
    'Rows': '影像列數',
    'Columns': '影像行數',
    'BitsAllocated': '位元配置',
    'BitsStored': '位元儲存',
    'HighBit': '最高位元',
    'PixelRepresentation': '像素表示法',
    'WindowWidth': '窗寬 (WW)',
    'WindowCenter': '窗位 (WL)',
    'RescaleIntercept': '重新縮放截距',
    'RescaleSlope': '重新縮放斜率',
    'PhotometricInterpretation': '光度解讀',

    // 身體部位
    'BodyPartExamined': '檢查部位',
    'ViewPosition': '投射方向',
    'PatientPosition': '病患姿勢',
    'ImageLaterality': '影像側別',

    // 其他
    'ContentDate': '內容日期',
    'ContentTime': '內容時間',
    'InstanceNumber': '影像編號',
    'SOPClassUID': 'SOP 類別 UID',
    'SOPInstanceUID': 'SOP 實例 UID',
    'SliceLocation': '切片位置'
};

// 取得標籤的中文翻譯
function getTagDisplayName(tagName) {
    const translation = TAG_TRANSLATIONS[tagName];
    if (translation) {
        return `${translation} (${tagName})`;
    }
    return tagName;
}

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Drop Zone
    dropZone: null,
    folderInput: null,
    selectFolderBtn: null,

    // Viewer Panel
    viewerPanel: null,
    imageContainer: null,
    dicomCanvas: null,
    ctx: null,

    // Overlays
    patientInfo: null,
    wwwlInfo: null,
    fileInfo: null,
    roiInfo: null,

    // Navigation
    prevBtn: null,
    nextBtn: null,
    imageSlider: null,
    imageCounter: null,
    fullscreenBtn: null,

    // ROI Controls
    roiRadius: null,
    roiCount: null,
    roiListContainer: null,
    deleteLastRoiBtn: null,
    clearAllRoiBtn: null,

    // Tools
    toolModeRadios: null,
    roiSettingsSection: null,
    
    // Header Viewer
    rawHeaderBtn: null,
    rawHeaderModal: null,
    rawHeaderTableBody: null,
    rawHeaderSearch: null,
    closeRawHeaderBtn: null,
    ctPresetsContainer: null,

    // Zoom Controls
    zoomSlider: null,
    zoomValue: null,
    zoomInBtn: null,
    zoomOutBtn: null,
    zoomResetBtn: null,

    // WW/WL Controls
    windowWidth: null,
    windowLevel: null,
    applyWWWLAllBtn: null,
    resetWWWLBtn: null,

    // Rotation Controls
    rotationSlider: null,
    rotationValue: null,
    rotateMinus45Btn: null,
    rotateMinus1Btn: null,
    rotatePlus1Btn: null,
    rotatePlus45Btn: null,
    rotate90LeftBtn: null,
    rotate90RightBtn: null,
    resetRotationBtn: null,
    applyRotationAllBtn: null,

    // CT Presets
    presetLungBtn: null,
    presetBrainBtn: null,
    presetBoneBtn: null,
    presetAbdBtn: null,

    // Analysis
    analyzeBtn: null,
    singleResultActions: null,
    singleResultInfo: null,
    singleResultTable: null,
    exportSingleBtn: null,
    analysisProgress: null,
    progressFill: null,
    progressText: null,
    singleImageSelect: null,
    analyzeSingleBtn: null,

    // Export
    exportBtn: null,

    // Modals
    helpModal: null,
    helpBtn: null,
    closeHelpBtn: null,

    tagModal: null,
    closeTagBtn: null,
    tagList: null,
    themeToggleBtn: null,
    themeIcon: null,
    selectAllTags: null,
    deselectAllTags: null,
    cancelExportBtn: null,
    confirmExportBtn: null,

    // Loading
    loadingOverlay: null,
    loadingText: null,

    // Display Tags
    displayTagBtn: null,
    displayTagModal: null,
    displayTagList: null,
    closeDisplayTagBtn: null,
    selectAllDisplayTags: null,
    deselectAllDisplayTags: null,
    cancelDisplayTagBtn: null,
    confirmDisplayTagBtn: null,
    customTagsOverlay: null,
    displayTagPreview: null,

    // Filter
    sliceLocationFilter: null,

    // Grid Controls
    gridToggle: null,
    gridControlsInner: null,
    gridMode: null,
    gridSpacing: null,
    crosshairOverlay: null,
    imageContainerInner: null
};

// ============================================
// Initialization Helper
// ============================================
function populateElements() {
    elements.dropZone = document.getElementById('dropZone');
    elements.folderInput = document.getElementById('folderInput');
    elements.selectFolderBtn = document.getElementById('selectFolderBtn');
    elements.viewerPanel = document.getElementById('viewerPanel');
    elements.imageContainer = document.getElementById('imageContainer');
    elements.dicomCanvas = document.getElementById('dicomCanvas');
    elements.patientInfo = document.getElementById('patientInfo');
    elements.wwwlInfo = document.getElementById('wwwlInfo');
    elements.fileInfo = document.getElementById('fileInfo');
    elements.roiInfo = document.getElementById('roiInfo');
    elements.prevBtn = document.getElementById('prevBtn');
    elements.nextBtn = document.getElementById('nextBtn');
    elements.imageSlider = document.getElementById('imageSlider');
    elements.imageCounter = document.getElementById('imageCounter');
    elements.fullscreenBtn = document.getElementById('fullscreenBtn');
    elements.roiRadius = document.getElementById('roiRadius');
    elements.roiCount = document.getElementById('roiCount');
    elements.roiListContainer = document.getElementById('roiListContainer');
    elements.deleteLastRoiBtn = document.getElementById('deleteLastRoiBtn');
    elements.clearAllRoiBtn = document.getElementById('clearAllRoiBtn');
    elements.toolModeRadios = document.getElementsByName('toolMode');
    elements.roiSettingsSection = document.getElementById('roiSettingsSection');
    elements.rawHeaderBtn = document.getElementById('rawHeaderBtn');
    elements.rawHeaderModal = document.getElementById('rawHeaderModal');
    elements.rawHeaderTableBody = document.getElementById('rawHeaderTableBody');
    elements.rawHeaderSearch = document.getElementById('rawHeaderSearch');
    elements.closeRawHeaderBtn = document.getElementById('closeRawHeaderBtn');
    elements.ctPresetsContainer = document.getElementById('ctPresetsContainer');
    elements.zoomSlider = document.getElementById('zoomSlider');
    elements.zoomValue = document.getElementById('zoomValue');
    elements.zoomInBtn = document.getElementById('zoomInBtn');
    elements.zoomOutBtn = document.getElementById('zoomOutBtn');
    elements.zoomResetBtn = document.getElementById('zoomResetBtn');
    elements.windowWidth = document.getElementById('windowWidth');
    elements.windowLevel = document.getElementById('windowLevel');
    elements.applyWWWLAllBtn = document.getElementById('applyWWWLAllBtn');
    elements.resetWWWLBtn = document.getElementById('resetWWWLBtn');
    elements.rotationSlider = document.getElementById('rotationSlider');
    elements.rotationValue = document.getElementById('rotationValue');
    elements.rotateMinus45Btn = document.getElementById('rotateMinus45Btn');
    elements.rotateMinus1Btn = document.getElementById('rotateMinus1Btn');
    elements.rotatePlus1Btn = document.getElementById('rotatePlus1Btn');
    elements.rotatePlus45Btn = document.getElementById('rotatePlus45Btn');
    elements.rotate90LeftBtn = document.getElementById('rotate90LeftBtn');
    elements.rotate90RightBtn = document.getElementById('rotate90RightBtn');
    elements.resetRotationBtn = document.getElementById('resetRotationBtn');
    elements.applyRotationAllBtn = document.getElementById('applyRotationAllBtn');
    elements.presetLungBtn = document.getElementById('presetLungBtn');
    elements.presetBrainBtn = document.getElementById('presetBrainBtn');
    elements.presetBoneBtn = document.getElementById('presetBoneBtn');
    elements.presetAbdBtn = document.getElementById('presetAbdBtn');
    elements.analyzeBtn = document.getElementById('analyzeBtn');
    elements.singleResultActions = document.getElementById('singleResultActions');
    elements.singleResultInfo = document.getElementById('singleResultInfo');
    elements.singleResultTable = document.getElementById('singleResultTable');
    elements.exportSingleBtn = document.getElementById('exportSingleBtn');
    elements.analysisProgress = document.getElementById('analysisProgress');
    elements.progressFill = document.getElementById('progressFill');
    elements.progressText = document.getElementById('progressText');
    elements.singleImageSelect = document.getElementById('singleImageSelect');
    elements.analyzeSingleBtn = document.getElementById('analyzeSingleBtn');
    elements.exportBtn = document.getElementById('exportBtn');
    elements.helpModal = document.getElementById('helpModal');
    elements.helpBtn = document.getElementById('helpBtn');
    elements.closeHelpBtn = document.getElementById('closeHelpBtn');
    elements.tagModal = document.getElementById('tagModal');
    elements.closeTagBtn = document.getElementById('closeTagBtn');
    elements.tagList = document.getElementById('tagList');
    elements.themeToggleBtn = document.getElementById('themeToggleBtn');
    elements.themeIcon = document.getElementById('themeIcon');
    elements.selectAllTags = document.getElementById('selectAllTags');
    elements.deselectAllTags = document.getElementById('deselectAllTags');
    elements.cancelExportBtn = document.getElementById('cancelExportBtn');
    elements.confirmExportBtn = document.getElementById('confirmExportBtn');
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.loadingText = document.getElementById('loadingText');
    elements.displayTagBtn = document.getElementById('displayTagBtn');
    elements.displayTagModal = document.getElementById('displayTagModal');
    elements.displayTagList = document.getElementById('displayTagList');
    elements.closeDisplayTagBtn = document.getElementById('closeDisplayTagBtn');
    elements.selectAllDisplayTags = document.getElementById('selectAllDisplayTags');
    elements.deselectAllDisplayTags = document.getElementById('deselectAllDisplayTags');
    elements.cancelDisplayTagBtn = document.getElementById('cancelDisplayTagBtn');
    elements.confirmDisplayTagBtn = document.getElementById('confirmDisplayTagBtn');
    elements.customTagsOverlay = document.getElementById('customTagsOverlay');
    elements.displayTagPreview = document.getElementById('displayTagPreview');
    elements.sliceLocationFilter = document.getElementById('sliceLocationFilter');
    elements.gridToggle = document.getElementById('gridToggle');
    elements.gridControlsInner = document.getElementById('gridControlsInner');
    elements.gridMode = document.getElementById('gridMode');
    elements.gridSpacing = document.getElementById('gridSpacing');
    elements.lockCenter = document.getElementById('lockCenter');
    elements.crosshairOverlay = document.getElementById('crosshairOverlay');
    elements.imageContainerInner = document.getElementById('imageContainerInner');
}

/**
 * Safe listener attachment
 */
function safeAddListener(element, event, handler, options = null) {
    if (!element) return;
    if (element instanceof NodeList || Array.isArray(element)) {
        element.forEach(el => el.addEventListener(event, handler, options));
    } else {
        element.addEventListener(event, handler, options);
    }
}


function updateSystemStatus(mode) {
    const indicator = document.querySelector('.status-indicator');
    if (!indicator) return;
    if (mode === 'compatibility') {
        indicator.textContent = 'Compatibility Mode';
        indicator.className = 'status-indicator status-warning';
    } else {
        indicator.textContent = 'System Ready';
        indicator.className = 'status-indicator status-ready';
    }
}

// ============================================
// Initialization
// ============================================
function init() {
    populateElements(); // Find all elements now that DOM is ready
    
    if (elements.dicomCanvas) {
        elements.ctx = elements.dicomCanvas.getContext('2d');
    }
    
    // Load saved theme
    const savedTheme = localStorage.getItem('dicom-roi-theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (elements.themeIcon) elements.themeIcon.textContent = '☀️';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        if (elements.themeIcon) elements.themeIcon.textContent = '🌙';
    }

    setupEventListeners();
    console.log('DICOM ROI Analyzer initialized (Robust Mode)');
}

function setupEventListeners() {
    // Theme toggle
    safeAddListener(elements.themeToggleBtn, 'click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        if (elements.themeIcon) elements.themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('dicom-roi-theme', newTheme);
    });

    // Tools - Default to ROI since Pan tool UI was removed
    // 工具模式 - 因介面已移除平移工具，預設為 ROI 模式
    state.toolMode = 'roi';
    if (elements.dicomCanvas) elements.dicomCanvas.style.cursor = 'crosshair';
    if (elements.roiSettingsSection) elements.roiSettingsSection.classList.remove('hidden');

    // Modal listeners
    if (elements.rawHeaderBtn) {
        elements.rawHeaderBtn.addEventListener('click', showRawHeaderModal);
        safeAddListener(elements.closeRawHeaderBtn, 'click', () => {
            if (elements.rawHeaderModal) elements.rawHeaderModal.classList.add('hidden');
        });
        safeAddListener(elements.rawHeaderSearch, 'input', filterRawHeaders);
    }

    // Folder selection
    safeAddListener(elements.selectFolderBtn, 'click', () => elements.folderInput && elements.folderInput.click());
    safeAddListener(elements.folderInput, 'change', handleFileSelect);

    // Drag and drop
    safeAddListener(elements.dropZone, 'dragover', handleDragOver);
    safeAddListener(elements.dropZone, 'dragleave', handleDragLeave);
    safeAddListener(elements.dropZone, 'drop', handleDrop);

    // Image navigation
    safeAddListener(elements.prevBtn, 'click', () => navigateImage(-1));
    safeAddListener(elements.nextBtn, 'click', () => navigateImage(1));
    safeAddListener(elements.imageSlider, 'input', handleSliderChange);
    safeAddListener(elements.fullscreenBtn, 'click', toggleFullscreen);

    // Canvas interactions
    if (elements.dicomCanvas) {
        elements.dicomCanvas.addEventListener('click', handleCanvasClick);
        elements.dicomCanvas.addEventListener('mousedown', handleMouseDown);
        elements.dicomCanvas.addEventListener('mousemove', handleMouseMove);
        elements.dicomCanvas.addEventListener('mouseup', handleMouseUp);
        elements.dicomCanvas.addEventListener('mouseleave', handleMouseUp);
        elements.dicomCanvas.addEventListener('contextmenu', e => e.preventDefault());
        elements.dicomCanvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
    }

    // ROI controls
    safeAddListener(elements.roiRadius, 'change', () => {
        state.roiRadius = parseInt(elements.roiRadius.value) || 25;
        renderImage();
    });

    safeAddListener(elements.deleteLastRoiBtn, 'click', deleteLastRoi);
    safeAddListener(elements.clearAllRoiBtn, 'click', clearAllRois);

    // WW/WL controls
    safeAddListener(elements.windowWidth, 'change', () => {
        state.windowWidth = parseFloat(elements.windowWidth.value) || 400;
        renderImage();
    });
    safeAddListener(elements.windowLevel, 'change', () => {
        state.windowLevel = parseFloat(elements.windowLevel.value) || 200;
        renderImage();
    });
    safeAddListener(elements.resetWWWLBtn, 'click', resetWindowLevel);
    safeAddListener(elements.applyWWWLAllBtn, 'click', applyWWWLToAll);

    // CT Preset Listeners
    safeAddListener(elements.presetLungBtn, 'click', () => setWindowLevel(CT_PRESETS.lung.ww, CT_PRESETS.lung.wl));
    safeAddListener(elements.presetBrainBtn, 'click', () => setWindowLevel(CT_PRESETS.brain.ww, CT_PRESETS.brain.wl));
    safeAddListener(elements.presetBoneBtn, 'click', () => setWindowLevel(CT_PRESETS.bone.ww, CT_PRESETS.bone.wl));
    safeAddListener(elements.presetAbdBtn, 'click', () => setWindowLevel(CT_PRESETS.abdomen.ww, CT_PRESETS.abdomen.wl));

    // Rotation controls
    safeAddListener(elements.rotationSlider, 'input', handleRotationSlider);
    safeAddListener(elements.rotateMinus45Btn, 'click', () => rotateImage(-45));
    safeAddListener(elements.rotateMinus1Btn, 'click', () => rotateImage(-1));
    safeAddListener(elements.rotatePlus1Btn, 'click', () => rotateImage(1));
    safeAddListener(elements.rotatePlus45Btn, 'click', () => rotateImage(45));
    safeAddListener(elements.rotate90LeftBtn, 'click', () => rotateImage(-90));
    safeAddListener(elements.rotate90RightBtn, 'click', () => rotateImage(90));
    safeAddListener(elements.resetRotationBtn, 'click', resetRotation);
    safeAddListener(elements.applyRotationAllBtn, 'click', applyRotationToAll);

    // Zoom controls
    safeAddListener(elements.zoomSlider, 'input', handleZoomSlider);
    safeAddListener(elements.zoomInBtn, 'click', () => adjustZoom(25));
    safeAddListener(elements.zoomOutBtn, 'click', () => adjustZoom(-25));
    safeAddListener(elements.zoomResetBtn, 'click', () => setZoom(100));

    // Analysis
    safeAddListener(elements.analyzeBtn, 'click', runAnalysis);
    safeAddListener(elements.singleImageSelect, 'change', updateSingleAnalyzeButton);
    safeAddListener(elements.analyzeSingleBtn, 'click', runSingleImageAnalysis);
    safeAddListener(elements.exportSingleBtn, 'click', () => openTagModal('single'));
    safeAddListener(elements.exportBtn, 'click', () => openTagModal('batch'));

    // Modals
    safeAddListener(elements.helpBtn, 'click', () => showModal('helpModal'));
    safeAddListener(elements.closeHelpBtn, 'click', () => hideModal('helpModal'));
    safeAddListener(elements.closeTagBtn, 'click', () => hideModal('tagModal'));
    safeAddListener(elements.cancelExportBtn, 'click', () => hideModal('tagModal'));
    safeAddListener(elements.confirmExportBtn, 'click', () => {
        if (state.exportMode === 'single') {
            exportSingleCSV();
        } else {
            exportCSV();
        }
    });
    safeAddListener(elements.selectAllTags, 'click', () => toggleAllTags(true));
    safeAddListener(elements.deselectAllTags, 'click', () => toggleAllTags(false));

    // Display Tag Modal
    safeAddListener(elements.displayTagBtn, 'click', openDisplayTagModal);
    safeAddListener(elements.closeDisplayTagBtn, 'click', () => hideModal('displayTagModal'));
    safeAddListener(elements.cancelDisplayTagBtn, 'click', () => hideModal('displayTagModal'));
    safeAddListener(elements.confirmDisplayTagBtn, 'click', confirmDisplayTags);
    safeAddListener(elements.selectAllDisplayTags, 'click', () => toggleAllDisplayTags(true));
    safeAddListener(elements.deselectAllDisplayTags, 'click', () => toggleAllDisplayTags(false));

    // Grid Controls
    safeAddListener(elements.gridToggle, 'change', handleGridToggle);

    safeAddListener(elements.gridSpacing, 'input', handleGridSpacingChange);
    safeAddListener(elements.lockCenter, 'change', handleLockCenterChange);

    // Worker Detection (Placed at the end to prevent crashing other listeners)
    // 工作執行緒偵測（放在最後以防止影響其他事件監聽器）
    try {
        if (window.Worker) {
            state.worker = new Worker('analysis-worker.js');
            state.worker.onmessage = handleWorkerMessage;

            // === KEY FIX: Handle worker errors (e.g. importScripts failure on GitHub Pages) ===
            // === 關鍵修正：處理 Worker 錯誤（例如 GitHub Pages 上 importScripts 失敗）===
            state.worker.onerror = function(err) {
                console.warn('⚠️ Analysis Worker error, falling back to main thread mode:', err);
                state.worker = null; // Disable worker to force fallback
                // 停用 Worker 以強制降級到主執行緒
                updateSystemStatus('compatibility');
                showToast('⚠️ 背景分析模組錯誤，已自動切換至相容模式', 'warning', 5000);
                // If analysis was in progress, restart it on main thread
                // 若分析已在進行中，在主執行緒重新啟動
                if (elements.analyzeBtn && elements.analyzeBtn.disabled) {
                    const filterValue = (elements.sliceLocationFilter && elements.sliceLocationFilter.value)
                        ? elements.sliceLocationFilter.value.trim() : '';
                    runAnalysisMainThread(filterValue);
                }
            };

            console.info('✅ Analysis Worker initialized.');
        } else {
            state.worker = null;
            updateSystemStatus('compatibility');
        }
    } catch (e) {
        state.worker = null;
        updateSystemStatus('compatibility');
        showToast('⚠️ 無法啟動背景分析模組 (可能是 file:// 安全限制)，改用相容模式執行', 'warning', 6000);
    }



    // Modal backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            hideModal('helpModal');
            hideModal('tagModal');
            hideModal('displayTagModal');
            hideModal('rawHeaderModal');
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

/**
 * Handle messages from background worker
 */
function handleWorkerMessage(e) {
    const { type, completed, total, results, message, fileName } = e.data;

    if (type === 'progress') {
        const progress = Math.round(completed / total * 100);
        if (elements.progressFill) elements.progressFill.style.width = `${progress}%`;
        if (elements.progressText) elements.progressText.textContent = `${progress}% (${completed}/${total})`;
    } else if (type === 'result_chunk') {
        if (state.lastAnalysisMode === 'single') {
            state.singleResults = results; // For single analysis, typically one chunk
            displaySingleAnalysisResults(results);
        } else {
            // Batch mode: append chunks
            if (!state.results) state.results = [];
            state.results.push(...results);
        }
    } else if (type === 'chunk_complete') {
        if (results && results.length > 0) {
            if (!state.results) state.results = [];
            state.results.push(...results);
        }
        state.analysisQueueIndex++;
        const totalCount = state.files.length;
        const progress = Math.round(state.analysisQueueIndex / totalCount * 100);
        if (elements.progressFill) elements.progressFill.style.width = `${progress}%`;
        if (elements.progressText) elements.progressText.textContent = `${progress}% (${state.analysisQueueIndex}/${totalCount})`;
        
        processNextAnalysisChunk();

    } else if (type === 'single_complete') {
        state.singleResults = results;
        displaySingleAnalysisResults(results);

    } else if (type === 'complete') {
        finishAnalysis();
    } else if (type === 'error') {
        console.error('Worker Error:', message, 'in', fileName);
        const errorMsg = fileName ? `檔案 ${fileName}: ${message}` : message;
        showToast('⚠️ 分析出錯: ' + errorMsg, 'error', 5000);
        
        // On chunk error, just continue to next file
        if (typeof state.analysisQueueIndex !== 'undefined') {
            state.analysisQueueIndex++;
            processNextAnalysisChunk();
        }
    }
}

function finishAnalysis() {
    elements.analysisProgress.classList.add('hidden');
    elements.analyzeBtn.disabled = false;
    elements.exportBtn.disabled = false;
    
    // Dynamically populate available tags from results
    if (state.results && state.results.length > 0) {
        Object.keys(state.results[0]).forEach(tag => state.availableTags.add(tag));
    }
    
    // Auto-select common tags for results table
    ['FileName', 'ROI_ID', 'ROI_Mean', 'ROI_Noise_SD'].forEach(tag => state.selectedTags.add(tag));
    
    showToast(`✅ 分析完成！共載入 ${state.results.length} 筆結果`, 'success', 5000);
}



// ============================================
// File Handling
// ============================================
function handleDragOver(e) {
    e.preventDefault();
    elements.dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');

    const items = e.dataTransfer.items;
    const files = [];
    const queue = [];
    let count = 0;

    showLoading('正在讀取拖曳項目...');

    // Initialize queue with top-level entries
    // 使用頂層項目初始化佇列
    for (const item of items) {
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) queue.push(entry);
        }
    }

    // Iterative queue processing for stability and UI responsiveness
    // 使用迭代佇列處理以確保穩定性與 UI 反應能力
    while (queue.length > 0) {
        const entry = queue.shift();

        if (entry.isFile) {
            const file = await new Promise(resolve => entry.file(resolve));
            files.push(file);
            count++;

            // Periodically update UI and yield to browser to handle dialogs
            // 定期更新 UI 並向瀏覽器讓位，以便處理安全性對話框
            if (count % 50 === 0) {
                showLoading(`正在搜尋資料夾 (已找到 ${count} 個檔案)...`);
                await new Promise(r => setTimeout(r, 0));
            }
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            let batch;
            do {
                batch = await new Promise(resolve => reader.readEntries(resolve));
                for (const child of batch) {
                    queue.push(child);
                }
                // Yield to keep UI responsive during large directory reads
                // 在讀取大型目錄時讓位以保持 UI 反應
                await new Promise(r => setTimeout(r, 0));
            } while (batch.length > 0);
        }
    }

    await loadDICOMFiles(files);
}

// Optimized traverseFileTree is now handled inlined in handleDrop's iterative queue
// for better flow control and stability. 
// (Removed separate traverseFileTree function to prevent confusion)

async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    showLoading('正在讀取檔案...');
    await loadDICOMFiles(files);
}

async function loadDICOMFiles(files) {
    state.files = [];
    const total = files.length;
    const batchSize = 25;

    try {
        for (let i = 0; i < total; i += batchSize) {
            const currentBatch = files.slice(i, i + batchSize);
            
            // Show dynamic progress progress
            // 顯示動態讀取進度
            showLoading(`正在讀取檔案 (${i + 1} - ${Math.min(i + batchSize, total)} / ${total})...`);

            const results = await Promise.all(currentBatch.map(async (file) => {
                let byteArray = null;
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    byteArray = new Uint8Array(arrayBuffer);
                    const dataSet = dicomParser.parseDicom(byteArray);

                    // Check if it has pixel data
                    if (dataSet.elements.x7fe00010) {
                        return {
                            file: file,
                            dataSet: dataSet,
                            byteArray: byteArray
                        };
                    }
                } catch (err) {
                    console.error(`Error parsing file ${file.name}:`, err);
                    if (err.message && err.message.includes('preamble')) {
                        console.warn(`File ${file.name} is missing DICOM preamble.`);
                    }
                    if (byteArray) {
                        const headBytes = byteArray.slice(0, 132);
                        console.log(`File head snippet:`, headBytes);
                    }
                }
                return null;
            }));

            // Filter valid DICOM files and add to state
            results.forEach(res => {
                if (res) state.files.push(res);
            });
        }
    } finally {
        hideLoading();
    }
    
    const validCount = state.files.length;
    if (validCount > 0) {
        showToast(`✅ 匯入成功！共載入 ${validCount} 張影像 (忽略 ${files.length - validCount} 個非影像檔案)`, 'success');
    }

    // Check for compressed transfer syntax
    const compressedFiles = state.files.filter(f => checkTransferSyntax(f.dataSet));
    if (compressedFiles.length > 0) {
        const fileNames = compressedFiles.slice(0, 3).map(f => f.file.name).join(', ');
        const moreCount = compressedFiles.length - 3;
        const moreText = moreCount > 0 ? `...等 ${compressedFiles.length} 個檔案` : '';
        showToast(`⚠️ 偵測到壓縮格式 DICOM：${fileNames}${moreText}。本工具僅支援未壓縮影像，如有黑畫面為正常格式限制。`, 'warning', 8000);
    }

    if (state.files.length > 0) {
        elements.dropZone.classList.add('hidden');
        elements.viewerPanel.classList.remove('hidden');

        elements.imageSlider.max = state.files.length - 1;
        state.currentIndex = 0;

        loadImage(0);
        updateAnalyzeButton();
        updateSingleImageSelect();
    } else {
        showToast('⚠️ 未找到有效的 DICOM 影像檔案', 'warning');
    }
}

// ============================================
// Image Loading & Rendering
// ============================================
function loadImage(index) {
    if (index < 0 || index >= state.files.length) return;

    // Hide single results when changing image
    if (elements.singleResultActions) {
        elements.singleResultActions.classList.add('hidden');
    }

    try {
        state.currentIndex = index;
        const { dataSet } = state.files[index];
        state.currentDS = dataSet;

    // Extract pixel data
    const pixelDataElement = dataSet.elements.x7fe00010;
    const rows = dataSet.uint16('x00280010');
    const cols = dataSet.uint16('x00280011');
    const bitsAllocated = dataSet.uint16('x00280100');
    const bitsStored = dataSet.uint16('x00280101');
    const pixelRepresentation = dataSet.uint16('x00280103') || 0;
    const rescaleIntercept = parseFloat(dataSet.string('x00281052')) || 0;
    const rescaleSlope = parseFloat(dataSet.string('x00281053')) || 1;

    // Get pixel data
    let pixelData;
    if (bitsAllocated === 16) {
        if (pixelRepresentation === 1) {
            pixelData = new Int16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, rows * cols);
        } else {
            pixelData = new Uint16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, rows * cols);
        }
    } else {
        pixelData = new Uint8Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, rows * cols);
    }

    // Apply rescale
    state.pixelData = new Float32Array(pixelData.length);
    for (let i = 0; i < pixelData.length; i++) {
        state.pixelData[i] = pixelData[i] * rescaleSlope + rescaleIntercept;
    }

    state.imageRows = rows;
    state.imageCols = cols;

    // Set default WW/WL from DICOM tags or calculate
    const dicomWW = parseFloat(dataSet.string('x00281051'));
    const dicomWL = parseFloat(dataSet.string('x00281050'));

    if (!isNaN(dicomWW) && !isNaN(dicomWL)) {
        state.defaultWW = dicomWW;
        state.defaultWL = dicomWL;
    } else {
        // Auto calculate
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < state.pixelData.length; i++) {
            if (state.pixelData[i] < min) min = state.pixelData[i];
            if (state.pixelData[i] > max) max = state.pixelData[i];
        }
        state.defaultWW = max - min;
        state.defaultWL = (max + min) / 2;
    }

    // Check if we have stored WW/WL for this image (from "apply to all")
    if (state.imageWWWL[index]) {
        state.windowWidth = state.imageWWWL[index].ww;
        state.windowLevel = state.imageWWWL[index].wl;
    } else {
        state.windowWidth = state.defaultWW;
        state.windowLevel = state.defaultWL;
    }

    // Extract PixelSpacing
    state.pixelSpacing = null;
    const pixelSpacingEl = state.currentDS.elements['x00280030'];
    if (pixelSpacingEl) {
        try {
            const val = state.currentDS.string('x00280030');
            const parts = val.split('\\');
            if (parts.length === 2) {
                state.pixelSpacing = [parseFloat(parts[0]), parseFloat(parts[1])];
            }
        } catch (e) {}
    }

    // Set UI for modality
    const modality = state.currentDS.string('x00080060') || 'OT';
    if (elements.ctPresetsContainer) {
        if (modality === 'CT') {
            elements.ctPresetsContainer.style.display = 'grid';
        } else {
            elements.ctPresetsContainer.style.display = 'none';
        }
    }

    // Check if we have stored rotation for this image
    if (state.imageRotations[index] !== undefined) {
        state.rotation = state.imageRotations[index];
    } else {
        state.rotation = 0;
    }

    // Update UI
    elements.windowWidth.value = Math.round(state.windowWidth);
    elements.windowLevel.value = Math.round(state.windowLevel);
    elements.rotationSlider.value = state.rotation;
    elements.rotationValue.textContent = state.rotation + '°';
    elements.imageSlider.value = index;
    elements.imageCounter.textContent = `${index + 1} / ${state.files.length}`;

    // Update patient info
    updateOverlayInfo();

    // Sync Single Image Analysis dropdown
    if (elements.singleImageSelect) {
        elements.singleImageSelect.value = index;
        updateSingleAnalyzeButton();
    }

    renderImage();
    } catch (err) {
        console.error('Error in loadImage:', err);
        showToast('⚠️ 無法解析此影像資料，可能格式受損', 'error');
        // Reset UI partially
        elements.imageCounter.textContent = `${state.currentIndex + 1} / ${state.files.length}`;
    }
}

function renderImage() {
    if (!state.pixelData) return;

    const rows = state.imageRows;
    const cols = state.imageCols;

    // Apply zoom
    const zoomFactor = state.zoom / 100;
    const displayWidth = Math.round(cols * zoomFactor);
    const displayHeight = Math.round(rows * zoomFactor);

    // Apply window/level
    const ww = state.windowWidth;
    const wl = state.windowLevel;
    const lower = wl - ww / 2;

    // Reuse offscreen canvas to reduce GC pressure
    if (!state._offCanvas || state._offCanvas.width !== cols || state._offCanvas.height !== rows) {
        state._offCanvas = document.createElement('canvas');
        state._offCanvas.width = cols;
        state._offCanvas.height = rows;
    }
    const offCanvas = state._offCanvas;
    const offCtx = offCanvas.getContext('2d');

    const imageData = offCtx.createImageData(cols, rows);
    const data = imageData.data;

    const scale = 255 / ww;

    for (let i = 0; i < state.pixelData.length; i++) {
        const value = (state.pixelData[i] - lower) * scale;
        
        const idx = i * 4;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 255;
    }

    offCtx.putImageData(imageData, 0, 0);

    // Handle rotation - swap canvas dimensions for 90/270 degree rotations
    const isRotated90or270 = (state.rotation === 90 || state.rotation === 270);
    const canvasWidth = isRotated90or270 ? displayHeight : displayWidth;
    const canvasHeight = isRotated90or270 ? displayWidth : displayHeight;

    // Set canvas size
    elements.dicomCanvas.width = canvasWidth;
    elements.dicomCanvas.height = canvasHeight;
    elements.dicomCanvas.style.width = canvasWidth + 'px';
    elements.dicomCanvas.style.height = canvasHeight + 'px';

    // Apply rotation transform
    elements.ctx.save();
    elements.ctx.translate(canvasWidth / 2, canvasHeight / 2);
    elements.ctx.rotate(state.rotation * Math.PI / 180);
    elements.ctx.translate(-displayWidth / 2, -displayHeight / 2);

    // Draw scaled image to main canvas
    elements.ctx.imageSmoothingEnabled = true;
    elements.ctx.imageSmoothingQuality = 'high';
    elements.ctx.drawImage(offCanvas, 0, 0, displayWidth, displayHeight);



    // Draw multiple ROIs (隨旋轉同步顯示)
    const roiColors = ['#ff0000', '#00ff00', '#0080ff', '#ff8000', '#ff00ff', '#00ffff', '#ffff00', '#8000ff'];
    state.roiCenters.forEach((center, index) => {
        const scaledX = center.x * zoomFactor;
        const scaledY = center.y * zoomFactor;
        const scaledRadius = state.roiRadius * zoomFactor;
        const color = roiColors[index % roiColors.length];

        // Draw ROI circle
        elements.ctx.strokeStyle = color;
        elements.ctx.lineWidth = 2;
        elements.ctx.beginPath();
        elements.ctx.arc(scaledX, scaledY, scaledRadius, 0, 2 * Math.PI);
        elements.ctx.stroke();

        // Draw center dot
        elements.ctx.fillStyle = color;
        elements.ctx.beginPath();
        elements.ctx.arc(scaledX, scaledY, 2, 0, 2 * Math.PI);
        elements.ctx.fill();

        // Draw small crosshair at center
        elements.ctx.beginPath();
        elements.ctx.moveTo(scaledX - 5, scaledY);
        elements.ctx.lineTo(scaledX + 5, scaledY);
        elements.ctx.moveTo(scaledX, scaledY - 5);
        elements.ctx.lineTo(scaledX, scaledY + 5);
        elements.ctx.stroke();

        // Draw ROI number label
        elements.ctx.fillStyle = color;
        elements.ctx.font = 'bold 14px Inter, sans-serif';
        elements.ctx.fillText(`${index + 1}`, scaledX + scaledRadius + 5, scaledY - scaledRadius);
    });

    elements.ctx.restore();

    // Update WW/WL display
    elements.wwwlInfo.textContent = `WW: ${Math.round(state.windowWidth)} | WL: ${Math.round(state.windowLevel)}`;
}

function updateOverlayInfo() {
    const ds = state.currentDS;
    if (!ds) return;

    const patientName = ds.string('x00100010') || 'Unknown';
    const patientID = ds.string('x00100020') || 'N/A';

    elements.patientInfo.textContent = `Patient: ${patientName}\nID: ${patientID}`;

    const instanceNumber = ds.string('x00200013') || '';
    const sliceLocation = ds.string('x00201041') || '';

    let fileInfoText = `File: ${state.files[state.currentIndex].file.name}`;
    if (instanceNumber) fileInfoText += ` | Img: ${instanceNumber}`;
    if (sliceLocation) fileInfoText += ` | Loc: ${sliceLocation}`;

    elements.fileInfo.textContent = fileInfoText;

    // Update ROI info for multiple ROIs
    if (state.roiCenters.length > 0) {
        elements.roiInfo.textContent = `ROI: ${state.roiCenters.length} 個 (R=${state.roiRadius})`;
    } else {
        elements.roiInfo.textContent = '';
    }

    // Display custom tags on overlay
    updateCustomTagsOverlay();
}

// ============================================
// Grid Functions
// ============================================
function handleGridToggle() {
    state.showGrid = elements.gridToggle.checked;
    
    if (state.showGrid) {
        elements.gridControlsInner.classList.remove('hidden');
    } else {
        elements.gridControlsInner.classList.add('hidden');
    }
    
    updateGridDisplay();
    renderImage();
}



function handleGridSpacingChange() {
    state.gridSpacing = parseInt(elements.gridSpacing.value) || 50;
    updateGridDisplay();
    renderImage();
}

function handleLockCenterChange() {
    state.lockCenter = elements.lockCenter.checked;
    renderImage();
}


function updateGridDisplay() {
    if (state.showGrid && state.gridMode === 'fixed') {
        elements.crosshairOverlay.classList.remove('hidden');
        const spacing = state.gridSpacing;

        const gridColor = 'rgba(0, 255, 100, 0.35)';
        const crossColor = 'rgba(0, 255, 100, 0.85)';

        // Use half-spacing offset so grid is symmetric about center
        // and each cell is EXACTLY `spacing` CSS px wide
        const offset = spacing / 2;

        elements.crosshairOverlay.style.backgroundImage = [
            // Grid columns (centered in tile)
            `linear-gradient(to right, transparent calc(50% - 0.5px), ${gridColor} calc(50% - 0.5px), ${gridColor} calc(50% + 0.5px), transparent calc(50% + 1px))`,
            // Grid rows (centered in tile)
            `linear-gradient(to bottom, transparent calc(50% - 0.5px), ${gridColor} calc(50% - 0.5px), ${gridColor} calc(50% + 0.5px), transparent calc(50% + 1px))`,
            // Center vertical crosshair (bold, at 50% of container)
            `linear-gradient(to right, transparent calc(50% - 1px), ${crossColor} calc(50% - 1px), ${crossColor} calc(50% + 1px), transparent calc(50% + 1px))`,
            // Center horizontal crosshair (bold, at 50% of container)
            `linear-gradient(to bottom, transparent calc(50% - 1px), ${crossColor} calc(50% - 1px), ${crossColor} calc(50% + 1px), transparent calc(50% + 1px))`
        ].join(', ');

        elements.crosshairOverlay.style.backgroundSize =
            `${spacing}px ${spacing}px, ${spacing}px ${spacing}px, 100% 100%, 100% 100%`;
        // Align both grid and crosshair to center (50% 50%)
        // This ensures the thin grid lines and bold crosshair always align at the center
        elements.crosshairOverlay.style.backgroundPosition =
            `50% 50%, 50% 50%, 0 0, 0 0`;
        elements.crosshairOverlay.style.backgroundRepeat = 'repeat, repeat, no-repeat, no-repeat';

        // Show a pixel-ruler label so user can verify
        _updateGridLabel(spacing);
    } else {
        elements.crosshairOverlay.classList.add('hidden');
        elements.crosshairOverlay.style.backgroundImage = '';
        elements.crosshairOverlay.style.backgroundSize = '';
        elements.crosshairOverlay.style.backgroundRepeat = '';
        elements.crosshairOverlay.style.backgroundPosition = '';
        _removeGridLabel();
    }
}

function _updateGridLabel(spacing) {
    let label = document.getElementById('_gridSpacingLabel');
    if (!label) {
        label = document.createElement('div');
        label.id = '_gridSpacingLabel';
        label.style.cssText = `
            position: absolute;
            bottom: 8px;
            right: 10px;
            z-index: 200;
            pointer-events: none;
            font-family: monospace;
            font-size: 11px;
            color: rgba(0,255,100,0.9);
            background: rgba(0,0,0,0.55);
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(0,255,100,0.4);
        `;
        elements.imageContainer.appendChild(label);
    }
    label.textContent = `Grid: ${spacing}px`;
}

function _removeGridLabel() {
    const label = document.getElementById('_gridSpacingLabel');
    if (label) label.remove();
}


function updatePanTransform() {
    if (elements.imageContainerInner) {
        elements.imageContainerInner.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
    }
}



// Multi-ROI management functions
function updateRoiControls() {
    const count = state.roiCenters.length;
    elements.roiCount.textContent = count;
    elements.deleteLastRoiBtn.disabled = count === 0;
    elements.clearAllRoiBtn.disabled = count === 0;

    // Update ROI list display
    updateRoiList();
}

function updateRoiList() {
    const container = elements.roiListContainer;
    container.innerHTML = '';

    if (state.roiCenters.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; padding: 8px;">尚未放置 ROI</div>';
        return;
    }

    const roiColors = ['#ff0000', '#00ff00', '#0080ff', '#ff8000', '#ff00ff', '#00ffff', '#ffff00', '#8000ff'];
    state.roiCenters.forEach((center, index) => {
        const item = document.createElement('div');
        item.className = 'roi-list-item';

        const color = roiColors[index % roiColors.length];
        item.innerHTML = `
            <span class="roi-color-dot" style="background: ${color};"></span>
            <span>ROI ${index + 1}: (${center.x}, ${center.y})</span>
        `;
        container.appendChild(item);
    });
}

function deleteLastRoi() {
    if (state.roiCenters.length > 0) {
        state.roiCenters.pop();
        updateRoiControls();
        renderImage();
        updateOverlayInfo();
        updateAnalyzeButton();
    }
}

function clearAllRois() {
    if (state.roiCenters.length > 0 && confirm(`確定要清除全部 ${state.roiCenters.length} 個 ROI 嗎？`)) {
        state.roiCenters = [];
        updateRoiControls();
        renderImage();
        updateOverlayInfo();
        updateAnalyzeButton();
    }
}

// ============================================
// Image Navigation
// ============================================
function navigateImage(delta) {
    const newIndex = state.currentIndex + delta;
    if (newIndex >= 0 && newIndex < state.files.length) {
        loadImage(newIndex);
    }
}

function handleSliderChange() {
    loadImage(parseInt(elements.imageSlider.value));
}

// ============================================
// Canvas Interactions
// ============================================
function getCanvasCoordinates(e) {
    const rect = elements.dicomCanvas.getBoundingClientRect();
    const zoomFactor = state.zoom / 100;

    // Click position in canvas pixel coordinates
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // No rotation: simple zoom-only conversion
    // 無旋轉時：僅做縮放轉換
    if (state.rotation === 0) {
        return {
            x: Math.round(cx / zoomFactor),
            y: Math.round(cy / zoomFactor)
        };
    }

    // With rotation: reverse transform to get original image coordinates
    // 有旋轉時：反向轉換以取得原始影像座標
    const canvasWidth = elements.dicomCanvas.width;
    const canvasHeight = elements.dicomCanvas.height;
    const displayWidth = Math.round(state.imageCols * zoomFactor);
    const displayHeight = Math.round(state.imageRows * zoomFactor);
    const theta = state.rotation * Math.PI / 180;

    // Reverse rotation around canvas center
    const dx = cx - canvasWidth / 2;
    const dy = cy - canvasHeight / 2;
    const rx = Math.cos(theta) * dx + Math.sin(theta) * dy;
    const ry = -Math.sin(theta) * dx + Math.cos(theta) * dy;

    return {
        x: Math.round((rx + displayWidth / 2) / zoomFactor),
        y: Math.round((ry + displayHeight / 2) / zoomFactor)
    };
}

function handleCanvasClick(e) {
    if (e.button !== 0) return; // Only left click
    if (state.isSpaceHeld) return; // Ignore clicks during pan mode
    if (state.wasPanning) { state.wasPanning = false; return; } // Ignore click after panning

    const coords = getCanvasCoordinates(e);

    // Multi-ROI: Add new ROI to array
    state.roiCenters.push(coords);

    updateRoiControls();
    renderImage();
    updateOverlayInfo();
    updateAnalyzeButton();
}

function handleMouseDown(e) {
    if (e.button === 2) { // Right click - WW/WL adjustment
        e.preventDefault();
        state.isRightDragging = true;
        state.dragStartX = e.clientX;
        state.dragStartY = e.clientY;
        state.dragStartWW = state.windowWidth;
        state.dragStartWL = state.windowLevel;
    }
    // Middle button or Space + left button - Pan
    if (e.button === 1 || (e.button === 0 && state.isSpaceHeld)) {
        if (state.lockCenter) return; // Prevent pan when locked
        e.preventDefault();
        state.isPanning = true;
        state.panStartX = e.clientX;
        state.panStartY = e.clientY;
        state.startPanX = state.panX;
        state.startPanY = state.panY;
        elements.dicomCanvas.style.cursor = 'grabbing';
    }
}

function handleMouseMove(e) {
    if (state.isPanning && !state.lockCenter) {
        state.panX = state.startPanX + (e.clientX - state.panStartX);
        state.panY = state.startPanY + (e.clientY - state.panStartY);
        updatePanTransform();
        return;
    }
    if (state.isRightDragging) {
        const dx = e.clientX - state.dragStartX;
        const dy = e.clientY - state.dragStartY;

        // Horizontal = Window Width, Vertical = Window Level
        state.windowWidth = Math.max(1, state.dragStartWW + dx * 2);
        state.windowLevel = state.dragStartWL - dy * 2;

        elements.windowWidth.value = Math.round(state.windowWidth);
        elements.windowLevel.value = Math.round(state.windowLevel);

        renderImage();
    }
}

function handleMouseUp(e) {
    if (state.isPanning) {
        state.wasPanning = true; // Prevent click from placing ROI after pan
        state.isPanning = false;
        elements.dicomCanvas.style.cursor = state.isSpaceHeld ? 'grab' : 'crosshair';
    }
    state.isRightDragging = false;
}

function resetWindowLevel() {
    state.windowWidth = state.defaultWW;
    state.windowLevel = state.defaultWL;
    elements.windowWidth.value = Math.round(state.windowWidth);
    elements.windowLevel.value = Math.round(state.windowLevel);
    renderImage();
}

function applyWWWLToAll() {
    const ww = state.windowWidth;
    const wl = state.windowLevel;

    // Store current WW/WL for all images
    for (let i = 0; i < state.files.length; i++) {
        state.imageWWWL[i] = { ww, wl };
    }

    showToast(`✅ 已將 WW: ${Math.round(ww)} / WL: ${Math.round(wl)} 套用至全部 ${state.files.length} 張影像`, 'success');
}

function setWindowLevel(ww, wl) {
    state.windowWidth = ww;
    state.windowLevel = wl;
    elements.windowWidth.value = Math.round(state.windowWidth);
    elements.windowLevel.value = Math.round(state.windowLevel);
    renderImage();
}

// ============================================
// Rotation Functions
// ============================================
function handleRotationSlider() {
    let rotation = parseInt(elements.rotationSlider.value);
    
    // Magnetic Snapping (誤差 ±3° 自動吸附)
    const snapAngles = [0, 90, 180, 270, 360];
    for (const angle of snapAngles) {
        if (Math.abs(rotation - angle) <= 3) {
            rotation = angle % 360; // 360 becomes 0
            if (rotation === 0) elements.rotationSlider.value = 0; // Fix slider position for 360
            else elements.rotationSlider.value = rotation; // Snap UI slider
            break;
        }
    }

    state.rotation = rotation;
    state.imageRotations[state.currentIndex] = state.rotation;
    elements.rotationValue.textContent = state.rotation + '°';
    renderImage();
}

function rotateImage(delta) {
    // Calculate new rotation angle (0-359)
    state.rotation = ((state.rotation + delta) % 360 + 360) % 360;

    // Store rotation for current image
    state.imageRotations[state.currentIndex] = state.rotation;

    // Update UI (slider and value)
    elements.rotationSlider.value = state.rotation;
    elements.rotationValue.textContent = state.rotation + '°';

    renderImage();
}

function resetRotation() {
    state.rotation = 0;
    state.imageRotations[state.currentIndex] = 0;
    elements.rotationSlider.value = 0;
    elements.rotationValue.textContent = '0°';
    renderImage();
}

function applyRotationToAll() {
    const rotation = state.rotation;

    // Store current rotation for all images
    for (let i = 0; i < state.files.length; i++) {
        state.imageRotations[i] = rotation;
    }

    showToast(`✅ 已將旋轉角度 ${rotation}° 套用至全部 ${state.files.length} 張影像`, 'success');
}

// ============================================
// Zoom Functions
// ============================================
function handleCanvasWheel(e) {
    e.preventDefault(); // Prevent page scrolling
    if (e.deltaY < 0) {
        adjustZoom(25); // Zoom in
    } else {
        adjustZoom(-25); // Zoom out
    }
}

function handleZoomSlider() {
    setZoom(parseInt(elements.zoomSlider.value));
}

function adjustZoom(delta) {
    const newZoom = Math.max(25, Math.min(400, state.zoom + delta));
    setZoom(newZoom);
}

function setZoom(value) {
    const oldZoom = state.zoom;
    const newZoom = value;
    
    // Prevent division by zero
    // 防止除以零
    const ratio = oldZoom > 0 ? (newZoom / oldZoom) : 1;

    state.zoom = value;
    
    // Scale pan to keep the point at screen center stable
    // 縮放平移座標以保持位於螢幕中心的影像點位穩定
    state.panX *= ratio;
    state.panY *= ratio;
    updatePanTransform();

    elements.zoomSlider.value = value;
    elements.zoomValue.textContent = value + '%';
    renderImage();
}


// ============================================
// Fullscreen
// ============================================
function toggleFullscreen() {
    const container = elements.imageContainer;

    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            console.log('Fullscreen error:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// ============================================
// Keyboard Shortcuts
// ============================================
function handleKeyDown(e) {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    // Space key for pan mode
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!state.isSpaceHeld) {
            state.isSpaceHeld = true;
            elements.dicomCanvas.style.cursor = 'grab';
        }
        return;
    }

    // Handle Ctrl+Z / Cmd+Z for undo (Remove last ROI)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        deleteLastRoi();
        return;
    }

    switch (e.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
            navigateImage(-1);
            break;
        case 'd':
        case 'arrowright':
            navigateImage(1);
            break;
        case 'f':
            toggleFullscreen();
            break;
        case 'r':
            resetWindowLevel();
            break;
        case 'q':
            rotateImage(-90);
            break;
        case 'e':
            rotateImage(90);
            break;
        case 'backspace':
            e.preventDefault();
            deleteLastRoi();
            break;
        case 'delete':
            e.preventDefault();
            clearAllRois();
            break;
    }
}

function handleKeyUp(e) {
    if (e.key === ' ' || e.code === 'Space') {
        state.isSpaceHeld = false;
        if (!state.isPanning) {
            elements.dicomCanvas.style.cursor = 'crosshair';
        }
    }
}

// ============================================
// Analysis
// ============================================
function updateAnalyzeButton() {
    elements.analyzeBtn.disabled = state.roiCenters.length === 0 || state.files.length === 0;
    updateSingleAnalyzeButton();
}

function updateSingleImageSelect() {
    const select = elements.singleImageSelect;
    select.innerHTML = '<option value="">-- 選擇影像 --</option>';

    state.files.forEach((fileObj, index) => {
        const option = document.createElement('option');
        option.value = index;

        let label = `${index + 1}. ${fileObj.file.name}`;

        // Add Instance Number and Slice Location if available
        const instanceNumber = fileObj.dataSet.string('x00200013');
        const sliceLocation = fileObj.dataSet.string('x00201041');

        const extraInfo = [];
        if (instanceNumber) extraInfo.push(`Img: ${instanceNumber}`);
        if (sliceLocation) extraInfo.push(`Loc: ${sliceLocation}`);

        if (extraInfo.length > 0) {
            label += ` (${extraInfo.join(', ')})`;
        }

        option.textContent = label;
        select.appendChild(option);
    });

    // Set initial value if current index is valid
    if (state.currentIndex >= 0 && state.currentIndex < state.files.length) {
        select.value = state.currentIndex;
    }

    // Handle Selection Change
    elements.singleImageSelect.onchange = () => {
        const index = parseInt(elements.singleImageSelect.value);
        if (!isNaN(index)) {
            state.currentIndex = index;
            loadImage(index);
            if (elements.singleResultActions) {
                elements.singleResultActions.classList.add('hidden');
            }
        }
    };
}

function updateSingleAnalyzeButton() {
    const selectedIndex = elements.singleImageSelect.value;
    elements.analyzeSingleBtn.disabled = state.roiCenters.length === 0 || selectedIndex === '';
}

async function runSingleImageAnalysis() {
    const selectedIndex = parseInt(elements.singleImageSelect.value);
    if (isNaN(selectedIndex) || state.roiCenters.length === 0) return;

    const { file, byteArray } = state.files[selectedIndex];

    elements.analysisProgress.classList.remove('hidden');
    elements.analyzeSingleBtn.disabled = true;
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = '0%';

    if (elements.singleResultActions) {
        elements.singleResultActions.classList.add('hidden');
    }

    state.lastAnalysisMode = 'single';
    state.availableTags = new Set(['FileName', 'ROI_ID', 'ROI_Mean', 'ROI_Noise_SD', 'FullImage_Mean', 'FullImage_SD', 'ROI_X', 'ROI_Y', 'ROI_R']);

    // Fallback: if Worker unavailable, run on main thread
    if (!state.worker) {
        await runSingleMainThread(selectedIndex);
        elements.analyzeSingleBtn.disabled = false;
        elements.analysisProgress.classList.add('hidden');
        return;
    }

    let copiedBuffer;
    try {
        copiedBuffer = byteArray.buffer.slice(0);
    } catch(e) { copiedBuffer = byteArray.buffer; }

    state.worker.postMessage({
        command: 'analyze_single',
        data: {
            file: { name: file.name, buffer: copiedBuffer },
            roiCenters: state.roiCenters,
            roiRadius: state.roiRadius,
            commonTags: COMMON_TAGS,
            filterValue: null
        }
    });
}

function displaySingleAnalysisResults(results) {
    elements.analysisProgress.classList.add('hidden');
    elements.analyzeSingleBtn.disabled = false;

    if (results.length === 0) {
        showToast('⚠️ 分析失敗，未發現有效數據', 'warning');
        return;
    }

    // Save results for export
    state.singleResults = results;
    const first = results[0];

    // Build Table HTML
    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>ROI</th>
                    <th>Mean (平均)</th>
                    <th>SD (標偏)</th>
                </tr>
            </thead>
            <tbody>
    `;

    results.forEach(r => {
        tableHtml += `
            <tr>
                <td>ROI ${r.ROI_ID}</td>
                <td style="font-family: monospace;">${r.ROI_Mean}</td>
                <td style="font-family: monospace;">${r.ROI_Noise_SD}</td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
        <div class="full-stats">
            <div class="stat-item">
                <span class="stat-label">全圖平均 (Image Mean)</span>
                <span class="stat-value">${first.FullImage_Mean}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">全圖標準差 (Image SD)</span>
                <span class="stat-value">${first.FullImage_SD}</span>
            </div>
        </div>
    `;

    // Display
    if (elements.singleResultTable) {
        elements.singleResultTable.innerHTML = tableHtml;
    }

    if (elements.singleResultInfo) {
        elements.singleResultInfo.textContent = `📁 ${first.FileName}`;
    }

    if (elements.singleResultActions) {
        elements.singleResultActions.classList.remove('hidden');
    }

    // Populate available tags for single analysis mode
    if (results && results.length > 0) {
        Object.keys(results[0]).forEach(tag => state.availableTags.add(tag));
    }
}

async function runAnalysis() {
    if (state.files.length === 0 || state.roiCenters.length === 0) return;

    // Get filter value
    const filterValue = (elements.sliceLocationFilter && elements.sliceLocationFilter.value) ? elements.sliceLocationFilter.value.trim() : '';
    
    elements.analysisProgress.classList.remove('hidden');
    elements.analyzeBtn.disabled = true;
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = '0%';

    state.results = [];
    state.availableTags = new Set(['FileName', 'ROI_ID', 'ROI_Mean', 'ROI_Noise_SD', 'FullImage_Mean', 'FullImage_SD', 'ROI_X', 'ROI_Y', 'ROI_R']);
    state.lastAnalysisMode = 'batch';

    // Fallback: if Worker unavailable, run on main thread
    if (!state.worker) {
        if (state.files.length > 30) {
            showToast('⚠️ 相容模式：分析中，請稍候，畫面可能短暫無法操作', 'warning', 4000);
        }
        await runAnalysisMainThread(filterValue);
        return;
    }

    // To prevent memory spike/freeze on GitHub pages, use batch streaming instead of creating memory copies at once
    state.analysisQueueIndex = 0;
    state.analysisFilterValue = filterValue;
    processNextAnalysisChunk();
}

function processNextAnalysisChunk() {
    if (!state.files || state.analysisQueueIndex >= state.files.length) {
        finishAnalysis();
        return;
    }

    const f = state.files[state.analysisQueueIndex];
    let copiedBuffer;
    try {
        copiedBuffer = f.byteArray.buffer.slice(0); // Only copy 1 at a time to prevent CPU/memory spikes!
    } catch (sliceErr) {
        console.warn('Buffer detach detected, falling back:', sliceErr);
        showToast('⚠️ 記憶體錯誤，切換相容模式後將自動接續', 'warning', 4000);
        state.worker = null;
        runAnalysisMainThread(state.analysisFilterValue); // Continue on main thread
        return;
    }

    state.worker.postMessage({
        command: 'analyze_chunk',
        data: {
            file: { name: f.file.name, buffer: copiedBuffer },
            roiCenters: state.roiCenters,
            roiRadius: state.roiRadius,
            commonTags: COMMON_TAGS,
            filterValue: state.analysisFilterValue,
            chunkIndex: state.analysisQueueIndex,
            totalItems: state.files.length
        }
    });
}

function getPixelDataFromDataSet(dataSet, byteArray) {
    const pixelDataElement = dataSet.elements.x7fe00010;
    const rows = dataSet.uint16('x00280010');
    const cols = dataSet.uint16('x00280011');
    const bitsAllocated = dataSet.uint16('x00280100');
    const pixelRepresentation = dataSet.uint16('x00280103') || 0;
    const rescaleIntercept = parseFloat(dataSet.string('x00281052')) || 0;
    const rescaleSlope = parseFloat(dataSet.string('x00281053')) || 1;

    let pixelData;
    if (bitsAllocated === 16) {
        if (pixelRepresentation === 1) {
            pixelData = new Int16Array(byteArray.buffer, pixelDataElement.dataOffset, rows * cols);
        } else {
            pixelData = new Uint16Array(byteArray.buffer, pixelDataElement.dataOffset, rows * cols);
        }
    } else {
        pixelData = new Uint8Array(byteArray.buffer, pixelDataElement.dataOffset, rows * cols);
    }

    const result = new Float32Array(pixelData.length);
    for (let i = 0; i < pixelData.length; i++) {
        result[i] = pixelData[i] * rescaleSlope + rescaleIntercept;
    }

    return result;
}

function calculateROIStats(pixelData, cols, rows, center, radius) {
    const values = [];

    for (let y = Math.max(0, center.y - radius); y <= Math.min(rows - 1, center.y + radius); y++) {
        for (let x = Math.max(0, center.x - radius); x <= Math.min(cols - 1, center.x + radius); x++) {
            const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
            if (dist <= radius) {
                values.push(pixelData[y * cols + x]);
            }
        }
    }

    if (values.length === 0) {
        return { mean: 0, sd: 0 };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);

    return { mean, sd };
}

// 主執行緒降級 — 批次分析 (Compatibility Mode fallback)
async function runAnalysisMainThread(filterValue) {
    const BATCH_SIZE = 5;
    const results = [];
    const total = state.files.length;

    for (let i = 0; i < total; i++) {
        const f = state.files[i];

        try {
            // Apply slice location filter
            if (filterValue) {
                const sliceLoc = f.dataSet.string('x00201041') || '';
                const filterNum = parseFloat(filterValue);
                const sliceNum = parseFloat(sliceLoc);
                const match = isNaN(filterNum)
                    ? sliceLoc.includes(filterValue)
                    : (!isNaN(sliceNum) && Math.abs(sliceNum - filterNum) < 0.001);
                if (!match) { updateProgress(i + 1, total); continue; }
            }

            const pixelData = getPixelDataFromDataSet(f.dataSet, f.byteArray);
            const rows = f.dataSet.uint16('x00280010');
            const cols = f.dataSet.uint16('x00280011');

            // Full image stats
            let fSum = 0, fSumSq = 0;
            for (let j = 0; j < pixelData.length; j++) {
                fSum += pixelData[j];
                fSumSq += pixelData[j] * pixelData[j];
            }
            const fullMean = fSum / pixelData.length;
            const fullSD = Math.sqrt(fSumSq / pixelData.length - fullMean * fullMean);

            // DICOM tags
            const dicomTags = {};
            for (const { tag, name: tagName } of COMMON_TAGS) {
                const val = f.dataSet.string(tag);
                if (val !== undefined) dicomTags[tagName] = val;
            }

            // Multi-ROI
            for (let roiIdx = 0; roiIdx < state.roiCenters.length; roiIdx++) {
                const center = state.roiCenters[roiIdx];
                const roiStats = calculateROIStats(pixelData, cols, rows, center, state.roiRadius);
                results.push({
                    FileName: f.file.name,
                    ROI_ID: roiIdx + 1,
                    ROI_Mean: roiStats.mean.toFixed(4),
                    ROI_Noise_SD: roiStats.sd.toFixed(4),
                    FullImage_Mean: fullMean.toFixed(4),
                    FullImage_SD: fullSD.toFixed(4),
                    ROI_X: center.x,
                    ROI_Y: center.y,
                    ROI_R: state.roiRadius,
                    ...dicomTags
                });
            }
        } catch (err) {
            console.error(`Error analyzing ${f.file.name}:`, err);
        }

        updateProgress(i + 1, total);

        // Yield every BATCH_SIZE images to keep UI responsive
        if ((i + 1) % BATCH_SIZE === 0) {
            await new Promise(r => setTimeout(r, 0));
        }
    }

    state.results = results;
    finishAnalysis();
}

// 手動進度條更新（降級模式專用）
function updateProgress(completed, total) {
    const pct = Math.round(completed / total * 100);
    if (elements.progressFill) elements.progressFill.style.width = `${pct}%`;
    if (elements.progressText) elements.progressText.textContent = `${pct}% (${completed}/${total})`;
}

// 主執行緒降級 — 單張分析
async function runSingleMainThread(selectedIndex) {
    const f = state.files[selectedIndex];
    if (!f) return;

    state.lastAnalysisMode = 'single';
    const pixelData = getPixelDataFromDataSet(f.dataSet, f.byteArray);
    const rows = f.dataSet.uint16('x00280010');
    const cols = f.dataSet.uint16('x00280011');

    let fSum = 0, fSumSq = 0;
    for (let j = 0; j < pixelData.length; j++) {
        fSum += pixelData[j];
        fSumSq += pixelData[j] * pixelData[j];
    }
    const fullMean = fSum / pixelData.length;
    const fullSD = Math.sqrt(fSumSq / pixelData.length - fullMean * fullMean);

    const dicomTags = {};
    for (const { tag, name: tagName } of COMMON_TAGS) {
        const val = f.dataSet.string(tag);
        if (val !== undefined) dicomTags[tagName] = val;
    }

    const results = [];
    for (let roiIdx = 0; roiIdx < state.roiCenters.length; roiIdx++) {
        const center = state.roiCenters[roiIdx];
        const roiStats = calculateROIStats(pixelData, cols, rows, center, state.roiRadius);
        results.push({
            FileName: f.file.name,
            ROI_ID: roiIdx + 1,
            ROI_Mean: roiStats.mean.toFixed(4),
            ROI_Noise_SD: roiStats.sd.toFixed(4),
            FullImage_Mean: fullMean.toFixed(4),
            FullImage_SD: fullSD.toFixed(4),
            ROI_X: center.x,
            ROI_Y: center.y,
            ROI_R: state.roiRadius,
            ...dicomTags
        });
    }

    updateProgress(1, 1);
    displaySingleAnalysisResults(results);
}

// ============================================
// Tag Selection & Export
// ============================================
function openTagModal(mode = 'batch') {
    state.exportMode = mode;
    // Build tag list
    const tagList = elements.tagList;
    tagList.innerHTML = '';

    // Default selected tags
    state.selectedTags = new Set([
        'PatientName', 'PatientID', 'FileName', 'ROI_ID',
        'ROI_Mean', 'ROI_Noise_SD', 'FullImage_Mean', 'FullImage_SD',
        'ExposureIndex', 'KVP', 'SliceLocation', 'SeriesDescription'
    ]);

    const sortedTags = Array.from(state.availableTags).sort((a, b) => {
        // Sort by translation if available, otherwise by tag name
        const aName = TAG_TRANSLATIONS[a] || a;
        const bName = TAG_TRANSLATIONS[b] || b;
        return aName.localeCompare(bName, 'zh-TW');
    });

    for (const tag of sortedTags) {
        const item = document.createElement('div');
        item.className = 'tag-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `tag-${tag}`;
        checkbox.checked = state.selectedTags.has(tag);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                state.selectedTags.add(tag);
            } else {
                state.selectedTags.delete(tag);
            }
        });

        const label = document.createElement('label');
        label.htmlFor = `tag-${tag}`;
        label.textContent = getTagDisplayName(tag);
        label.title = tag; // Tooltip shows original tag name

        item.appendChild(checkbox);
        item.appendChild(label);
        tagList.appendChild(item);
    }

    showModal('tagModal');
}

function toggleAllTags(select) {
    const checkboxes = elements.tagList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = select;
        const tag = cb.id.replace('tag-', '');
        if (select) {
            state.selectedTags.add(tag);
        } else {
            state.selectedTags.delete(tag);
        }
    });
}

function exportCSV() {
    if (state.results.length === 0) return;

    const selectedTagsArray = Array.from(state.selectedTags);

    // Build CSV content
    let csv = selectedTagsArray.join(',') + '\n';

    for (const result of state.results) {
        const row = selectedTagsArray.map(tag => {
            const value = result[tag] || '';
            // Escape quotes and wrap in quotes if contains comma
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });
        csv += row.join(',') + '\n';
    }

    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dicom_roi_analysis_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    hideModal('tagModal');
}

function exportSingleCSV() {
    if (!state.singleResults || state.singleResults.length === 0) {
        showToast('⚠️ 尚無單張分析結果可匯出', 'warning');
        return;
    }

    const results = state.singleResults;
    const selectedTagsArray = Array.from(state.selectedTags);

    // Build CSV with selected tags
    let csv = selectedTagsArray.join(',') + '\n';

    // Add each ROI result as a row
    for (const result of results) {
        const row = selectedTagsArray.map(field => {
            const value = result[field] || '';
            // Escape quotes and wrap in quotes if contains comma
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });
        csv += row.join(',') + '\n';
    }

    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Use filename for download name
    const baseName = results[0].FileName.replace(/\.[^/.]+$/, '') || 'single_analysis';
    a.download = `${baseName}_roi_analysis_${results.length}ROIs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    hideModal('tagModal');
}

// ============================================
// Modal Helpers
// ============================================
function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// ============================================
// Loading Helpers
// ============================================
function showLoading(text) {
    elements.loadingText.textContent = text || '載入中...';
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

// ============================================
// Toast Notification (取代 alert 的非阻塞通知)
// ============================================
function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));

    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

// ============================================
// Display Tag Functions
// ============================================

// DICOM Tag to Element Address mapping
const DISPLAY_TAG_MAPPING = {
    'PatientName': 'x00100010',
    'PatientID': 'x00100020',
    'PatientBirthDate': 'x00100030',
    'PatientSex': 'x00100040',
    'PatientAge': 'x00101010',
    'StudyDate': 'x00080020',
    'StudyTime': 'x00080030',
    'StudyDescription': 'x00081030',
    'SeriesDescription': 'x0008103e',
    'Modality': 'x00080060',
    'Manufacturer': 'x00080070',
    'InstitutionName': 'x00080080',
    'StationName': 'x00081010',
    'ManufacturerModelName': 'x00081090',
    'ExposureIndex': 'x00181411',
    'TargetExposureIndex': 'x00181412',
    'DeviationIndex': 'x00181413',
    'ExposureTime': 'x00181150',
    'Exposure': 'x00181152',
    'XRayTubeCurrent': 'x00181151',
    'KVP': 'x00180060',
    'DistanceSourceToDetector': 'x00181110',
    'BodyPartExamined': 'x00180015',
    'ViewPosition': 'x00185101',
    'ImageLaterality': 'x00200062',
    'Rows': 'x00280010',
    'Columns': 'x00280011',
    'WindowWidth': 'x00281051',
    'WindowCenter': 'x00281050',
    'InstanceNumber': 'x00200013',
    'SeriesNumber': 'x00200011',
    'SliceLocation': 'x00201041'
};

function openDisplayTagModal() {
    const tagList = elements.displayTagList;
    tagList.innerHTML = '';

    // Copy current display tags to temp
    state.tempDisplayTags = new Set(state.displayTags);

    // Get available tags (sorted by Chinese translation)
    const allTags = Object.keys(TAG_TRANSLATIONS).filter(tag => DISPLAY_TAG_MAPPING[tag]);
    allTags.sort((a, b) => {
        const aName = TAG_TRANSLATIONS[a] || a;
        const bName = TAG_TRANSLATIONS[b] || b;
        return aName.localeCompare(bName, 'zh-TW');
    });

    for (const tag of allTags) {
        const item = document.createElement('div');
        item.className = 'tag-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `display-tag-${tag}`;
        checkbox.checked = state.tempDisplayTags.has(tag);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                state.tempDisplayTags.add(tag);
            } else {
                state.tempDisplayTags.delete(tag);
            }
        });

        const label = document.createElement('label');
        label.htmlFor = `display-tag-${tag}`;
        label.textContent = TAG_TRANSLATIONS[tag] || tag;
        label.title = tag;

        item.appendChild(checkbox);
        item.appendChild(label);
        tagList.appendChild(item);
    }

    showModal('displayTagModal');
}

function toggleAllDisplayTags(select) {
    const checkboxes = elements.displayTagList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = select;
        const tag = cb.id.replace('display-tag-', '');
        if (select) {
            state.tempDisplayTags.add(tag);
        } else {
            state.tempDisplayTags.delete(tag);
        }
    });
}

function confirmDisplayTags() {
    state.displayTags = new Set(state.tempDisplayTags);
    hideModal('displayTagModal');
    updateDisplayTagPreview();
    updateCustomTagsOverlay();
}

function updateDisplayTagPreview() {
    if (state.displayTags.size === 0) {
        elements.displayTagPreview.textContent = '(未選擇任何標籤)';
    } else {
        const names = Array.from(state.displayTags).map(tag => TAG_TRANSLATIONS[tag] || tag);
        elements.displayTagPreview.textContent = `已選擇: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '...' : ''}`;
    }
}

function updateCustomTagsOverlay() {
    const ds = state.currentDS;
    if (!ds || state.displayTags.size === 0) {
        elements.customTagsOverlay.innerHTML = '';
        return;
    }

    const lines = [];
    for (const tag of state.displayTags) {
        const address = DISPLAY_TAG_MAPPING[tag];
        if (address) {
            let value = ds.string(address);
            if (value === undefined || value === '') {
                value = '--';
            }
            const displayName = TAG_TRANSLATIONS[tag] || tag;
            lines.push(`<span class="tag-label">${displayName}:</span> <span class="tag-value">${value}</span>`);
        }
    }

    elements.customTagsOverlay.innerHTML = lines.join('<br>');
}

function checkTransferSyntax(dataSet) {
    // x00020010: Transfer Syntax UID
    const transferSyntax = dataSet.string('x00020010');

    // List of compressed Transfer Syntaxes commonly found
    // 1.2.840.10008.1.2.4.50 (JPEG Baseline)
    // 1.2.840.10008.1.2.4.51 (JPEG Extended)
    // 1.2.840.10008.1.2.4.70 (JPEG Lossless)
    // 1.2.840.10008.1.2.4.80 (JPEG-LS)
    // 1.2.840.10008.1.2.4.90 (JPEG 2000)
    // 1.2.840.10008.1.2.5 (RLE Lossless)

    if (!transferSyntax) return false;

    // Explicitly allow uncompressed syntaxes
    const uncompressedSyntaxes = [
        '1.2.840.10008.1.2',      // Implicit VR Little Endian
        '1.2.840.10008.1.2.1',    // Explicit VR Little Endian
        '1.2.840.10008.1.2.1.99', // Deflated Explicit VR Little Endian (kinda compressed but sometimes works if browser supports deflate, but usually requires inflate) Note: Deflated is actually compressed.
        '1.2.840.10008.1.2.2'     // Explicit VR Big Endian
    ];

    // If it's one of the known uncompressed ones, return false (not compressed issue)
    if (uncompressedSyntaxes.includes(transferSyntax)) {
        return false;
    }

    // If it starts with 1.2.840.10008.1.2.4 (JPEG family) or is RLE, it's compressed
    if (transferSyntax.startsWith('1.2.840.10008.1.2.4') || transferSyntax === '1.2.840.10008.1.2.5') {
        return true;
    }

    return false;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);




// ============================================
// Raw DICOM Header Viewer (Feature 23)
// ============================================
let currentRawTags = [];

function showRawHeaderModal() {
    if (!state.currentDS) {
        showToast("錯誤：請先載入 DICOM 影像", "error");
        return;
    }
    
    currentRawTags = [];
    const elementsObj = state.currentDS.elements;
    
    for (const tag in elementsObj) {
        const el = elementsObj[tag];
        const rawTag = tag.substring(1).toUpperCase();
        let formattedTag = tag;
        if (rawTag.length === 8) { // standard tags (e.g. 00100010)
            formattedTag = `(${rawTag.substring(0,4)},${rawTag.substring(4)})`;
        }

        // Attempt to find a standard name
        let name = "Unknown Tag";
        const foundCommon = COMMON_TAGS.find(t => t.tag === tag);
        if (foundCommon && TAG_TRANSLATIONS[foundCommon.name]) {
            name = TAG_TRANSLATIONS[foundCommon.name] + ` (${foundCommon.name})`;
        } else if (foundCommon) {
            name = foundCommon.name;
        }

        // Attempt string extraction
        let value = "<Binary/Empty>";
        try {
            const strVal = state.currentDS.string(tag);
            if (strVal !== undefined && strVal !== null && strVal.trim() !== '') {
                value = strVal;
            }
        } catch (e) {}

        const vr = el.vr || "UN";

        currentRawTags.push({ tag: formattedTag, rawId: tag, name, vr, value });
    }

    renderRawHeaderTable(currentRawTags);
    elements.rawHeaderSearch.value = '';
    elements.rawHeaderModal.classList.remove('hidden');
}

function renderRawHeaderTable(tags) {
    if (!elements.rawHeaderTableBody) return;
    elements.rawHeaderTableBody.innerHTML = tags.map(t => {
        return `<tr>
            <td style="font-family: monospace; font-size: 0.85rem;">${t.tag}</td>
            <td style="font-size: 0.85rem;">${t.name}</td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${t.vr}</td>
            <td style="font-family: monospace; font-size: 0.85rem; word-break: break-all;">${t.value}</td>
        </tr>`;
    }).join('');
}

function filterRawHeaders(e) {
    const term = e.target.value.toLowerCase();
    const filtered = currentRawTags.filter(t => 
        t.tag.toLowerCase().includes(term) ||
        t.name.toLowerCase().includes(term) ||
        t.value.toLowerCase().includes(term)
    );
    renderRawHeaderTable(filtered);
}

// ============================================
// Entry Point
// ============================================
document.addEventListener('DOMContentLoaded', init);

