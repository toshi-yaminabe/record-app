# Flutter Android APK ビルド修正手順

## 問題
GitHub ActionsでFlutterアプリのビルドが失敗している。

## 修正手順

### Step 1: pubspec.yaml SDK制約を緩和

ファイル: `flutter_app/pubspec.yaml`

```yaml
# 変更前
environment:
  sdk: ^3.10.7

# 変更後
environment:
  sdk: '>=3.10.0 <4.0.0'
```

### Step 2: GitHub Actions ワークフロー更新

ファイル: `.github/workflows/build-apk.yml`

```yaml
# 変更前
- name: Setup Flutter
  uses: subosito/flutter-action@v2
  with:
    flutter-version: '3.38.9'
    channel: 'stable'

# 変更後
- name: Setup Flutter
  uses: subosito/flutter-action@v2
  with:
    channel: 'stable'
    cache: true
```

### Step 3: (フォールバック) まだ失敗する場合

ファイル: `flutter_app/lib/presentation/pages/home/home_page.dart`

- Line 85: `.withValues(alpha: 0.4)` → `.withOpacity(0.4)`
- Line 125: `surfaceContainerHighest` → `surfaceVariant`

## 検証

1. コミット・プッシュ
2. GitHub Actions確認
3. Releases からAPKダウンロード
