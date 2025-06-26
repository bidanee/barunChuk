import React, { useState, useEffect, useRef, useCallback } from 'react';

const Stopwatch = ({ shouldRun, onResetConfirm }) => {
  const [time, setTime] = useState(0); // 화면에 표시될 경과 시간 (밀리초)
  const animationFrameRef = useRef(null); // requestAnimationFrame ID 저장
  const startTimeRef = useRef(0); // 타이머가 마지막으로 시작된 실제 시간 (performance.now())
  const elapsedTimeAtPauseRef = useRef(0); // 타이머가 일시 정지될 때까지의 경과 시간

  // shouldRun prop (Main 컴포넌트로부터의 신호) 변경에 따라 타이머 시작/정지 로직을 관리합니다.
  useEffect(() => {
    const animate = () => {
      // shouldRun이 false로 바뀌면 animate가 호출되지 않으므로, 이 안에서 isRunning 검사는 불필요합니다.
      const currentTime = performance.now();
      // 현재 경과 시간 = 현재 실제 시간 - (시작된 실제 시간 - 일시 정지까지의 누적 시간)
      setTime(elapsedTimeAtPauseRef.current + (currentTime - startTimeRef.current));
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (shouldRun) {
      // 타이머가 시작되거나 다시 시작될 때, 시작 시점 타임스탬프를 현재 시간으로 설정합니다.
      // elapsedTimeAtPauseRef.current는 이전에 멈췄을 때까지의 시간을 보존합니다.
      startTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // shouldRun이 false가 되면 타이머 중지 및 현재까지의 시간 저장
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      // 타이머가 멈출 때 현재까지의 경과 시간을 기록 (다음에 시작할 때 이어서 카운트)
      elapsedTimeAtPauseRef.current = time;
    }

    // 컴포넌트 언마운트 또는 shouldRun 변경 시 기존 애니메이션 프레임 정리
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [shouldRun]); // time을 의존성 배열에서 제거하여 불필요한 재실행 방지

  // 시간을 HH:MM:SS 형태로 포맷팅합니다.
  // time 상태가 변경될 때만 이 함수가 재생성되도록 useCallback으로 감쌉니다.
  const formatTime = useCallback(() => {
    const totalSeconds = Math.floor(time / 1000);
    const hours = `0${Math.floor(totalSeconds / 3600)}`.slice(-2);
    const minutes = `0${Math.floor((totalSeconds % 3600) / 60)}`.slice(-2);
    const seconds = `0${totalSeconds % 60}`.slice(-2);
    return `${hours}:${minutes}:${seconds}`;
  }, [time]);

  // Reset 버튼 클릭 핸들러입니다.
  // onResetConfirm prop이 변경될 때만 이 함수가 재생성되도록 useCallback으로 감쌉니다.
  const handleResetClick = useCallback(() => {
    // 현재 실행 중인 애니메이션 프레임이 있다면 취소
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setTime(0); // 시간 초기화
    startTimeRef.current = 0; // 시작 시간 초기화
    elapsedTimeAtPauseRef.current = 0; // 누적 시간 초기화
    onResetConfirm(); // Main 컴포넌트에 리셋 완료 알림
  }, [onResetConfirm]);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <div style={{ fontSize: '3em' }}>{formatTime()}</div>
      <button onClick={handleResetClick} style={buttonStyle}>
        Reset
      </button>
    </div>
  );
};

const buttonStyle = {
  fontSize: '1.2em',
  margin: '5px',
  padding: '10px 20px',
  cursor: 'pointer',
};

export default Stopwatch;