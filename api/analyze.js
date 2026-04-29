export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { formula } = req.body;

  if (!formula || typeof formula !== 'string' || formula.trim().length === 0) {
    return res.status(400).json({ error: 'Geçersiz formül' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Sunucu yapılandırma hatası' });
  }

  const prompt = `Sen kapsamlı bir kimya uzmanısın. Kullanıcı şu element kombinasyonunu girdi: ${formula}

Bu kombinasyondan oluşabilecek TÜM olası bileşikleri analiz et. Hem organik hem inorganik bileşikleri dahil et.

Şu başlıkları kullan ve Türkçe yaz:

**Olası Bileşikler:**
Her bileşik için ayrı satırda:
- Kimyasal formül ve IUPAC adı
- Bağ türü: iyonik / kovalent / polar kovalent / metalik / koordinasyon
- Fiziksel özellikler: hal (katı/sıvı/gaz), renk, erime/kaynama noktası
- Kullanım alanları ve önemi

**Organik Bileşikler (varsa):**
- Fonksiyonel gruplar
- Homolog seri / organik sınıf (alkan, alken, alkol, asit vb.)
- Endüstriyel / biyolojik önemi

**Anot ve Katot Reaksiyonları (varsa):**
- Elektroliz reaksiyonları
- Anotta yükseltgenme: ...
- Katotta indirgenme: ...

**İzotoplar:**
- Her elementin önemli izotopları, kararlı/radyoaktif durumu, özel kullanımları

**Bağ ve Yapı Özeti:**
- Lewis yapısı veya bağ açıklaması
- Geometri (varsa: doğrusal, açısal, tetrahedral vb.)
- Elektronegatiflik farkı ve polarite

Bilimsel, kapsamlı ama anlaşılır yaz. Türkçe.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'Yapay zeka servisine ulaşılamadı' });
    }

    const data = await response.json();
    const text = data.content.map((i) => i.text || '').join('\n');

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ result: text });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Sunucu hatası oluştu' });
  }
}
