/**
 * DICOM ROI Analysis Worker
 * Offloads heavy statistical calculations to a background thread to prevent UI freezing.
 */

// Import dicom-parser from CDN
importScripts('https://unpkg.com/dicom-parser@1.8.21/dist/dicomParser.min.js');

self.onmessage = function(e) {
    const { command, data } = e.data;

    if (command === 'analyze') {
        const { files, roiCenters, roiRadius, commonTags, filterValue } = data;
        const results = [];
        const totalItems = files.length;
        let completed = 0;

        for (let i = 0; i < files.length; i++) {
            const fileData = files[i];
            const { name, buffer } = fileData;

            try {
                const byteArray = new Uint8Array(buffer);
                const dataSet = dicomParser.parseDicom(byteArray);

                // 1. Apply Slice Location Filter
                if (filterValue) {
                    const sliceLoc = dataSet.string('x00201041') || '';
                    if (!isMatch(sliceLoc, filterValue)) {
                        completed++;
                        sendProgress(completed, totalItems);
                        continue;
                    }
                }

                // 2. Check if pixel data exists
                if (!dataSet.elements.x7fe00010) {
                    completed++;
                    sendProgress(completed, totalItems);
                    continue;
                }

                // 3. Extract Pixel Data & Stats
                const pixelData = getPixelData(dataSet, byteArray);
                const rows = dataSet.uint16('x00280010');
                const cols = dataSet.uint16('x00280011');

                // Full image stats
                let fSum = 0, fSumSq = 0;
                for (let j = 0; j < pixelData.length; j++) {
                    const v = pixelData[j];
                    fSum += v;
                    fSumSq += v * v;
                }
                const fullMean = fSum / pixelData.length;
                const fullSD = Math.sqrt(fSumSq / pixelData.length - fullMean * fullMean);

                // Extract Common Tags
                const dicomTags = {};
                for (const { tag, name: tagName } of commonTags) {
                    const val = dataSet.string(tag);
                    if (val !== undefined) dicomTags[tagName] = val;
                }

                // 4. Multi-ROI Analysis
                for (let roiIdx = 0; roiIdx < roiCenters.length; roiIdx++) {
                    const center = roiCenters[roiIdx];
                    const roiStats = calculateROIStats(pixelData, cols, rows, center, roiRadius);

                    results.push({
                        FileName: name,
                        ROI_ID: roiIdx + 1,
                        ROI_Mean: roiStats.mean.toFixed(4),
                        ROI_Noise_SD: roiStats.sd.toFixed(4),
                        FullImage_Mean: fullMean.toFixed(4),
                        FullImage_SD: fullSD.toFixed(4),
                        ROI_X: center.x,
                        ROI_Y: center.y,
                        ROI_R: roiRadius,
                        ...dicomTags
                    });
                }

            } catch (err) {
                console.error(`Worker error analyzing ${name}:`, err);
            }

            completed++;
            sendProgress(completed, totalItems);
        }

        // Final result
        self.postMessage({ type: 'result', results });
    }
};

/**
 * Filter matching logic
 */
function isMatch(sliceLoc, filterValue) {
    if (sliceLoc === filterValue) return true;
    const filterNum = parseFloat(filterValue);
    if (!isNaN(filterNum)) {
        const sliceNum = parseFloat(sliceLoc);
        return (!isNaN(sliceNum) && Math.abs(sliceNum - filterNum) < 0.001);
    }
    return sliceLoc.includes(filterValue);
}

/**
 * DICOM Pixel Data Extraction with Modality Rescaling
 */
function getPixelData(dataSet, byteArray) {
    const pixelDataElement = dataSet.elements.x7fe00010;
    const rows = dataSet.uint16('x00280010');
    const cols = dataSet.uint16('x00280011');
    const bitsAllocated = dataSet.uint16('x00280100');
    const pixelRepresentation = dataSet.uint16('x00280103') || 0;
    const rescaleIntercept = parseFloat(dataSet.string('x00281052')) || 0;
    const rescaleSlope = parseFloat(dataSet.string('x00281053')) || 1;

    let pixels;
    if (bitsAllocated === 16) {
        if (pixelRepresentation === 1) {
            pixels = new Int16Array(byteArray.buffer, pixelDataElement.dataOffset, rows * cols);
        } else {
            pixels = new Uint16Array(byteArray.buffer, pixelDataElement.dataOffset, rows * cols);
        }
    } else {
        pixels = new Uint8Array(byteArray.buffer, pixelDataElement.dataOffset, rows * cols);
    }

    const floatData = new Float32Array(pixels.length);
    for (let i = 0; i < pixels.length; i++) {
        floatData[i] = pixels[i] * rescaleSlope + rescaleIntercept;
    }
    return floatData;
}

/**
 * ROI Statistics Calculation
 */
function calculateROIStats(pixelData, cols, rows, center, radius) {
    const values = [];
    const rSq = radius * radius;

    for (let y = Math.max(0, Math.floor(center.y - radius)); y <= Math.min(rows - 1, Math.ceil(center.y + radius)); y++) {
        for (let x = Math.max(0, Math.floor(center.x - radius)); x <= Math.min(cols - 1, Math.ceil(center.x + radius)); x++) {
            const distSq = (x - center.x) ** 2 + (y - center.y) ** 2;
            if (distSq <= rSq) {
                values.push(pixelData[y * cols + x]);
            }
        }
    }

    if (values.length === 0) return { mean: 0, sd: 0 };

    let sum = 0, sumSq = 0;
    for (const v of values) {
        sum += v;
        sumSq += v * v;
    }
    const mean = sum / values.length;
    const sd = Math.sqrt(Math.max(0, sumSq / values.length - mean * mean));
    return { mean, sd };
}

function sendProgress(completed, total) {
    self.postMessage({ type: 'progress', completed, total });
}
