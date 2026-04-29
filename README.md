# Periyodik Tablo — Bileşik Analiz

## Klasör Yapısı

```
periyodik-tablo/
├── api/
│   └── analyze.js        ← Serverless API (API key burada gizli)
├── public/
│   └── index.html        ← Frontend
├── vercel.json           ← Yönlendirme kuralları
└── README.md
```

## Deploy Adımları (Vercel)

### 1. GitHub'a yükle
```bash
cd periyodik-tablo
git init
git add .
git commit -m "ilk commit"
# GitHub'da yeni repo oluştur, sonra:
git remote add origin https://github.com/KULLANICI/periyodik-tablo.git
git push -u origin main
```

### 2. Vercel'e bağla
1. https://vercel.com adresine git
2. "New Project" → GitHub repoyu seç
3. Deploy et (ayar gerekmez, vercel.json otomatik algılar)

### 3. API Key'i ekle
1. Vercel Dashboard → Projen → Settings → Environment Variables
2. Yeni değişken ekle:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (Anthropic Console'dan al)
   - Environment: Production, Preview, Development hepsini seç
3. Kaydet → Redeploy et

### 4. Test et
Deploy sonrası verilen URL'yi aç, element seç, analiz et!

## Lokal Geliştirme

```bash
npm i -g vercel
vercel dev
```

`.env.local` dosyası oluştur:
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Notlar
- API key hiçbir zaman frontend'e gitmez, sadece sunucuda çalışır
- Rate limiting eklemek istersen `api/analyze.js`'e Vercel KV ile basit counter eklenebilir
