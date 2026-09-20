# AGENTS — DICOM ROI Analyzer: Line Profile Representativeness & Resolution

## Goal
- Determine whether Center line profile can statistically represent image resolution compared to Left/Right offset profiles.
- Quantify spatial resolution (LP/mm) from line-pair phantom profiles via automated peak-valley detection.

## Constraints & Preferences
- RSNA publication format: TIFF 300 DPI LZW, Arial font, clean line-art style, no gridlines, grayscale-printable colors
- Bland-Altman 95% LoA for equivalence boundary
- Four-layer proof: shape (Pearson r), absolute difference (|bias|), distance-dependence (regression |β₁|), resolution (peak-valley modulation)
- Resolution criterion: **C (SNR ≥ 3)** — amplitude > 3 × noise_std from blank regions

## Progress

### Done
- Line profile plots (2×4 subplots, 3 lines per condition, RSNA‑format TIFF)
- Bland-Altman analysis (bias, 95% LoA, LoA width) for all 8 conditions × 2 comparisons
- Regression analysis: diff ~ distance (β₁ slope, R²)
- Representative check matrix (PASS/FAIL criteria: r>0.90, |bias|<50, |β₁|<0.5, LoA width<150)
- RM-ANOVA + post-hoc (Bonferroni, η²)
- ICC(2,1) 3-line + pairwise with 95% CI, bar chart
- Trend criterion changed from p>0.05 to |β₁|<0.5
- Final verdict: 16/16 PASS (100%) → CENTER IS REPRESENTATIVE
- Peak‑valley resolution analysis (`scripts/peak_valley_analysis.py`):
  - Rolling‑std based segmentation to exclude blank regions between LP/mm groups
  - Adaptive peak detection: `distance = max(1, floor(1/(LP·Δx) − 1))`, `prominence = max(3, 0.15·std(seg))`
  - 5 resolution methods: 10% modulation, B1 (50% of max), B2 (50% decay), B3 (30% of max), C (SNR ≥ 3)
  - Primary standard: **C (SNR ≥ 3)**
  - File 1 (0.6–1.6 LP/mm): all 8 conditions → **1.6 LP/mm**
  - File 2 (1.8–5.0 LP/mm): 6/8 at 2.8 LP/mm, 1 at 2.5, 1 at 2.2)

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Bland‑Altman 95% LoA used instead of noise‑SD equivalence boundary (standard for radiology)
- Representative thresholds: r > 0.90 (shape), |bias| < 50 (offset), |β₁| < 0.5 (no distance dependence), LoA width < 150
- Trend criterion changed from p>0.05 (NHST) to |β₁|<0.5 (effect-size threshold derived as ½·BIAS_THRESH / profile_length ≈ 25 / 51) to avoid large‑n false positives
- **Center confirmed representative for Left/Right** → peak‑valley analysis uses Center only
- Profile segmentation: rolling std (window=10, threshold=20) → blank regions excluded; oscillation regions matched to known LP/mm groups (by ascending order)
- Peak detection: principled adaptive formulas — `distance = max(1, floor(P − 1))` where P = period in pixels (ensures all true peaks detected, none duplicated); `prominence = max(3, 0.15·std)` (adapts to signal level)
- Monotonic constraint: amplitude strictly decreasing with frequency (physical MTF constraint); any increase is a false spike → clamped to previous value
- Resolution criterion: **C (SNR ≥ 3)** replaces 10% modulation (too conservative at higher frequencies)
- Noise estimation: `noise_std` from all blank regions (rolling std < 20) within each condition's profile
- File 2 Nyquist limit = 1 / (2 × 0.125 mm) = **4 LP/mm**; practical limit ~2.5–3.1 LP/mm

## Summary of Results

### Representativeness
- File 1 (0.6–1.6 mm): C‑R bias ~ −27 (constant offset), all |bias| < 50, η² ≈ 0.64, ICC(2,1) ≈ 0.93
- File 2 (1.8–5.0 mm): |bias| < 10 all conditions, η² ≈ 0.03, ICC(2,1) ≈ 0.94, CI [0.93–0.96]
- Final: 16/16 PASS (100%) → **CENTER IS REPRESENTATIVE**

### Resolution (C: SNR ≥ 3)
| Condition | File 1 (0.6–1.6) | File 2 (1.8–5.0) |
|---|---|---|
| 10 mA, 2.0 s | 1.6 | 2.8 |
| 20 mA, 1.0 s | 1.6 | 2.8 |
| 50 mA, 0.4 s | 1.6 | 2.8 |
| 100 mA, 0.2 s | 1.6 | 3.1 |
| 160 mA, 0.125 s | 1.6 | 3.1 |
| 200 mA, 0.1 s | 1.6 | 2.5 |
| 250 mA, 0.08 s | 1.6 | 2.5 |
| 400 mA, 0.05 s | 1.6 | 2.8 |

## Relevant Files
- `/Users/chl/Desktop/Study/[2026][TWSRT59]Reciprocity Law Failure/Reciprocity＿latex/profile/line_profile_0.6-1.6_2026-06-07.csv`: File 1 (0.6–1.6 LP/mm)
- `/Users/chl/Desktop/Study/[2026][TWSRT59]Reciprocity Law Failure/Reciprocity＿latex/profile/line_profile_1.8-5.0_2026-06-07.csv`: File 2 (1.8–5.0 LP/mm)
- `/Users/chl/Desktop/Antigravity/DICOM-ROI-Analyzer-main/scripts/peak_valley_analysis.py`: Resolution analysis (single script, all methods)
- `/Users/chl/Desktop/Antigravity/DICOM-ROI-Analyzer-main/scripts/plot_line_profile.py`: RSNA profile plot (representativeness)
- `/Users/chl/Desktop/Antigravity/DICOM-ROI-Analyzer-main/scripts/equivalence_analysis.py`: Bland-Altman + regression
- `/Users/chl/Desktop/Antigravity/DICOM-ROI-Analyzer-main/scripts/representative_check.py`: PASS/FAIL matrix
- `/Users/chl/Desktop/Antigravity/DICOM-ROI-Analyzer-main/scripts/anova_analysis.py`: RM-ANOVA + post-hoc
- `/Users/chl/Desktop/Antigravity/DICOM-ROI-Analyzer-main/scripts/icc_analysis.py`: ICC(2,1) pairwise
- `/Users/chl/Desktop/Antigravity/DICOM-ROI-Analyzer-main/figures/`: All TIFFs + CSVs

## How to Re-run
```bash
python3 scripts/peak_valley_analysis.py
```
For the original representativeness analysis:
```bash
python3 scripts/plot_line_profile.py
python3 scripts/equivalence_analysis.py
python3 scripts/representative_check.py
python3 scripts/anova_analysis.py
python3 scripts/icc_analysis.py
```
