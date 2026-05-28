# WordForge

英単語学習サイト。JSONデータを読み込んで、単語・意味・例文を確認できます。

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
npm run preview
```

## データ配置

JSONは `public/data` 配下に置きます。

## GitHub Pages公開

1. GitHub の `Settings > Pages` で `Build and deployment` の `Source` を `GitHub Actions` に設定
2. `main` へpushすると `.github/workflows/deploy.yml` で自動デプロイ
