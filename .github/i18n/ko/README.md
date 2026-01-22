# Arc 스타일 Chrome 사이드바

[English](/.github/i18n/en/README.md) | [繁體中文](/.github/i18n/zh_TW/README.md) | [简体中文](/.github/i18n/zh_CN/README.md) | [日本語](/.github/i18n/ja/README.md) | [한국어](/.github/i18n/ko/README.md) | [Deutsch](/.github/i18n/de/README.md) | [Español](/.github/i18n/es/README.md) | [Français](/.github/i18n/fr/README.md) | [हिन्दी](/.github/i18n/hi/README.md) | [Bahasa Indonesia](/.github/i18n/id/README.md) | [Português (Brasil)](/.github/i18n/pt_BR/README.md) | [Русский](/.github/i18n/ru/README.md) | [ไทย](/.github/i18n/th/README.md) | [Tiếng Việt](/.github/i18n/vi/README.md)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

이 프로젝트는 Google Chrome에 Arc 브라우저와 같은 수직 사이드바 경험을 제공하여 탭과 북마크를 관리할 수 있는 통합된 강력한 패널을 제공하는 Chrome 확장 프로그램입니다.

## 🚀 새 릴리스 v1.11.0 업데이트!
[![데모 비디오](http://img.youtube.com/vi/Ld4lyaZatWo/0.jpg)](https://www.youtube.com/watch?v=Ld4lyaZatWo)

### ⚡️ 주요 특징
- **수직 탭**: 더 이상 작은 아이콘으로 압축되지 않고 전체 페이지 제목을 볼 수 있습니다.
- **탭 그룹**: Chrome 탭 그룹과 완벽하게 통합되어 색상과 이름을 동기화합니다.
- **북마크 통합**: 탭과 북마크를 관리하기 위한 통합 패널입니다.
- **연결된 탭**: 북마크를 열 때 자동으로 "링크"를 생성하여 중복 열기를 방지합니다.
- **창 간 검색**: 열려 있는 모든 창에서 탭과 북마크를 검색합니다.
- **동적 렌더링**: 방대한 북마크 라이브러리를 위한 효율적인 렌더링을 제공합니다.

## 🤝 기여하기

커뮤니티의 기여를 환영합니다! 버그 수정, 문서 개선, 새로운 기능 제안 등 여러분의 도움은 언제나 소중합니다.

우리는 **사양 주도 개발 (SDD)** 워크플로우를 채택하고 있으며 **AI 친화적**입니다. 시작하려면 기여 가이드를 확인하세요:

👉 **[기여 가이드 읽기](./CONTRIBUTING.md)**

개발 프로세스의 실제 사례는 [Issue #30](https://github.com/Tai-ch0802/arc-like-chrome-extension/issues/30)을 참조하세요.

---

## 🔥 핵심 기능

### 🔗 독점 혁신: 연결된 탭 (Linked Tabs)
이 기능은 우리의 가장 강력한 기능입니다! 사이드바에서 북마크를 열면 자동으로 **"링크"**가 생성됩니다.
- **탭 혼란 방지**: 북마크 옆의 링크 아이콘을 클릭하여 해당 북마크에서 열린 모든 탭을 확인하세요. 중복 열기를 방지하고 시스템 리소스를 절약할 수 있습니다.
- **양방향 동기화**: 탭이 닫히면 북마크 상태가 자동으로 업데이트됩니다. 북마크가 삭제되면 연결된 탭이 지능적으로 처리됩니다.
- **시각적 피드백**: 북마크 옆에 정교한 링크 아이콘이 표시되어 현재 어떤 북마크가 활성화되어 있는지 한눈에 알 수 있습니다.

### ⚡️ 스마트 렌더링
수천 개의 북마크가 있어도 문제 없습니다!
- **동적 렌더링**: 가상 스크롤(Virtual Scrolling)에서 효율적인 동적 렌더링 메커니즘으로 전환하여 더 나은 호환성과 함께 매끄러운 성능을 보장합니다.
- **매끄러운 경험**: 지연 없이 대규모 북마크 라이브러리를 손쉽게 탐색하세요.

### 🪟 창 간 관리
- **창 개요**: 현재 창뿐만 아니라 열려 있는 모든 Chrome 창의 탭을 사이드바에서 직접 볼 수 있습니다.
- **전역 검색**: 검색 결과에 모든 창의 탭이 포함되어 전체 세션에서 즉시 탐색할 수 있습니다.

### 🔍 전문가급 검색
단순히 검색하는 것이 아니라 즉시 찾아보세요.
- **다중 키워드 필터링**: 정밀한 타겟팅을 위해 공백으로 구분된 키워드(예: "google docs 업무")를 지원합니다.
- **도메인 검색**: 도메인(예: `github.com`)을 입력하면 특정 소스의 탭과 북마크를 즉시 필터링합니다.
- **스마트 하이라이트**: 일치하는 키워드를 실시간으로 강조 표시하여 시각적 초점을 명확하게 유지합니다.

### 🗂️ 통합 작업 공간
- **수직 탭**: 압축되지 않은 전체 페이지 제목을 확인하세요.
- **네이티브 그룹 지원**: Chrome 탭 그룹과 완벽하게 통합됩니다.
- **사용자 정의 창 명명**: 창에 사용자 정의 이름(예: "업무", "개인")을 지정하여 더 명확한 컨텍스트를 제공합니다.
- **드래그 앤 드롭**: 직관적인 관리 - 탭, 그룹, 북마크 폴더 간에 항목을 손쉽게 이동하세요.
- **드래그하여 저장**: 탭을 북마크 영역으로 드래그하여 즉시 저장하세요. 북마크를 탭 영역으로 드래그하여 여세요.

### 🎨 프리미엄 디자인
- **집중 모드**: 눈의 피로를 줄이기 위해 세심하게 조정된 대비를 갖춘 매끄러운 다크 테마입니다.
- **자동 확장**: 항목을 드래그하는 동안 폴더 위에 마우스를 올리면 자동으로 경로가 확장됩니다.
- **스마트 호버**: 작업 버튼은 필요할 때만 나타나 인터페이스를 깔끔하고 방해 요소 없이 유지합니다.

## ⌨️ 전체 키보드 탐색
- **네이티브 경험**: `위`/`아래` 방향키를 사용하여 탭과 북마크 사이를 매끄럽게 탐색하세요.
- **마이크로 인터랙션**: `왼쪽`/`오른쪽` 방향키를 사용하여 탐색하고 내부 버튼(닫기, 그룹에 추가 등)을 트리거하세요.
- **검색 통합**: 목록 맨 위에서 `위`를 눌러 검색창에 포커스를 맞추세요. 검색창에서 `아래`를 눌러 결과로 이동하세요.
- **포커스 팁**: 사이드바가 열리면 아무 방향키나 눌러 자동으로 포커스를 잡고 탐색을 시작할 수 있습니다.

### ⌨️ 생산성 단축키
- **Cmd/Ctrl + I**: 사이드바 토글
- **Opt/Alt + T**: 현재 탭 옆에 새 탭 생성

---

## 🆚 왜 이 확장 프로그램을 선택해야 할까요?

| 기능 | 이 확장 프로그램 | 순정 Chrome | 기존 사이드바 |
| :--- | :---: | :---: | :---: |
| **수직 탭** | ✅ 전체 제목 | ❌ 압축됨 | ✅ |
| **탭 그룹** | ✅ 네이티브 동기화 | ✅ | ⚠️ 부분적 |
| **북마크 통합** | ✅ 통합 패널 | ❌ 별도 관리자 | ❌ 별도 |
| **연결된 탭** | ✅ 동기화 상태 | ❌ | ❌ |
| **창 간 검색** | ✅ | ❌ | ⚠️ 차이 있음 |
| **성능** | ⚡️ 동적 렌더링 | N/A | 🐢 가상 스크롤 |

---

## 🚀 설치 및 개발

### 옵션 1: Chrome 웹 스토어에서 설치 (권장)

자동 업데이트를 받으려면 공식 스토어에서 직접 확장 프로그램을 설치할 수 있습니다:

[**Chrome 웹 스토어에서 설치하려면 여기를 클릭하세요**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### 옵션 2: 소스에서 수동 설치 (개발자용)

**1. 사전 요구 사항**

시작하기 전에 시스템에 [Node.js](https://nodejs.org/)(npm 포함)가 설치되어 있는지 확인하세요.

**2. 설정 단계**

1.  이 프로젝트를 로컬 머신에 클론하거나 다운로드합니다.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  프로젝트 디렉토리로 이동하여 필요한 개발 종속성을 설치합니다:
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Chrome 브라우저를 열고 `chrome://extensions`로 이동합니다.
4.  오른쪽 상단의 "개발자 모드"를 활성화합니다.
5.  "압축해제된 확장 프로그램을 로드합니다"를 클릭하고 프로젝트의 루트 디렉토리를 선택합니다.

---

## 🛠️ 빌드 명령

이 프로젝트는 빌드 프로세스를 자동화하기 위해 `Makefile`을 사용합니다.

*   **개발 모드**: `make` 또는 `make package`

    이 명령은 압축되지 않은 개발 빌드를 생성합니다. 모든 소스 코드가 그대로 유지되므로 Chrome 개발자 도구에서 디버깅하기 쉽습니다. 패키징된 파일은 `arc-sidebar-v<버전>-dev.zip`이 됩니다.

*   **프로덕션 모드**: `make release`

    이 명령은 다음 단계를 포함하는 프로덕션 빌드 프로세스를 실행합니다:
    1.  `esbuild`를 사용하여 모든 JavaScript 모듈을 단일 파일로 번들링하고 압축합니다.
    2.  CSS 파일을 압축합니다.
    3.  출력을 Chrome 웹 스토어에 업로드하기에 적합한 `.zip` 파일로 패키징합니다.

---

## 🧪 테스트

프로젝트 기능의 품질과 안정성을 보장하기 위해 우리는 모든 변경 사항을 검증하기 위한 사용 사례 테스트 접근 방식을 채택합니다.

### 사용 사례 테스트

*   **목적**: 각 사용 사례 테스트는 특정 기능의 예상 동작과 운영 흐름을 명확하게 정의합니다. 테스트 단계, 전제 조건, 예상 결과 및 검증 방법을 상세히 설명하는 서술형 텍스트로 제공됩니다.
*   **위치**: 모든 사용 사례 테스트 파일은 프로젝트 루트의 `usecase_tests/` 폴더에 저장됩니다.
*   **실행 및 검증**: 이 테스트들은 현재 주로 수동으로 실행됩니다. 개발자는 테스트 파일의 단계에 따라 실행 중인 Chrome 확장 프로그램에서 사용자 작업을 시뮬레이션하고 결과가 예상과 일치하는지 관찰해야 합니다.

### 자동화 테스트

향후 자동화 테스트를 위해 **Puppeteer**를 엔드 투 엔드(E2E) 테스트 프레임워크로 선택했습니다. 이를 통해 브라우저에서 다양한 사용자 작업을 시뮬레이션하고 기능을 검증하는 스크립트를 작성할 수 있습니다.

---

## 🔒 개인정보 보호 및 FAQ

우리는 사용자의 개인정보를 소중히 여깁니다. 이 확장 프로그램은 완전히 로컬에서 작동하며 사용자의 개인 데이터를 수집하거나 전송하지 않습니다.

자세한 내용은 [개인정보 처리방침](../../PRIVACY_POLICY.md)을 참조하세요.

---

## 👥 기여자

이 프로젝트를 더 좋게 만드는 데 도움을 주시는 모든 기여자분들께 특별한 감사를 드립니다:

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 라이선스

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](../../LICENSE) 파일을 참조하세요.
