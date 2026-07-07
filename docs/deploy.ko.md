[English](deploy.md) · **한국어**

# Deploying libre

libre는 서로 독립적인 두 부분으로 구성됩니다. **클라이언트**(정적 파일)와 콘텐츠가
존재하는 **릴레이**입니다. 설계상 어느 쪽도 단일 장애점이 되지 않습니다.

## 1. Build the client

```bash
cd web
npm install
npm run build:vendor   # produces web/vendor/nostr-tools.js
```

결과물은 `web/` 폴더입니다. 순수한 정적 파일이며 서버 로직은 없습니다.

### Single-file build (simplest to host/mirror)

```bash
npm run build          # -> web/dist/index.html
```

`dist/index.html`은 CSS와 JS, 모든 i18n이 인라인으로 포함된 하나의 완전한 파일이며
외부 참조가 전혀 없습니다. 이 파일 하나를 아무 곳에나 호스팅하거나 `ipfs add`로 추가할
수 있습니다. **http(s)** 또는 IPFS 게이트웨이를 통해 서빙되어야 하며, `file://`로 열어서는
안 됩니다. 보안 컨텍스트 밖에서는 브라우저가 (키 암호화에 필요한) `crypto.subtle`을
비활성화하기 때문입니다. `dist/`에는 HTTP 호스트에서도 PWA가 동작하도록 `sw.js`,
`manifest.webmanifest`, `icon.svg`도 함께 복사되지만, `index.html` 단일 파일은 이것들
없이도 동작합니다.

## 2. Publish the client to many doors

검열 저항성은 여러 개의 진입점에서 나옵니다. 가능한 한 많이 확보하세요.

- **Static hosts**(서로 다른 여러 제공자/국가): `web/`을 업로드하세요.
- **IPFS**: `ipfs add -r web`로 CID를 핀하세요(핀닝 서비스에도 핀하는 것을 권장합니다).
  CID와 게이트웨이 URL을 공유하세요.
- **Tor**: onion 서비스로 `web/`을 서빙해 `.onion` 주소를 얻으세요.
- **직접 다운로드**: `web/`을 zip으로 압축해 사용자가 직접 호스팅하거나 오프라인으로
  실행할 수 있게 하세요.

앱은 정적이고 동일 출처만 사용하므로 위 방법들은 어디서든 그대로 동작합니다. 사용자가
설정한 릴레이와 미디어 호스트하고만 통신하기 때문입니다.

### GitHub Pages (무료로 내 저장소에서 바로 호스팅)

GitHub은 저장소에서 바로, 무료로 사이트를 호스팅해 줄 수 있습니다. 직접 서버를 마련할
필요가 없습니다.

1. [github.com](https://github.com)에서 무료 계정을 만들고 이 프로젝트를 저장소로
   업로드하세요(git 사용이 익숙하지 않다면 GitHub의 "파일 업로드" 버튼을 사용해도
   됩니다).
2. 저장소에서 상단 메뉴의 **Settings**를 클릭한 다음, 왼쪽 메뉴의 **Pages**를
   클릭하세요.
3. **Build and deployment** 항목에서 **Source**를 **GitHub Actions**로 설정하세요.
4. 저장소에 `.github/workflows/pages.yml` 파일을 아래 내용 그대로 추가하고
   저장하세요. 내용을 이해할 필요는 없습니다. 이 파일은 GitHub에게 `web/` 폴더를
   게시하라고 알려줄 뿐입니다.

   ```yaml
   name: Deploy to Pages
   on:
     push:
       branches: [main]
   permissions:
     contents: read
     pages: write
     id-token: write
   jobs:
     deploy:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deploy.outputs.page_url }}
       steps:
         - uses: actions/checkout@v4
         - uses: actions/configure-pages@v5
         - uses: actions/upload-pages-artifact@v3
           with:
             path: web
         - id: deploy
           uses: actions/deploy-pages@v4
   ```

5. 1분 정도 기다리세요. GitHub가 **Pages** 설정 페이지에 주소를 보여줄 것입니다.
   `https://<your-name>.github.io/<repo>/`와 비슷한 형태입니다. 이것이 실제로
   작동하는 libre 사이트 주소입니다. 이 링크를 공유하세요.

이 주소는 `https://`로 시작하는데, 이는 로그인/키 관련 기능이 동작하는 데 꼭 필요한
조건입니다. 따로 빌드하거나 설정할 것은 없습니다.

**이 링크 하나에만 의존하지 마세요.** GitHub도 차단되거나 페이지가 내려갈 수
있습니다. 가능하다면 위 목록에 있는 다른 방법(IPFS, 다른 정적 호스팅, 또는 `.onion`
주소) 중 하나에도 사이트를 함께 올려두고, 다음 섹션을 읽어서 필요할 때 언제든 내
컴퓨터에서 직접 실행하는 방법으로 되돌아갈 수 있도록 준비해 두세요.

### 웹사이트가 차단되면: 내 컴퓨터에서 직접 libre 실행하기

웹사이트가 차단되어도 libre 자체가 사라지는 것은 아닙니다. 이 앱은 그냥 파일 몇
개로 이루어져 있을 뿐입니다. 사본을 하나 가지고 있다면 언제든 내 컴퓨터에서 열 수
있고, 웹사이트 없이도 릴레이에 그대로 연결되어 계속 작동합니다.

**필요해지기 전에 미리 사본을 준비해 두세요.** 이 프로젝트를 빌드하면 나오는 단일
파일 `index.html`(그 자체로 완결된 파일입니다)을 기술을 아는 사람에게 부탁해서
받거나, GitHub에서 프로젝트 전체를 ZIP으로 내려받으세요. USB 메모리 같은 안전한
곳에 저장해 두세요. 그 `index.html`을 폴더에 넣어두세요. 예를 들어 바탕화면의
`libre`라는 폴더에 넣으면 됩니다.

어떤 화면에서 열고 싶은지에 따라 두 가지 방법이 있습니다.

#### A. 같은 컴퓨터에서 열기 (가장 간단)

명령어 하나만 입력하면 됩니다. `#` 뒤에 나오는 말은 설명이므로 따라 입력하지
마세요.

**Mac에서:**

1. **터미널(Terminal)** 앱을 여세요(`Cmd + Space`를 누르고 `Terminal`이라고 입력한
   다음 Enter를 누르세요).
2. 아래 줄을 복사해서 붙여넣고 Enter를 누르세요.

   ```bash
   cd ~/Desktop/libre && python3 -m http.server 8099
   ```

   (`cd ...`는 해당 폴더로 이동하는 명령이고, 나머지 부분은 내 컴퓨터 안에 아주
   작은 로컬 웹사이트를 띄우는 명령입니다.)
3. 웹 브라우저를 열고 다음 주소로 이동하세요: `http://localhost:8099`

**Windows에서:**

1. **명령 프롬프트(Command Prompt)**를 여세요(Windows 키를 누르고 `cmd`라고
   입력한 다음 Enter를 누르세요).
2. 아래 줄을 복사해서 붙여넣고 Enter를 누르세요.

   ```bat
   cd C:\libre && python -m http.server 8099
   ```

3. 웹 브라우저를 열고 다음 주소로 이동하세요: `http://localhost:8099`

컴퓨터가 `python`을 찾을 수 없다고 하면, [python.org](https://www.python.org/downloads/)에서
한 번만 설치하고(Windows에서는 설치 중 **"Add Python to PATH"**에 체크하세요) 다시
시도하세요. 파이썬(Python)은 이미 많은 컴퓨터에 설치되어 있는 작고 무료인
프로그램입니다.

파일을 더블클릭해서 열지 마세요. 그렇게 열면 브라우저가 libre가 내 키를 보호하는
데 필요한 보안 기능을 꺼버립니다. 항상 위의 `http://localhost:8099` 주소를
사용하세요.

#### B. 휴대폰이나 다른 기기에서 열기 (HTTPS 필요)

같은 Wi-Fi에 연결된 **휴대폰이나 다른 컴퓨터**에서 사이트에 접속하려면, 앞서 사용한
간단한 `localhost` 방식만으로는 부족합니다. 휴대폰은 `https://`로 시작하는
주소에서만 libre의 보안 기능을 활성화하기 때문입니다. 그래서 간단히 "자체 서명
(self-signed)" 인증서를 만들고 HTTPS 서버를 실행해야 합니다. `index.html`이 있는
폴더에서 다음을 실행하세요.

```bash
# 1. 1주일짜리 자체 서명 인증서 생성 (cert.pem과 key.pem 파일 생성)
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 7 -nodes -subj "/CN=libre"

# 2. 같은 Wi-Fi의 다른 기기에서 접속할 수 있는 HTTPS 서버 실행
npx http-server . -S -C cert.pem -K key.pem -p 8099 -a 0.0.0.0
```

그다음 내 컴퓨터의 로컬 네트워크 주소를 확인하세요.

- **Mac:** `ipconfig getifaddr en0` 명령을 실행하세요(`192.168.0.42`와 비슷한
  값이 출력됩니다).
- **Windows:** `ipconfig` 명령을 실행하고 **IPv4 Address** 줄을 확인하세요.

(같은 Wi-Fi에 연결된) 휴대폰에서 `https://<위에서 확인한 주소>:8099`를 여세요.
예를 들면 `https://192.168.0.42:8099`입니다. 인증서를 직접 만들었기 때문에
브라우저가 "신뢰할 수 없는 인증서"라는 경고를 보여줄 것입니다. 이 경고는 예상된
것이니 **고급(Advanced)**을 선택해서 사이트로 계속 진행하세요.

(`openssl`은 Mac과 Linux에 기본으로 설치되어 있습니다. `npx`는
[nodejs.org](https://nodejs.org/)에서 받을 수 있는 작고 무료인 프로그램인 `node`와
함께 설치됩니다. 명령을 찾을 수 없다면 한 번만 설치하세요.)

### 개발자용: 소스에서 다시 빌드하기

전체 프로젝트를 가지고 있고 `node`가 설치되어 있다면, 단일 파일을 직접 다시
생성해서 같은 방식으로 서빙할 수 있습니다.

```bash
./build.sh                                  # -> web/dist/index.html 생성

# 같은 컴퓨터:
python3 -m http.server 8099 --directory web/dist --bind 127.0.0.1
# 그 다음 http://127.0.0.1:8099 열기

# 휴대폰 / 다른 기기 (HTTPS, web/dist 폴더 안에서):
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 7 -nodes -subj "/CN=libre"
npx http-server web/dist -S -C cert.pem -K key.pem -p 8099 -a 0.0.0.0
```

`./build.sh`는 처음 실행할 때 빌드 도구를 설치하며 `node`와 `npm`이 필요합니다.
결과로 나오는 `web/dist/index.html`은 위 단계들에서 누구에게든 건네줄 수 있는,
그 자체로 완결된 파일입니다. 생성되는 `cert.pem` / `key.pem`은 임시로만 쓰이는
로컬 파일이며 이미 git에서 무시되도록 설정되어 있어 커밋되지 않습니다.

## 3. Run a relay

검열하는 국가 **밖의** VPS에서:

```bash
cd relay
# 1. point a DNS A record at the VPS
# 2. set your hostname in Caddyfile and (optionally) info fields in strfry.conf
docker compose up -d
```

- `strfry`는 이벤트를 저장하고, `Caddy`는 자동 HTTPS를 제공해 클라이언트가 `wss://`를
  사용할 수 있게 합니다.
- 확인: `wss://your-domain`이 Nostr 클라이언트에 응답해야 합니다.
- libre → **relays**에 URL을 추가하고, 다른 사람들도 추가할 수 있도록 공개하세요.

서로 다른 운영자가 여러 관할권에서 릴레이를 운영하게 하세요. 회복력은 어느 한 릴레이가
아니라 이러한 다양성에서 나옵니다.

### Vetting a relay before recommending it

도달 가능한 것만으로는 충분하지 않습니다. 클라이언트는 릴레이마다 하나의 WebSocket
연결 위에서 모든 쿼리를 멀티플렉싱하므로, **동시 구독**을 제대로 처리하지 못하는
릴레이(첫 REQ에만 응답하고 나머지는 조용히 무시하는 경우)는 앱의 모든 쿼리를 풀 타임아웃
전체까지 지연시킵니다. 그러면 릴레이는 겉으로는 완전히 "정상"으로 보이면서도 클라이언트
전체를 느리게 만듭니다. 아래 명령 하나로 전부 확인할 수 있습니다.

```bash
node scripts/relay-check.mjs                      # check the current defaults
node scripts/relay-check.mjs wss://candidate.example   # vet a candidate
```

릴레이는 `DEFAULT_RELAYS`(`web/src/nostr/relays.js`)에 들어가기 전에 네 항목
(connect, EOSE, open writes, 12/12 concurrent subs) 모두에서 PASS를 받아야 합니다.
이 점검은 ephemeral kind 이벤트만 발행하며, 릴레이는 이를 확인은 하지만 저장하지는
않습니다.

## 4. Native wrappers (optional)

- **PWA**: 이미 설정되어 있습니다(`manifest.webmanifest` + `sw.js`). 사용자는 "홈 화면에
  추가"를 사용할 수 있습니다.
- **Android APK / F-Droid**: PWA를 (예: Trusted Web Activity / Capacitor로) 감싸서
  APK를 Google Play뿐 아니라 직접 배포와 F-Droid를 통해서도 배포하세요.

## Notes

- 유일한 빌드 단계는 `nostr-tools` 번들링이며, 결과물이 커밋되어 있으므로 배포 시점에는
  npm이 전혀 필요 없습니다.
- 외부 호스트(CDN, 폰트, 분석 도구)에 대한 런타임 의존성을 절대 추가하지 마세요. 이는
  병목 지점이 되어 정적 파일이라는 불변 조건을 깨뜨립니다(`CLAUDE.md` 참고).
