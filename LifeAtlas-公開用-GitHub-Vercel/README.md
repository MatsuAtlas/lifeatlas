# Life Atlas｜GitHub・Vercel直接連携用

このフォルダは、Life AtlasをGitHubへ登録し、Vercelで公開するために必要なファイルだけをまとめたものです。

## 使い方

このフォルダを開き、中にあるファイルとフォルダを、GitHubリポジトリの一番上へ登録してください。

GitHub側で一度登録した後、Vercelでそのリポジトリを選んで接続します。接続後は、GitHubの`main`（本番用の保存場所）に変更が反映されるたび、Vercelが自動でサイトを更新します。

## Vercelの設定

- Root Directory（読み込む場所）：空欄
- Install Command（必要な部品の準備）：自動設定
- Build Command（公開用ファイルの作成）：`npm run build`
- Output Directory（出力先）：自動設定
- Environment Variables（秘密の設定値）：MVPでは不要

## 含まれているもの

- `app`：Life Atlasの画面とデータ更新機能
- `public`：アイコン
- `build`、`worker`：公開時に必要な補助設定
- `package.json`、`package-lock.json`：起動と使用部品の設定
- `vite.config.ts`、`next.config.ts`など：公開サービス用の設定

個人情報、パスワード、APIキー、`.env`ファイル、`node_modules`、ビルド途中のファイルは含めていません。

## 注意

このアプリの税金・保険料・生活費は、都市比較のための試算です。実際の給与明細や税務申告の代わりにはなりません。
