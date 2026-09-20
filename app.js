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
    exportMode: 'batch',      // 'batch' or 'single' - For tag selection modal

    // Line Profile / 線段剖面
    lines: [],              // Array of { start: {x, y}, end: {x, y}, id: number }
    activeLineIndex: -1,    // Index of the active line in state.lines
    lineStart: null,        // {x, y} in image coordinates (points to active line start)
    lineEnd: null,          // {x, y} in image coordinates (points to active line end)
    isDrawingLine: false,   // Flag for drawing interaction
    lineDragMode: null,     // Drag state: null, 'start', 'end', 'translate'
    lineDragStartCoords: null, // Initial mouse coordinates on mouse down for calculating pan offset
    lineProfileData: [],    // Sampled readings along the line
    lineDuplicateDirection: 'left', // 'left' uses +normal, 'right' uses -normal
    lineDuplicateDistance: 30, // Parallel copy offset distance in image pixels / 平行複製偏移距離（影像像素）
    showAllLines: true,     // Render all stored lines or only active line
    academicStyle: true,    // Default to Academic Style for publication / 預設為學術期刊格式
    appendMode: false       // Load files cumulatively / 累加載入模式
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
    'ROI_Pixels': 'ROI 像素數',
    'ROI_R_mm': 'ROI 半徑 (mm)',
    'ROI_Area_mm2': 'ROI 面積 (mm²)',

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
    filesInput: null,
    selectFilesBtn: null,
    appendModeToggle: null,
    sidebarSelectFolderBtn: null,
    sidebarSelectFilesBtn: null,
    sidebarAppendModeToggle: null,

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
    gridSpacing: null,
    crosshairOverlay: null,
    imageContainerInner: null,

    // Line Profile Elements / 線段剖面元素
    lineSettingsSection: null,
    lineStartX: null,
    lineStartY: null,
    lineEndX: null,
    lineEndY: null,
    lineLengthDisplay: null,
    lineProfileCanvas: null,
    clearLineBtn: null,
    openLineDetailBtn: null,
    lineDetailModal: null,
    closeLineDetailBtn: null,
    largeProfileCanvas: null,
    modalLineStart: null,
    modalLineEnd: null,
    modalLineLength: null,
    modalLineMax: null,
    modalLineMin: null,
    modalLineMean: null,
    exportLineCsvBtn: null,
    batchExportLineBtn: null,
    lineDataTableBody: null,
    academicStyleToggle: null, // Style toggle checkbox / 學術風格切換器
    downloadAcademicBtn: null, // Academic image export button / 學術影像匯出按鈕
    activeLineSelect: null,    // Multi-line dropdown select / 多線段下拉選單
    duplicateLineBtn: null,    // Parallel offset copy button / 平行偏移複製按鈕
    cloneLineBtn: null,        // Exact clone button / 原地複製按鈕
    deleteLineBtn: null,       // Delete line button / 刪除線段按鈕
    duplicateDirectionSelect: null, // Duplicate direction selector / 複製方向選擇
    duplicateDistanceInput: null, // Duplicate distance input / 複製距離輸入
    showAllLinesToggle: null   // Show all lines toggle / 顯示全部線段開關
};

// ============================================
// Initialization Helper
// ============================================
function populateElements() {
    elements.dropZone = document.getElementById('dropZone');
    elements.folderInput = document.getElementById('folderInput');
    elements.selectFolderBtn = document.getElementById('selectFolderBtn');
    elements.filesInput = document.getElementById('filesInput');
    elements.selectFilesBtn = document.getElementById('selectFilesBtn');
    elements.appendModeToggle = document.getElementById('appendModeToggle');
    elements.sidebarSelectFolderBtn = document.getElementById('sidebarSelectFolderBtn');
    elements.sidebarSelectFilesBtn = document.getElementById('sidebarSelectFilesBtn');
    elements.sidebarAppendModeToggle = document.getElementById('sidebarAppendModeToggle');
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
    elements.roiArea = document.getElementById('roiArea');
    elements.roiPhysicalInfo = document.getElementById('roiPhysicalInfo');
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
    elements.gridSpacing = document.getElementById('gridSpacing');
    elements.lockCenter = document.getElementById('lockCenter');
    elements.crosshairOverlay = document.getElementById('crosshairOverlay');
    elements.imageContainerInner = document.getElementById('imageContainerInner');

    // Line Profile Elements / 線段剖面元素
    elements.lineSettingsSection = document.getElementById('lineSettingsSection');
    elements.lineStartX = document.getElementById('lineStartX');
    elements.lineStartY = document.getElementById('lineStartY');
    elements.lineEndX = document.getElementById('lineEndX');
    elements.lineEndY = document.getElementById('lineEndY');
    elements.lineLengthDisplay = document.getElementById('lineLengthDisplay');
    elements.lineProfileCanvas = document.getElementById('lineProfileCanvas');
    elements.clearLineBtn = document.getElementById('clearLineBtn');
    elements.openLineDetailBtn = document.getElementById('openLineDetailBtn');
    elements.lineDetailModal = document.getElementById('lineDetailModal');
    elements.closeLineDetailBtn = document.getElementById('closeLineDetailBtn');
    elements.largeProfileCanvas = document.getElementById('largeProfileCanvas');
    elements.modalLineStart = document.getElementById('modalLineStart');
    elements.modalLineEnd = document.getElementById('modalLineEnd');
    elements.modalLineLength = document.getElementById('modalLineLength');
    elements.modalLineMax = document.getElementById('modalLineMax');
    elements.modalLineMin = document.getElementById('modalLineMin');
    elements.modalLineMean = document.getElementById('modalLineMean');
    elements.exportLineCsvBtn = document.getElementById('exportLineCsvBtn');
    elements.batchExportLineBtn = document.getElementById('batchExportLineBtn');
    elements.lineDataTableBody = document.getElementById('lineDataTableBody');
    elements.academicStyleToggle = document.getElementById('academicStyleToggle');
    elements.downloadAcademicBtn = document.getElementById('downloadAcademicBtn');
    elements.activeLineSelect = document.getElementById('activeLineSelect');
    elements.duplicateLineBtn = document.getElementById('duplicateLineBtn');
    elements.cloneLineBtn = document.getElementById('cloneLineBtn');
    elements.deleteLineBtn = document.getElementById('deleteLineBtn');
    elements.duplicateDirectionSelect = document.getElementById('duplicateDirectionSelect');
    elements.duplicateDistanceInput = document.getElementById('duplicateDistanceInput');
    elements.showAllLinesToggle = document.getElementById('showAllLinesToggle');
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

    // Tools - Default to ROI / 工具模式 - 預設為 ROI 模式
    state.toolMode = 'roi';
    if (elements.dicomCanvas) elements.dicomCanvas.style.cursor = 'crosshair';
    if (elements.roiSettingsSection) elements.roiSettingsSection.classList.remove('hidden');
    if (elements.lineSettingsSection) elements.lineSettingsSection.classList.add('hidden');

    if (elements.toolModeRadios) {
        elements.toolModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.toolMode = e.target.value;
                if (state.toolMode === 'roi') {
                    if (elements.roiSettingsSection) elements.roiSettingsSection.classList.remove('hidden');
                    if (elements.lineSettingsSection) elements.lineSettingsSection.classList.add('hidden');
                    if (elements.dicomCanvas) elements.dicomCanvas.style.cursor = 'crosshair';
                } else if (state.toolMode === 'line') {
                    if (elements.roiSettingsSection) elements.roiSettingsSection.classList.add('hidden');
                    if (elements.lineSettingsSection) elements.lineSettingsSection.classList.remove('hidden');
                    if (elements.dicomCanvas) elements.dicomCanvas.style.cursor = 'crosshair';
                }
                renderImage();
            });
        });
    }

    // Line Profile Buttons / 線段剖面按鈕
    safeAddListener(elements.clearLineBtn, 'click', () => {
        const confirmMsg = document.documentElement.lang === 'zh-TW' || document.documentElement.lang === 'zh'
            ? '確定要清除所有量測線段嗎？'
            : 'Are you sure you want to clear all measurement lines?';
        if (state.lines.length > 0 && confirm(confirmMsg)) {
            state.lines = [];
            state.activeLineIndex = -1;
            state.lineStart = null;
            state.lineEnd = null;
            state.lineProfileData = [];
            updateLineUI();
            renderImage();
            const toastMsg = document.documentElement.lang === 'zh-TW' || document.documentElement.lang === 'zh'
                ? '已清除所有量測線段'
                : 'All measurement lines cleared';
            showToast(toastMsg, 'info');
        }
    });

    safeAddListener(elements.activeLineSelect, 'change', (e) => {
        const selectedIndex = parseInt(e.target.value);
        if (!isNaN(selectedIndex) && state.lines[selectedIndex]) {
            state.activeLineIndex = selectedIndex;
            state.lineStart = state.lines[selectedIndex].start;
            state.lineEnd = state.lines[selectedIndex].end;
        } else {
            state.activeLineIndex = -1;
            state.lineStart = null;
            state.lineEnd = null;
        }
        calculateLineProfile();
        renderImage();
    });

    safeAddListener(elements.duplicateDirectionSelect, 'change', (e) => {
        if (e.target.value === 'left' || e.target.value === 'right') {
            state.lineDuplicateDirection = e.target.value;
        }
    });

    safeAddListener(elements.duplicateDistanceInput, 'input', (e) => {
        const distance = parseFloat(e.target.value);
        if (Number.isFinite(distance) && distance > 0) {
            state.lineDuplicateDistance = distance;
        }
    });

    safeAddListener(elements.showAllLinesToggle, 'change', (e) => {
        state.showAllLines = !!e.target.checked;
        renderImage();
    });

    safeAddListener(elements.duplicateLineBtn, 'click', () => {
        if (state.activeLineIndex === -1 || !state.lineStart || !state.lineEnd) return;

        // True parallel offset along the line normal / 沿線段法向量做真正平行偏移
        const inputDistance = elements.duplicateDistanceInput
            ? parseFloat(elements.duplicateDistanceInput.value)
            : state.lineDuplicateDistance;
        if (!Number.isFinite(inputDistance) || inputDistance <= 0) {
            showToast('⚠️ 請輸入大於 0 的複製距離 / Enter a copy distance greater than 0', 'warning');
            return;
        }
        const offsetPx = inputDistance;
        state.lineDuplicateDistance = offsetPx;
        const dx = state.lineEnd.x - state.lineStart.x;
        const dy = state.lineEnd.y - state.lineStart.y;
        const length = Math.hypot(dx, dy);
        if (length < 1) return;

        // Unit normal vector n = (-dy, dx) / |v|
        const nx = -dy / length;
        const ny = dx / length;

        const cols = state.imageCols || 512;
        const rows = state.imageRows || 512;

        function clampPoint(pt) {
            return {
                x: Math.round(Math.max(0, Math.min(cols - 1, pt.x))),
                y: Math.round(Math.max(0, Math.min(rows - 1, pt.y)))
            };
        }

        const plusStart = { x: state.lineStart.x + nx * offsetPx, y: state.lineStart.y + ny * offsetPx };
        const plusEnd = { x: state.lineEnd.x + nx * offsetPx, y: state.lineEnd.y + ny * offsetPx };
        const minusStart = { x: state.lineStart.x - nx * offsetPx, y: state.lineStart.y - ny * offsetPx };
        const minusEnd = { x: state.lineEnd.x - nx * offsetPx, y: state.lineEnd.y - ny * offsetPx };

        const plusValid = plusStart.x >= 0 && plusStart.x < cols && plusStart.y >= 0 && plusStart.y < rows && plusEnd.x >= 0 && plusEnd.x < cols && plusEnd.y >= 0 && plusEnd.y < rows;
        const minusValid = minusStart.x >= 0 && minusStart.x < cols && minusStart.y >= 0 && minusStart.y < rows && minusEnd.x >= 0 && minusEnd.x < cols && minusEnd.y >= 0 && minusEnd.y < rows;
        let usePlus = state.lineDuplicateDirection !== 'right';
        if (usePlus && !plusValid && minusValid) usePlus = false;
        if (!usePlus && !minusValid && plusValid) usePlus = true;

        const newLine = {
            start: clampPoint(usePlus ? plusStart : minusStart),
            end: clampPoint(usePlus ? plusEnd : minusEnd),
            id: Date.now()
        };

        state.lines.push(newLine);
        state.activeLineIndex = state.lines.length - 1;
        state.lineStart = newLine.start;
        state.lineEnd = newLine.end;

        calculateLineProfile();
        renderImage();

        const toastMsg = document.documentElement.lang === 'zh-TW' || document.documentElement.lang === 'zh'
            ? `📋 已複製平行線段 ${state.lines.length}`
            : `📋 Parallel line duplicated as Line ${state.lines.length}`;
        showToast(toastMsg, 'success');
    });

    safeAddListener(elements.cloneLineBtn, 'click', () => {
        if (state.activeLineIndex === -1 || !state.lineStart || !state.lineEnd) return;

        const newLine = {
            start: { x: state.lineStart.x, y: state.lineStart.y },
            end: { x: state.lineEnd.x, y: state.lineEnd.y },
            id: Date.now()
        };

        state.lines.push(newLine);
        state.activeLineIndex = state.lines.length - 1;
        state.lineStart = newLine.start;
        state.lineEnd = newLine.end;

        calculateLineProfile();
        renderImage();

        showToast(`📄 已複製線段 ${state.lines.length}`, 'success');
    });

    safeAddListener(elements.deleteLineBtn, 'click', () => {
        if (state.activeLineIndex === -1) return;

        const deletedIdx = state.activeLineIndex;
        state.lines.splice(deletedIdx, 1);

        if (state.lines.length === 0) {
            state.activeLineIndex = -1;
            state.lineStart = null;
            state.lineEnd = null;
        } else {
            state.activeLineIndex = Math.max(0, deletedIdx - 1);
            state.lineStart = state.lines[state.activeLineIndex].start;
            state.lineEnd = state.lines[state.activeLineIndex].end;
        }

        calculateLineProfile();
        renderImage();

        const toastMsg = document.documentElement.lang === 'zh-TW' || document.documentElement.lang === 'zh'
            ? '❌ 線段已刪除'
            : '❌ Line deleted';
        showToast(toastMsg, 'warning');
    });

    safeAddListener(elements.openLineDetailBtn, 'click', () => {
        if (elements.lineDetailModal) {
            elements.lineDetailModal.classList.remove('hidden');
            // Update toggle element status to match current state / 依當前狀態更新開關狀態
            if (elements.academicStyleToggle) {
                elements.academicStyleToggle.checked = state.academicStyle;
            }
            // Draw large profile chart / 繪製大型剖面圖
            setTimeout(() => {
                drawProfileChart(elements.largeProfileCanvas, true);
                populateLineDataTable();
            }, 50);
        }
    });

    safeAddListener(elements.closeLineDetailBtn, 'click', () => {
        if (elements.lineDetailModal) elements.lineDetailModal.classList.add('hidden');
    });

    safeAddListener(elements.exportLineCsvBtn, 'click', exportLineProfileToCSV);
    safeAddListener(elements.batchExportLineBtn, 'click', openBatchLineTagModal);

    safeAddListener(elements.academicStyleToggle, 'change', (e) => {
        state.academicStyle = e.target.checked;
        if (elements.largeProfileCanvas) {
            drawProfileChart(elements.largeProfileCanvas, true);
        }
    });

    safeAddListener(elements.downloadAcademicBtn, 'click', exportAcademicFigure);

    // Modal listeners
    if (elements.rawHeaderBtn) {
        elements.rawHeaderBtn.addEventListener('click', showRawHeaderModal);
        safeAddListener(elements.closeRawHeaderBtn, 'click', () => {
            if (elements.rawHeaderModal) elements.rawHeaderModal.classList.add('hidden');
        });
        safeAddListener(elements.rawHeaderSearch, 'input', filterRawHeaders);
    }

    // Folder selection & File selection / 資料夾選取與檔案選取
    safeAddListener(elements.selectFolderBtn, 'click', () => elements.folderInput && elements.folderInput.click());
    safeAddListener(elements.folderInput, 'change', handleFileSelect);

    safeAddListener(elements.selectFilesBtn, 'click', () => elements.filesInput && elements.filesInput.click());
    safeAddListener(elements.filesInput, 'change', handleFileSelect);

    // Sidebar selectors / 側邊欄快速載入按鈕
    safeAddListener(elements.sidebarSelectFolderBtn, 'click', () => elements.folderInput && elements.folderInput.click());
    safeAddListener(elements.sidebarSelectFilesBtn, 'click', () => elements.filesInput && elements.filesInput.click());

    // Append mode toggles with bilateral synchronization / 累加載入模式勾選（含雙向同步）
    safeAddListener(elements.appendModeToggle, 'change', (e) => {
        state.appendMode = e.target.checked;
        if (elements.sidebarAppendModeToggle) {
            elements.sidebarAppendModeToggle.checked = state.appendMode;
        }
    });

    safeAddListener(elements.sidebarAppendModeToggle, 'change', (e) => {
        state.appendMode = e.target.checked;
        if (elements.appendModeToggle) {
            elements.appendModeToggle.checked = state.appendMode;
        }
    });

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
        updateRoiPhysicalInfo();
        renderImage();
    });

    // Area input: target mm² -> pixel radius (rounded to integer, clamped to input range).
    // 面積反推半徑：r = √(A / (π·sx·sy))，四捨五入取整並箝制在 5~200。
    safeAddListener(elements.roiArea, 'change', () => {
        const targetArea = parseFloat(elements.roiArea.value);
        const sp = state.pixelSpacing;
        if (!(targetArea > 0)) return;
        if (!sp || !(sp[0] > 0) || !(sp[1] > 0) || isNaN(sp[0]) || isNaN(sp[1])) {
            showToast('⚠️ 目前影像無 Pixel Spacing，無法由面積換算半徑', 'warning');
            return;
        }
        let r = Math.round(Math.sqrt(targetArea / (Math.PI * sp[0] * sp[1])));
        r = Math.min(200, Math.max(5, r));
        state.roiRadius = r;
        if (elements.roiRadius) elements.roiRadius.value = r;
        updateRoiPhysicalInfo();
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
        } else if (state.exportMode === 'line-batch') {
            exportBatchLineProfileToCSV(Array.from(state.selectedTags));
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
    let hasFileItems = false; // Track if any file-kind items exist / 記錄是否有檔案類型項目

    for (const item of items) {
        if (item.kind === 'file') {
            hasFileItems = true;
            const entry = item.webkitGetAsEntry();
            if (entry) queue.push(entry);
        }
    }

    // Iterative queue processing for stability and UI responsiveness
    // 使用迭代佇列處理以確保穩定性與 UI 反應能力
    let queueIndex = 0; // Using pointer to avoid O(N^2) array shift operation / 使用指標以避免 O(N^2) 陣列 shift 操作
    while (queueIndex < queue.length) {
        const entry = queue[queueIndex++];

        if (entry.isFile) {
            // CRITICAL FIX FOR MAC OS: Add error callback to prevent hanging forever on protected/hidden files (like .DS_Store, lock files)
            // 關鍵修正 Mac OS：加入錯誤回呼，避免在讀取受保護/隱藏檔案（如 .DS_Store、鎖定檔）時永久卡死
            const file = await new Promise(resolve => {
                entry.file(
                    fileObj => resolve(fileObj),
                    error => {
                        console.warn(`[handleDrop] Skip unreadable file: ${entry.fullPath || entry.name}`, error);
                        resolve(null);
                    }
                );
            });

            if (file) {
                // Filter out macOS metadata and hidden files to save memory and CPU
                // 過濾 macOS 中介資料及隱藏檔案以節省記憶體與 CPU 資源
                const isHidden = file.name.startsWith('.') || file.name.startsWith('._') || file.name === 'Icon\r';
                if (!isHidden) {
                    files.push(file);
                    count++;

                    // Periodically update UI and yield to browser to handle dialogs
                    // 定期更新 UI 並向瀏覽器讓位，以便處理安全性對話框
                    if (count % 50 === 0) {
                        showLoading(`正在搜尋資料夾 (已找到 ${count} 個檔案)...`);
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
            }
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            let batch;
            do {
                // CRITICAL FIX FOR MAC OS: Add error callback to prevent hanging if a subdirectory cannot be read
                // 關鍵修正 Mac OS：加入錯誤回呼，防止子資料夾無法讀取時卡死
                batch = await new Promise(resolve => {
                    reader.readEntries(
                        entries => resolve(entries),
                        error => {
                            console.warn(`[handleDrop] Skip unreadable directory: ${entry.fullPath || entry.name}`, error);
                            resolve([]);
                        }
                    );
                });
                for (const child of batch) {
                    queue.push(child);
                }
                // Yield to keep UI responsive during large directory reads
                // 在讀取大型目錄時讓位以保持 UI 反應
                await new Promise(r => setTimeout(r, 0));
            } while (batch.length > 0);
        }
    }

    // Fallback: If no files were gathered via webkitGetAsEntry (typical for local file:// protocol sandboxes),
    // but e.dataTransfer.files is populated, read those directly to bypass sandboxing.
    // 退回機制：如果透過 webkitGetAsEntry 未收集到任何檔案（本地 file:// 協議沙箱下常見），但 e.dataTransfer.files 存在檔案，則直接使用。
    if (files.length === 0) {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (const file of e.dataTransfer.files) {
                const isHidden = file.name.startsWith('.') || file.name.startsWith('._') || file.name === 'Icon\r';
                if (!isHidden) {
                    files.push(file);
                }
            }
        } else if (hasFileItems && queue.length === 0) {
            // Detected file:// sandbox: webkitGetAsEntry returned null for all items, and dataTransfer.files
            // has no entries (user dragged folders, not individual files). Provide specific guidance.
            // 偵測到 file:// 沙箱限制：webkitGetAsEntry 全數回傳 null 且 dataTransfer.files 無檔案（使用者拖曳的是資料夾），顯示明確引導。
            showToast('⚠️ 在 file:// 模式下無法拖曳資料夾，請改用「選擇複數檔案」按鈕，或透過 HTTP server 開啟（如 python3 -m http.server 8000）', 'warning');
            hideLoading();
            return;
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
    if (!state.appendMode) {
        state.files = [];
    }

    // Filter out duplicates if in append mode / 在累加模式下過濾重複選取的檔案
    let filesToLoad = files;
    if (state.appendMode && state.files.length > 0) {
        filesToLoad = files.filter(file => {
            const isDuplicate = state.files.some(f => f.file.name === file.name && f.file.size === file.size);
            return !isDuplicate;
        });

        const skippedCount = files.length - filesToLoad.length;
        if (skippedCount > 0) {
            console.log(`[loadDICOMFiles] Skipped ${skippedCount} duplicate files.`);
        }
    }

    if (filesToLoad.length === 0) {
        if (state.files.length > 0) {
            showToast('⚠️ 所選項目皆已存在於影像清單中', 'warning');
            return;
        } else {
            showToast('⚠️ 未找到任何檔案', 'warning');
            return;
        }
    }

    const initialCount = state.files.length;
    const total = filesToLoad.length;
    const batchSize = 25;

    try {
        for (let i = 0; i < total; i += batchSize) {
            const currentBatch = filesToLoad.slice(i, i + batchSize);
            
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

    // Sort loaded slices into anatomical order before display:
    // SeriesInstanceUID -> SliceLocation -> InstanceNumber -> numeric filename.
    // 載入後先按 Series 分組、再按物理位置/編號排序，避免 I10/I100 檔名排序造成播放跳片。
    // Without this, browser file order (I10, I100, I110... I20) scrambles playback.
    if (state.files.length > 1) {
        state.files.sort((a, b) => {
            const seriesA = a.dataSet.string('x0020000e') || '';
            const seriesB = b.dataSet.string('x0020000e') || '';
            if (seriesA !== seriesB) {
                return seriesA.localeCompare(seriesB);
            }
            const locA = parseFloat(a.dataSet.string('x00201041'));
            const locB = parseFloat(b.dataSet.string('x00201041'));
            if (!isNaN(locA) && !isNaN(locB) && locA !== locB) {
                return locA - locB;
            }
            const instA = parseInt(a.dataSet.string('x00200013'), 10);
            const instB = parseInt(b.dataSet.string('x00200013'), 10);
            if (!isNaN(instA) && !isNaN(instB) && instA !== instB) {
                return instA - instB;
            }
            return a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' });
        });
    }
    
    const loadedCount = state.files.length - initialCount;
    const validCount = state.files.length;
    if (loadedCount > 0) {
        showToast(`✅ 匯入成功！共載入 ${loadedCount} 張影像 (忽略 ${filesToLoad.length - loadedCount} 個非影像檔案)`, 'success');
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
        
        // If append mode and we already had files, preserve current index. Else set to 0.
        // 如果是累加模式且原本已有檔案，保留當前索引，否則設為 0
        if (!state.appendMode || initialCount === 0) {
            state.currentIndex = 0;
            loadImage(0);
        } else {
            // Update UI/Counter but keep looking at current image / 更新 UI 元素，但保持當前影像檢視
            loadImage(state.currentIndex);
        }
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
    updateRoiPhysicalInfo();

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

    if (state.lineStart && state.lineEnd) {
        calculateLineProfile();
    } else {
        updateLineUI();
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

    // Draw Line Profile lines and endpoints / 繪製線段剖面線段與端點
    const drawLineWithHandles = (line, isActive) => {
        const scaledStart = { x: line.start.x * zoomFactor, y: line.start.y * zoomFactor };
        const scaledEnd = { x: line.end.x * zoomFactor, y: line.end.y * zoomFactor };
        const strokeColor = isActive ? '#00ffff' : 'rgba(0, 255, 255, 0.45)';
        const lineWidth = isActive ? 2.5 : 1.5;

        elements.ctx.strokeStyle = strokeColor;
        elements.ctx.lineWidth = lineWidth;
        elements.ctx.beginPath();
        elements.ctx.moveTo(scaledStart.x, scaledStart.y);
        elements.ctx.lineTo(scaledEnd.x, scaledEnd.y);
        elements.ctx.stroke();

        if (!isActive) return;

        const drawHandle = (point, label) => {
            elements.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            elements.ctx.shadowBlur = 4;
            elements.ctx.shadowOffsetX = 0;
            elements.ctx.shadowOffsetY = 2;

            elements.ctx.fillStyle = '#00ffff';
            elements.ctx.beginPath();
            elements.ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
            elements.ctx.fill();

            elements.ctx.fillStyle = '#ffffff';
            elements.ctx.beginPath();
            elements.ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            elements.ctx.fill();

            elements.ctx.shadowBlur = 0;
            elements.ctx.shadowOffsetX = 0;
            elements.ctx.shadowOffsetY = 0;

            elements.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            elements.ctx.fillRect(point.x + 8, point.y - 18, 14, 14);

            elements.ctx.fillStyle = '#00ffff';
            elements.ctx.font = 'bold 11px Inter, sans-serif';
            elements.ctx.fillText(label, point.x + 11, point.y - 7);
        };

        drawHandle(scaledStart, 'S');
        drawHandle(scaledEnd, 'E');
    };

    if (state.lines.length > 0) {
        if (state.showAllLines) {
            state.lines.forEach((line, index) => drawLineWithHandles(line, index === state.activeLineIndex));
        } else if (state.activeLineIndex >= 0 && state.lines[state.activeLineIndex]) {
            drawLineWithHandles(state.lines[state.activeLineIndex], true);
        }
    } else if (state.lineStart && state.lineEnd) {
        drawLineWithHandles({ start: state.lineStart, end: state.lineEnd }, true);
    }

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
    if (state.toolMode !== 'roi') return; // KEY FIX: Only place ROI when toolMode is 'roi' / 關鍵修正：僅在 ROI 模式下才新增標記

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
        return;
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
        return;
    }
    // Left button click - Line Profile / 左鍵點擊 - 線段剖面
    if (e.button === 0 && !state.isSpaceHeld) {
        if (state.toolMode === 'line') {
            const coords = getCanvasCoordinates(e);
            state.lineStart = coords;
            state.lineEnd = coords;
            state.isDrawingLine = true;
            renderImage();
        }
    }
}

function handleMouseMove(e) {
    if (state.isPanning && !state.lockCenter) {
        state.panX = state.startPanX + (e.clientX - state.panStartX);
        state.panY = state.startPanY + (e.clientY - state.panStartY);
        updatePanTransform();
        return;
    }
    if (state.isDrawingLine) {
        const coords = getCanvasCoordinates(e);
        state.lineEnd = coords;
        renderImage();
        calculateLineProfile(); // Real-time profile calculation on drag / 拖曳時即時計算剖面
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
    if (state.isDrawingLine) {
        const coords = getCanvasCoordinates(e);
        state.lineEnd = coords;
        state.isDrawingLine = false;

        // Persist the completed line into multi-line state so Copy/Delete can work.
        const cols = state.imageCols || 512;
        const rows = state.imageRows || 512;
        const finalizedLine = {
            start: {
                x: Math.round(Math.max(0, Math.min(cols - 1, state.lineStart.x))),
                y: Math.round(Math.max(0, Math.min(rows - 1, state.lineStart.y)))
            },
            end: {
                x: Math.round(Math.max(0, Math.min(cols - 1, state.lineEnd.x))),
                y: Math.round(Math.max(0, Math.min(rows - 1, state.lineEnd.y)))
            },
            id: Date.now()
        };

        state.lines.push(finalizedLine);
        state.activeLineIndex = state.lines.length - 1;
        state.lineStart = finalizedLine.start;
        state.lineEnd = finalizedLine.end;

        renderImage();
        calculateLineProfile();
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
    state.availableTags = new Set(['FileName', 'ROI_ID', 'ROI_Mean', 'ROI_Noise_SD', 'FullImage_Mean', 'FullImage_SD', 'ROI_X', 'ROI_Y', 'ROI_R', 'ROI_Pixels', 'ROI_R_mm', 'ROI_Area_mm2']);

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
    state.availableTags = new Set(['FileName', 'ROI_ID', 'ROI_Mean', 'ROI_Noise_SD', 'FullImage_Mean', 'FullImage_SD', 'ROI_X', 'ROI_Y', 'ROI_R', 'ROI_Pixels', 'ROI_R_mm', 'ROI_Area_mm2']);
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
        return { mean: 0, sd: 0, count: 0 };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);

    return { mean, sd, count: values.length };
}

// Physical ROI fields from DICOM Pixel Spacing (x00280030).
// 面積用實際取樣像素數 × 單像素面積（邊界裁切的圓會比 πr² 小，故不用理論值）。
function getPixelSpacingMm(dataSet) {
    try {
        const raw = dataSet.string('x00280030');
        if (!raw) return null;
        const p = String(raw).split('\\').map(parseFloat);
        if (p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]) && p[0] > 0 && p[1] > 0) {
            return { row: p[0], col: p[1] };
        }
    } catch (e) {}
    return null;
}

function roiPhysicalFields(dataSet, radiusPx, pixelCount) {
    const sp = getPixelSpacingMm(dataSet);
    if (!sp) {
        return { ROI_Pixels: pixelCount, ROI_R_mm: 'N/A', ROI_Area_mm2: 'N/A' };
    }
    return {
        ROI_Pixels: pixelCount,
        ROI_R_mm: (radiusPx * (sp.row + sp.col) / 2).toFixed(4),
        ROI_Area_mm2: (pixelCount * sp.row * sp.col).toFixed(4)
    };
}

// Live conversion hint under the radius input (theoretical full circle;
// clipped edges make actual sampled pixels fewer — see ROI_Pixels in results).
// 同步回填面積輸入框；無 spacing 時停用面積輸入。
function updateRoiPhysicalInfo() {
    if (!elements.roiPhysicalInfo) return;
    const r = state.roiRadius || 25;
    const sp = state.pixelSpacing;
    const areaInput = elements.roiArea;
    if (sp && sp[0] > 0 && sp[1] > 0 && !isNaN(sp[0]) && !isNaN(sp[1])) {
        const rMm = r * (sp[0] + sp[1]) / 2;
        const areaMm2 = Math.PI * r * r * sp[0] * sp[1];
        elements.roiPhysicalInfo.textContent =
            `≈ ${rMm.toFixed(2)} mm / ${areaMm2.toFixed(1)} mm²`;
        if (areaInput) {
            areaInput.disabled = false;
            areaInput.value = areaMm2.toFixed(1);
            areaInput.title = '';
        }
    } else {
        elements.roiPhysicalInfo.textContent = '目前影像無 Pixel Spacing，僅能以像素計';
        if (areaInput) {
            areaInput.disabled = true;
            areaInput.value = '';
            areaInput.title = '目前影像無 Pixel Spacing';
        }
    }
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
                    ...roiPhysicalFields(f.dataSet, state.roiRadius, roiStats.count),
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
            ...roiPhysicalFields(f.dataSet, state.roiRadius, roiStats.count),
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
    if (mode === 'line-batch') {
        state.selectedTags = new Set([
            'PatientName', 'PatientID', 'StudyDate', 'Modality',
            'ExposureIndex', 'KVP', 'SliceLocation', 'SeriesDescription'
        ]);
    } else {
        state.selectedTags = new Set([
            'PatientName', 'PatientID', 'FileName', 'ROI_ID',
            'ROI_Mean', 'ROI_Noise_SD', 'FullImage_Mean', 'FullImage_SD',
            'ExposureIndex', 'KVP', 'SliceLocation', 'SeriesDescription'
        ]);
    }

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

function openBatchLineTagModal() {
    if (state.files.length === 0) {
        showToast('⚠️ 尚未載入影像 / No images loaded', 'warning');
        return;
    }
    if (state.lines.length === 0 && (!state.lineStart || !state.lineEnd)) {
        showToast('⚠️ 尚未建立線段 / No measured lines', 'warning');
        return;
    }

    // Reuse the same tag modal, but limit to DICOM tags for batch line export.
    state.availableTags = new Set(COMMON_TAGS.map(t => t.name));
    openTagModal('line-batch');
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
// Line Profile Functions / 線段剖面功能函式
// ============================================

/**
 * Calculate pixel values and distances along the drawn line / 計算繪製線段上的像素值與距離
 */
function calculateLineProfile() {
    if (!state.pixelData || !state.lineStart || !state.lineEnd) {
        state.lineProfileData = [];
        updateLineUI();
        return;
    }

    const x1 = state.lineStart.x;
    const y1 = state.lineStart.y;
    const x2 = state.lineEnd.x;
    const y2 = state.lineEnd.y;
    const cols = state.imageCols;
    const rows = state.imageRows;

    // Calculate pixel distance / 計算像素距離
    const dx = x2 - x1;
    const dy = y2 - y1;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);

    // Number of sample points: Round distance to nearest integer + 1 / 採樣點數量：取像素距離最接近的整數 + 1
    const N = pixelDistance >= 1 ? Math.round(pixelDistance) + 1 : 1;
    const profileData = [];

    const rowSpacing = state.pixelSpacing ? state.pixelSpacing[0] : null;
    const colSpacing = state.pixelSpacing ? state.pixelSpacing[1] : null;

    for (let i = 0; i < N; i++) {
        const t = N > 1 ? i / (N - 1) : 0;
        
        // Exact pixel coordinate using linear interpolation / 使用線性插值計算精確像素座標
        const px = Math.min(cols - 1, Math.max(0, Math.round(x1 + t * dx)));
        const py = Math.min(rows - 1, Math.max(0, Math.round(y1 + t * dy)));

        // Read pixel value from DICOM pixel data / 從 DICOM 像素數據中讀取像素值
        const value = state.pixelData[py * cols + px];

        // Calculate segment distances / 計算分段距離
        const segDx = px - x1;
        const segDy = py - y1;
        const distPx = Math.sqrt(segDx * segDx + segDy * segDy);
        
        let distMm = null;
        if (rowSpacing !== null && colSpacing !== null) {
            distMm = Math.sqrt(Math.pow(segDx * colSpacing, 2) + Math.pow(segDy * rowSpacing, 2));
        }

        profileData.push({
            index: i,
            x: px,
            y: py,
            distancePx: distPx,
            distanceMm: distMm,
            value: value
        });
    }

    state.lineProfileData = profileData;

    // Trigger UI and chart updates / 觸發 UI 與圖表更新
    updateLineUI();
    
    // Draw preview chart in sidebar / 繪製側邊欄預覽圖表
    if (elements.lineProfileCanvas) {
        drawProfileChart(elements.lineProfileCanvas, false);
    }
}

/**
 * Update Line Profile sidebar UI components / 更新線段剖面側邊欄 UI 元件
 */
function updateLineUI() {
    const hasLine = (state.lineStart && state.lineEnd);

    // Keep multi-line dropdown and button states in sync.
    if (elements.activeLineSelect) {
        elements.activeLineSelect.innerHTML = '<option value="">-- 無線段 / No Line --</option>';
        state.lines.forEach((line, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = `Line ${index + 1}`;
            elements.activeLineSelect.appendChild(option);
        });

        if (state.activeLineIndex >= 0 && state.activeLineIndex < state.lines.length) {
            elements.activeLineSelect.value = String(state.activeLineIndex);
        } else {
            elements.activeLineSelect.value = '';
        }
    }

    const canOperateLine = state.activeLineIndex >= 0 && state.activeLineIndex < state.lines.length;
    if (elements.duplicateLineBtn) elements.duplicateLineBtn.disabled = !canOperateLine;
    if (elements.cloneLineBtn) elements.cloneLineBtn.disabled = !canOperateLine;
    if (elements.deleteLineBtn) elements.deleteLineBtn.disabled = !canOperateLine;
    if (elements.duplicateDirectionSelect) elements.duplicateDirectionSelect.value = state.lineDuplicateDirection;
    if (elements.duplicateDistanceInput) {
        elements.duplicateDistanceInput.value = state.lineDuplicateDistance;
        elements.duplicateDistanceInput.disabled = !canOperateLine;
    }
    if (elements.showAllLinesToggle) elements.showAllLinesToggle.checked = state.showAllLines;

    if (hasLine) {
        const x1 = Math.round(state.lineStart.x);
        const y1 = Math.round(state.lineStart.y);
        const x2 = Math.round(state.lineEnd.x);
        const y2 = Math.round(state.lineEnd.y);

        if (elements.lineStartX) elements.lineStartX.textContent = x1;
        if (elements.lineStartY) elements.lineStartY.textContent = y1;
        if (elements.lineEndX) elements.lineEndX.textContent = x2;
        if (elements.lineEndY) elements.lineEndY.textContent = y2;

        // Calculate total lengths / 計算總長度
        const dx = state.lineEnd.x - state.lineStart.x;
        const dy = state.lineEnd.y - state.lineStart.y;
        const totalPx = Math.sqrt(dx * dx + dy * dy);

        let totalMm = null;
        if (state.pixelSpacing) {
            const rowSpacing = state.pixelSpacing[0];
            const colSpacing = state.pixelSpacing[1];
            totalMm = Math.sqrt(Math.pow(dx * colSpacing, 2) + Math.pow(dy * rowSpacing, 2));
        }

        if (elements.lineLengthDisplay) {
            if (totalMm !== null) {
                elements.lineLengthDisplay.textContent = `${totalMm.toFixed(1)} mm (${totalPx.toFixed(1)} px)`;
            } else {
                elements.lineLengthDisplay.textContent = `${totalPx.toFixed(1)} px`;
            }
        }

        // Enable buttons / 啟用按鈕
        if (elements.clearLineBtn) elements.clearLineBtn.disabled = false;
        if (elements.openLineDetailBtn) elements.openLineDetailBtn.disabled = false;
        if (elements.batchExportLineBtn) elements.batchExportLineBtn.disabled = state.files.length === 0;
    } else {
        // Reset coordinate text / 重置座標文字
        if (elements.lineStartX) elements.lineStartX.textContent = '-';
        if (elements.lineStartY) elements.lineStartY.textContent = '-';
        if (elements.lineEndX) elements.lineEndX.textContent = '-';
        if (elements.lineEndY) elements.lineEndY.textContent = '-';
        if (elements.lineLengthDisplay) elements.lineLengthDisplay.textContent = '-';

        // Disable buttons / 停用按鈕
        if (elements.clearLineBtn) elements.clearLineBtn.disabled = true;
        if (elements.openLineDetailBtn) elements.openLineDetailBtn.disabled = true;
        if (elements.batchExportLineBtn) elements.batchExportLineBtn.disabled = true;

        // Clear preview chart if empty / 若為空則清空預覽圖表
        if (elements.lineProfileCanvas) {
            const ctx = elements.lineProfileCanvas.getContext('2d');
            ctx.clearRect(0, 0, elements.lineProfileCanvas.width, elements.lineProfileCanvas.height);
            
            // Draw placeholder text / 繪製提示文字
            const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
            ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                document.documentElement.lang === 'zh-TW' || document.documentElement.lang === 'zh' 
                    ? '請在影像上拖曳劃線以生成剖面圖' 
                    : 'Drag on image to generate profile', 
                elements.lineProfileCanvas.width / 2, 
                elements.lineProfileCanvas.height / 2
            );
        }
    }
}

/**
 * Axis labels for publication-style line profile figures.
 * Keep academic figures language-consistent and modality-aware.
 */
function getLineProfileAxisLabels(useAcademic, xUnit) {
    const modality = state.currentDS ? (state.currentDS.string('x00080060') || '').toUpperCase() : '';
    const yLabel = modality === 'CT'
        ? 'CT number (HU)'
        : 'Pixel intensity (a.u.)';

    if (useAcademic) {
        return {
            x: `Distance along line (${xUnit})`,
            y: yLabel
        };
    }

    return {
        x: document.documentElement.lang === 'zh-TW' || document.documentElement.lang === 'zh'
            ? `沿線段距離 / Distance along line (${xUnit})`
            : `Distance along line (${xUnit})`,
        y: document.documentElement.lang === 'zh-TW' || document.documentElement.lang === 'zh'
            ? `像素讀值 / ${yLabel}`
            : yLabel
    };
}

/**
 * Draw custom Line Profile chart on canvas / 在畫布上繪製自訂線段剖面圖表
 * @param {HTMLCanvasElement} canvas Target canvas / 目標畫布
 * @param {boolean} isLarge True if modal chart, false if sidebar preview / 是否為彈窗大圖表，否則為側欄小圖表
 * @param {boolean} isAcademicExport True if exporting offline high-res figure / 是否正在匯出離線高解析度學術圖表
 */
function drawProfileChart(canvas, isLarge, isAcademicExport = false) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Determine whether to use academic style / 判定是否使用學術期刊風格
    const useAcademic = isAcademicExport || (isLarge && state.academicStyle);

    // Dynamically adjust canvas internal resolution to client display size to prevent blurriness (Bypass during offline high-res export)
    // 動態調整畫布內部解析度至顯示大小以防止模糊（離線高解析度匯出時跳過此步驟）
    if (!isAcademicExport) {
        const displayWidth = canvas.clientWidth || canvas.width;
        const displayHeight = canvas.clientHeight || canvas.height;
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
    }

    // Clear background (Academic style uses solid white; standard style uses clear rect / dark bg)
    // 清空背景（學術風格使用純白填滿，標準風格則清除畫布/深色背景）
    if (useAcademic) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (!state.lineProfileData || state.lineProfileData.length === 0) {
        return;
    }

    const data = state.lineProfileData;
    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const meanVal = values.reduce((a, b) => a + b, 0) / values.length;

    // Define scale factor to maintain proportions across resolutions (900px base width)
    // 定義縮放比例因子以在不同解析度下保持完美的視覺比例（以 900px 寬度為基準）
    let scaleFactor = 1.0;
    if (isAcademicExport) {
        scaleFactor = canvas.width / 900.0;
    } else if (isLarge) {
        scaleFactor = 1.0;
    } else {
        scaleFactor = 0.55; // for the small sidebar chart / 側欄小圖表比例
    }

    // Set chart dimensions and padding (Academic style needs slightly more padding for clear label display)
    // 設定圖表尺寸與內邊距（學術期刊格式需要稍大的邊距以確保標籤清晰顯示）
    const padding = useAcademic
        ? {
            top: 45 * scaleFactor,
            right: 40 * scaleFactor,
            bottom: 60 * scaleFactor,
            left: 80 * scaleFactor
          }
        : (isLarge 
            ? { top: 35, right: 30, bottom: 45, left: 60 } 
            : { top: 12, right: 10, bottom: 20, left: 40 });
    
    const chartW = canvas.width - padding.left - padding.right;
    const chartH = canvas.height - padding.top - padding.bottom;

    // Setup fonts and styles dynamically
    // 動態設定字型與色彩樣式
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    
    // Academic style: Times New Roman, solid black axes, no glow
    // 標準樣式：Inter/sans-serif，高科技霓虹發光
    const fontName = useAcademic ? '"Times New Roman", Times, serif' : 'Inter, sans-serif';
    const textPrimary = useAcademic ? '#000000' : (isDark ? '#f8fafc' : '#0f172a');
    const textMuted = useAcademic ? '#000000' : (isDark ? '#94a3b8' : '#64748b');
    const axisColor = useAcademic ? '#000000' : (isDark ? '#475569' : '#cbd5e1');
    const gridColor = useAcademic ? 'rgba(0, 0, 0, 0.05)' : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)');

    // Compute range with a 10% buffer
    // 計算帶有 10% 緩衝的 Y 軸範圍
    const valueRange = maxVal - minVal;
    const yBuffer = valueRange === 0 ? 10 : valueRange * 0.1;
    const yMin = minVal - yBuffer;
    const yMax = maxVal + yBuffer;
    const yRange = yMax - yMin;

    // X axis unit: Use physical (mm) if spacing available, else pixels
    // X 軸單位：若有間距則用物理(mm)，否則用像素(px)
    const hasMm = data[0] && data[0].distanceMm !== null;
    const getXVal = (d) => hasMm ? d.distanceMm : d.distancePx;
    const xMax = Math.max(getXVal(data[data.length - 1]), Number.EPSILON);
    const xUnit = hasMm ? 'mm' : 'px';
    const axisLabels = getLineProfileAxisLabels(useAcademic, xUnit);

    // Helper functions to map coordinates
    // 輔助函數：映射物理數據至畫布座標
    const getScreenX = (d) => padding.left + (getXVal(d) / xMax) * chartW;
    const getScreenY = (val) => padding.top + chartH - ((val - yMin) / yRange) * chartH;

    // 1. Draw Grid Lines or Academic Ticks / 1. 繪製網格線或學術刻度線
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = Math.max(1, 0.8 * scaleFactor);

    // Horizontal grids & Y-axis labels / 水平網格線與 Y 軸標記
    const gridCounts = isLarge ? 5 : 3;
    for (let i = 0; i <= gridCounts; i++) {
        const yVal = yMin + (i / gridCounts) * yRange;
        const screenY = getScreenY(yVal);
        
        // Draw subtle grid lines (Skip completely in academic mode if you prefer ultra-clean, or keep a very subtle line)
        // 繪製微弱網格線（學術期刊一般只留邊框與刻度，此處可繪製極淡的點線，或在學術模式下省略）
        if (!useAcademic) {
            ctx.beginPath();
            ctx.moveTo(padding.left, screenY);
            ctx.lineTo(padding.left + chartW, screenY);
            ctx.stroke();
        } else {
            // Draw an extremely light solid grid line for academic precision, or skip
            // 繪製一條極淡的實線以輔助讀數
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
            ctx.beginPath();
            ctx.moveTo(padding.left, screenY);
            ctx.lineTo(padding.left + chartW, screenY);
            ctx.stroke();
        }

        // Draw Y axis labels / 繪製 Y 軸數值標籤
        ctx.fillStyle = textMuted;
        ctx.font = `${Math.round(11 * scaleFactor)}px ${fontName}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(yVal), padding.left - (8 * scaleFactor), screenY);
        
        // Draw Y-axis Ticks pointing outward in Academic Style / 在學術風格下繪製向外突出的 Y 軸刻度線
        if (useAcademic) {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.2 * scaleFactor;
            ctx.beginPath();
            ctx.moveTo(padding.left, screenY);
            ctx.lineTo(padding.left - (5 * scaleFactor), screenY);
            ctx.stroke();
        }
    }

    // Vertical grids & X-axis labels / 垂直網格線與 X 軸標記
    const xGridCounts = isLarge ? 6 : 3;
    for (let i = 0; i <= xGridCounts; i++) {
        const xVal = (i / xGridCounts) * xMax;
        const screenX = padding.left + (i / xGridCounts) * chartW;

        if (!useAcademic) {
            ctx.strokeStyle = gridColor;
            ctx.beginPath();
            ctx.moveTo(screenX, padding.top);
            ctx.lineTo(screenX, padding.top + chartH);
            ctx.stroke();
        } else {
            // Light grid lines / 極淡垂直線
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
            ctx.beginPath();
            ctx.moveTo(screenX, padding.top);
            ctx.lineTo(screenX, padding.top + chartH);
            ctx.stroke();
        }

        // Draw X axis labels / 繪製 X 軸數值標籤
        ctx.fillStyle = textMuted;
        ctx.font = `${Math.round(11 * scaleFactor)}px ${fontName}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(
            `${xVal.toFixed(hasMm && isLarge ? 1 : 0)}`, 
            screenX, 
            padding.top + chartH + (6 * scaleFactor)
        );

        // Draw X-axis Ticks pointing outward in Academic Style / 在學術風格下繪製向外突出的 X 軸刻度線
        if (useAcademic) {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.2 * scaleFactor;
            ctx.beginPath();
            ctx.moveTo(screenX, padding.top + chartH);
            ctx.lineTo(screenX, padding.top + chartH + (5 * scaleFactor));
            ctx.stroke();
        }
    }

    // 2. Draw Area Gradient (Only in standard mode, skip in Academic mode to avoid gradients)
    // 2. 繪製半透明漸變區域（標準模式下繪製，學術模式下省略以保持高對比）
    if (!useAcademic && data.length > 1) {
        ctx.beginPath();
        ctx.moveTo(getScreenX(data[0]), getScreenY(data[0].value));
        for (let i = 1; i < data.length; i++) {
            ctx.lineTo(getScreenX(data[i]), getScreenY(data[i].value));
        }
        ctx.lineTo(getScreenX(data[data.length - 1]), padding.top + chartH);
        ctx.lineTo(getScreenX(data[0]), padding.top + chartH);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0.25)');
        grad.addColorStop(1, 'rgba(0, 255, 255, 0.00)');
        ctx.fillStyle = grad;
        ctx.fill();
    }

    // 3. Draw Profile Line / 3. 繪製主要剖面折線
    if (data.length > 1) {
        ctx.beginPath();
        ctx.moveTo(getScreenX(data[0]), getScreenY(data[0].value));
        for (let i = 1; i < data.length; i++) {
            ctx.lineTo(getScreenX(data[i]), getScreenY(data[i].value));
        }
        
        if (useAcademic) {
            ctx.strokeStyle = '#000000'; // Pure black in academic style / 學術格式使用純黑色
            ctx.lineWidth = 2.0 * scaleFactor; // Proportional line width / 按比例設定寬度
        } else {
            ctx.strokeStyle = '#00ffff'; // Neon cyan in standard style / 標準格式使用發光青色
            ctx.lineWidth = isLarge ? 2.5 : 1.5;
        }
        
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    // Draw L-Frame Border for Academic Style (Nature/IEEE style: clear outer bounding box or L-frame)
    // 為學術期刊圖表繪製堅實的邊框與座標軸實線 (L 型實線)
    if (useAcademic) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5 * scaleFactor;
        
        // Draw L-frame / 繪製 L 型實線軸
        ctx.beginPath();
        // Y Axis Line
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + chartH);
        // X Axis Line
        ctx.lineTo(padding.left + chartW, padding.top + chartH);
        ctx.stroke();

        // Optional: Draw top and right borders to make it a full frame (Standard for some journals)
        // 可選：繪製頂部與右側細線以形成完整矩形邊框
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.0 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left + chartW, padding.top);
        ctx.lineTo(padding.left + chartW, padding.top + chartH);
        ctx.stroke();
    }

    // 4. Highlight summary marks. Academic mode keeps the figure clean and only shows the mean reference line.
    // 4. 標記摘要資訊。學術模式保持簡潔，僅顯示平均值參考線。
    if ((isLarge || isAcademicExport) && data.length > 1) {
        const maxPoint = data.find(d => d.value === maxVal);
        const minPoint = data.find(d => d.value === minVal);

        const drawMarker = (point, color, labelText) => {
            const sx = getScreenX(point);
            const sy = getScreenY(point.value);

            // Standard mode: Glowing markers
            // 標準模式：帶有霓虹發光背景與色塊的標記
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(sx, sy, 5, 0, 2 * Math.PI);
            ctx.fill();

            // Inner white dot
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, sy, 2.5, 0, 2 * Math.PI);
            ctx.fill();

            // Draw text tag with contrast background
            ctx.font = 'bold 10px Inter, sans-serif';
            const tagText = `${labelText}: ${point.value.toFixed(0)}`;
            const textW = ctx.measureText(tagText).width;
            
            const tagX = sx + 8;
            const tagY = sy - 14;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            ctx.fillRect(tagX - 4, tagY - 10, textW + 8, 14);

            ctx.fillStyle = color;
            ctx.fillText(tagText, tagX, tagY);
        };

        if (!useAcademic) {
            if (maxPoint) drawMarker(maxPoint, '#f43f5e', 'MAX');
            if (minPoint) drawMarker(minPoint, '#3b82f6', 'MIN');
        }

        // Draw Mean line / 繪製平均值水平線
        const meanY = getScreenY(meanVal);
        ctx.shadowBlur = 0;
        
        if (useAcademic) {
            ctx.strokeStyle = '#4b5563'; // Dark gray for neutral academic look / 深灰色以符合學術中性色調
            ctx.lineWidth = 1.2 * scaleFactor;
            ctx.setLineDash([5 * scaleFactor, 5 * scaleFactor]); // Proportional dash / 按比例虛線
            ctx.beginPath();
            ctx.moveTo(padding.left, meanY);
            ctx.lineTo(padding.left + chartW, meanY);
            ctx.stroke();
            ctx.setLineDash([]); // Reset dash

            ctx.fillStyle = '#1f2937';
            ctx.font = `italic ${Math.round(10 * scaleFactor)}px ${fontName}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`Mean = ${meanVal.toFixed(1)}`, padding.left + (5 * scaleFactor), meanY - (4 * scaleFactor));
        } else {
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)'; // Emerald 500
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, meanY);
            ctx.lineTo(padding.left + chartW, meanY);
            ctx.stroke();
            ctx.setLineDash([]); // Reset dash

            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`MEAN: ${meanVal.toFixed(1)}`, padding.left + 5, meanY - 4);
        }
    }

    // 5. Draw Axis Titles / 5. 繪製座標軸標題
    ctx.fillStyle = textPrimary;
    ctx.font = `bold ${Math.round(13 * scaleFactor)}px ${fontName}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // X axis title / X 軸標題
    if (isLarge || isAcademicExport) {
        ctx.fillText(
            axisLabels.x,
            padding.left + chartW / 2,
            canvas.height - (18 * scaleFactor)
        );

        // Y axis title (rotated) / Y 軸標題 (旋轉繪製)
        ctx.save();
        ctx.translate(22 * scaleFactor, padding.top + chartH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(
            axisLabels.y,
            0,
            0
        );
        ctx.restore();
    } else {
        // Simple indicator for unit in small chart / 小圖表簡單顯示單位
        ctx.fillStyle = textMuted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.font = `${Math.round(9 * scaleFactor)}px ${fontName}`;
        ctx.fillText(`(${xUnit})`, canvas.width - 2, canvas.height - 2);
    }
}

/**
 * Populate detailed coordinates and reading values into modal table / 填充詳細座標與讀值到彈窗表格中
 */
function populateLineDataTable() {
    if (!elements.lineDataTableBody) return;

    if (!state.lineProfileData || state.lineProfileData.length === 0) {
        elements.lineDataTableBody.innerHTML = `<tr>
            <td colspan="5" class="text-center" style="color: var(--text-muted); padding: 1.5rem;">
                ${document.documentElement.lang === 'zh-TW' || document.documentElement.lang === 'zh' 
                    ? '暫無數據 / No Data Available' 
                    : 'No Data Available'}
            </td>
        </tr>`;
        return;
    }

    const rowSpacing = state.pixelSpacing ? state.pixelSpacing[0] : null;
    const colSpacing = state.pixelSpacing ? state.pixelSpacing[1] : null;

    // Generate table rows HTML / 生成表格列 HTML
    elements.lineDataTableBody.innerHTML = state.lineProfileData.map((d, idx) => {
        const distanceStr = d.distanceMm !== null 
            ? `${d.distanceMm.toFixed(2)} mm (${d.distancePx.toFixed(1)} px)`
            : `${d.distancePx.toFixed(1)} px`;

        return `<tr class="hover-highlight" data-index="${idx}">
            <td style="font-family: monospace; font-size: 0.85rem; text-align: center;">${idx + 1}</td>
            <td style="font-family: monospace; font-size: 0.85rem; text-align: center;">(${d.x}, ${d.y})</td>
            <td style="font-size: 0.85rem; text-align: left;">${distanceStr}</td>
            <td style="font-family: monospace; font-size: 0.85rem; text-align: right; font-weight: bold; color: var(--accent-cyan);">
                ${d.value.toFixed(0)}
            </td>
        </tr>`;
    }).join('');

    // Update modal statistical summary card / 更新彈窗統計摘要卡片
    const values = state.lineProfileData.map(d => d.value);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const meanVal = values.reduce((a, b) => a + b, 0) / values.length;

    // Calculate Standard Deviation / 計算標準差
    const variance = values.reduce((a, b) => a + Math.pow(b - meanVal, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (elements.modalLineStart) elements.modalLineStart.textContent = `(${Math.round(state.lineStart.x)}, ${Math.round(state.lineStart.y)})`;
    if (elements.modalLineEnd) elements.modalLineEnd.textContent = `(${Math.round(state.lineEnd.x)}, ${Math.round(state.lineEnd.y)})`;
    if (elements.modalLineMax) elements.modalLineMax.textContent = maxVal.toFixed(0);
    if (elements.modalLineMin) elements.modalLineMin.textContent = minVal.toFixed(0);
    if (elements.modalLineMean) elements.modalLineMean.textContent = meanVal.toFixed(1);
    if (elements.modalLineStd) elements.modalLineStd.textContent = stdDev.toFixed(1);
}

/**
 * Export Line Profile data into CSV file / 匯出線段剖面數據為 CSV 檔案
 */
function exportLineProfileToCSV() {
    if (!state.lineProfileData || state.lineProfileData.length === 0) {
        showToast('⚠️ 沒有可供匯出的剖面線數據 / No Profile Data to export', 'error');
        return;
    }

    // Prepare CSV header and lines bilingually / 雙語準備 CSV 檔頭與資料列
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Traditional Chinese support / Excel 繁體中文支援
    csvContent += 'Index (索引),X (列座標),Y (行座標),Distance px (像素距離),Distance mm (物理距離),Pixel Value (像素讀值)\r\n';

    state.lineProfileData.forEach(d => {
        const mmVal = d.distanceMm !== null ? d.distanceMm.toFixed(4) : 'N/A';
        csvContent += `${d.index + 1},${d.x},${d.y},${d.distancePx.toFixed(2)},${mmVal},${d.value}\r\n`;
    });

    // Create download link / 建立下載連結
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Include instance or file name in CSV filename / 檔名中包含切片編號或檔名
        const fileName = state.files[state.currentIndex]?.file?.name || 'dicom_image';
        const cleanName = fileName.replace(/\.[^/.]+$/, "");
        link.setAttribute('href', url);
        link.setAttribute('download', `${cleanName}_line_profile.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('✅ 成功匯出線段剖面 CSV 數據 / Successfully exported CSV profile', 'success');
    } catch (err) {
        console.error('CSV Export Error:', err);
        showToast('❌ 匯出 CSV 失敗 / Failed to export CSV', 'error');
    }
}

/**
 * Export Batch Line Profile data into a single CSV file (Wide-Format)
 * 批次匯出整個資料夾切片的線段剖面數據為單一 CSV 檔案（寬格式）
 */
function exportBatchLineProfileToCSV(selectedDicomTags = null) {
    const linesToExport = state.lines.length > 0
        ? state.lines
        : ((state.lineStart && state.lineEnd) ? [{ start: state.lineStart, end: state.lineEnd, id: Date.now() }] : []);

    if (linesToExport.length === 0 || state.files.length === 0) {
        showToast('⚠️ 沒有量測線段或未載入任何影像 / No measured lines or loaded images', 'error');
        return;
    }

    // Show loading overlay / 顯示加載遮罩
    if (elements.loadingOverlay && elements.loadingText) {
        elements.loadingOverlay.classList.remove('hidden');
        elements.loadingText.textContent = '正在進行批次線段剖面分析... / Performing batch line profile analysis...';
    }

    // Use setTimeout to yield execution and keep UI responsive / 使用 setTimeout 讓出執行緒保持 UI 響應
    setTimeout(async () => {
        try {
            // Sort slices grouped by series into anatomical order (same order as viewer playback):
            // SeriesInstanceUID -> SliceLocation -> InstanceNumber -> numeric filename.
            // 批次匯出與 viewer 播放用同一排序：先按 Series 分組、組內按物理位置/編號，
            // 避免多系列載入時不同協議的同位置切片交錯混排。
            const sortedFiles = [...state.files].sort((a, b) => {
                const seriesA = a.dataSet.string('x0020000e') || '';
                const seriesB = b.dataSet.string('x0020000e') || '';
                if (seriesA !== seriesB) {
                    return seriesA.localeCompare(seriesB);
                }
                const locA = parseFloat(a.dataSet.string('x00201041'));
                const locB = parseFloat(b.dataSet.string('x00201041'));
                if (!isNaN(locA) && !isNaN(locB) && locA !== locB) {
                    return locA - locB;
                }
                const instA = parseInt(a.dataSet.string('x00200013'), 10);
                const instB = parseInt(b.dataSet.string('x00200013'), 10);
                if (!isNaN(instA) && !isNaN(instB) && instA !== instB) {
                    return instA - instB;
                }
                return a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' });
            });

            const allRowsData = [];
            const rowSpacing = state.pixelSpacing ? state.pixelSpacing[0] : null;
            const colSpacing = state.pixelSpacing ? state.pixelSpacing[1] : null;

            // Build rows for each line and attach line number / 對每條線建立資料列並附上線段編號
            for (let lineIdx = 0; lineIdx < linesToExport.length; lineIdx++) {
                const line = linesToExport[lineIdx];
                const x1 = line.start.x;
                const y1 = line.start.y;
                const x2 = line.end.x;
                const y2 = line.end.y;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const pixelDistance = Math.sqrt(dx * dx + dy * dy);
                const N = pixelDistance >= 1 ? Math.round(pixelDistance) + 1 : 1;

                const rowsData = [];
                for (let i = 0; i < N; i++) {
                    const t = N > 1 ? i / (N - 1) : 0;
                    const px = Math.min(state.imageCols - 1, Math.max(0, Math.round(x1 + t * dx)));
                    const py = Math.min(state.imageRows - 1, Math.max(0, Math.round(y1 + t * dy)));
                    const segDx = px - x1;
                    const segDy = py - y1;
                    const distPx = Math.sqrt(segDx * segDx + segDy * segDy);

                    let distMm = null;
                    if (rowSpacing !== null && colSpacing !== null) {
                        distMm = Math.sqrt(Math.pow(segDx * colSpacing, 2) + Math.pow(segDy * rowSpacing, 2));
                    }

                    rowsData.push({
                        lineNo: lineIdx + 1,
                        index: i + 1,
                        x: px,
                        y: py,
                        distPx: distPx.toFixed(2),
                        distMm: distMm !== null ? distMm.toFixed(4) : 'N/A',
                        values: []
                    });
                }

                for (let fIdx = 0; fIdx < sortedFiles.length; fIdx++) {
                    const f = sortedFiles[fIdx];
                    let pixelData = null;
                    let cols = 0, rows = 0;

                    try {
                        pixelData = getPixelDataFromDataSet(f.dataSet, f.byteArray);
                        rows = f.dataSet.uint16('x00280010');
                        cols = f.dataSet.uint16('x00280011');
                    } catch (err) {
                        console.error(`Error parsing pixel data for ${f.file.name}:`, err);
                    }

                    for (let i = 0; i < N; i++) {
                        if (pixelData && cols > 0 && rows > 0) {
                            const t = N > 1 ? i / (N - 1) : 0;
                            const px = Math.min(cols - 1, Math.max(0, Math.round(x1 + t * dx)));
                            const py = Math.min(rows - 1, Math.max(0, Math.round(y1 + t * dy)));
                            const val = pixelData[py * cols + px];
                            rowsData[i].values.push(val.toFixed(4));
                        } else {
                            rowsData[i].values.push('N/A');
                        }
                    }
                }

                allRowsData.push(...rowsData);
            }

            // Compile to CSV with Excel compatible UTF-8 BOM / 編譯為包含 Excel 相容 UTF-8 BOM 的 CSV
            let csvContent = '\uFEFF';

            // Compile headers / 編譯表頭
            const headers = [
                'Line (線段編號)',
                'Index (索引)',
                'X (列座標)',
                'Y (行座標)',
                'Distance px (像素距離)',
                'Distance mm (物理距離)'
            ];

            sortedFiles.forEach(f => {
                const sliceLoc = f.dataSet.string('x00201041');
                const seriesNum = f.dataSet.string('x00200011');
                const seriesDesc = f.dataSet.string('x0008103e');
                let colHeader = f.file.name;
                // Include series identity so same filenames across series stay distinguishable
                // 欄位標註系列編號與描述，多系列批次時才分得出 132 個 I10 各屬哪個協議
                const tagParts = [];
                if (seriesNum !== undefined && seriesNum !== '') {
                    tagParts.push(`S${seriesNum}`);
                }
                if (seriesDesc !== undefined && seriesDesc !== '') {
                    tagParts.push(seriesDesc);
                }
                if (sliceLoc !== undefined && sliceLoc !== '') {
                    tagParts.push(`Loc: ${parseFloat(sliceLoc).toFixed(2)}`);
                } else {
                    const instNum = f.dataSet.string('x00200013');
                    if (instNum !== undefined && instNum !== '') {
                        tagParts.push(`Inst: ${instNum}`);
                    }
                }
                if (tagParts.length > 0) {
                    colHeader += ` (${tagParts.join(' | ')})`;
                }

                if (colHeader.includes(',') || colHeader.includes('"')) {
                    colHeader = `"${colHeader.replace(/\"/g, '""')}"`;
                }
                headers.push(colHeader);
            });
            csvContent += headers.join(',') + '\r\n';

            // Optional metadata rows for user-selected DICOM tags / 依使用者勾選附加 DICOM tag 資訊列
            if (Array.isArray(selectedDicomTags) && selectedDicomTags.length > 0) {
                selectedDicomTags.forEach(tagName => {
                    const tagValues = sortedFiles.map(f => {
                        let value = '';
                        const found = COMMON_TAGS.find(t => t.name === tagName);
                        if (found) {
                            const raw = f.dataSet.string(found.tag);
                            value = raw !== undefined && raw !== null ? String(raw) : '';
                        }
                        if (value.includes(',') || value.includes('"')) {
                            return `"${value.replace(/\"/g, '""')}"`;
                        }
                        return value;
                    });

                    const metaRow = [
                        `DICOM Tag: ${tagName}`,
                        '',
                        '',
                        '',
                        '',
                        '',
                        ...tagValues
                    ];
                    csvContent += metaRow.join(',') + '\r\n';
                });
            }

            // Compile rows / 編譯數據列
            allRowsData.forEach(r => {
                const rowCells = [
                    `Line ${r.lineNo}`,
                    r.index,
                    r.x,
                    r.y,
                    r.distPx,
                    r.distMm,
                    ...r.values
                ];
                csvContent += rowCells.join(',') + '\r\n';
            });

            // Create download link and trigger / 建立下載連結並觸發
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            const firstFileName = state.files[0]?.file?.name || 'dicom';
            const cleanDirName = firstFileName.replace(/\.[^/.]+$/, "") || 'dicom_folder';
            const dateStr = new Date().toISOString().slice(0, 10);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `${cleanDirName}_batch_line_profile_${dateStr}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            hideModal('tagModal');

            showToast('✅ 成功匯出批次線段剖面 CSV / Successfully exported batch CSV profile', 'success');
        } catch (err) {
            console.error('Batch CSV Export Error:', err);
            showToast('❌ 匯出批次 CSV 失敗 / Failed to export batch CSV', 'error');
        } finally {
            // Hide loading overlay / 隱藏加載遮罩
            if (elements.loadingOverlay) {
                elements.loadingOverlay.classList.add('hidden');
            }
        }
    }, 50);
}

/**
 * Convert a canvas to a Blob with Promise ergonomics.
 */
function canvasToBlob(canvas, type = 'image/png') {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas export failed.'));
        }, type);
    });
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc ^= bytes[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(view, offset, value) {
    view[offset] = (value >>> 24) & 0xff;
    view[offset + 1] = (value >>> 16) & 0xff;
    view[offset + 2] = (value >>> 8) & 0xff;
    view[offset + 3] = value & 0xff;
}

async function addPngDpiMetadata(blob, dpi = 300) {
    const source = new Uint8Array(await blob.arrayBuffer());
    const pngSignatureLength = 8;
    const firstChunkLength = 4 + 4 + new DataView(source.buffer).getUint32(8) + 4;
    const insertAt = pngSignatureLength + firstChunkLength;
    const pixelsPerMeter = Math.round(dpi / 0.0254);

    const chunkData = new Uint8Array(9);
    writeUint32BE(chunkData, 0, pixelsPerMeter);
    writeUint32BE(chunkData, 4, pixelsPerMeter);
    chunkData[8] = 1; // Unit: meter

    const chunkType = new TextEncoder().encode('pHYs');
    const crcInput = new Uint8Array(chunkType.length + chunkData.length);
    crcInput.set(chunkType, 0);
    crcInput.set(chunkData, chunkType.length);

    const chunk = new Uint8Array(4 + chunkType.length + chunkData.length + 4);
    writeUint32BE(chunk, 0, chunkData.length);
    chunk.set(chunkType, 4);
    chunk.set(chunkData, 8);
    writeUint32BE(chunk, 8 + chunkData.length, crc32(crcInput));

    const output = new Uint8Array(source.length + chunk.length);
    output.set(source.slice(0, insertAt), 0);
    output.set(chunk, insertAt);
    output.set(source.slice(insertAt), insertAt + chunk.length);

    return new Blob([output], { type: 'image/png' });
}

/**
 * Export high-resolution (300 DPI equivalent) line profile chart in Academic Style
 * 匯出學術期刊規格之高解析度 (等效 300 DPI) 剖面圖表影像
 */
async function exportAcademicFigure() {
    if (!state.lineProfileData || state.lineProfileData.length === 0) {
        showToast('⚠️ 沒有可供匯出的剖面線數據 / No Profile Data to export', 'error');
        return;
    }

    try {
        // Create an offline high-resolution canvas (2400 x 1500 pixels for publication-grade prints)
        // 建立離線高解析度畫布 (2400 x 1500 像素，符合學術期刊排版印刷規格)
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 2400;
        exportCanvas.height = 1500;

        // Draw profile chart on the offline canvas in academic style
        // 在離線畫布上以學術期刊風格繪製剖面圖表
        drawProfileChart(exportCanvas, true, true);

        // Export as PNG and add 300 DPI pHYs metadata for publication workflows.
        // 匯出 PNG 並寫入 300 DPI pHYs metadata，以利期刊排版工作流程辨識。
        const pngBlob = await addPngDpiMetadata(await canvasToBlob(exportCanvas), 300);
        const url = URL.createObjectURL(pngBlob);

        // Create download link and trigger the download
        // 建立下載連結並觸發下載
        const link = document.createElement('a');
        
        // Get active file name to generate descriptive download filename
        // 取得當前檔案名稱以生成具描述性的下載檔名
        const fileName = state.files[state.currentIndex]?.file?.name || 'dicom_image';
        const cleanName = fileName.replace(/\.[^/.]+$/, "");
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${cleanName}_academic_profile.png`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        showToast('✅ 成功下載高解析度學術圖表 / Successfully downloaded academic figure', 'success');
    } catch (err) {
        console.error('Academic Export Error:', err);
        showToast('❌ 匯出學術圖表失敗 / Failed to export academic figure', 'error');
    }
}

// ============================================
// Entry Point
// ============================================
document.addEventListener('DOMContentLoaded', init);
