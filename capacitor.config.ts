import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nongsadama.myapp',
  appName: 'NongsaDaMa',
  loggingBehavior: 'none',
  webDir: 'dist',
  plugins: {
    // 디자인 v5: 머리줄·아래 탭이 늘 흰색이다. 기본값(DEFAULT)은 기기 테마를 따라서 어두운 모드 폰에서
    // 흰 머리줄 위에 흰 상태 표시줄 아이콘이 나온다 → LIGHT(밝은 바탕 + 어두운 아이콘)로 고정한다.
    // LIGHT는 android/app/src/main/res/values*/styles.xml 의 밝은 네이티브 테마(AppTheme.NoActionBar: Light 부모 +
    // 흰 상태·아래 탭 줄 + windowLight*Bar)에 기댄다. Android 14 이하와, WebView 140 미만인 Android 15+ 에서는
    // 시스템 줄을 네이티브가 그리므로 그 테마를 어두운 테마(DayNight 등)로 되돌리면 어두운 모드에서 아이콘이 안 보인다.
    // insetsHandling은 기본값 'css'(--safe-area-inset-* 주입, src/index.css --safe-top/--safe-bottom) 그대로.
    SystemBars: {
      style: 'LIGHT',
    },
  },
};

export default config;
