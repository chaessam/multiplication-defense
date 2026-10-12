# 구구단 디펜스 — Claude 작업 규칙

## PR 머지
- 작업은 PR로 올린다. **머지는 채쌤이 채팅에서 "머지해"처럼 직접 말할 때만** Claude가 한다 (`.claude/settings.json`에서 머지 도구를 허용해 둠).
- 머지 전에 확인: main과 충돌 없음, 테스트 통과. (브랜치의 "Workers Builds" 미리보기 검사는 로그 없이 0초 만에 실패로 뜨는 게 평소 모습이고, main 배포와는 상관없음)
- main에 머지되면 클라우드플레어가 바로 배포한다 (https://multiplication-defense.chaessam.workers.dev/).

## 지켜야 할 것
- `wrangler.jsonc`의 Worker 이름 `multiplication-defense`와 주소는 바꾸지 않는다 (이미 학교에 많이 배포됨).
- 게임 코드(js/*.js)는 2017년 문법(ES2017)까지만 쓴다 — 오래된 학교 태블릿 호환.
- 학교 목록은 전국 초등학교만. 전라남도·광주광역시는 '전남광주'로 표기.
- 서버(worker/index.js)는 클라우드플레어 **무료 플랜**: Durable Object SQLite는 하루 읽기 500만 행·쓰기 10만 행 한도가 있다.
  요청마다 표 전체를 훑는 쿼리(COUNT(*), COUNT(DISTINCT …), 인덱스 없는 정렬 등)를 쓰지 말고, 카운터나 메모리 캐시를 쓴다.
  사이트에 없는 파일을 요청하는 것도 Worker 호출(하루 10만 건 한도)로 잡히니 피한다.
