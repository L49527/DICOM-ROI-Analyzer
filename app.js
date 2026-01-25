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

    // ROI
    roiCenter: null,        // {x, y}
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

    // Analysis results
    results: [],
    availableTags: new Set(),
    selectedTags: new Set(),

    // Display tags on image overlay
    displayTags: new Set(),
    tempDisplayTags: new Set()  // Temporary selection in modal
};

// DICOM Tag 中文翻譯對照表
const TAG_TRANSLATIONS = {
    // 分析結果標籤
    'FileName': '檔案名稱',
    'ROI_Mean': 'ROI 平均值',
    'ROI_Noise_SD': 'ROI 雜訊 (標準差)',
    'FullImage_Mean': '全影像平均值',
    'FullImage_SD': '全影像標準差',
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
    'SOPInstanceUID': 'SOP 實例 UID'
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
    dropZone: document.getElementById('dropZone'),
    folderInput: document.getElementById('folderInput'),
    selectFolderBtn: document.getElementById('selectFolderBtn'),

    // Viewer Panel
    viewerPanel: document.getElementById('viewerPanel'),
    imageContainer: document.getElementById('imageContainer'),
    dicomCanvas: document.getElementById('dicomCanvas'),
    ctx: document.getElementById('dicomCanvas').getContext('2d'),

    // Overlays
    patientInfo: document.getElementById('patientInfo'),
    wwwlInfo: document.getElementById('wwwlInfo'),
    fileInfo: document.getElementById('fileInfo'),
    roiInfo: document.getElementById('roiInfo'),

    // Navigation
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    imageSlider: document.getElementById('imageSlider'),
    imageCounter: document.getElementById('imageCounter'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),

    // ROI Controls
    roiRadius: document.getElementById('roiRadius'),
    roiX: document.getElementById('roiX'),
    roiY: document.getElementById('roiY'),

    // Zoom Controls
    zoomSlider: document.getElementById('zoomSlider'),
    zoomValue: document.getElementById('zoomValue'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomResetBtn: document.getElementById('zoomResetBtn'),

    // WW/WL Controls
    windowWidth: document.getElementById('windowWidth'),
    windowLevel: document.getElementById('windowLevel'),
    applyWWWLAllBtn: document.getElementById('applyWWWLAllBtn'),
    resetWWWLBtn: document.getElementById('resetWWWLBtn'),

    // Rotation Controls
    rotationSlider: document.getElementById('rotationSlider'),
    rotationValue: document.getElementById('rotationValue'),
    rotateMinus45Btn: document.getElementById('rotateMinus45Btn'),
    rotateMinus1Btn: document.getElementById('rotateMinus1Btn'),
    rotatePlus1Btn: document.getElementById('rotatePlus1Btn'),
    rotatePlus45Btn: document.getElementById('rotatePlus45Btn'),
    rotate90LeftBtn: document.getElementById('rotate90LeftBtn'),
    rotate90RightBtn: document.getElementById('rotate90RightBtn'),
    resetRotationBtn: document.getElementById('resetRotationBtn'),
    applyRotationAllBtn: document.getElementById('applyRotationAllBtn'),

    // Analysis
    analyzeBtn: document.getElementById('analyzeBtn'),
    analysisProgress: document.getElementById('analysisProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    singleImageSelect: document.getElementById('singleImageSelect'),
    analyzeSingleBtn: document.getElementById('analyzeSingleBtn'),

    // Export
    exportBtn: document.getElementById('exportBtn'),

    // Modals
    helpModal: document.getElementById('helpModal'),
    helpBtn: document.getElementById('helpBtn'),
    closeHelpBtn: document.getElementById('closeHelpBtn'),

    tagModal: document.getElementById('tagModal'),
    closeTagBtn: document.getElementById('closeTagBtn'),
    tagList: document.getElementById('tagList'),
    selectAllTags: document.getElementById('selectAllTags'),
    deselectAllTags: document.getElementById('deselectAllTags'),
    cancelExportBtn: document.getElementById('cancelExportBtn'),
    confirmExportBtn: document.getElementById('confirmExportBtn'),

    // Loading
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),

    // Display Tags
    displayTagBtn: document.getElementById('displayTagBtn'),
    displayTagModal: document.getElementById('displayTagModal'),
    displayTagList: document.getElementById('displayTagList'),
    closeDisplayTagBtn: document.getElementById('closeDisplayTagBtn'),
    selectAllDisplayTags: document.getElementById('selectAllDisplayTags'),
    deselectAllDisplayTags: document.getElementById('deselectAllDisplayTags'),
    cancelDisplayTagBtn: document.getElementById('cancelDisplayTagBtn'),
    confirmDisplayTagBtn: document.getElementById('confirmDisplayTagBtn'),
    customTagsOverlay: document.getElementById('customTagsOverlay'),
    displayTagPreview: document.getElementById('displayTagPreview')
};

// ============================================
// Initialization
// ============================================
function init() {
    setupEventListeners();
    console.log('DICOM ROI Analyzer initialized');
}

function setupEventListeners() {
    // Folder selection
    elements.selectFolderBtn.addEventListener('click', () => elements.folderInput.click());
    elements.folderInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);

    // Image navigation
    elements.prevBtn.addEventListener('click', () => navigateImage(-1));
    elements.nextBtn.addEventListener('click', () => navigateImage(1));
    elements.imageSlider.addEventListener('input', handleSliderChange);
    elements.fullscreenBtn.addEventListener('click', toggleFullscreen);

    // Canvas interactions
    elements.dicomCanvas.addEventListener('click', handleCanvasClick);
    elements.dicomCanvas.addEventListener('mousedown', handleMouseDown);
    elements.dicomCanvas.addEventListener('mousemove', handleMouseMove);
    elements.dicomCanvas.addEventListener('mouseup', handleMouseUp);
    elements.dicomCanvas.addEventListener('mouseleave', handleMouseUp);
    elements.dicomCanvas.addEventListener('contextmenu', e => e.preventDefault());

    // ROI controls
    elements.roiRadius.addEventListener('change', () => {
        state.roiRadius = parseInt(elements.roiRadius.value) || 25;
        renderImage();
    });

    // WW/WL controls
    elements.windowWidth.addEventListener('change', () => {
        state.windowWidth = parseFloat(elements.windowWidth.value) || 400;
        renderImage();
    });
    elements.windowLevel.addEventListener('change', () => {
        state.windowLevel = parseFloat(elements.windowLevel.value) || 200;
        renderImage();
    });
    elements.resetWWWLBtn.addEventListener('click', resetWindowLevel);
    elements.applyWWWLAllBtn.addEventListener('click', applyWWWLToAll);

    // Rotation controls
    elements.rotationSlider.addEventListener('input', handleRotationSlider);
    elements.rotateMinus45Btn.addEventListener('click', () => rotateImage(-45));
    elements.rotateMinus1Btn.addEventListener('click', () => rotateImage(-1));
    elements.rotatePlus1Btn.addEventListener('click', () => rotateImage(1));
    elements.rotatePlus45Btn.addEventListener('click', () => rotateImage(45));
    elements.rotate90LeftBtn.addEventListener('click', () => rotateImage(-90));
    elements.rotate90RightBtn.addEventListener('click', () => rotateImage(90));
    elements.resetRotationBtn.addEventListener('click', resetRotation);
    elements.applyRotationAllBtn.addEventListener('click', applyRotationToAll);

    // Zoom controls
    elements.zoomSlider.addEventListener('input', handleZoomSlider);
    elements.zoomInBtn.addEventListener('click', () => adjustZoom(25));
    elements.zoomOutBtn.addEventListener('click', () => adjustZoom(-25));
    elements.zoomResetBtn.addEventListener('click', () => setZoom(100));

    // Analysis
    elements.analyzeBtn.addEventListener('click', runAnalysis);
    elements.singleImageSelect.addEventListener('change', updateSingleAnalyzeButton);
    elements.analyzeSingleBtn.addEventListener('click', runSingleImageAnalysis);
    elements.exportBtn.addEventListener('click', openTagModal);

    // Modals
    elements.helpBtn.addEventListener('click', () => showModal('helpModal'));
    elements.closeHelpBtn.addEventListener('click', () => hideModal('helpModal'));
    elements.closeTagBtn.addEventListener('click', () => hideModal('tagModal'));
    elements.cancelExportBtn.addEventListener('click', () => hideModal('tagModal'));
    elements.confirmExportBtn.addEventListener('click', exportCSV);
    elements.selectAllTags.addEventListener('click', () => toggleAllTags(true));
    elements.deselectAllTags.addEventListener('click', () => toggleAllTags(false));

    // Display Tag Modal
    elements.displayTagBtn.addEventListener('click', openDisplayTagModal);
    elements.closeDisplayTagBtn.addEventListener('click', () => hideModal('displayTagModal'));
    elements.cancelDisplayTagBtn.addEventListener('click', () => hideModal('displayTagModal'));
    elements.confirmDisplayTagBtn.addEventListener('click', confirmDisplayTags);
    elements.selectAllDisplayTags.addEventListener('click', () => toggleAllDisplayTags(true));
    elements.deselectAllDisplayTags.addEventListener('click', () => toggleAllDisplayTags(false));

    // Modal backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            hideModal('helpModal');
            hideModal('tagModal');
            hideModal('displayTagModal');
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
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

    showLoading('正在讀取檔案...');

    for (const item of items) {
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) {
                await traverseFileTree(entry, files);
            }
        }
    }

    await loadDICOMFiles(files);
}

async function traverseFileTree(entry, files) {
    if (entry.isFile) {
        const file = await new Promise(resolve => entry.file(resolve));
        files.push(file);
    } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await new Promise(resolve => reader.readEntries(resolve));
        for (const childEntry of entries) {
            await traverseFileTree(childEntry, files);
        }
    }
}

async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    showLoading('正在讀取檔案...');
    await loadDICOMFiles(files);
}

async function loadDICOMFiles(files) {
    state.files = [];

    for (const file of files) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const byteArray = new Uint8Array(arrayBuffer);
            const dataSet = dicomParser.parseDicom(byteArray);

            // Check if it has pixel data
            if (dataSet.elements.x7fe00010) {
                state.files.push({
                    file: file,
                    dataSet: dataSet,
                    byteArray: byteArray
                });
            }
        } catch (err) {
            console.log(`Skipping non-DICOM file: ${file.name}`);
        }
    }

    hideLoading();

    if (state.files.length > 0) {
        elements.dropZone.classList.add('hidden');
        elements.viewerPanel.classList.remove('hidden');

        elements.imageSlider.max = state.files.length - 1;
        state.currentIndex = 0;

        loadImage(0);
        updateAnalyzeButton();
        updateSingleImageSelect();
    } else {
        alert('未找到有效的 DICOM 影像檔案');
    }
}

// ============================================
// Image Loading & Rendering
// ============================================
function loadImage(index) {
    if (index < 0 || index >= state.files.length) return;

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

    renderImage();
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
    const upper = wl + ww / 2;

    // Create offscreen canvas for original size
    const offCanvas = document.createElement('canvas');
    offCanvas.width = cols;
    offCanvas.height = rows;
    const offCtx = offCanvas.getContext('2d');

    const imageData = offCtx.createImageData(cols, rows);
    const data = imageData.data;

    for (let i = 0; i < state.pixelData.length; i++) {
        let value = (state.pixelData[i] - lower) / (upper - lower) * 255;
        value = Math.max(0, Math.min(255, value));

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

    // Set canvas size with zoom and rotation consideration
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

    elements.ctx.restore();

    // Draw ROI (scaled)
    if (state.roiCenter) {
        const scaledX = state.roiCenter.x * zoomFactor;
        const scaledY = state.roiCenter.y * zoomFactor;
        const scaledRadius = state.roiRadius * zoomFactor;

        elements.ctx.strokeStyle = '#ff0000';
        elements.ctx.lineWidth = 2;
        elements.ctx.beginPath();
        elements.ctx.arc(scaledX, scaledY, scaledRadius, 0, 2 * Math.PI);
        elements.ctx.stroke();

        // Draw crosshair
        elements.ctx.beginPath();
        elements.ctx.moveTo(scaledX - 10, scaledY);
        elements.ctx.lineTo(scaledX + 10, scaledY);
        elements.ctx.moveTo(scaledX, scaledY - 10);
        elements.ctx.lineTo(scaledX, scaledY + 10);
        elements.ctx.stroke();
    }

    // Update WW/WL display
    elements.wwwlInfo.textContent = `WW: ${Math.round(state.windowWidth)} | WL: ${Math.round(state.windowLevel)}`;
}

function updateOverlayInfo() {
    const ds = state.currentDS;
    if (!ds) return;

    const patientName = ds.string('x00100010') || 'Unknown';
    const patientID = ds.string('x00100020') || 'N/A';

    elements.patientInfo.textContent = `Patient: ${patientName}\nID: ${patientID}`;
    elements.fileInfo.textContent = `File: ${state.files[state.currentIndex].file.name}`;

    if (state.roiCenter) {
        elements.roiInfo.textContent = `ROI: (${state.roiCenter.x}, ${state.roiCenter.y}) R=${state.roiRadius}`;
    } else {
        elements.roiInfo.textContent = '';
    }

    // Display custom tags on overlay
    updateCustomTagsOverlay();
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

    // Account for zoom when calculating coordinates
    return {
        x: Math.round((e.clientX - rect.left) / zoomFactor),
        y: Math.round((e.clientY - rect.top) / zoomFactor)
    };
}

function handleCanvasClick(e) {
    if (e.button !== 0) return; // Only left click

    const coords = getCanvasCoordinates(e);
    state.roiCenter = coords;

    elements.roiX.textContent = coords.x;
    elements.roiY.textContent = coords.y;

    renderImage();
    updateOverlayInfo();
    updateAnalyzeButton();
}

function handleMouseDown(e) {
    if (e.button === 2) { // Right click
        e.preventDefault();
        state.isRightDragging = true;
        state.dragStartX = e.clientX;
        state.dragStartY = e.clientY;
        state.dragStartWW = state.windowWidth;
        state.dragStartWL = state.windowLevel;
    }
}

function handleMouseMove(e) {
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

    alert(`已將 WW: ${Math.round(ww)} / WL: ${Math.round(wl)} 套用至全部 ${state.files.length} 張影像`);
}

// ============================================
// Rotation Functions
// ============================================
function handleRotationSlider() {
    state.rotation = parseInt(elements.rotationSlider.value);
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

    alert(`已將旋轉角度 ${rotation}° 套用至全部 ${state.files.length} 張影像`);
}

// ============================================
// Zoom Functions
// ============================================
function handleZoomSlider() {
    setZoom(parseInt(elements.zoomSlider.value));
}

function adjustZoom(delta) {
    const newZoom = Math.max(25, Math.min(400, state.zoom + delta));
    setZoom(newZoom);
}

function setZoom(value) {
    state.zoom = value;
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
    if (e.target.tagName === 'INPUT') return;

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
    }
}

// ============================================
// Analysis
// ============================================
function updateAnalyzeButton() {
    elements.analyzeBtn.disabled = !state.roiCenter || state.files.length === 0;
    updateSingleAnalyzeButton();
}

function updateSingleImageSelect() {
    const select = elements.singleImageSelect;
    select.innerHTML = '<option value="">-- 選擇影像 --</option>';

    state.files.forEach((fileObj, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${index + 1}. ${fileObj.file.name}`;
        select.appendChild(option);
    });
}

function updateSingleAnalyzeButton() {
    const selectedIndex = elements.singleImageSelect.value;
    elements.analyzeSingleBtn.disabled = !state.roiCenter || selectedIndex === '';
}

async function runSingleImageAnalysis() {
    const selectedIndex = parseInt(elements.singleImageSelect.value);
    if (isNaN(selectedIndex) || !state.roiCenter) return;

    const { file, dataSet, byteArray } = state.files[selectedIndex];

    // Initialize result storage if needed
    state.availableTags = new Set(['FileName', 'ROI_Mean', 'ROI_Noise_SD', 'FullImage_Mean', 'FullImage_SD', 'ROI_X', 'ROI_Y', 'ROI_R']);

    const commonTags = [
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
        { tag: 'x00280011', name: 'Columns' }
    ];

    try {
        showLoading('正在分析影像...');

        // Get pixel data
        const pixelData = getPixelDataFromDataSet(dataSet, byteArray);
        const rows = dataSet.uint16('x00280010');
        const cols = dataSet.uint16('x00280011');

        // Calculate ROI statistics
        const roiStats = calculateROIStats(pixelData, cols, rows, state.roiCenter, state.roiRadius);

        // Calculate full image statistics
        let sum = 0, sumSq = 0;
        for (let j = 0; j < pixelData.length; j++) {
            sum += pixelData[j];
            sumSq += pixelData[j] * pixelData[j];
        }
        const fullMean = sum / pixelData.length;
        const fullSD = Math.sqrt(sumSq / pixelData.length - fullMean * fullMean);

        // Build result object
        const result = {
            FileName: file.name,
            ROI_Mean: roiStats.mean.toFixed(4),
            ROI_Noise_SD: roiStats.sd.toFixed(4),
            FullImage_Mean: fullMean.toFixed(4),
            FullImage_SD: fullSD.toFixed(4),
            ROI_X: state.roiCenter.x,
            ROI_Y: state.roiCenter.y,
            ROI_R: state.roiRadius
        };

        // Extract DICOM tags
        for (const { tag, name } of commonTags) {
            const value = dataSet.string(tag);
            if (value !== undefined) {
                result[name] = value;
                state.availableTags.add(name);
            }
        }

        hideLoading();

        // Show result in a modal-like alert with detailed info
        const resultLines = [
            `📊 單張影像分析結果`,
            ``,
            `📁 檔案名稱: ${result.FileName}`,
            ``,
            `🎯 ROI 分析:`,
            `   • 平均值: ${result.ROI_Mean}`,
            `   • 標準差 (雜訊): ${result.ROI_Noise_SD}`,
            `   • 圓心: (${result.ROI_X}, ${result.ROI_Y})`,
            `   • 半徑: ${result.ROI_R}`,
            ``,
            `📷 全影像分析:`,
            `   • 平均值: ${result.FullImage_Mean}`,
            `   • 標準差: ${result.FullImage_SD}`
        ];

        // Add DICOM tags if available
        if (result.ExposureIndex) resultLines.push(`   • 曝光指標 (EI): ${result.ExposureIndex}`);
        if (result.TargetExposureIndex) resultLines.push(`   • 目標 EI: ${result.TargetExposureIndex}`);
        if (result.DeviationIndex) resultLines.push(`   • 偏差指數 (DI): ${result.DeviationIndex}`);
        if (result.KVP) resultLines.push(`   • 管電壓: ${result.KVP} kVp`);

        alert(resultLines.join('\n'));

        // Store result for potential export
        state.singleResult = result;

    } catch (err) {
        hideLoading();
        console.error('Single image analysis error:', err);
        alert(`分析失敗: ${err.message}`);
    }
}

async function runAnalysis() {
    if (!state.roiCenter) return;

    state.results = [];
    state.availableTags = new Set(['FileName', 'ROI_Mean', 'ROI_Noise_SD', 'FullImage_Mean', 'FullImage_SD', 'ROI_X', 'ROI_Y', 'ROI_R']);

    elements.analysisProgress.classList.remove('hidden');
    elements.analyzeBtn.disabled = true;

    const commonTags = [
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
        { tag: 'x00280011', name: 'Columns' }
    ];

    for (let i = 0; i < state.files.length; i++) {
        const { file, dataSet, byteArray } = state.files[i];

        // Update progress
        const progress = Math.round((i + 1) / state.files.length * 100);
        elements.progressFill.style.width = `${progress}%`;
        elements.progressText.textContent = `${progress}% (${i + 1}/${state.files.length})`;

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));

        try {
            // Get pixel data
            const pixelData = getPixelDataFromDataSet(dataSet, byteArray);
            const rows = dataSet.uint16('x00280010');
            const cols = dataSet.uint16('x00280011');

            // Calculate ROI statistics
            const roiStats = calculateROIStats(pixelData, cols, rows, state.roiCenter, state.roiRadius);

            // Calculate full image statistics
            let sum = 0, sumSq = 0;
            for (let j = 0; j < pixelData.length; j++) {
                sum += pixelData[j];
                sumSq += pixelData[j] * pixelData[j];
            }
            const fullMean = sum / pixelData.length;
            const fullSD = Math.sqrt(sumSq / pixelData.length - fullMean * fullMean);

            // Build result object
            const result = {
                FileName: file.name,
                ROI_Mean: roiStats.mean.toFixed(4),
                ROI_Noise_SD: roiStats.sd.toFixed(4),
                FullImage_Mean: fullMean.toFixed(4),
                FullImage_SD: fullSD.toFixed(4),
                ROI_X: state.roiCenter.x,
                ROI_Y: state.roiCenter.y,
                ROI_R: state.roiRadius
            };

            // Extract DICOM tags
            for (const { tag, name } of commonTags) {
                const value = dataSet.string(tag);
                if (value !== undefined) {
                    result[name] = value;
                    state.availableTags.add(name);
                }
            }

            state.results.push(result);
        } catch (err) {
            console.error(`Error analyzing ${file.name}:`, err);
        }
    }

    elements.analysisProgress.classList.add('hidden');
    elements.analyzeBtn.disabled = false;
    elements.exportBtn.disabled = false;

    alert(`分析完成！共處理 ${state.results.length} 張影像`);
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

// ============================================
// Tag Selection & Export
// ============================================
function openTagModal() {
    // Build tag list
    const tagList = elements.tagList;
    tagList.innerHTML = '';

    // Default selected tags
    state.selectedTags = new Set([
        'PatientName', 'PatientID', 'FileName',
        'ROI_Mean', 'ROI_Noise_SD', 'FullImage_Mean', 'FullImage_SD',
        'ExposureIndex', 'KVP'
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
    'InstanceNumber': 'x00200013'
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
    console.log('confirmDisplayTags: 已選擇標籤數量 =', state.displayTags.size);
    console.log('選擇的標籤:', Array.from(state.displayTags));
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
    console.log('updateCustomTagsOverlay 被呼叫');
    console.log('state.currentDS:', state.currentDS ? '存在' : '不存在');
    console.log('state.displayTags.size:', state.displayTags.size);

    const ds = state.currentDS;
    if (!ds || state.displayTags.size === 0) {
        elements.customTagsOverlay.innerHTML = '';
        console.log('沒有資料集或沒有選擇標籤，清空 overlay');
        return;
    }

    const lines = [];
    for (const tag of state.displayTags) {
        const address = DISPLAY_TAG_MAPPING[tag];
        console.log(`處理標籤 ${tag}, 地址=${address}`);
        if (address) {
            let value = ds.string(address);
            if (value === undefined || value === '') {
                value = '--';
            }
            const displayName = TAG_TRANSLATIONS[tag] || tag;
            lines.push(`<span class="tag-label">${displayName}:</span> <span class="tag-value">${value}</span>`);
        }
    }

    console.log('生成的行數:', lines.length);
    elements.customTagsOverlay.innerHTML = lines.join('<br>');
    console.log('customTagsOverlay innerHTML 已設定');
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
