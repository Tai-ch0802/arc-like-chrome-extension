# Arc-Style Chrome Sidebar

이 프로젝트는 Google Chrome에 Arc 브라우저와 같은 수직 사이드바 경험을 제공하여 탭과 북마크를 관리할 수 있는 통합되고 강력한 패널을 제공하는 것을 목표로 하는 Chrome 확장 프로그램 프로젝트입니다.

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

## 🚀 New Release v1.11.0 업데이트!
[![Demo Video](http://img.youtube.com/vi/Ld4lyaZatWo/0.jpg)](https://www.youtube.com/watch?v=Ld4lyaZatWo)

---

## 🔥 주요 기능

### 🔗 독점 혁신: 연결된 탭 (Linked Tabs)
이것은 우리의 가장 강력한 기능입니다! 사이드바에서 북마크를 열면 자동으로 **"링크(Link)"**가 생성됩니다.
- **탭 혼란 방지**: 북마크 옆의 링크 아이콘을 클릭하여 해당 북마크에서 열린 모든 탭을 확인하세요. 중복 탭을 열지 않도록 도와주어 시스템 리소스를 절약합니다.
- **양방향 동기화**: 탭이 닫히면 북마크 상태가 자동으로 업데이트되며, 북마크가 삭제되면 연결된 탭이 지능적으로 처리됩니다.
- **시각적 피드백**: 활성 북마크 옆에 세련된 링크 아이콘이 표시되어 현재 어떤 북마크가 열려 있는지 한눈에 알 수 있습니다.

### ⚡️ 스마트 렌더링
수천 개의 북마크가 있어도 문제없습니다!
- **동적 렌더링**: 가상 스크롤(Virtual Scrolling)에서 효율적인 동적 렌더링(Dynamic Rendering) 메커니즘으로 전환하여 더 나은 호환성과 함께 부드러운 성능을 보장합니다.
- **부드러운 경험**: 대규모 북마크 라이브러리에서도 지연 없이 손쉽게 탐색할 수 있습니다.

### 🪟 교차 윈도우 관리
- **윈도우 개요**: 현재 창뿐만 아니라 열려 있는 모든 Chrome 창의 탭을 사이드바에서 직접 볼 수 있습니다.
- **전역 검색**: 검색 결과에 모든 창의 탭이 포함되어 전체 세션에서 즉각적인 탐색이 가능합니다.

### 🔍 전문가급 검색
그저 검색하는 것이 아니라 즉시 "찾아냅니다".
- **다중 키워드 필터링**: 공백으로 구분된 키워드(예: "google docs 업무")를 지원하여 정확한 타겟팅이 가능합니다.
- **도메인 검색**: 도메인(예: `github.com`)을 입력하여 특정 소스의 탭과 북마크를 즉시 필터링합니다.
- **스마트 하이라이팅**: 검색어와 일치하는 키워드를 실시간으로 하이라이팅하여 시각적 초점을 명확하게 유지합니다.

### 🗂️ 통합 작업 공간
- **수직 탭**: 작은 아이콘으로 압축되지 않은 전체 페이지 제목을 확인하세요.
- **기본 그룹 지원**: Chrome 탭 그룹과 완벽하게 통합되어 색상과 이름이 동기화됩니다.
- **사용자 지정 창 이름 지정**: 창에 사용자 지정 이름(예: "업무", "개인")을 지정하여 명확한 문맥을 관리할 수 있습니다.
- **드래그 앤 드롭**: 직관적인 관리 - 탭, 그룹, 북마크 폴더 간에 항목을 쉽게 이동하세요.
- **드래그하여 저장**: 탭을 북마크 영역으로 드래그하여 즉시 저장하고, 북마크를 탭 영역으로 드래그하여 열 수 있습니다.

### 🎨 프리미엄 디자인
- **집중 모드**: 눈의 피로를 줄이기 위해 세심하게 조정된 대비의 매끄러운 다크 테마.
- **자동 확장**: 항목을 드래그하는 동안 폴더 위에 마우스를 올리면 자동으로 경로가 확장됩니다.
- **스마트 호버**: 필요한 때에만 작업 버튼이 나타나 인터페이스를 깔끔하고 방해 없이 유지합니다.

## ⌨️ 전체 키보드 탐색
- **네이티브 경험**: `위쪽 화살표`/`아래쪽 화살표` 키를 사용하여 탭과 북마크 사이를 원활하게 탐색하세요.
- **마이크로 상호작용**: `왼쪽 화살표`/`오른쪽 화살표`를 사용하여 내부 버튼(닫기, 그룹에 추가 등)을 탐색하고 실행하세요.
- **검색 통합**: 목록 상단에서 `위`를 눌러 검색창에 포커스를 맞추고, 검색창에서 `아래`를 눌러 결과로 이동하세요.
- **포커스 팁**: 사이드바가 열리면 화살표 키를 누르는 것만으로 자동으로 포커스를 가져와 탐색을 시작할 수 있습니다.

### ⌨️ 생산성 단축키
- **Cmd/Ctrl + I**: 사이드바 토글
- **Opt/Alt + T**: 현재 탭 옆에 새 탭 만들기

---

## 🆚 이 확장 프로그램을 선택해야 하는 이유

| 기능 | 이 확장 프로그램 | 기본 Chrome | 기존 사이드바 |
| :--- | :---: | :---: | :---: |
| **수직 탭** | ✅ 전체 제목 | ❌ 압축됨 | ✅ |
| **탭 그룹** | ✅ 기본 동기화 | ✅ | ⚠️ 일부 지원 |
| **북마크 통합** | ✅ 통합 패널 | ❌ 별도 관리자 | ❌ 별도 |
| **Linked Tabs** | ✅ 완벽한 동기화 | ❌ | ❌ |
| **교차 창 검색** | ✅ | ❌ | ⚠️ 다양함 |
| **성능** | ⚡️ 동적 렌더링 | N/A | 🐢 가상 스크롤 |

---

## 🚀 설치 및 개발

### 옵션 1: Chrome 웹 스토어에서 설치 (권장)

공식 스토어에서 직접 확장 프로그램을 설치하고 자동 업데이트를 받을 수 있습니다.

[**Chrome 웹 스토어에서 설치하려면 여기를 클릭하세요**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### 옵션 2: 소스에서 수동 설치 (개발자용)

**1. 사전 요구 사항**

시작하기 전에 시스템에 [Node.js](https://nodejs.org/)(npm 포함)가 설치되어 있는지 확인하세요.

**2. 설정 단계**

1.  이 프로젝트를 로컬 시스템에 복제하거나 다운로드합니다.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  프로젝트 디렉토리로 이동하여 필요한 개발 종속성을 설치합니다.
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Chrome 브라우저를 열고 `chrome://extensions`로 이동합니다.
4.  오른쪽 상단의 "개발자 모드"를 활성화합니다.
5.  "압축해제된 확장 프로그램을 로드합니다"를 클릭하고 프로젝트의 루트 디렉토리를 선택합니다.

---

## 🛠️ 빌드 명령

이 프로젝트는 `Makefile`을 사용하여 빌드 프로세스를 자동화합니다.

*   **개발 모드**: `make` 또는 `make package`

    압축되지 않은 개발 빌드를 생성합니다. 모든 소스 코드가 그대로 유지되어 Chrome 개발자 도구에서 디버깅하기 쉽습니다. 패키징된 파일은 `arc-sidebar-v<version>-dev.zip`입니다.

*   **프로덕션 모드**: `make release`

    프로덕션 빌드 프로세스를 실행하며 다음 단계가 포함됩니다.
    1.  `esbuild`를 사용하여 모든 JavaScript 모듈을 하나의 파일로 번들링하고 압축합니다.
    2.  CSS 파일을 압축합니다.
    3.  Chrome 웹 스토어 업로드에 적합한 `.zip` 파일로 패키징합니다.

---

## 🧪 테스트

프로젝트 기능의 품질과 안정성을 보장하기 위해 모든 변경 사항을 검증하는 유스케이스 테스트 접근 방식을 채택하고 있습니다.

### 유스케이스 테스트

*   **목적**: 각 유스케이스 테스트는 특정 기능의 예상 동작과 운영 흐름을 명확하게 정의합니다. 테스트 단계, 전제 조건, 예상 결과 및 확인 방법이 설명 텍스트로 제공됩니다.
*   **위치**: 모든 유스케이스 테스트 파일은 프로젝트 루트의 `usecase_tests/` 폴더에 저장됩니다.
*   **실행 및 확인**: 이 테스트는 현재 주로 수동으로 실행됩니다. 개발자는 테스트 파일의 단계에 따라 실행 중인 Chrome 확장 프로그램에서 사용자 작업을 시뮬레이션하고 결과가 예상과 일치하는지 관찰해야 합니다.

### 자동 테스트 프레임워크

향후 자동 테스트를 위해 **Puppeteer**를 엔드 투 엔드(E2E) 테스트 프레임워크로 선택했습니다.

*   **Puppeteer**: DevTools 프로토콜을 통해 Chromium 또는 Chrome을 제어하는 고수준 API를 제공하는 Node.js 라이브러리입니다. 클릭, 입력, 탐색 등 브라우저에서의 다양한 사용자 작업을 시뮬레이션하는 스크립트를 작성하고 확인을 위해 스크린샷을 찍거나 페이지 콘텐츠를 가져올 수 있습니다.
*   **설치**: Puppeteer는 `npm install puppeteer`를 통해 프로젝트에 설치되었습니다.
*   **향후 전망**: 향후 `usecase_tests/`의 설명적인 테스트 케이스는 점진적으로 실행 가능한 Puppeteer 스크립트로 변환되어 자동 테스트 및 지속적 통합을 달성할 것입니다.

---

## 👥 기여자

이 프로젝트를 더 좋게 만드는 데 도움을 주시는 모든 기여자분들께 특별히 감사드립니다.

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

---

## 🔒 개인정보 보호 및 FAQ

당사는 귀하의 개인정보를 소중히 여깁니다. 이 확장 프로그램은 완전히 로컬에서 작동하며 귀하의 개인 데이터를 수집하거나 전송하지 않습니다.

자세한 내용은 [개인정보 처리방침](../../PRIVACY_POLICY.md)을 참조하십시오.

---

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여되었습니다.
