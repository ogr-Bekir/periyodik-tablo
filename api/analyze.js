export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { formula } = req.body;

  if (!formula || typeof formula !== 'string' || formula.trim().length === 0) {
    return res.status(400).json({ error: 'Geçersiz formül' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Sunucu yapılandırma hatası: GROQ_API_KEY eksik' });
  }

  const prompt = `Sen kapsamlı bir kimya uzmanısın. Kullanıcı şu element kombinasyonunu girdi: ${formula}

Bu kombinasyondan oluşabilecek TÜM olası bileşikleri analiz et. Hem organik hem inorganik bileşikleri dahil et.

Şu başlıkları kullan ve Türkçe yaz:

**Olası Bileşikler:**
Her bileşik için:
- Kimyasal formül ve IUPAC adı
- Bağ türü: iyonik / kovalent / polar kovalent / metalik / koordinasyon
- Fiziksel özellikler: hal, renk, erime/kaynama noktası
- Kullanım alanları

**Organik Bileşikler (varsa):**
- Fonksiyonel gruplar, organik sınıf (alkan, alken, alkol, asit vb.)
- Endüstriyel veya biyolojik önemi

**Anot ve Katot Reaksiyonları (varsa):**
- Elektroliz reaksiyonları
- Anotta yükseltgenme, katotta indirgenme

**İzotoplar:**
- Her elementin önemli izotopları, kararlı/radyoaktif durumu

**Bağ ve Yapı Özeti:**
- Lewis yapısı veya bağ açıklaması
- Molekül geometrisi, polarite

Bilimsel ama anlaşılır yaz. her bileşiğin yanına o bileşiğin görselini PubChem den veya vikipediadan ve bileşiğin bağlarını temseil etmek için iyonik veya kovalent veya organik elementse ona göre IUPAC sembolik gösterimlerini de ekle. Türkçe.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Groq API error:', err);
      return res.status(502).json({ error: 'Yapay zeka servisine ulaşılamadı' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ result: text });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
}

