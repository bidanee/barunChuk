// /src/utils/calculatePostureScore.js (고개 숙임 기능 최종 수정)

function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export const calculateAdvancedMetrics = (landmarks) => {
    const L_SHOULDER_IDX = 11, R_SHOULDER_IDX = 12, L_EAR_IDX = 7, R_EAR_IDX = 8, L_EYE_INNER_IDX = 1, R_EYE_INNER_IDX = 4, NOSE_IDX = 0;
    const required = [L_SHOULDER_IDX, R_SHOULDER_IDX, L_EAR_IDX, R_EAR_IDX, L_EYE_INNER_IDX, R_EYE_INNER_IDX, NOSE_IDX];

    if (required.some(idx => !landmarks[idx])) return null;

    const lShoulderRaw = landmarks[L_SHOULDER_IDX], rShoulderRaw = landmarks[R_SHOULDER_IDX];
    const leftShoulder = lShoulderRaw.x < rShoulderRaw.x ? lShoulderRaw : rShoulderRaw, rightShoulder = lShoulderRaw.x < rShoulderRaw.x ? rShoulderRaw : lShoulderRaw;

    const lEarRaw = landmarks[L_EAR_IDX], rEarRaw = landmarks[R_EAR_IDX];
    const leftEar = lEarRaw.x < rEarRaw.x ? lEarRaw : rEarRaw, rightEar = lEarRaw.x < rEarRaw.x ? rEarRaw : lEarRaw;

    const lEyeInnerRaw = landmarks[L_EYE_INNER_IDX], rEyeInnerRaw = landmarks[R_EYE_INNER_IDX];
    const leftEyeInner = lEyeInnerRaw.x < rEyeInnerRaw.x ? lEyeInnerRaw : rEyeInnerRaw, rightEyeInner = lEyeInnerRaw.x < rEyeInnerRaw.x ? rEyeInnerRaw : lEyeInnerRaw;
    const nose = landmarks[NOSE_IDX];

    const shoulderWidth = Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y);
    if (shoulderWidth < 0.01) return null;

    const shoulderMidPoint = { x: (leftShoulder.x + rightShoulder.x) / 2, z: (leftShoulder.z + rightShoulder.z) / 2 };
    
    // ★★★ [수정 1] earAvg 객체에 누락되었던 y 좌표 계산을 추가합니다. ★★★
    const earAvg = { 
        x: (leftEar.x + rightEar.x) / 2, 
        y: (leftEar.y + rightEar.y) / 2, // 이 부분이 빠져있었습니다!
        z: (leftEar.z + rightEar.z) / 2 
    };
    
    const headForwardOffset = Math.hypot(shoulderMidPoint.x - earAvg.x, shoulderMidPoint.z - earAvg.z);
    const normalizedHeadForwardOffset = headForwardOffset / shoulderWidth;
    
    const shoulderTiltAngle = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * 180 / Math.PI;
    const headTiltAngle = Math.atan2(rightEar.y - leftEar.y, rightEar.x - leftEar.x) * 180 / Math.PI;
    const shoulderTwistRatio = Math.abs(leftShoulder.z - rightShoulder.z) / shoulderWidth;

    const pupilDistancePixels = Math.hypot(rightEyeInner.x - leftEyeInner.x, rightEyeInner.y - leftEyeInner.y);
    const pixelsPerCm = pupilDistancePixels > 0 ? pupilDistancePixels / 6.3 : 0;

    const earDistance = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y);
    const noseToEarVerticalDist = earAvg.y - nose.y;
    const headBowRatio = earDistance > 0 ? noseToEarVerticalDist / earDistance : 0;
    
    return {
        normalizedHeadForwardOffset, shoulderTiltAngle, headTiltAngle, shoulderTwistRatio, pixelsPerCm, shoulderWidth, headBowRatio,
    };
};

export class PoseSmoother {
    constructor(windowSize = 15) { this.windowSize = windowSize; this.history = []; }
    addMetrics(metrics) { if (!metrics) return; this.history.push(metrics); if (this.history.length > this.windowSize) { this.history.shift(); } }
    getSmoothedMetrics() {
        if (this.history.length === 0) return null;
        // ★★★ [수정 2] 데이터 안정화 객체에 headBowRatio를 추가하여 정보가 누락되지 않도록 합니다. ★★★
        const smoothed = { normalizedHeadForwardOffset: 0, shoulderTiltAngle: 0, headTiltAngle: 0, shoulderTwistRatio: 0, pixelsPerCm: 0, shoulderWidth: 0, headBowRatio: 0 };
        this.history.forEach(metrics => {
            for (const key in smoothed) {
                // metrics에 해당 key가 있을 때만 더해줍니다. (안전장치)
                if (metrics[key] !== undefined) {
                    smoothed[key] += metrics[key];
                }
            }
        });
        Object.keys(smoothed).forEach(key => smoothed[key] /= this.history.length);
        return smoothed;
    }
}


const ALLOWED_DEVIATION = {
    turtleNeck: { diff: 2, severityMultiplier: 30 },
    shoulderTilt: { diff: 2, severityMultiplier: 30 },
    headTilt: { diff: 2, severityMultiplier: 30 },
    shoulderTwist: { diff: 2, severityMultiplier: 30 },
    headBow: { threshold: 2, severityMultiplier: 30 },
};

const FEEDBACKS_RELATIVE = {
    REF_OK: "✅ 지금 자세 그대로~~ 아주 좋습니다!",
    REF_TURTLE_FORWARD: (cm) => `🐢 기준 자세보다 목이 약 ${cm}cm 앞으로 나왔어요.`,
    REF_TURTLE_BACK: "🐢 목이 너무 뒤로 갔어요~ 긴장을 풀어주세요.",

    REF_SHOULDER_TILT: "📐 어깨가 기울어졌어요.",
    REF_SHOULDER_TILT_LEFT: "📉 오른쪽 어깨가 내려갔어요.",
    REF_SHOULDER_TILT_RIGHT: "📈 왼쪽 어깨가 내려갔어요.",

    REF_HEAD_TILT_LEFT: "🤕 머리가 오른쪽으로 기울어졌어요.",
    REF_HEAD_TILT_RIGHT: "🤕 머리가 왼쪽으로 기울어졌어요.",
    REF_HEAD_TILT: "🤕 머리가 기울어졌어요.",

    REF_SHOULDER_TWIST: "🔄 몸이 틀어져 있어요 ㅜㅜ 정면을 봐주세요.",
    
    REF_HEAD_BOW: "📉 고개를 너무 숙이고 있어요 화면을 봐주세요!",
};

// export const analyzePoseV2 = (currentMetrics, referenceMetrics) => {
//     if (!currentMetrics || !referenceMetrics || !currentMetrics.pixelsPerCm) {
//         return { score: null, feedback: "기준 자세를 분석 중입니다..." };
//     }
    
//     let score = 100;
//     const problems = [];
    
//     const diffs = {
//         turtleNeck: currentMetrics.normalizedHeadForwardOffset - referenceMetrics.normalizedHeadForwardOffset,
//         shoulderTilt: currentMetrics.shoulderTiltAngle - referenceMetrics.shoulderTiltAngle,
//         headTilt: currentMetrics.headTiltAngle - referenceMetrics.headTiltAngle,
//         shoulderTwist: currentMetrics.shoulderTwistRatio - referenceMetrics.shoulderTwistRatio,
//     };

//     const checkProblem = (diff, guide, type, feedbackFn) => {
//         if (Math.abs(diff) > guide.diff) {
//             const severity = Math.min(1, Math.abs(diff) / (guide.diff * 5));
//             problems.push({ type, severity, feedbackFn });
//         }
//     };

//     const checkHeadBow = (currentRatio, referenceRatio, guide) => {
//         const diff = currentRatio - referenceRatio;
//         if (diff < -guide.threshold) {
//             const severity = Math.min(1, Math.abs(diff) / (guide.threshold * 3));
//             problems.push({ type: 'headBow', severity, feedbackFn: () => FEEDBACKS_RELATIVE.REF_HEAD_BOW });
//         }
//     };
    
//     const headOffsetCm = Math.abs(diffs.turtleNeck * currentMetrics.shoulderWidth / currentMetrics.pixelsPerCm).toFixed(1);
//     checkProblem(diffs.turtleNeck, ALLOWED_DEVIATION.turtleNeck, 'turtleNeck', diffs.turtleNeck > 0 ? () => FEEDBACKS_RELATIVE.REF_TURTLE_FORWARD(headOffsetCm) : () => FEEDBACKS_RELATIVE.REF_TURTLE_BACK);
//     checkProblem(diffs.shoulderTilt, ALLOWED_DEVIATION.shoulderTilt, 'shoulderTilt', () => FEEDBACKS_RELATIVE.REF_SHOULDER_TILT);
//     checkProblem(diffs.headTilt, ALLOWED_DEVIATION.headTilt, 'headTilt', () => FEEDBACKS_RELATIVE.REF_HEAD_TILT);
//     checkProblem(diffs.shoulderTwist, ALLOWED_DEVIATION.shoulderTwist, 'shoulderTwist', () => FEEDBACKS_RELATIVE.REF_SHOULDER_TWIST);
//     checkHeadBow(currentMetrics.headBowRatio, referenceMetrics.headBowRatio, ALLOWED_DEVIATION.headBow);

//     problems.sort((a, b) => b.severity - a.severity);

//     if (problems.length > 0) {
//         problems.forEach(p => {
//             const guide = ALLOWED_DEVIATION[p.type];
//             if (guide) {
//                 score -= p.severity * guide.severityMultiplier;
//             }
//         });
//     }

//     const feedback = problems.length > 0
//         ? problems.map(p => p.feedbackFn()).join(' ')
//         : FEEDBACKS_RELATIVE.REF_OK;
// const checkProblemWithDirection = (diff, guide, type, feedbackLeftFn, feedbackRightFn) => {
//     if (Math.abs(diff) > guide.diff) {
//         const severity = Math.min(1, Math.abs(diff) / (guide.diff * 5));
//         const feedbackFn = diff > 0 ? feedbackRightFn : feedbackLeftFn;
//         problems.push({ type, severity, feedbackFn });
//     }
// };

// checkProblemWithDirection(diffs.shoulderTilt, ALLOWED_DEVIATION.shoulderTilt, 'shoulderTilt',
//     () => FEEDBACKS_RELATIVE.REF_SHOULDER_TILT_LEFT,
//     () => FEEDBACKS_RELATIVE.REF_SHOULDER_TILT_RIGHT
// );

// checkProblemWithDirection(diffs.headTilt, ALLOWED_DEVIATION.headTilt, 'headTilt',
//     () => FEEDBACKS_RELATIVE.REF_HEAD_TILT_LEFT,
//     () => FEEDBACKS_RELATIVE.REF_HEAD_TILT_RIGHT
// );
//     return { score: Math.max(0, Math.round(score)), feedback };
// };


// [신규 기능] 기준 자세로 삼기에 적절한지 검증하기 위한 '절대 최소 기준'
export const analyzePoseV2 = (currentMetrics, referenceMetrics) => {
    if (!currentMetrics || !referenceMetrics || !currentMetrics.pixelsPerCm) {
        return { score: null, feedback: "기준 자세를 분석 중입니다..." };
    }

    let score = 100;
    const problems = [];

    const diffs = {
        turtleNeck: currentMetrics.normalizedHeadForwardOffset - referenceMetrics.normalizedHeadForwardOffset,
        shoulderTilt: currentMetrics.shoulderTiltAngle - referenceMetrics.shoulderTiltAngle,
        headTilt: currentMetrics.headTiltAngle - referenceMetrics.headTiltAngle,
        shoulderTwist: currentMetrics.shoulderTwistRatio - referenceMetrics.shoulderTwistRatio,
    };

    const headOffsetCm = Math.abs(diffs.turtleNeck * currentMetrics.shoulderWidth / currentMetrics.pixelsPerCm).toFixed(1);

    const checkProblem = (diff, guide, type, feedbackFn) => {
        if (Math.abs(diff) > guide.diff) {
            const severity = Math.min(1, Math.abs(diff) / (guide.diff * 5));
            problems.push({ type, severity, feedbackFn });
        }
    };

    // 🆕 방향까지 고려하는 함수
    const checkProblemWithDirection = (diff, guide, type, feedbackLeftFn, feedbackRightFn) => {
        if (Math.abs(diff) > guide.diff) {
            const severity = Math.min(1, Math.abs(diff) / (guide.diff * 5));
            const feedbackFn = diff > 0 ? feedbackRightFn : feedbackLeftFn;
            problems.push({ type, severity, feedbackFn });
        }
    };

    const checkHeadBow = (currentRatio, referenceRatio, guide) => {
        const diff = currentRatio - referenceRatio;
        if (diff < -guide.threshold) {
            const severity = Math.min(1, Math.abs(diff) / (guide.threshold * 3));
            problems.push({ type: 'headBow', severity, feedbackFn: () => FEEDBACKS_RELATIVE.REF_HEAD_BOW });
        }
    };

    checkProblem(
        diffs.turtleNeck,
        ALLOWED_DEVIATION.turtleNeck,
        'turtleNeck',
        diffs.turtleNeck > 0
            ? () => FEEDBACKS_RELATIVE.REF_TURTLE_FORWARD(headOffsetCm)
            : () => FEEDBACKS_RELATIVE.REF_TURTLE_BACK
    );

    checkProblemWithDirection(
        diffs.shoulderTilt,
        ALLOWED_DEVIATION.shoulderTilt,
        'shoulderTilt',
        () => FEEDBACKS_RELATIVE.REF_SHOULDER_TILT_LEFT,
        () => FEEDBACKS_RELATIVE.REF_SHOULDER_TILT_RIGHT
    );

    checkProblemWithDirection(
        diffs.headTilt,
        ALLOWED_DEVIATION.headTilt,
        'headTilt',
        () => FEEDBACKS_RELATIVE.REF_HEAD_TILT_LEFT,
        () => FEEDBACKS_RELATIVE.REF_HEAD_TILT_RIGHT
    );

    checkProblem(
        diffs.shoulderTwist,
        ALLOWED_DEVIATION.shoulderTwist,
        'shoulderTwist',
        () => FEEDBACKS_RELATIVE.REF_SHOULDER_TWIST
    );

    checkHeadBow(currentMetrics.headBowRatio, referenceMetrics.headBowRatio, ALLOWED_DEVIATION.headBow);

    problems.sort((a, b) => b.severity - a.severity);

    if (problems.length > 0) {
        problems.forEach(p => {
            const guide = ALLOWED_DEVIATION[p.type];
            if (guide) {
                score -= p.severity * guide.severityMultiplier;
            }
        });
    }

    const feedback = problems.length > 0
        ? problems.map(p => p.feedbackFn()).join(' ')
        : FEEDBACKS_RELATIVE.REF_OK;

    return { score: Math.max(0, Math.round(score)), feedback };
};

const ABSOLUTE_POSE_STANDARDS = {
    maxShoulderTilt: 10,  // 어깨 기울기는 8도를 넘으면 안 됨
    maxHeadTilt: 10,      // 머리 기울기도 8도를 넘으면 안 됨
    maxHeadForward: 1, // 거북목 지수가 0.2를 넘으면(심한 거북목) 안 됨
    maxShoulderTwist:0.15,// 몸 틀어짐이 0.15를 넘으면 안 됨
};

// [신규 기능] 기준 자세를 검증하고 결과를 반환하는 함수
export const validateReferencePose = (metrics) => {
    if (!metrics) {
        return { isValid: false, message: "자세 정보를 읽을 수 없습니다." };
    }

    if (Math.abs(metrics.shoulderTiltAngle) > ABSOLUTE_POSE_STANDARDS.maxShoulderTilt) {
        return { isValid: false, message: "어깨가 너무 기울었어요. 자세를 바로 하고 다시 시도해 주세요." };
    }
    if (Math.abs(metrics.headTiltAngle) > ABSOLUTE_POSE_STANDARDS.maxHeadTilt) {
        return { isValid: false, message: "머리가 너무 기울었어요. 자세를 바로 하고 다시 시도해 주세요." };
    }
    if (metrics.normalizedHeadForwardOffset > ABSOLUTE_POSE_STANDARDS.maxHeadForward) {
        return { isValid: false, message: "거북목이 심한 상태입니다. 목을 바로 세우고 다시 시도해 주세요." };
    }
    if (metrics.shoulderTwistRatio > ABSOLUTE_POSE_STANDARDS.maxShoulderTwist) {
        return { isValid: false, message: "몸이 너무 틀어져 있어요. 정면을 보고 다시 시도해 주세요." };
    }

    // 모든 검사를 통과한 경우
    return { isValid: true, message: "기준 자세가 설정되었습니다! 이제부터 자세를 분석합니다." };
};