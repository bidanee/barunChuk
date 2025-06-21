const FEEDBACKS = {
    // 기준 자세 없을 때
    GOOD: ["완벽한 자세입니다!", "지금 자세를 계속 유지해 보세요!", "아주 이상적인 자세예요!"],
    MILD_TURTLE: ["목이 약간 앞으로 나왔어요. 조금만 신경 써주세요.", "거의 좋아요! 목을 살짝만 뒤로 당겨볼까요?"],
    BAD_TURTLE: ["거북목이 심해요! 턱을 당기고 목을 뒤로 당겨주세요.", "모니터가 너무 낮은 건 아닐까요? 목이 많이 나왔어요."],
    MILD_TILT: ["어깨가 약간 기울었어요.", "몸의 균형을 다시 한번 확인해 주세요."],
    BAD_TILT: ["어깨가 많이 기울었어요. 허리를 곧게 펴보세요.", "한쪽으로 너무 쏠려있어요. 자세를 바로잡아 주세요."],
    // 기준 자세 있을 때
    REF_OK: ["설정하신 기준 자세를 잘 유지하고 있어요!", "기준 자세와 거의 일치해요. 멋져요!"],
    REF_TURTLE: "기준 자세보다 머리가 앞으로 나왔어요.",
    REF_HEAD_BACK: "기준 자세보다 머리가 너무 뒤로 갔어요.",
    REF_TILT: "기준 자세보다 어깨가 기울었어요."
};

// 2. 기준값 및 허용 오차 (이 값들은 계속 튜닝 가능)
const DEFAULT_GUIDELINES = {
    headOffset: { good: 0.08, bad: 0.15 },
    shoulderTilt: { good: 8, bad: 15 }
};
const ALLOWED_DEVIATION = {
    offset: 0.05,
    tilt: 5
};

// 3. 배열에서 랜덤 메시지를 고르는 헬퍼 함수 (ChatGPT의 장점)
function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * [최종 개선] 자세를 분석하여 점수와 피드백 메시지를 반환하는 메인 함수
 */
export const analyzePose = (currentPose, referencePose) => {
    const { offset, tilt } = currentPose;
    const absTilt = Math.abs(tilt);
    const deviationFromHorizontal = Math.min(Math.abs(tilt), 180 - Math.abs(tilt));
    let score = 100;
    let feedback = "";

    // --- 기준 자세가 설정된 경우 ---
    if (referencePose) {
        const offsetDiff = offset - referencePose.offset;
        const tiltDiff = tilt - referencePose.tilt;

        // 점수 계산
        if (Math.abs(offsetDiff) > ALLOWED_DEVIATION.offset) score -= (Math.abs(offsetDiff) - ALLOWED_DEVIATION.offset) * 300;
        if (Math.abs(tiltDiff) > ALLOWED_DEVIATION.tilt) score -= (Math.abs(tiltDiff) - ALLOWED_DEVIATION.tilt) * 2;

        // ✅ [개선] 피드백은 가장 중요한 것 하나만!
        if (offsetDiff > ALLOWED_DEVIATION.offset) feedback = FEEDBACKS.REF_TURTLE;
        else if (offsetDiff < -ALLOWED_DEVIATION.offset) feedback = FEEDBACKS.REF_HEAD_BACK;
        else if (Math.abs(tiltDiff) > ALLOWED_DEVIATION.tilt) feedback = FEEDBACKS.REF_TILT;
        else feedback = randomPick(FEEDBACKS.REF_OK); // 문제가 없을 때만 랜덤 메시지

        return { score: Math.max(0, Math.round(score)), feedback };
    } 
    
    // --- 기준 자세가 없는 경우 ---
    else {
        // 점수 계산
        if (offset > DEFAULT_GUIDELINES.headOffset.bad) score -= 50;
        else if (offset > DEFAULT_GUIDELINES.headOffset.good) score -= (offset - DEFAULT_GUIDELINES.headOffset.good) * 350;
        
        if (deviationFromHorizontal > DEFAULT_GUIDELINES.shoulderTilt.bad) score -= 30;
        else if (deviationFromHorizontal > DEFAULT_GUIDELINES.shoulderTilt.good) score -= (absTilt - DEFAULT_GUIDELINES.shoulderTilt.good) * 5;

        // ✅ [개선] 피드백은 우선순위에 따라 가장 중요한 것 하나만, 하지만 랜덤으로!
        if (offset > DEFAULT_GUIDELINES.headOffset.bad) feedback = randomPick(FEEDBACKS.BAD_TURTLE);
        else if (offset > DEFAULT_GUIDELINES.headOffset.good) feedback = randomPick(FEEDBACKS.MILD_TURTLE);
        else if (deviationFromHorizontal > DEFAULT_GUIDELINES.shoulderTilt.bad) feedback = randomPick(FEEDBACKS.BAD_TILT);
        else if (deviationFromHorizontal > DEFAULT_GUIDELINES.shoulderTilt.good) feedback = randomPick(FEEDBACKS.MILD_TILT);
        else feedback = randomPick(FEEDBACKS.GOOD); // 아무 문제가 없을 때만 좋은 피드백
        
        return { score: Math.max(0, Math.round(score)), feedback };
    }
};
