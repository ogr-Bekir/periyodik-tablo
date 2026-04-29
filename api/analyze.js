export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { elements } = req.body;

  if (!elements || !Array.isArray(elements) || elements.length === 0) {
    return res.status(400).json({ error: 'Geçersiz element listesi' });
  }

  if (elements.length > 5) {
    return res.status(400).json({ error: 'En fazla 5 element gönderilebilir' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Sunucu yapılandırma hatası' });
  }

  const prompt = `Sen bir kimya uzmanısın. Kullanıcı şu elementleri seçti: ${elements.join(', ')}.

Bu elementlerden oluşabilecek bileşikleri ve izotopları Türkçe olarak açıkla. Şu formatta yaz:

**Olası Bileşikler:**
Her bileşik için: kimyasal formül, tam adı, bağ türü (iyonik/kovalent/polar kovalent), temel fiziksel özellikleri (renk, hal, erime noktası varsa), kullanım alanları.

**Önemli İzotoplar:**
Her element için en önemli 1-2 izotop: sembol, kütle numarası, kararlı mı / radyoaktif mi, varsa özel kullanımı.

**Bağ Yapısı:**
Seçilen elementlerin elektron konfigürasyonu özeti ve nasıl bağ kurduklarına dair kısa açıklama.

Bilimsel ama anlaşılır bir dil kullan. Türkçe yaz.`;

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
        max_tokens: 1200,
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
